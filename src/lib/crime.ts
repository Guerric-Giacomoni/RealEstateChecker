import type { CrimeStats } from "./types";

/**
 * Délinquance — SSMSI "bases communale/départementale" via the data.gouv
 * tabular API (public, keyless). Rates are `taux_pour_mille` (faits pour 1 000
 * habitants). Small communal counts are suppressed (`est_diffuse = "ndiff"`,
 * value null) with a smoothed figure in `complement_info_taux`.
 *
 *  - A (communal)   keyed by CODGEO_2026 (INSEE code)
 *  - B (départemental) keyed by Code_departement — also used to build a France
 *    aggregate (Σ faits ÷ Σ population × 1000 over all departments).
 */
const TAB = "https://tabular-api.data.gouv.fr/api/resources";
const A = "44ef4323-1097-48d5-8719-3c544b55d294"; // communal base
const B = "2b27a675-e3bf-41ef-a852-5fb9ab483967"; // departmental base

/** Buyer-facing categories → SSMSI `indicateur` labels. */
const CATEGORIES: { label: string; indicators: string[] }[] = [
  { label: "Cambriolages", indicators: ["Cambriolages de logement"] },
  { label: "Vols sans violence", indicators: ["Vols sans violence contre des personnes"] },
  {
    label: "Violences physiques",
    indicators: [
      "Violences physiques intrafamiliales",
      "Violences physiques hors cadre familial",
    ],
  },
  { label: "Vols de véhicules", indicators: ["Vols de véhicule", "Vols dans les véhicules"] },
  { label: "Dégradations", indicators: ["Destructions et dégradations volontaires"] },
  { label: "Stupéfiants", indicators: ["Trafic de stupéfiants", "Usage de stupéfiants"] },
];
const ALL_INDICATORS = [...new Set(CATEGORIES.flatMap((c) => c.indicators))];

type ARow = {
  CODGEO_2026?: string;
  annee?: number;
  indicateur?: string;
  taux_pour_mille?: number | null;
  complement_info_taux?: number | null;
};
type BRow = {
  Code_departement?: string;
  annee?: number;
  indicateur?: string;
  nombre?: number | null;
  taux_pour_mille?: number | null;
  insee_pop?: number | null;
};

async function fetchRows<T>(url: string): Promise<T[]> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`tabular ${res.status}`);
  const j = (await res.json()) as unknown;
  return (Array.isArray(j) ? j : ((j as { data?: T[] }).data ?? [])) as T[];
}

/** Département code from an INSEE commune code (Corsica 2A/2B, DOM 97x). */
function deptOf(code: string): string {
  if (/^97/.test(code)) return code.slice(0, 3);
  return code.slice(0, 2).toUpperCase();
}

/** indicateur → (year → rate) */
type RateMap = Map<string, Map<number, number>>;
function put(m: RateMap, ind: string, year: number, rate: number) {
  let y = m.get(ind);
  if (!y) m.set(ind, (y = new Map()));
  y.set(year, rate);
}
function rate(m: RateMap, ind: string, year: number): number {
  return m.get(ind)?.get(year) ?? 0;
}
const sumInds = (m: RateMap, inds: string[], year: number) =>
  inds.reduce((s, ind) => s + rate(m, ind, year), 0);
const r1 = (n: number) => Math.round(n * 10) / 10;

/* --- departmental base + France aggregate (cached; ~18k rows) ------------- */

type Base = { at: number; dept: Map<string, RateMap>; france: RateMap };
let baseCache: Base | null = null;
const TTL = 24 * 60 * 60 * 1000;

async function loadBase(): Promise<Base> {
  if (baseCache && Date.now() - baseCache.at < TTL) return baseCache;
  const rows = await fetchRows<BRow>(`${TAB}/${B}/data/json/`);

  const dept = new Map<string, RateMap>();
  // indicateur → year → { n, pop } to aggregate a national rate.
  const agg = new Map<string, Map<number, { n: number; pop: number }>>();

  for (const row of rows) {
    const { Code_departement: d, indicateur: ind, annee: y } = row;
    if (!d || !ind || y == null) continue;
    if (row.taux_pour_mille != null) {
      let rm = dept.get(d);
      if (!rm) dept.set(d, (rm = new Map()));
      put(rm, ind, y, row.taux_pour_mille);
    }
    if (row.nombre != null && row.insee_pop) {
      let ym = agg.get(ind);
      if (!ym) agg.set(ind, (ym = new Map()));
      const cur = ym.get(y) ?? { n: 0, pop: 0 };
      cur.n += row.nombre;
      cur.pop += row.insee_pop;
      ym.set(y, cur);
    }
  }

  const france: RateMap = new Map();
  for (const [ind, ym] of agg)
    for (const [y, { n, pop }] of ym) put(france, ind, y, pop ? (n / pop) * 1000 : 0);

  return (baseCache = { at: Date.now(), dept, france });
}

/** Full delinquency summary for a commune. */
export async function fetchCrime(code: string): Promise<CrimeStats | null> {
  const [aRows, base] = await Promise.all([
    fetchRows<ARow>(`${TAB}/${A}/data/json/?CODGEO_2026__exact=${code}`),
    loadBase(),
  ]);
  if (aRows.length === 0) return null;

  const communeRates: RateMap = new Map();
  const years = new Set<number>();
  for (const row of aRows) {
    if (!row.indicateur || row.annee == null) continue;
    const t = row.taux_pour_mille ?? row.complement_info_taux;
    if (t == null) continue;
    put(communeRates, row.indicateur, row.annee, t);
    years.add(row.annee);
  }
  if (years.size === 0) return null;

  const deptRates = base.dept.get(deptOf(code)) ?? new Map();
  const sorted = [...years].sort((a, b) => a - b);
  const latest = sorted[sorted.length - 1];
  const prev = latest - 1;

  const categories = CATEGORIES.map((c) => {
    const value = sumInds(communeRates, c.indicators, latest);
    const before = sumInds(communeRates, c.indicators, prev);
    return {
      label: c.label,
      value: r1(value),
      dept: r1(sumInds(deptRates, c.indicators, latest)),
      france: r1(sumInds(base.france, c.indicators, latest)),
      trend: before ? r1((value / before - 1) * 100) : 0,
    };
  });

  return {
    year: latest,
    index: {
      commune: r1(sumInds(communeRates, ALL_INDICATORS, latest)),
      dept: r1(sumInds(deptRates, ALL_INDICATORS, latest)),
      france: r1(sumInds(base.france, ALL_INDICATORS, latest)),
    },
    history: sorted.map((y) => ({
      label: String(y),
      value: r1(sumInds(communeRates, ALL_INDICATORS, y)),
    })),
    categories,
  };
}

/* --- per-commune cache ---------------------------------------------------- */

const cache = new Map<string, { at: number; data: CrimeStats | null }>();

export async function getCrime(code: string): Promise<CrimeStats | null> {
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const data = await fetchCrime(code);
  cache.set(code, { at: Date.now(), data });
  return data;
}
