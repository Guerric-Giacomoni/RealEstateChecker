import type { Lycee } from "./types";

/**
 * Lycées (général & technologique) + bac results for a commune, from the
 * Ministère de l'Éducation OpenDataSoft Explore API v2.1 (public, keyless).
 * `annee` is a date field, so we fetch every year for the commune ordered by
 * year desc and keep the most recent row per établissement (UAI) — this stays
 * correct as new years are published, without hardcoding one.
 */
const BASE = "https://data.education.gouv.fr/api/explore/v2.1";
const DATASET = "fr-en-indicateurs-de-resultat-des-lycees-gt_v2";
const ANNUAIRE = "fr-en-annuaire-education"; // address + coordinates, keyed by UAI

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** "LYCEE ARCISSE DE CAUMONT (GENERAL ET TECHNO.)" → "Lycée Arcisse de Caumont" */
function cleanName(raw: unknown): string {
  const s = String(raw ?? "")
    .replace(/\s*\((?:general|général)[^)]*\)\s*$/i, "")
    .trim()
    .toLowerCase();
  const small = new Set(["de", "du", "des", "la", "le", "les", "et", "sur", "sous"]);
  return s
    .split(/\s+/)
    .map((w, i) =>
      i > 0 && small.has(w) ? w : w.replace(/^([a-zà-ÿ])/, (c) => c.toUpperCase()),
    )
    .join(" ")
    .replace(/(^|\s)lycee\b/i, (m) => m.replace(/lycee/i, "Lycée"));
}

export async function fetchLycees(codeInsee: string): Promise<Lycee[]> {
  const url = new URL(`${BASE}/catalog/datasets/${DATASET}/records`);
  url.searchParams.set("where", `code_commune='${codeInsee}'`);
  url.searchParams.set("order_by", "annee desc");
  url.searchParams.set("limit", "100");

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`education ${res.status}`);
  const data = (await res.json()) as { results?: Record<string, unknown>[] };

  const seen = new Set<string>();
  const lycees: Lycee[] = [];
  for (const r of data.results ?? []) {
    const uai = String(r.uai ?? "");
    if (!uai || seen.has(uai)) continue; // keep only the latest year per school
    seen.add(uai);
    lycees.push({
      uai,
      name: cleanName(r.libelle_uai),
      sector: String(r.secteur ?? ""),
      passRate: num(r.taux_reu_total),
      mentionRate: num(r.taux_men_total),
      candidates: num(r.presents_total),
      addedValue: num(r.va_reu_total),
      year: Number(String(r.annee ?? "").slice(0, 4)) || 0,
      address: null,
      lat: null,
      lon: null,
    });
  }

  await enrichWithAnnuaire(lycees);

  // Best réussite first, then biggest cohorts.
  return lycees.sort(
    (a, b) => (b.passRate ?? 0) - (a.passRate ?? 0) || (b.candidates ?? 0) - (a.candidates ?? 0),
  );
}

/** Add address + coordinates to each lycée from the education annuaire (one
 *  batch request, joined by UAI). Best-effort — leaves fields null on failure. */
async function enrichWithAnnuaire(lycees: Lycee[]): Promise<void> {
  if (lycees.length === 0) return;
  const inList = lycees.map((l) => `'${l.uai}'`).join(",");
  const url = new URL(`${BASE}/catalog/datasets/${ANNUAIRE}/records`);
  url.searchParams.set("where", `identifiant_de_l_etablissement in (${inList})`);
  url.searchParams.set(
    "select",
    "identifiant_de_l_etablissement,adresse_1,code_postal,nom_commune,latitude,longitude",
  );
  url.searchParams.set("limit", "100");
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return;
    const rows = ((await res.json()) as { results?: Record<string, unknown>[] }).results ?? [];
    const byUai = new Map(rows.map((r) => [String(r.identifiant_de_l_etablissement), r]));
    for (const l of lycees) {
      const r = byUai.get(l.uai);
      if (!r) continue;
      const cp = [r.code_postal, r.nom_commune].filter(Boolean).join(" ").trim();
      l.address = [r.adresse_1, cp].filter(Boolean).join(", ") || null;
      l.lat = num(r.latitude);
      l.lon = num(r.longitude);
    }
  } catch {
    /* keep addresses null */
  }
}

/* --- in-memory cache (yearly data) ---------------------------------------- */

const cache = new Map<string, { at: number; data: Lycee[] }>();
const TTL = 24 * 60 * 60 * 1000;

export async function getLycees(codeInsee: string): Promise<Lycee[]> {
  const hit = cache.get(codeInsee);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const data = await fetchLycees(codeInsee);
  cache.set(codeInsee, { at: Date.now(), data });
  return data;
}
