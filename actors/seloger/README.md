# SeLoger Listing Scraper (with DPE / GES)

Apify actor. Give it SeLoger listing URLs, get back one structured record per
listing — including the **DPE** and **GES** energy ratings with their numeric
values, not just the letters.

```
Input:  https://www.seloger.com/annonces/achat/appartement/bayeux-14/268652599.htm
Output: { id: 268652599, price: 231000, livingArea: 57, dpe: "D", ges: "D", ... }
```

---

## How it actually works

The important discovery: **you do not need to scrape the DOM.** SeLoger
server-renders its entire listing model into the HTML, in one script tag:

```html
<script id="__UFRN_LIFECYCLE_SERVERREQUEST__">
  window["__UFRN_LIFECYCLE_SERVERREQUEST__"]=JSON.parse("{\"app_cldp\":{\"data\":{\"classified\":{...
</script>
```

Note the double encoding — the tag holds a JS *string literal* that contains
JSON, so parsing it from raw HTML means `JSON.parse()` twice. The actor reads
`window.__UFRN_LIFECYCLE_SERVERREQUEST__.app_cldp.data.classified` off the live
page and falls back to parsing that literal out of the HTML if the page's JS
never ran.

Everything the detail page displays lives in that object, DPE and GES included:

```
classified.sections.energy.certificates[0].scales[]
  ├─ { name: "Diagnostic de performance énergétique (DPE)",
  │     efficiencyClass: { rating: "D", index: 3 },
  │     values: [ "228 kWh/m².an", "49 kg CO₂/m².an" ] }
  └─ { name: "Indice d'émission de gaz à effet de serre (GES)",
        efficiencyClass: { rating: "D", index: 3 },
        values: [ "49 kg CO₂/m².an" ] }
```

Because this is a single server-rendered blob, the scraper is dramatically more
stable than a CSS-selector scraper: SeLoger can redesign the page freely and the
extraction keeps working. The only thing that breaks it is a change to the state
key itself, which lives in one place — `src/constants.js`.

### What is deliberately NOT collected

Three fields are not server-rendered. The page fetches them over XHR after load:

| Field | Why it is empty |
| --- | --- |
| `dailyLife` | Nearby POIs (schools, shops, pharmacy) — loaded by the map widget |
| `transportations` | Bus/train stops — same widget |
| `priceVariations` | Price-drop history (e.g. 252 000 € → 231 000 €) — loaded by the price badge |

The keys are still emitted as empty arrays so the record shape never varies. If
you want them later, add a `page.on('response')` hook in
`src/routes.js` that captures the relevant XHR bodies before mapping — the
mapper takes them as-is.

### One caveat on `coordinates`

SeLoger does not publish exact addresses (`isAddressPublished: false` on almost
every listing). It ships the *district polygon* instead. The actor returns that
polygon's area-weighted centroid, tagged `source: "district-polygon-centroid"`.
Treat it as "somewhere in this neighbourhood", not as the property's location.

---

## Running it

### On Apify

```bash
npm install -g apify-cli
apify login
apify push
```

Then call it over the API. `run-sync-get-dataset-items` blocks until the run
finishes and returns the records directly — usually what you want for one-off
lookups:

```bash
curl -X POST "https://api.apify.com/v2/acts/<username>~seloger-listing-scraper/run-sync-get-dataset-items?token=$APIFY_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "startUrls": [
      { "url": "https://www.seloger.com/annonces/achat/appartement/bayeux-14/268652599.htm" }
    ],
    "proxyConfiguration": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"], "apifyProxyCountry": "FR" }
  }'
```

For bigger batches, start the run async and poll:

```bash
# returns immediately with a run id
curl -X POST "https://api.apify.com/v2/acts/<username>~seloger-listing-scraper/runs?token=$APIFY_TOKEN" \
  -H 'Content-Type: application/json' -d @input.json

# then
curl "https://api.apify.com/v2/actor-runs/<runId>/dataset/items?token=$APIFY_TOKEN&format=json"
```

### Locally

```bash
npm install
npx playwright install chromium   # skip if you already have a browser
npm test                          # offline checks, no network needed
apify run                         # reads storage/key_value_stores/default/INPUT.json
```

