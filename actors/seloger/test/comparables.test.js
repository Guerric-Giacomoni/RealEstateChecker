/**
 * Offline checks for the comparables pipeline — no network, no browser.
 *   node test/comparables.test.js
 *
 * The SERP fixture mirrors the real payload shape read off a live
 * /classified-search page (window.__UFRN_FETCHER__ → classified-serp-init-data).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { mapClassified } from '../src/extractor.js';
import { serpFromHtml, mapSerpResults, mapSerpCard } from '../src/serp.js';
import {
    buildComparablesSearchUrl,
    buildRentComparablesSearchUrl,
    selectComparables,
    selectRentComparables,
    similarityScore,
    toEstateType,
} from '../src/comparables.js';
import { SERP_STATE_KEY } from '../src/constants.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(join(here, 'fixtures', name), 'utf8'));

const classified = read('bayeux-268652599.json');
const serpState = read('serp-bayeux.json');
const subject = mapClassified(
    classified,
    'https://www.seloger.com/annonces/achat/appartement/bayeux-14/268652599.htm',
);

let passed = 0;
const check = (name, fn) => {
    try {
        fn();
        passed++;
        console.log(`  ok  ${name}`);
    } catch (error) {
        console.error(`FAIL  ${name}\n      ${error.message}`);
        process.exitCode = 1;
    }
};

console.log('\nsearch URL builder');
const built = buildComparablesSearchUrl(subject);
const params = new URL(built.url).searchParams;

check('targets the subject’s own district', () =>
    assert.equal(params.get('locations'), 'AD08FR4602'));
check('estate type mapped APARTMENT → Apartment', () =>
    assert.equal(params.get('estateTypes'), 'Apartment'));
check('sale, not rental', () =>
    assert.equal(params.get('distributionTypes'), 'Buy'));
check('price band is ±15% of 231 000 €', () => {
    assert.equal(params.get('priceMin'), '196000'); // 231000 * 0.85 = 196350 → floor to 1k
    assert.equal(params.get('priceMax'), '266000'); // 231000 * 1.15 = 265650 → ceil to 1k
});
check('surface band is ±20% of 57 m²', () => {
    assert.equal(params.get('spaceMin'), '45');     // 45.6 → floor
    assert.equal(params.get('spaceMax'), '69');     // 68.4 → ceil
});
check('carries method=form like the site’s own searches', () =>
    assert.equal(params.get('method'), 'form'));
check('nothing reported missing for a complete subject', () =>
    assert.deepEqual(built.missing, []));
check('tolerances are configurable', () => {
    const tight = buildComparablesSearchUrl(subject, { priceTolerance: 0.05, surfaceTolerance: 0.1 });
    const p = new URL(tight.url).searchParams;
    assert.equal(p.get('priceMin'), '219000');
    assert.equal(p.get('spaceMax'), '63');
});
check('refuses to build a nationwide search when the comparison zone is unknown', () => {
    const noPlace = {
        ...subject,
        marketInsightsPlaceId: null,
        locality: { ...subject.locality, districtGeoId: null },
    };
    const out = buildComparablesSearchUrl(noPlace);
    assert.equal(out.url, null);
    assert.ok(out.missing.includes('placeId'));
});
check('prefers marketInsights.placeId (neighbourhood) over the AD08 commune', () => {
    // Paris regression: AD08 is the whole city (~20k flats); NBH2 is the quartier.
    const paris = {
        ...subject,
        marketInsightsPlaceId: 'NBH2FR41',
        locality: { ...subject.locality, districtGeoId: 'AD08FR31096' },
    };
    const p = new URL(buildComparablesSearchUrl(paris).url).searchParams;
    assert.equal(p.get('locations'), 'NBH2FR41');
});
check('estate type fallback for unknown types', () => {
    assert.equal(toEstateType('HOUSE'), 'House');
    assert.equal(toEstateType('WAREHOUSE'), 'Warehouse');
    assert.equal(toEstateType(null), null);
});

console.log('\nrent comparables');
const rentSearch = buildRentComparablesSearchUrl(subject);
const rp = new URL(rentSearch.url).searchParams;

check('rent search flips distributionTypes to Rent', () =>
    assert.equal(rp.get('distributionTypes'), 'Rent'));
check('rent search drops the price band', () => {
    assert.equal(rp.get('priceMin'), null);
    assert.equal(rp.get('priceMax'), null);
});
check('rent search keeps location, estate type and surface band', () => {
    assert.equal(rp.get('locations'), 'AD08FR4602');
    assert.equal(rp.get('estateTypes'), 'Apartment');
    assert.equal(rp.get('spaceMin'), '45');
    assert.equal(rp.get('spaceMax'), '69');
});
check('rent selection ranks by surface proximity to the subject (57 m²)', () => {
    const candidates = [
        { publicId: 'a', price: 2400, livingArea: 80, squareMeterPrice: 30, rooms: 3 },
        { publicId: 'b', price: 1200, livingArea: 55, squareMeterPrice: 21.8, rooms: 3 },
        { publicId: 'c', price: 1400, livingArea: 60, squareMeterPrice: 23.3, rooms: 3 },
    ];
    const out = selectRentComparables(subject, candidates, { maxComparables: 2 });
    assert.equal(out.length, 2);
    assert.equal(out[0].publicId, 'b'); // 55 m² — closest to 57
    assert.equal(out[1].publicId, 'c'); // 60 m² — next closest
    assert.ok(Number.isFinite(out[0].comparison.rentPerM2));
});

console.log('\nSERP parsing');
const { results, totalCount } = mapSerpResults(
    serpState.data['classified-serp-init-data'].pageProps,
);

check('every card parsed', () => {
    assert.equal(results.length, 7);
    assert.equal(totalCount, 32);
});
check('numeric fields come from rawData, not French strings', () => {
    const house = results.find((r) => r.publicId === '26U2BBCHZNQ3');
    assert.equal(house.price, 305000);
    assert.equal(house.livingArea, 116.49);
    assert.equal(house.rooms, 5);
    assert.equal(house.bedrooms, 3);
    assert.equal(house.plotArea, 509);
});
check('DPE letter captured, GES explicitly null', () => {
    const r = results.find((r) => r.publicId === '26AAAAAAAAA4');
    assert.equal(r.dpe, 'B');
    assert.equal(r.ges, null, 'cards do not carry GES — must not be faked');
});
check('price per m² computed', () => {
    const r = results.find((r) => r.publicId === '26AAAAAAAAA1');
    assert.equal(r.squareMeterPrice, Number((225000 / 55).toFixed(2)));
});
check('legacy id and url kept', () => {
    const r = results.find((r) => r.publicId === '26AAAAAAAAA1');
    assert.equal(r.id, 270000001);
    assert.match(r.url, /bayeux-14400/);
});
check('private seller flagged', () => {
    const r = results.find((r) => r.publicId === '26AAAAAAAAA3');
    assert.equal(r.isPrivateOwner, true);
});
check('HTML fallback recovers the double-encoded SERP blob', () => {
    const inner = JSON.stringify(serpState);
    const html = `<script id="${SERP_STATE_KEY}">window["${SERP_STATE_KEY}"]=JSON.parse(${JSON.stringify(inner)})</script>`;
    const parsed = serpFromHtml(html);
    assert.equal(mapSerpResults(parsed).results.length, 7);
});
check('a malformed card does not sink the page', () =>
    assert.equal(mapSerpCard(null), null));

console.log('\ncomparable selection');
const comparables = selectComparables(subject, results, { maxComparables: 10 });

check('the subject itself is excluded', () =>
    assert.ok(!comparables.some((c) => c.publicId === '26RWYVPVLFLT')));
check('capped at maxComparables', () => {
    const capped = selectComparables(subject, results, { maxComparables: 3 });
    assert.equal(capped.length, 3);
});
check('returns fewer than the cap without complaint', () => {
    const thin = selectComparables(subject, results.slice(0, 2), { maxComparables: 10 });
    assert.equal(thin.length, 1); // only the house survives, subject removed
});
check('ranked by similarity — closest first', () => {
    const scores = comparables.map((c) => c.comparison.similarityScore);
    assert.deepEqual(scores, [...scores].sort((a, b) => a - b));
    // 55 m² / 225k is much closer to 57 m² / 231k than a 116 m² house is.
    assert.equal(comparables[0].publicId, '26AAAAAAAAA1');
});
check('deltas computed against the subject', () => {
    const c = comparables.find((c) => c.publicId === '26AAAAAAAAA2');
    assert.equal(c.comparison.surfaceDeltaPct, 5.3);   // 60 vs 57
    assert.equal(c.comparison.priceDeltaPct, 7.4);     // 248k vs 231k
    assert.equal(c.comparison.roomsDelta, 0);
});
check('an overpriced same-size flat ranks below a well-priced one', () => {
    const cheap = comparables.findIndex((c) => c.publicId === '26AAAAAAAAA1'); // 55 m², 4091 €/m²
    const dear = comparables.findIndex((c) => c.publicId === '26AAAAAAAAA5');  // 58 m², 5172 €/m²
    assert.ok(cheap < dear, 'price-per-m² must influence the ranking, not just size');
});
check('similarity is symmetric-ish and finite', () => {
    const score = similarityScore(subject, results[2]);
    assert.ok(Number.isFinite(score) && score >= 0);
    assert.equal(similarityScore(subject, {}), Number.POSITIVE_INFINITY);
});

console.log(`\n${passed} checks passed${process.exitCode ? ' — with failures above' : ''}\n`);
