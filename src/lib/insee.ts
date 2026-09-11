import type { MarketStats } from "./types";

/**
 * INSEE Melodi — public, keyless (30 req/min). We query commune-level datasets
 * by INSEE code and derive the figures the UI shows. Base:
 *   https://api.insee.fr/melodi/data/{DATASET}?GEO=COM-{code}&...
 */
const MELODI = "https://api.insee.fr/melodi/data";

type Obs = { time: number; value: number };

/** Fetch one Melodi dataset and flatten to {time, value} observations. */
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
    }))
    .filter((o: Obs) => o.value != null && Number.isFinite(o.time));
}

const round1 = (n: number) => Number(n.toFixed(1));

/** Population history + median income (vs France) for a commune. */
export async function fetchMarketStats(code: string): Promise<MarketStats> {
  const [pop, incomeCom, incomeFr] = await Promise.all([
    melodi("DS_POPULATIONS_HISTORIQUES", { GEO: `COM-${code}`, POPREF_MEASURE: "PMUN" }),
    melodi("DS_FILOSOFI_CC", { GEO: `COM-${code}`, FILOSOFI_MEASURE: "MED_SL" }),
    melodi("DS_FILOSOFI_CC", { GEO: "FRANCE", FILOSOFI_MEASURE: "MED_SL" }),
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
