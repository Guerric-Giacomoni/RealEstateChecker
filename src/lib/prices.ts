import { createClient, type Client } from "@libsql/client";
import type { PriceHistory } from "./types";

/**
 * Yearly commune price indicators (average €/m² 2015–2024) from the hosted
 * Turso `commune_prices` table. Keyed by INSEE commune code — Paris/Lyon/
 * Marseille are whole-commune here (75056, 69123, 13055), matching INSEE stats.
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

export async function queryPriceHistory(code: string): Promise<PriceHistory | null> {
  const rs = await getClient().execute({
    sql: `select year, price_m2, n_mutations from commune_prices
          where code_insee = ? order by year`,
    args: [code.toUpperCase()],
  });
  if (rs.rows.length === 0) return null;
  const series = rs.rows.map((r) => ({
    year: Number(r.year),
    priceM2: Number(r.price_m2),
    nMutations: Number(r.n_mutations),
  }));
  return {
    codeInsee: code,
    series,
    latestVolume: series[series.length - 1]?.nMutations ?? null,
  };
}

/* --- in-memory cache (yearly data, essentially static) -------------------- */

const cache = new Map<string, { at: number; data: PriceHistory | null }>();
const TTL = 24 * 60 * 60 * 1000;

export async function getPriceHistory(code: string): Promise<PriceHistory | null> {
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const data = await queryPriceHistory(code);
  cache.set(code, { at: Date.now(), data });
  return data;
}
