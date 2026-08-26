/**
 * One-off: load data/dvf-2025.sqlite into a Turso database.
 *
 *   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… node scripts/load-turso.mjs
 *
 * Reads the local SQLite (better-sqlite3) and bulk-inserts into Turso over HTTP
 * in batched multi-row statements. Recreates the `sales` table + index.
 */
import Database from "better-sqlite3";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
  process.exit(1);
}

const local = new Database("data/dvf-2025.sqlite", { readonly: true });
const remote = createClient({ url, authToken });

const COLS = ["cp", "type", "price", "surface", "rooms", "month", "adresse", "ville"];
const CHUNK = 500; // rows per INSERT statement
const BATCH = 20; // statements per HTTP round trip
const tuple = `(${COLS.map(() => "?").join(",")})`;

console.log("recreating schema…");
await remote.execute("drop table if exists sales");
await remote.execute(
  `create table sales (cp text, type text, price integer, surface integer,
   rooms integer, month integer, adresse text, ville text)`,
);

const rows = local.prepare(`select ${COLS.join(",")} from sales`).all();
console.log("rows to load:", rows.length.toLocaleString());

let statements = [];
let loaded = 0;
const flush = async () => {
  if (!statements.length) return;
  await remote.batch(statements);
  loaded += statements.reduce((n, s) => n + s.args.length / COLS.length, 0);
  statements = [];
  process.stdout.write(`\r loaded ${loaded.toLocaleString()} / ${rows.length.toLocaleString()}`);
};

for (let i = 0; i < rows.length; i += CHUNK) {
  const slice = rows.slice(i, i + CHUNK);
  const sql = `insert into sales (${COLS.join(",")}) values ${slice.map(() => tuple).join(",")}`;
  const args = [];
  for (const r of slice) for (const c of COLS) args.push(r[c]);
  statements.push({ sql, args });
  if (statements.length >= BATCH) await flush();
}
await flush();

console.log("\ncreating index…");
await remote.execute("create index if not exists idx_cp on sales(cp, type)");
const n = await remote.execute("select count(*) as n from sales");
console.log("done. rows in Turso:", Number(n.rows[0].n).toLocaleString());
