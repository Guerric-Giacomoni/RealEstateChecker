# SeLoger Listing & Comparables Scraper

Apify actor. Give it one SeLoger listing URL and get back the listing — DPE and
GES included — plus the closest comparable properties on the market.

```
Input:  { "comparablesFor": ["https://www.seloger.com/annonces/.../268652599.htm"] }
Output: 1 subject  + up to 10 comparables + 1 summary
        231 000 € / 57 m² / DPE D    median comparable 4 112 €/m² (subject −1.4%)
```

Three modes, one actor:

| Input | What it does | Requests |
| --- | --- | --- |
| `comparablesFor` | Scrape the listing, derive a search from its own characteristics, return ranked comparables | 2 |
| `startUrls` | Scrape listing detail pages only | 1 per listing |
| `searchUrls` | Run a `/classified-search` URL you built yourself, return every card | 1 per page |

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

Search pages do the same thing under a **different** global — the fetcher cache
rather than the lifecycle blob:

```js
window.__UFRN_FETCHER__.data['classified-serp-init-data'].pageProps
  ├─ classifieds:     ["26U2BBCHZNQ3", ...]      ordered public ids
  ├─ classifiedsData: { "26U2BBCHZNQ3": {...} }  card payload, keyed by id
  └─ totalCount:      32
```

Each card carries a numeric `rawData` block (`price`, `surface.main`, `nbroom`,
`nbbedroom`) and `energyClass` — the DPE letter. That is the whole reason a
comparables run costs **two requests**: one for the subject, one for the search.
Nothing needs visiting per comparable.

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

### How comparables are chosen

From the subject's own scraped data:

| Filter | Derived from | Default |
| --- | --- | --- |
| `locations` | `locality.districtGeoId` | exact district — no fallback |
| `estateTypes` | `propertyType` (`APARTMENT` → `Apartment`) | same type |
| `priceMin/Max` | `price` | ±15%, rounded to 1 000 € |
| `spaceMin/Max` | `livingArea` | ±20%, rounded to 1 m² |
| `distributionTypes` | `transactionTypeLetters` | Buy / Rent |

Results are then ranked by a similarity score — a blend of relative surface
distance, relative price-per-m² distance, and room count — and the closest ones
are kept, **not** SeLoger's default ordering. Each comparable carries a
`comparison` block with signed deltas against the subject.

Two deliberate behaviours:

- **No location widening.** If the district has only three matches, you get
  three. Silently widening to the whole city would return listings that are not
  comparable and you would not know it happened. `totalMatches` and
  `comparablesReturned` in the summary tell you what you got.
- **No search without a district.** If `districtGeoId` is missing, the actor
  emits a skipped summary rather than running a nationwide search.

Only page 1 of the search is read. With ±15%/±20% filters the match count is
almost always under SeLoger's 30-per-page, and the output caps at 10 anyway —
`truncatedByPageSize` flags the exception.

### What is deliberately NOT collected

Three fields are not server-rendered. The page fetches them over XHR after load:

| Field | Why it is empty |
| --- | --- |
| `dailyLife` | Nearby POIs (schools, shops, pharmacy) — loaded by the map widget |
| `ges` on comparables | Search cards carry the DPE letter only; GES is detail-page-only. Left `null` rather than guessed |
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
| `comparablesFor` | array | — | Listing URLs to find comparables for. |
| `startUrls` | array | — | Listing URLs, detail only. |
| `searchUrls` | array | — | `/classified-search` URLs to run as-is. |
| `maxComparables` | integer | `10` | Upper bound per subject. |
| `priceTolerance` | string | `"0.15"` | ±15%. |
| `surfaceTolerance` | string | `"0.2"` | ±20%. |
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
| `yearOfConstruction` | `1800` | Année de construction — `null` when not declared (often) |
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
  main.js        actor entry — input modes, crawler config, proxies, hooks
  routes.js      DETAIL and SERP handlers — block detection, 404s, dataset push
  extractor.js   detail blob → full listing record (pure, no browser dependency)
  serp.js        search blob → comparable records (pure)
  comparables.js search-URL builder + similarity ranking (pure)
  energy.js      DPE / GES parsing
  utils.js       French number parsing, polygon centroid, safe deep-get
  constants.js   the state key — the one thing to update if SeLoger changes it
test/
  extractor.test.js          35 offline checks — listing extraction
  comparables.test.js        25 offline checks — URL building, SERP, ranking
  fixtures/                  real listing and search-results models
```

`extractor.js` has no Playwright dependency on purpose: if SeLoger ever stops
challenging plain HTTP requests, you can swap `PlaywrightCrawler` for
`CheerioCrawler`, feed `classifiedFromHtml(html)` into `mapClassified()`, and
cut your compute cost by an order of magnitude. Nothing else changes.

## Testing

```bash
npm test
```

60 checks across two suites, no network: DPE/GES parsing (including a listing
with no DPE, and a fallback for if SeLoger renames the scales), year of
construction, ALUR fee-flag derivation, French number formats, agency
legal-notice parsing, polygon centroid maths, the double-encoded HTML fallback
for both page types, search-URL band arithmetic, subject exclusion, and
similarity ranking.

`sample-comparables-output.json` is a real end-to-end run: subject, six ranked
comparables, and the summary.