---

## Input

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `startUrls` | array | — | **Required.** SeLoger listing detail URLs. |
| `proxyConfiguration` | object | FR residential | See the anti-bot note below. |
| `maxConcurrency` | integer | `2` | Keep it low. |
| `maxRequestRetries` | integer | `5` | Each retry = new IP + new fingerprint. |
| `headless` | boolean | `true` | Turn off only to debug locally. |

## Output

70 fields per listing. The ones you probably came for:

| Field | Example | Notes |
| --- | --- | --- |
| `dpe` | `"D"` | Energy letter A–G, `null` if the listing is exempt |
| `ges` | `"D"` | Greenhouse-gas letter A–G |
| `energyBalance.dpe.consumption` | `228` | kWh/m².an, numeric |
| `energyBalance.ges.emission` | `49` | kg CO₂/m².an, numeric |
| `energyBalance.estimatedAnnualEnergyCost` | `{ min: 1250, max: 1730 }` | Parsed from "entre 1250 et 1730 €/an" |
| `energyBalance.heatingSystem` | `"Chauffage central"` | |
| `price` / `squareMeterPrice` | `231000` / `4052.63` | |
| `livingArea` / `rooms` / `bedrooms` | `57` / `3` / `2` | |
| `condoProperties` | `7` | Lots in the copropriété |
| `alur` | object | Loi ALUR block; fee-responsibility flags derived from the fee wording |
| `publisher` | object | Agency name, phone, SIRET, RCS, GALIAN guarantee, lead email |
| `features` | array | Including SeLoger's own AI-detected ones, tagged `source: "ai"` |

`sample-output.json` is a full real record.

---

## Anti-bot: the part that will actually cost you

SeLoger sits behind **DataDome**. Nothing in this codebase defeats it; what the
actor does is avoid looking obviously automated and recover cleanly when it is
challenged:

- **Residential FR proxies.** Non-negotiable at any volume. Datacenter IPs get
  challenged within a handful of requests.
- **Fingerprint rotation** via Crawlee's fingerprint suite, pinned to
  desktop Chrome on Windows/macOS with an `fr-FR` locale.
- **Short session lifetime** — 5 uses, `maxErrorScore: 1`. DataDome scores the
  IP+fingerprint pair, so a session that has been challenged once is burned;
  the pool discards it rather than pushing its luck.
- **Aggressive request blocking** in `preNavigationHooks`: images, media, fonts
  and the ad/analytics stack are aborted. This cuts page weight ~80% and removes
  most third-party scripts that fingerprint the browser. It is safe precisely
  because the data is server-rendered.
- **Block detection** in `src/routes.js`: a captcha interstitial or a 403/429
  throws, which hands the request back to Crawlee for a retry on a fresh
  session — rather than silently writing an empty record.

Practical guidance: keep `maxConcurrency` at 2–3, expect a few percent of
requests to need a retry, and if you see sustained failures, lower concurrency
before you reach for more proxies.

---

## Layout

```
src/
  main.js        actor entry — crawler config, proxies, fingerprints, hooks
  routes.js      request handler — block detection, 404s, dataset push
  extractor.js   blob → output record (pure, no browser dependency)
  energy.js      DPE / GES parsing
  utils.js       French number parsing, polygon centroid, safe deep-get
  constants.js   the state key — the one thing to update if SeLoger changes it
test/
  extractor.test.js          31 offline checks
  fixtures/                  a real listing model
```

`extractor.js` has no Playwright dependency on purpose: if SeLoger ever stops
challenging plain HTTP requests, you can swap `PlaywrightCrawler` for
`CheerioCrawler`, feed `classifiedFromHtml(html)` into `mapClassified()`, and
cut your compute cost by an order of magnitude. Nothing else changes.

## Testing

```bash
npm test
```

31 checks, no network: DPE/GES parsing (including a listing with no DPE, and a
fallback for if SeLoger renames the scales), ALUR fee-flag derivation, French
number formats, agency legal-notice parsing, polygon centroid maths, and the
double-encoded HTML fallback path.
