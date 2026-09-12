import { createClient, type Client } from "@libsql/client";
import type { DvfComp } from "./types";

/**
 * DVF lookups against the hosted Turso database (data lives there, not in the
 * repo). One client, reused across requests.
 *
 *  - by postal code  : arrondissement-precise for Paris/Lyon/Marseille
 *  - by radius       : needs lat/lon on the rows (from the geo-dvf source) and a
 *                      subject point; more accurate than a whole postal code
 *
 * No hard cap on the comparable set — the médian/moyen stats are computed over
 * every matching sale — but a generous ceiling guards the payload.
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

const MAX_ROWS = 2000; // payload guardrail; real sectors are far smaller
const fullAddress = (adresse: unknown, ville: unknown) =>
  [adresse, ville].filter(Boolean).join(", ");

type Row = {
  price: unknown;
  surface: unknown;
  rooms: unknown;
  month: unknown;
  adresse: unknown;
  ville: unknown;
  lat: unknown;
  lon: unknown;
  price_m2: unknown;
};

function toComp(r: Row, id: string, label: string, distance: number | null = null): DvfComp {
  return {
    id,
    soldOn: `2025-${String(Number(r.month) || 1).padStart(2, "0")}-01`,
    address: fullAddress(r.adresse, r.ville),
    price: Number(r.price),
    surface: Number(r.surface),
    pricePerM2: Number(r.price_m2),
    rooms: r.rooms == null ? null : Number(r.rooms),
    type: label,
    lat: r.lat == null ? null : Number(r.lat),
    lon: r.lon == null ? null : Number(r.lon),
    distance,
  };
}

const typeCode = (t: string) => (/maison/i.test(t) ? "M" : "A");
const typeLabel = (code: string) => (code === "M" ? "Maison" : "Appartement");

/** Every comparable sale for a postal code + type (whole sector, for stats). */
export async function queryDvfComparables(
  cp: string,
  propertyType: string,
  _surface: number,
  limit = MAX_ROWS,
): Promise<DvfComp[]> {
  const type = typeCode(propertyType);
  const rs = await getClient().execute({
    sql: `select price, surface, rooms, month, adresse, ville, lat, lon,
                 round(price * 1.0 / surface) as price_m2
          from sales where cp = ? and type = ?
          order by month desc limit ?`,
    args: [cp, type, limit],
  });
  const label = typeLabel(type);
  return rs.rows.map((r, i) => toComp(r as unknown as Row, `dvf-${cp}-${i}`, label));
}

/**
 * Comparable sales within `radiusKm` of a point. Filters on a lat/lon bounding
 * box in SQL, then refines with the haversine distance in JS (SQLite has no
 * trig). Returns rows sorted by distance, with `distance` set.
 */
export async function queryDvfByRadius(
  lat: number,
  lon: number,
  propertyType: string,
  radiusKm: number,
  limit = MAX_ROWS,
): Promise<DvfComp[]> {
  const type = typeCode(propertyType);
  const dLat = radiusKm / 111; // ~111 km per degree of latitude
  const dLon = radiusKm / (111 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  const rs = await getClient().execute({
    sql: `select price, surface, rooms, month, adresse, ville, lat, lon,
                 round(price * 1.0 / surface) as price_m2
          from sales
          where type = ? and lat is not null
            and lat between ? and ? and lon between ? and ?
          limit ?`,
    args: [type, lat - dLat, lat + dLat, lon - dLon, lon + dLon, MAX_ROWS],
  });

  const label = typeLabel(type);
  return rs.rows
    .map((r) => {
      const row = r as unknown as Row;
      const d = haversineKm(lat, lon, Number(row.lat), Number(row.lon));
      return toComp(row, "", label, d);
    })
    .filter((c) => (c.distance ?? Infinity) <= radiusKm)
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
    .slice(0, limit)
    .map((c, i) => ({ ...c, id: `dvf-rad-${i}` }));
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
