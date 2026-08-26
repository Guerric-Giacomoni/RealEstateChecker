import Database from "better-sqlite3";
import path from "node:path";
import type { DvfComp, DvfRow } from "./types";

/**
 * Server-only DVF lookups against the bundled SQLite (data/dvf-2025.sqlite).
 * One read-only connection, reused across requests. Keyed on postal code,
 * which is arrondissement-precise for Paris/Lyon/Marseille (unlike commune INSEE).
 */
let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(path.join(process.cwd(), "data", "dvf-2025.sqlite"), {
      readonly: true,
      fileMustExist: true,
    });
  }
  return db;
}

type Row = { price: number; surface: number; rooms: number | null; month: number; price_m2: number };

/** Closest recent sales to the subject (by surface) for a postal code + type. */
export function queryDvfComparables(
  cp: string,
  propertyType: string,
  surface: number,
  limit = 25,
): DvfComp[] {
  const type = /maison/i.test(propertyType) ? "M" : "A";
  const rows = getDb()
    .prepare(
      `select price, surface, rooms, month, round(price * 1.0 / surface) as price_m2
       from sales where cp = ? and type = ?
       order by abs(surface - ?) limit ?`,
    )
    .all(cp, type, surface || 0, limit) as Row[];

  const label = type === "M" ? "Maison" : "Appartement";
  return rows.map((r, i) => ({
    id: `dvf-${cp}-${i}`,
    soldOn: `2025-${String(r.month ?? 1).padStart(2, "0")}-01`,
    price: r.price,
    surface: r.surface,
    pricePerM2: r.price_m2,
    rooms: r.rooms ?? null,
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

export function searchDvf(p: DvfSearchParams): {
  rows: DvfRow[];
  total: number;
  page: number;
  limit: number;
} {
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

  const db = getDb();
  const total = (db.prepare(`select count(*) as n from sales ${clause}`).get(...args) as { n: number }).n;
  const raw = db
    .prepare(
      `select cp, type, price, surface, round(price * 1.0 / surface) as priceM2, rooms, month
       from sales ${clause} order by ${sortCol} ${order} limit ? offset ?`,
    )
    .all(...args, limit, page * limit) as Array<Omit<DvfRow, "type"> & { type: string }>;

  const rows: DvfRow[] = raw.map((r) => ({ ...r, type: r.type === "M" ? "Maison" : "Appartement" }));
  return { rows, total, page, limit };
}
