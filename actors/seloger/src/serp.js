import { SERP_STATE_KEY, SERP_DATA_KEY } from './constants.js';
import { asArray, pick, toNumber, toInt } from './utils.js';

/* -------------------------------------------------------------------------- */
/* Reading the search-results model                                           */
/* -------------------------------------------------------------------------- */

/** Read the SERP payload from the live page. */
export async function serpFromPage(page) {
    return page.evaluate(
        ([stateKey, dataKey]) =>
            window[stateKey]?.data?.[dataKey]?.pageProps ?? null,
        [SERP_STATE_KEY, SERP_DATA_KEY],
    );
}

/**
 * Same, from raw HTML. The fetcher cache is assigned the same double-encoded
 * way as the detail-page blob: `window["KEY"]=JSON.parse("...")`.
 */
export function serpFromHtml(html) {
    if (!html) return null;

    const anchor = html.indexOf(`window["${SERP_STATE_KEY}"]`);
    if (anchor === -1) return null;

    const parseAt = html.indexOf('JSON.parse(', anchor);
    if (parseAt === -1) return null;

    const openQuote = html.indexOf('"', parseAt);
    if (openQuote === -1) return null;

    let i = openQuote + 1;
    let escaped = false;
    for (; i < html.length; i++) {
        const char = html[i];
        if (escaped) { escaped = false; continue; }
        if (char === '\\') { escaped = true; continue; }
        if (char === '"') break;
    }

    try {
        const state = JSON.parse(JSON.parse(html.slice(openQuote, i + 1)));
        return pick(state, ['data', SERP_DATA_KEY, 'pageProps']);
    } catch {
        return null;
    }
}

/* -------------------------------------------------------------------------- */
/* Mapping one result card                                                    */
/* -------------------------------------------------------------------------- */

const factValue = (facts, type) =>
    asArray(facts).find((f) => f?.type === type)?.splitValue ?? null;

/**
 * One search-result card → a compact comparable record.
 *
 * Cards carry a numeric `rawData` block, which is preferable to re-parsing the
 * formatted French strings in `hardFacts`. `hardFacts` is the fallback.
 *
 * Note: cards expose `energyClass` (the DPE letter) but NOT the GES letter or
 * the kWh/CO2 figures. If you need those for a comparable, you have to visit
 * its detail page — see `fetchComparableDetails` in the actor input.
 */
export function mapSerpCard(card) {
    if (!card) return null;

    const raw = pick(card, ['rawData'], {}) || {};
    const facts = pick(card, ['hardFacts', 'facts'], []);
    const address = pick(card, ['location', 'address'], {}) || {};

    const price = toInt(raw.price) ?? toInt(pick(card, ['hardFacts', 'price', 'value']));
    const livingArea = toNumber(raw?.surface?.main) ?? toNumber(factValue(facts, 'livingSpace'));

    const geoId = (typeKey) =>
        asArray(raw.geoIdHierarchy).find((entry) => entry?.typeKey === typeKey)?.id ?? null;

    // SeLoger publishes the neighbourhood in `location.address.district`
    // (e.g. "Lorette-Martyrs"). Compose the label shown on each card:
    //   "<district>, <city> (<zipCode>)"
    const district = address.district ?? null;
    const cityLine = [district, address.city].filter(Boolean).join(', ');
    const fullAddress = cityLine
        ? (address.zipCode ? `${cityLine} (${address.zipCode})` : cityLine)
        : (address.zipCode ?? null);

    return {
        publicId: card.id ?? null,
        id: toInt(pick(card, ['metadata', 'legacyId'])),
        url: card.url ?? null,
        title: pick(card, ['hardFacts', 'title']),

        price,
        priceUnit: '€',
        squareMeterPrice:
            price && livingArea ? Number((price / livingArea).toFixed(2)) : null,

        livingArea,
        livingAreaUnit: 'm²',
        plotArea: toNumber(raw?.surface?.plot),
        rooms: toInt(raw.nbroom) ?? toInt(factValue(facts, 'numberOfRooms')),
        bedrooms: toInt(raw.nbbedroom) ?? toInt(factValue(facts, 'numberOfBedrooms')),

        // Cards carry the DPE letter only. GES is detail-page-only.
        dpe: card.energyClass ?? null,
        ges: null,

        district,
        address: fullAddress,
        city: address.city ?? null,
        zipCode: address.zipCode ?? null,
        districtGeoId: geoId('AD08'),

        propertyType: raw.propertyType ?? null,
        propertyTypeLabel: raw.propertyTypeLabel ?? null,
        distributionType: raw.distributionType ?? null,

        agencyName: pick(card, ['cardProvider', 'name']) ?? pick(card, ['provider', 'name']),
        isPrivateOwner: card.type === 'PRIVATE',
        isExclusive: Boolean(pick(card, ['tags', 'isExclusive'])),
        isNew: Boolean(pick(card, ['tags', 'isNew'])),

        createdAt: pick(card, ['metadata', 'creationDate']),
        updatedAt: pick(card, ['metadata', 'updateDate']),
    };
}

/**
 * Every card on the page, in SeLoger's own order.
 * `classifieds` is the ordered id list; `classifiedsData` is keyed by that id.
 */
export function mapSerpResults(pageProps) {
    if (!pageProps) return { results: [], totalCount: 0, page: null };

    const ids = asArray(pageProps.classifieds);
    const data = pageProps.classifiedsData ?? {};

    const results = ids
        .map((id) => mapSerpCard(data[id]))
        .filter((record) => record && record.publicId);

    return {
        results,
        totalCount: toInt(pageProps.totalCount) ?? results.length,
        page: toInt(pageProps.page) ?? 1,
    };
}
