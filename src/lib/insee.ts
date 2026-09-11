import type { MarketStats } from "./types";

/**
 * INSEE Melodi — public, keyless (30 req/min). We query commune-level datasets
 * by INSEE code and derive the figures the UI shows. Base:
 *   https://api.insee.fr/melodi/data/{DATASET}?GEO=COM-{code}&...
 */
const MELODI = "https://api.insee.fr/melodi/data";

type Obs = { time: number; value: number; dims: Record<string, string> };

/** Fetch one Melodi dataset and flatten to observations (value + dimensions). */
async function melodi(dataset: string, params: Record<string, string>): Promise<Obs[]> {
  const url = new URL(`${MELODI}/${dataset}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`INSEE ${res.status} for ${dataset}`);
  const json = await res.json();
  return (json.observations ?? [])
    .map((o: { dimensions?: Record<string, string>; measures?: Record<string, { value?: number }> }) => ({
      time: Number(o.dimensions?.TIME_PERIOD),
      value: o.measures?.OBS_VALUE_NIVEAU?.value ?? o.measures?.OBS_VALUE?.value ?? null,
      dims: o.dimensions ?? {},
    }))
    .filter((o: Obs) => o.value != null && Number.isFinite(o.time));
}

const round1 = (n: number) => Number(n.toFixed(1));

/** Latest year's observations from a set. */
function latestObs(obs: Obs[]): { year: number | null; rows: Obs[] } {
  if (!obs.length) return { year: null, rows: [] };
  const year = Math.max(...obs.map((o) => o.time));
  return { year, rows: obs.filter((o) => o.time === year) };
}
const pickBy = (rows: Obs[], dim: string, code: string) =>
  rows.find((o) => o.dims[dim] === code)?.value ?? null;

// INSEE's non-overlapping age bands for DS_RP_POPULATION_PRINC (they partition
// the total). Codes are stable; labels are ours.
const AGE_BANDS: [code: string, label: string][] = [
  ["Y_LT15", "0–14"],
  ["Y15T24", "15–24"],
  ["Y25T39", "25–39"],
  ["Y40T54", "40–54"],
  ["Y55T64", "55–64"],
  ["Y65T79", "65–79"],
  ["Y_GE80", "80+"],
];

/** Population history + median income (vs France) for a commune. */
export async function fetchMarketStats(code: string): Promise<MarketStats> {
  const [pop, incomeCom, incomeFr, emp, housing, age] = await Promise.all([
    melodi("DS_POPULATIONS_HISTORIQUES", { GEO: `COM-${code}`, POPREF_MEASURE: "PMUN" }),
    melodi("DS_FILOSOFI_CC", { GEO: `COM-${code}`, FILOSOFI_MEASURE: "MED_SL" }),
    melodi("DS_FILOSOFI_CC", { GEO: "FRANCE", FILOSOFI_MEASURE: "MED_SL" }),
    // Census unemployment: unemployed (EMPSTA_ENQ=2) / active pop (1T2), 15–64.
    melodi("DS_RP_EMPLOI_LR_PRINC", { GEO: `COM-${code}`, SEX: "_T", EDUC: "_T", AGE: "Y15T64" }),
    // Housing vacancy: vacant / all dwellings, all other dimensions totalled.
    melodi("DS_RP_LOGEMENT_PRINC", {
      GEO: `COM-${code}`,
      RP_MEASURE: "DWELLINGS",
      CARS: "_T", BUILD_END: "_T", NRG_SRC: "_T", TDW: "_T", TSH: "_T", CARPARK: "_T", NOR: "_T", L_STAY: "_T",
    }),
    // Age distribution (total sexes).
    melodi("DS_RP_POPULATION_PRINC", { GEO: `COM-${code}`, SEX: "_T" }),
  ]);

  const byYear = new Map(pop.map((o) => [o.time, o.value]));
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const latestYear = years[years.length - 1];
  const latest = byYear.get(latestYear) ?? 0;
  const change = (fromYear: number) => {
    const from = byYear.get(fromYear);
    return from ? round1((latest / from - 1) * 100) : null;
  };

  const last = (obs: Obs[]) => obs.sort((a, b) => a.time - b.time).at(-1) ?? null;
  const inc = last(incomeCom);
  const incFr = last(incomeFr);
  const median = inc?.value ?? null;
  const france = incFr?.value ?? null;

  const empL = latestObs(emp);
  const unemployed = pickBy(empL.rows, "EMPSTA_ENQ", "2");
  const active = pickBy(empL.rows, "EMPSTA_ENQ", "1T2");
  const unemploymentRate = unemployed && active ? round1((unemployed / active) * 100) : null;

  const houseL = latestObs(housing);
  const vacant = pickBy(houseL.rows, "OCS", "DW_VAC");
  const totalDw = pickBy(houseL.rows, "OCS", "_T");
  const vacancyRate = vacant && totalDw ? round1((vacant / totalDw) * 100) : null;

  const ageL = latestObs(age);
  const ageTotal = pickBy(ageL.rows, "AGE", "_T");
  const ageBands = ageTotal
    ? AGE_BANDS.flatMap(([c, label]) => {
        const v = pickBy(ageL.rows, "AGE", c);
        return v != null ? [{ label, share: round1((v / ageTotal) * 100) }] : [];
      })
    : [];

  return {
    codeInsee: code,
    population: {
      latest,
      year: latestYear,
      change5y: change(latestYear - 5),
      change10y: change(latestYear - 10),
      history: years.slice(-12).map((y) => ({ label: String(y), value: byYear.get(y) as number })),
    },
    income: {
      median,
      year: inc?.time ?? null,
      france,
      vsFrancePct: median && france ? round1((median / france - 1) * 100) : null,
    },
    unemployment: { rate: unemploymentRate, year: empL.year },
    housing: { vacancyRate, year: houseL.year },
    ageBands,
  };
}

/* --- tiny in-memory cache (INSEE data changes ~yearly) --------------------- */

const cache = new Map<string, { at: number; stats: MarketStats }>();
const TTL = 24 * 60 * 60 * 1000;

export async function getMarketStats(code: string): Promise<MarketStats> {
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < TTL) return hit.stats;
  const stats = await fetchMarketStats(code);
  cache.set(code, { at: Date.now(), stats });
  return stats;
}
