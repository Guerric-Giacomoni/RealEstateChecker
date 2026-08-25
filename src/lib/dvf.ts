import Database from "better-sqlite3";
import path from "node:path";
import type { DvfComp } from "./types";

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
