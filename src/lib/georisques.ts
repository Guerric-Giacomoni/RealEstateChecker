import type { GeoRisks } from "./types";

/**
 * Géorisques V1 — public, keyless (1000 req/min/IP). Commune-level risks come
 * from GASPAR by INSEE code; point-based hazards (clay, seismic, flood atlas)
 * need coordinates as `latlon=lon,lat` (longitude first — easy to get wrong).
 */
const G = "https://www.georisques.gouv.fr/api/v1";

async function get(path: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${G}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const isFlood = (s: unknown) => /inondation|coul[ée]e/i.test(String(s ?? ""));

/** Aggregated natural-risk summary for a commune + point. */
export async function fetchRisks(code: string, lat: number, lon: number): Promise<GeoRisks> {
  const ll = `${lon},${lat}`; // longitude,latitude
  const [risques, catnat, clay, seismic, azi] = await Promise.all([
    get(`/gaspar/risques?code_insee=${code}`),
    get(`/gaspar/catnat?code_insee=${code}&page_size=500`),
    get(`/rga?latlon=${ll}&rayon=10`),
    get(`/zonage_sismique?latlon=${ll}`),
    get(`/gaspar/azi?latlon=${ll}&rayon=1000`),
  ]);

  const risquesData = (risques?.data as { risques_detail?: { libelle_risque_long?: string }[] }[]) ?? [];
  const communeRisks = (risquesData[0]?.risques_detail ?? [])
    .map((r) => r.libelle_risque_long)
    .filter((v): v is string => Boolean(v));

  const catnatRows =
    (catnat?.data as {
      libelle_risque_jo?: string;
      date_debut_evt?: string;
      date_fin_evt?: string;
      date_publication_arrete?: string;
    }[]) ?? [];
  const counts = new Map<string, number>();
  for (const r of catnatRows) {
    const k = r.libelle_risque_jo ?? "Autre";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const byType = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // Sortable key from a DD/MM/YYYY date.
  const iso = (s: string) => {
    const [d, m, y] = (s ?? "").split("/");
    return y ? `${y}-${m}-${d}` : "";
  };
  const events = catnatRows
    .map((r) => ({
      label: r.libelle_risque_jo ?? "Autre",
      start: r.date_debut_evt ?? "",
      end: r.date_fin_evt ?? "",
      published: r.date_publication_arrete ?? "",
    }))
    .filter((e) => e.start)
    .sort((a, b) => iso(b.start).localeCompare(iso(a.start)));

  const seismicData = (seismic?.data as { zone_sismicite?: string }[]) ?? [];

  return {
    communeRisks,
    catnat: { total: catnatRows.length, byType, events },
    flood: {
      communeRisk: communeRisks.some(isFlood),
      catnatCount: catnatRows.filter((r) => isFlood(r.libelle_risque_jo)).length,
      atlasNearby: (((azi?.data as unknown[]) ?? []).length ?? 0) > 0,
    },
    clay: { level: (clay?.exposition as string) ?? null },
    seismic: { level: seismicData[0]?.zone_sismicite ?? null },
    reportUrl: `${G}/rapport_pdf?latlon=${ll}`,
  };
}

/* --- in-memory cache (risk data is essentially static) -------------------- */

const cache = new Map<string, { at: number; risks: GeoRisks }>();
const TTL = 24 * 60 * 60 * 1000;

export async function getRisks(code: string, lat: number, lon: number): Promise<GeoRisks> {
  const key = `${code}:${lat.toFixed(4)}:${lon.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.risks;
  const risks = await fetchRisks(code, lat, lon);
  cache.set(key, { at: Date.now(), risks });
  return risks;
}
