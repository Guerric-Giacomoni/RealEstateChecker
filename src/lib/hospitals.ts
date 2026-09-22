import { createClient, type Client } from "@libsql/client";
import type { Hospital } from "./types";

/**
 * Health establishments (FINESS) around a point, from the hosted Turso
 * `hospitals` table (loaded by scripts/load-hospitals.mjs). FINESS lists every
 * établissement with a category *code*; we keep only the hospital/clinic
 * categories here and give them a readable label — tune the map freely, no
 * reload needed.
 */
let client: Client | null = null;
function getClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL is not set");
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return client;
}

/** FINESS category code → friendly label (hospitals & clinics only). */
const CATEGORIES: Record<string, string> = {
  "101": "CHR / CHU",
  "355": "Centre hospitalier",
  "365": "Centre hospitalier (ex-hôpital local)",
  "292": "Centre hospitalier spécialisé (psychiatrie)",
  "106": "Établissement de santé",
  "109": "Soins de suite / réadaptation",
  "131": "Centre de lutte contre le cancer",
  "114": "Hôpital d'instruction des armées",
  "122": "Clinique",
  "128": "Clinique",
  "129": "Hôpital / clinique privé(e)",
  "130": "Clinique",
  "411": "Établissement de soins chirurgicaux",
  "412": "Établissement de soins médicaux",
  "413": "Polyclinique",
  "414": "Établissement de soins chirurgico-obstétrical",
  "430": "Clinique",
};
const CAT_CODES = Object.keys(CATEGORIES);

/** "CENTRE HOSPITALIER - AUNAY-BAYEUX" → "Centre Hospitalier - Aunay-Bayeux" */
function titleCase(s: string): string {
  const small = new Set(["de", "du", "des", "la", "le", "les", "et", "sur", "aux", "en", "d"]);
  return s
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((w, i) =>
      /^\s+$/.test(w) || w === "-" || (i > 0 && small.has(w))
        ? w
        : w.replace(/^([a-zà-ÿ])/, (c) => c.toUpperCase()),
    )
    .join("");
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function queryHospitals(
  lat: number,
  lon: number,
  radiusKm: number,
  limit = 40,
): Promise<Hospital[]> {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  const placeholders = CAT_CODES.map(() => "?").join(",");
  const rs = await getClient().execute({
    sql: `select finess, name, cat, city, lat, lon from hospitals
          where cat in (${placeholders})
            and lat between ? and ? and lon between ? and ?`,
    args: [...CAT_CODES, lat - dLat, lat + dLat, lon - dLon, lon + dLon],
  });

  return rs.rows
    .map((r) => {
      const hLat = Number(r.lat);
      const hLon = Number(r.lon);
      return {
        finess: String(r.finess),
        name: titleCase(String(r.name)),
        category: CATEGORIES[String(r.cat)] ?? "Établissement de santé",
        city: r.city == null ? null : titleCase(String(r.city)),
        lat: hLat,
        lon: hLon,
        distance: haversineKm(lat, lon, hLat, hLon),
      };
    })
    .filter((h) => h.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}
