import { pick, toNumber } from './utils.js';

/**
 * Turns a scraped subject listing into a SeLoger search URL for comparables.
 *
 * SeLoger's search vocabulary (confirmed against a live `/classified-search`
 * page's own searchModel):
 *
 *   distributionTypes = Buy | Rent
 *   estateTypes       = Apartment | House | ...   (PascalCase)
 *   locations         = a geo placeId, e.g. AD08FR4602
 *   priceMin/priceMax, spaceMin/spaceMax, numberOfRoomsMax
 *   method            = form
 */

export const DEFAULT_CRITERIA = {
    priceTolerance: 0.15,   // ±15%
    surfaceTolerance: 0.20, // ±20%
    maxComparables: 10,
    // Overridable so the pipeline can be exercised against a local replica.
    searchBaseUrl: 'https://www.seloger.com/classified-search',
};

/** `rawData.propertyType` is SCREAMING_SNAKE; the URL param is PascalCase. */
const ESTATE_TYPES = {
    APARTMENT: 'Apartment',
    HOUSE: 'House',
    LAND: 'Land',
    PARKING: 'Parking',
    OFFICE: 'Office',
    BUILDING: 'Building',
    SHOP: 'Shop',
    LOFT: 'Loft',
    CASTLE: 'Castle',
    TOWNHOUSE: 'Townhouse',
};

export function toEstateType(propertyType) {
    if (!propertyType) return null;
    const key = String(propertyType).toUpperCase();
    if (ESTATE_TYPES[key]) return ESTATE_TYPES[key];
    // Unknown type: PascalCase it rather than dropping the filter entirely.
    return key.charAt(0) + key.slice(1).toLowerCase();
}

function toDistributionType(record) {
    // The mapper already normalises this to "Vente" / "Location".
    return pick(record, ['transactionTypeLetters']) === 'Location' ? 'Rent' : 'Buy';
}

/**
 * Widen a value by a ratio and round to something a human would type.
 * Price rounds to 1 000 €, surface to 1 m² — SeLoger accepts anything, but
 * round numbers make the generated URL readable when you debug a run.
 */
function band(value, tolerance, roundTo) {
    if (!Number.isFinite(value) || value <= 0) return { min: null, max: null };
    const min = Math.max(0, Math.floor((value * (1 - tolerance)) / roundTo) * roundTo);
    const max = Math.ceil((value * (1 + tolerance)) / roundTo) * roundTo;
    return { min, max };
}

/**
 * @param {object} subject  a record produced by mapClassified()
 * @param {object} criteria overrides for DEFAULT_CRITERIA
 * @returns {{url: string|null, params: object, missing: string[]}}
 *   `missing` lists the characteristics we could not derive, so the caller can
 *   report a degraded search instead of silently returning bad comparables.
 */
export function buildComparablesSearchUrl(subject, criteria = {}) {
    const { priceTolerance, surfaceTolerance, searchBaseUrl } = { ...DEFAULT_CRITERIA, ...criteria };

    const price = toNumber(subject?.price);
    const surface = toNumber(subject?.livingArea);
    // Use SeLoger's own comparison area (marketInsights.placeId): it resolves to
    // the neighbourhood in dense cities (NBH…) and the commune elsewhere (AD08…).
    // districtGeoId alone is AD08 = the whole commune, which in Paris means all
    // ~20k flats in the city — a meaningless comparables set. Fall back to it
    // only when the market place id is absent.
    const placeId =
        pick(subject, ['marketInsightsPlaceId']) ?? pick(subject, ['locality', 'districtGeoId']);
    const estateType = toEstateType(pick(subject, ['propertyType']));

    const missing = [];
    if (!placeId) missing.push('placeId');
    if (!estateType) missing.push('estateTypes');
    if (!price) missing.push('price');
    if (!surface) missing.push('livingArea');

    // Location is the one filter we cannot sensibly default: a nationwide
    // search is not a comparables search. Bail rather than return noise.
    if (!placeId) return { url: null, params: {}, missing };

    const priceBand = band(price, priceTolerance, 1000);
    const spaceBand = band(surface, surfaceTolerance, 1);

    const params = {
        distributionTypes: toDistributionType(subject),
        estateTypes: estateType,
        locations: placeId,
        method: 'form',
    };
    if (priceBand.min !== null) {
        params.priceMin = priceBand.min;
        params.priceMax = priceBand.max;
    }
    if (spaceBand.min !== null) {
        params.spaceMin = spaceBand.min;
        params.spaceMax = spaceBand.max;
    }

    const query = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
    );

    return {
        url: `${searchBaseUrl}?${query.toString()}`,
        params,
        missing,
    };
}

/**
 * How close is a candidate to the subject? Lower is more similar.
 *
 * Blends relative surface distance with relative price-per-m² distance, so a
 * flat that is the right size but wildly overpriced does not outrank a slightly
 * smaller one at a sane price. Both terms are relative, so the score is
 * comparable across price brackets.
 */
export function similarityScore(subject, candidate) {
    const parts = [];

    const sSurface = toNumber(subject?.livingArea);
    const cSurface = toNumber(candidate?.livingArea);
    if (sSurface && cSurface) parts.push(Math.abs(cSurface - sSurface) / sSurface);

    const sPerSqm = toNumber(subject?.squareMeterPrice)
        ?? (toNumber(subject?.price) && sSurface ? subject.price / sSurface : null);
    const cPerSqm = toNumber(candidate?.squareMeterPrice)
        ?? (toNumber(candidate?.price) && cSurface ? candidate.price / cSurface : null);
    if (sPerSqm && cPerSqm) parts.push(Math.abs(cPerSqm - sPerSqm) / sPerSqm);

    const sRooms = toNumber(subject?.rooms);
    const cRooms = toNumber(candidate?.rooms);
    if (sRooms && cRooms) parts.push(Math.abs(cRooms - sRooms) / Math.max(sRooms, 1) * 0.5);

    if (!parts.length) return Number.POSITIVE_INFINITY;
    return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/** Signed percentage difference vs the subject, rounded to 1 decimal. */
export function relativeDelta(subjectValue, candidateValue) {
    const s = toNumber(subjectValue);
    const c = toNumber(candidateValue);
    if (!s || c === null) return null;
    return Number((((c - s) / s) * 100).toFixed(1));
}

/**
 * Rank candidates by similarity, drop the subject itself, cap the list.
 * Returns fewer than `maxComparables` without complaint when the search area
 * is thin — that is expected, not an error.
 */
export function selectComparables(subject, candidates, criteria = {}) {
    const { maxComparables } = { ...DEFAULT_CRITERIA, ...criteria };

    const subjectIds = new Set(
        [subject?.id, subject?.publicId].filter(Boolean).map(String),
    );

    return candidates
        .filter((c) => c && !subjectIds.has(String(c.id)) && !subjectIds.has(String(c.publicId)))
        .map((c) => ({
            ...c,
            comparison: {
                similarityScore: Number(similarityScore(subject, c).toFixed(4)),
                priceDeltaPct: relativeDelta(subject?.price, c.price),
                surfaceDeltaPct: relativeDelta(subject?.livingArea, c.livingArea),
                squareMeterPriceDeltaPct: relativeDelta(subject?.squareMeterPrice, c.squareMeterPrice),
                roomsDelta:
                    toNumber(c.rooms) !== null && toNumber(subject?.rooms) !== null
                        ? toNumber(c.rooms) - toNumber(subject.rooms)
                        : null,
            },
        }))
        .sort((a, b) => a.comparison.similarityScore - b.comparison.similarityScore)
        .slice(0, maxComparables);
}
