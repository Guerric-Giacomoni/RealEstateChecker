import { createClient, type Client } from "@libsql/client";
import type { DvfComp, DvfRow } from "./types";

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

/* ------------------------------------------------------------------ */
/* Explorer — flexible filtered search over the whole dataset          */
/* ------------------------------------------------------------------ */

export type DvfSearchParams = {
  cp?: string;
  dept?: string;
  type?: string;
  priceMin?: number;
  priceMax?: number;
  surfaceMin?: number;
  surfaceMax?: number;
  roomsMin?: number;
  sort?: string;
  order?: string;
  page?: number;
  limit?: number;
};

const SORT_COLUMNS: Record<string, string> = {
  price: "price",
  surface: "surface",
  price_m2: "price * 1.0 / surface",
  rooms: "rooms",
  month: "month",
};

export async function searchDvf(p: DvfSearchParams): Promise<{
  rows: DvfRow[];
  total: number;
  page: number;
  limit: number;
}> {
  const where: string[] = [];
  const args: (string | number)[] = [];
  const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);

  if (p.cp && /^\d{5}$/.test(p.cp)) {
    where.push("cp = ?");
    args.push(p.cp);
  }
  if (p.dept && /^\d{1,3}[AB]?$/i.test(p.dept)) {
    where.push("cp LIKE ?");
    args.push(`${p.dept}%`);
  }
  if (p.type) {
    where.push("type = ?");
    args.push(/maison/i.test(p.type) ? "M" : "A");
  }
  const pushRange = (col: string, min: unknown, max: unknown) => {
    const lo = num(min);
    const hi = num(max);
    if (lo !== null) { where.push(`${col} >= ?`); args.push(lo); }
    if (hi !== null) { where.push(`${col} <= ?`); args.push(hi); }
  };
  pushRange("price", p.priceMin, p.priceMax);
  pushRange("surface", p.surfaceMin, p.surfaceMax);
  const roomsMin = num(p.roomsMin);
  if (roomsMin !== null) { where.push("rooms >= ?"); args.push(roomsMin); }

  const clause = where.length ? `where ${where.join(" and ")}` : "";
  const sortCol = SORT_COLUMNS[p.sort ?? "price"] ?? "price";
  const order = p.order === "asc" ? "asc" : "desc";
  const limit = Math.min(Math.max(p.limit ?? 50, 1), 200);
  const page = Math.max(p.page ?? 0, 0);

  const db = getClient();
  const [countRs, rowsRs] = await Promise.all([
    db.execute({ sql: `select count(*) as n from sales ${clause}`, args }),
    db.execute({
      sql: `select cp, ville, adresse, type, price, surface,
                   round(price * 1.0 / surface) as priceM2, rooms, month
            from sales ${clause} order by ${sortCol} ${order} limit ? offset ?`,
      args: [...args, limit, page * limit],
    }),
  ]);

  const total = Number(countRs.rows[0].n);
  const rows: DvfRow[] = rowsRs.rows.map((r) => ({
    cp: String(r.cp),
    ville: r.ville == null ? null : String(r.ville),
    adresse: r.adresse == null ? null : String(r.adresse),
    type: r.type === "M" ? "Maison" : "Appartement",
    price: Number(r.price),
    surface: Number(r.surface),
    priceM2: Number(r.priceM2),
    rooms: r.rooms == null ? null : Number(r.rooms),
    month: Number(r.month),
  }));
  return { rows, total, page, limit };
}
