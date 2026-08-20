/**
 * Offline checks — no network, no browser, no Apify.
 *   node test/extractor.test.js
 *
 * The fixture is the real `classified` model read off the live Bayeux listing
 * (268652599), trimmed to the branches the mapper touches and with image URLs
 * shortened. Expected values below are what SeLoger actually rendered.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { mapClassified, classifiedFromHtml } from '../src/extractor.js';
import { toNumber, polygonCentroid } from '../src/utils.js';

const here = dirname(fileURLToPath(import.meta.url));
const classified = JSON.parse(readFileSync(join(here, 'fixtures/bayeux-268652599.json'), 'utf8'));

const URL_UNDER_TEST = 'https://www.seloger.com/annonces/achat/appartement/bayeux-14/268652599.htm';

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

const record = mapClassified(classified, URL_UNDER_TEST);

console.log('\nenergy — the reason this actor exists');
check('DPE letter is D', () => assert.equal(record.dpe, 'D'));
check('GES letter is D', () => assert.equal(record.ges, 'D'));
check('DPE consumption is 228 kWh/m².an', () => {
    assert.equal(record.energyBalance.dpe.consumption, 228);
    assert.equal(record.energyBalance.dpe.consumptionUnit, 'kWh/m².an');
});
check('GES emission is 49 kg CO2/m².an', () => {
    assert.equal(record.energyBalance.ges.emission, 49);
    assert.equal(record.energyBalance.ges.emissionUnit, 'kg CO2/m².an');
});
check('annual energy bill parsed as a range', () => {
    assert.deepEqual(
        { min: record.energyBalance.estimatedAnnualEnergyCost.min, max: record.energyBalance.estimatedAnnualEnergyCost.max },
        { min: 1250, max: 1730 },
    );
});
check('heating / source / condition carried through', () => {
    assert.equal(record.energyBalance.heatingSystem, 'Chauffage central');
    assert.equal(record.energyBalance.energySource, 'Gaz');
    assert.equal(record.energyBalance.condition, 'Entretenu');
});
check('DPE/GES fall back to document order if names change', () => {
    const renamed = structuredClone(classified);
    renamed.sections.energy.certificates[0].scales[0].name = 'Étiquette énergie';
    renamed.sections.energy.certificates[0].scales[1].name = 'Étiquette climat';
    const out = mapClassified(renamed, URL_UNDER_TEST);
    assert.equal(out.dpe, 'D');
    assert.equal(out.ges, 'D');
});
check('listing with no DPE yields nulls, not a crash', () => {
    const exempt = structuredClone(classified);
    exempt.sections.energy = { hasScales: false, certificates: [], features: [] };
    const out = mapClassified(exempt, URL_UNDER_TEST);
    assert.equal(out.dpe, null);
    assert.equal(out.ges, null);
    assert.equal(out.energyBalance.hasScales, false);
});

console.log('\nyear of construction');
const withYear = JSON.parse(readFileSync(join(here, 'fixtures/caen-26AQ6I1A4SEW.json'), 'utf8'));
check('read from energy.features (Caen, "1800")', () => {
    const out = mapClassified(withYear, URL_UNDER_TEST);
    assert.equal(out.yearOfConstruction, 1800);
    assert.equal(out.energyBalance.yearOfConstruction, 1800);
});
check('falls back to the analytics payload', () => {
    const noFeature = structuredClone(withYear);
    noFeature.sections.energy.features = noFeature.sections.energy.features.filter(
        (f) => f.type !== 'yearOfConstruction',
    );
    assert.equal(mapClassified(noFeature, URL_UNDER_TEST).yearOfConstruction, 1800);
});
check('null when the listing does not declare one (Bayeux)', () =>
    assert.equal(record.yearOfConstruction, null));
check('never emits a partial year', () => {
    const junk = structuredClone(withYear);
    junk.sections.energy.features[0].value = 'années 1970';
    delete junk.legacyTracking.products[0].year_of_construction;
    assert.equal(mapClassified(junk, URL_UNDER_TEST).yearOfConstruction, 1970);
});

console.log('\ncore listing fields');
check('id / reference / publicId', () => {
    assert.equal(record.id, 268652599);
    assert.equal(record.reference, '3NAR-MB0-TIJ');
    assert.equal(record.publicId, '26RWYVPVLFLT');
});
check('price 231000 € and 4052.63 €/m²', () => {
    assert.equal(record.price, 231000);
    assert.equal(record.squareMeterPrice, 4052.63);
    assert.equal(record.priceBlock.squareMeterPrice, 4053);
});
check('surface / rooms / bedrooms / floors', () => {
    assert.equal(record.livingArea, 57);
    assert.equal(record.rooms, 3);
    assert.equal(record.bedrooms, 2);
    assert.equal(record.floors, 2);
});
check('city / zip / department', () => {
    assert.equal(record.city, 'Bayeux');
    assert.equal(record.zipCode, '14400');
    assert.equal(record.locality.departmentCode, '14');
});
check('geo ids resolved from the hierarchy', () => {
    assert.equal(record.locality.districtGeoId, 'AD08FR4602');
    assert.equal(record.locality.cityGeoId, 'AD06FR14');
    assert.equal(record.locality.departmentGeoId, 'AD04FR14');
    // District *name* is not server-rendered any more — must stay null, not undefined.
    assert.equal(record.locality.district, null);
});
check('tags object mapped to flags', () => {
    assert.equal(record.isExclusiveness, false);
    assert.equal(record.has3DVisit, true);
    assert.equal(record.isNew, false);
});
check('7 lots in the copropriété', () => assert.equal(record.condoProperties, 7));
check('transaction is a sale', () => {
    assert.equal(record.transactionType, 2);
    assert.equal(record.transactionTypeLetters, 'Vente');
});
check('dates come from metadata', () => {
    assert.equal(record.created, '2026-05-10T13:13:00Z');
    assert.equal(record.lastModified, '2026-07-16T00:46:29.407Z');
});

console.log('\nALUR fee flags');
check('fees are the seller’s responsibility', () => {
    assert.equal(record.alur.ifFeesAreSellerResponsability, true);
    assert.equal(record.alur.ifFeesArePurchaserResponsability, false);
    assert.equal(record.alur.idTypeOfFeesAccountant, 2);
    assert.equal(record.alur.price, 231000);
});
check('buyer-pays wording flips the flags', () => {
    const buyerPays = structuredClone(classified);
    buyerPays.sections.price.breakdown.message.value = 'Honoraires à la charge de l’acquéreur';
    const out = mapClassified(buyerPays, URL_UNDER_TEST);
    assert.equal(out.alur.ifFeesArePurchaserResponsability, true);
    assert.equal(out.alur.ifFeesAreSellerResponsability, false);
});

console.log('\npublisher / agency');
check('agency identity', () => {
    assert.equal(record.publisher.name, 'Normandie Privilege');
    assert.equal(record.publisher.agencyId, 'RC-326236');
    assert.equal(record.publisher.phoneNumber, '02 31 10 49 00');
    assert.equal(record.publisher.isPrivateOwner, false);
});
check('legal notices parsed out of the HTML blob', () => {
    assert.equal(record.publisher.financialGuaranteeFund, 'GALIAN');
    assert.equal(record.publisher.financialGuaranteeAmount, 119970);
    assert.equal(record.publisher.shareCapital, 1000);
    assert.equal(record.publisher.siret, '84098990900022');
    assert.equal(record.publisher.legalForm, 'SASU');
    assert.match(record.publisher.rcs, /Bayeux 840989909/);
});
check('lead email recovered', () => assert.equal(record.publisher.email, 'ag141264@contact-manager.net'));

console.log('\nmedia');
check('photos collected, first one promoted', () => {
    assert.equal(record.photos.length, 3);
    assert.equal(record.photosCount, 3);
    assert.equal(record.itemMainPicture, record.photos[0]);
});
check('matterport tour captured', () =>
    assert.ok(record.medias.some((m) => m.includes('matterport'))));

console.log('\nlocation approximation');
check('centroid lands inside Bayeux', () => {
    const { latitude, longitude } = record.coordinates;
    assert.ok(latitude > 49.25 && latitude < 49.30, `lat ${latitude}`);
    assert.ok(longitude > -0.74 && longitude < -0.67, `lng ${longitude}`);
    assert.equal(record.coordinates.source, 'district-polygon-centroid');
    assert.equal(record.coordinates.accuracy, 2);
});
check('centroid of a unit square is its middle', () => {
    const centroid = polygonCentroid({
        type: 'Polygon',
        coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
    });
    assert.deepEqual(centroid, { longitude: 1, latitude: 1 });
});

console.log('\nnumber parsing');
check('French formats', () => {
    assert.equal(toNumber('4 052,63 €/m²'), 4052.63);
    assert.equal(toNumber('231 000 €'), 231000);
    assert.equal(toNumber('228 kWh/m².an'), 228);
    assert.equal(toNumber(''), null);
    assert.equal(toNumber(null), null);
});

console.log('\nHTML fallback path');
check('double-encoded blob is recovered from raw HTML', () => {
    const inner = JSON.stringify({ app_cldp: { data: { classified } } });
    const html = `<html><body><script id="__UFRN_LIFECYCLE_SERVERREQUEST__">window["__UFRN_LIFECYCLE_SERVERREQUEST__"]=JSON.parse(${JSON.stringify(inner)})</script></body></html>`;
    const parsed = classifiedFromHtml(html);
    assert.equal(parsed.metadata.legacyId, '268652599');
    assert.equal(mapClassified(parsed, URL_UNDER_TEST).dpe, 'D');
});
check('missing blob returns null rather than throwing', () =>
    assert.equal(classifiedFromHtml('<html><body>nope</body></html>'), null));

console.log('\ncontract');
check('client-side-only keys present but empty', () => {
    assert.deepEqual(record.dailyLife, []);
    assert.deepEqual(record.transportations, []);
    assert.deepEqual(record.priceVariations, []);
});
check('record is JSON-serialisable', () => {
    assert.ok(JSON.parse(JSON.stringify(record)).id === 268652599);
});

console.log(`\n${passed} checks passed${process.exitCode ? ' — with failures above' : ''}\n`);
