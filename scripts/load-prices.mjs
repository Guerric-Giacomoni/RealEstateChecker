/**
 * One-off: load the yearly commune price indicators (data/dvf20XX.csv, source:
 * data.gouv "indicateurs immobiliers par commune et par année") into Turso as
 * `commune_prices`, keyed by INSEE code + year. Powers the price-evolution
 * chart and the transaction-volume figure.
 *
 *   node --env-file=.env.local scripts/load-prices.mjs
 *
 * Header naming varies across years (leading index column, casing), so columns
 * are resolved by name per file rather than by position.
 */
import { readFileSync, readdirSync } from "node:fs";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (node --env-file=.env.local …)");
  process.exit(1);
}

const COLS = [
  "code_insee",
  "year",
  "n_mutations",
  "n_maisons",
  "n_apparts",
  "price_avg",
  "price_m2",
  "surface_avg",
];
// data.gouv header (any casing/quoting) → our column name.
const MAP = {
  insee_com: "code_insee",
  annee: "year",
  nb_mutations: "n_mutations",
  nbmaisons: "n_maisons",
  nbapparts: "n_apparts",
  prixmoyen: "price_avg",
  prixm2moyen: "price_m2",
  surfacemoy: "surface_avg",
};

const strip = (s) => s.replace(/^"|"$/g, "").trim();
const isInsee = (s) => /^(2[ab]\d{3}|\d{5})$/i.test(s);

function parseFile(path) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",").map((h) => strip(h).toLowerCase());
  // our column name → its position in this file
  const pos = {};
  header.forEach((h, i) => {
    if (MAP[h]) pos[MAP[h]] = i;
  });
  if (pos.code_insee == null || pos.price_m2 == null) {
    throw new Error(`${path}: missing INSEE/price column (header: ${header.join("|")})`);
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",").map(strip);
    const code = c[pos.code_insee];
    const priceM2 = Number(c[pos.price_m2]);
    const year = Number(c[pos.year]);
    if (!isInsee(code) || !Number.isFinite(priceM2) || priceM2 <= 0 || !Number.isFinite(year))
      continue;
    const numOr = (i, d = null) => {
      const v = Number(c[i]);
      return Number.isFinite(v) ? v : d;
    };
    rows.push([
      code.toUpperCase(),
      year,
      pos.n_mutations != null ? numOr(pos.n_mutations, 0) : 0,
      pos.n_maisons != null ? numOr(pos.n_maisons, 0) : 0,
      pos.n_apparts != null ? numOr(pos.n_apparts, 0) : 0,
      pos.price_avg != null ? Math.round(numOr(pos.price_avg, 0)) : 0,
      Math.round(priceM2 * 10) / 10,
      pos.surface_avg != null ? Math.round(numOr(pos.surface_avg, 0) * 10) / 10 : null,
    ]);
  }
  return rows;
}

const files = readdirSync("data")
  .filter((f) => /^dvf\d{4}\.csv$/.test(f))
  .sort();
console.log("files:", files.join(", "));

let all = [];
for (const f of files) {
  const rows = parseFile(`data/${f}`);
  console.log(`  ${f}: ${rows.length.toLocaleString()} rows`);
  all = all.concat(rows);
}
console.log("total rows:", all.length.toLocaleString());

const remote = createClient({ url, authToken });
console.log("recreating schema…");
await remote.execute("drop table if exists commune_prices");
await remote.execute(
  `create table commune_prices (
     code_insee text, year integer, n_mutations integer,
     n_maisons integer, n_apparts integer,
     price_avg integer, price_m2 real, surface_avg real)`,
);

const CHUNK = 500;
const BATCH = 20;
const tuple = `(${COLS.map(() => "?").join(",")})`;
let statements = [];
let loaded = 0;
const flush = async () => {
  if (!statements.length) return;
  await remote.batch(statements);
  loaded += statements.reduce((n, s) => n + s.args.length / COLS.length, 0);
  statements = [];
  process.stdout.write(`\r loaded ${loaded.toLocaleString()} / ${all.length.toLocaleString()}`);
};

for (let i = 0; i < all.length; i += CHUNK) {
  const slice = all.slice(i, i + CHUNK);
  const sql = `insert into commune_prices (${COLS.join(",")}) values ${slice
    .map(() => tuple)
    .join(",")}`;
  const args = [];
  for (const r of slice) for (const v of r) args.push(v);
  statements.push({ sql, args });
  if (statements.length >= BATCH) await flush();
}
await flush();

console.log("\ncreating index…");
await remote.execute("create index if not exists idx_prices_code on commune_prices(code_insee)");
const n = await remote.execute("select count(*) as n from commune_prices");
console.log("done. rows in Turso:", Number(n.rows[0].n).toLocaleString());
