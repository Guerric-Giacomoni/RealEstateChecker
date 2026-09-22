/**
 * One-off: load FINESS "structures" establishments into Turso as `hospitals`.
 *
 *   1. download the monthly file (48 MB gz → 715 MB JSON):
 *      curl -sSL -o data/finess.json.gz \
 *        https://static.data.gouv.fr/resources/finess-structures-1/<latest>/finess-structures-mensuel-YYYYMM.json.gz
 *   2. node --env-file=.env.local scripts/load-hospitals.mjs [data/finess.json.gz]
 *
 * The file is a nested JSON keyed by legal entity (`pmej`), each with its
 * physical establishments (`ege`). We stream it (can't load 715 MB whole),
 * keep every ACTIVE establishment that has WGS84 coordinates, and store the
 * essentials. Category is a FINESS code — the app filters/labels at query time,
 * so we keep everything here (hospitals, clinics, EHPAD, pharmacies…).
 */
import fs from "node:fs";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { createClient } from "@libsql/client";

const require = createRequire(import.meta.url);
const { parser } = require("stream-json");
const { pick } = require("stream-json/filters/Pick");
const { streamArray } = require("stream-json/streamers/StreamArray");
const { chain } = require("stream-chain");

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (node --env-file=.env.local …)");
  process.exit(1);
}
const FILE = process.argv[2] || "data/finess.json.gz";

const clean = (s) => (s == null ? null : String(s).trim() || null);

console.log("streaming", FILE, "…");
const rows = [];
await new Promise((resolve, reject) => {
  const p = chain([
    fs.createReadStream(FILE),
    zlib.createGunzip(),
    parser(),
    pick({ filter: "pmej" }),
    streamArray(),
  ]);
  p.on("data", ({ value }) => {
    const ege = value.ege;
    if (!Array.isArray(ege)) return;
    for (const e of ege) {
      if (e.etatObjet !== "A") continue; // active only
      const g = e.informationsGeneralesEGE || {};
      const finess = clean(g.numFinessEge);
      const name = clean(g.nomEgeLong || g.nomEgeCourt);
      const cat = clean(e.categorieentiteGeographiqueExercice);
      const ad = Array.isArray(e.adresse) ? e.adresse[0] : null;
      if (!finess || !name || !cat || !ad) continue;
      const coord = ad.coordonneesGeographique || {};
      const lon = Number(coord.coordonneeX); // WGS84, already BAN-geocoded
      const lat = Number(coord.coordonneeY);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      rows.push([
        finess,
        name,
        cat,
        clean(ad.cogCommune),
        clean(ad.codePostal),
        clean(ad.ligneAcheminement),
        Math.round(lat * 1e6) / 1e6,
        Math.round(lon * 1e6) / 1e6,
      ]);
    }
  });
  p.on("end", resolve);
  p.on("error", reject);
});
console.log("active establishments with coordinates:", rows.length.toLocaleString());

const COLS = ["finess", "name", "cat", "commune", "cp", "city", "lat", "lon"];
const remote = createClient({ url, authToken });
console.log("recreating schema…");
await remote.execute("drop table if exists hospitals");
await remote.execute(
  `create table hospitals (finess text, name text, cat text, commune text,
   cp text, city text, lat real, lon real)`,
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
  process.stdout.write(`\r loaded ${loaded.toLocaleString()} / ${rows.length.toLocaleString()}`);
};
for (let i = 0; i < rows.length; i += CHUNK) {
  const slice = rows.slice(i, i + CHUNK);
  const sql = `insert into hospitals (${COLS.join(",")}) values ${slice.map(() => tuple).join(",")}`;
  const args = [];
  for (const r of slice) for (const v of r) args.push(v);
  statements.push({ sql, args });
  if (statements.length >= BATCH) await flush();
}
await flush();

console.log("\ncreating index…");
await remote.execute("create index if not exists idx_hosp_geo on hospitals(lat, lon)");
const n = await remote.execute("select count(*) as n from hospitals");
console.log("done. rows in Turso:", Number(n.rows[0].n).toLocaleString());
