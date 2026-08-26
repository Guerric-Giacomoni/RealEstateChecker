import { createClient, type Client } from "@libsql/client";
import type { DvfComp } from "./types";

/**
 * DVF lookups against the hosted Turso database (data lives there, not in the
 * repo). One client, reused across requests. Keyed on postal code, which is
 * arrondissement-precise for Paris/Lyon/Marseille (unlike commune INSEE).
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

const fullAddress = (adresse: unknown, ville: unknown) =>
  [adresse, ville].filter(Boolean).join(", ");

/** Closest recent sales to the subject (by surface) for a postal code + type. */
export async function queryDvfComparables(
  cp: string,
  propertyType: string,
  surface: number,
  limit = 25,
): Promise<DvfComp[]> {
  const type = /maison/i.test(propertyType) ? "M" : "A";
  const rs = await getClient().execute({
    sql: `select price, surface, rooms, month, adresse, ville,
                 round(price * 1.0 / surface) as price_m2
          from sales where cp = ? and type = ?
          order by abs(surface - ?) limit ?`,
    args: [cp, type, surface || 0, limit],
  });

  const label = type === "M" ? "Maison" : "Appartement";
  return rs.rows.map((r, i) => ({
    id: `dvf-${cp}-${i}`,
    soldOn: `2025-${String(Number(r.month) || 1).padStart(2, "0")}-01`,
    address: fullAddress(r.adresse, r.ville),
    price: Number(r.price),
    surface: Number(r.surface),
    pricePerM2: Number(r.price_m2),
    rooms: r.rooms == null ? null : Number(r.rooms),
    type: label,
  }));
}
