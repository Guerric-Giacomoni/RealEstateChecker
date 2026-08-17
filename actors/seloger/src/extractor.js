import { STATE_KEY, CLASSIFIED_PATH } from './constants.js';
import { extractEnergy } from './energy.js';
import { asArray, pick, polygonCentroid, stripTags, toInt, toNumber } from './utils.js';

/* -------------------------------------------------------------------------- */
/* 1. Getting the model out of the page                                        */
/* -------------------------------------------------------------------------- */

/**
 * Pulls the listing model straight out of the raw HTML — no browser required.
 *
 * Kept separate from the Playwright path so the same mapping can be reused by a
 * cheap CheerioCrawler run, or unit-tested against a saved HTML fixture.
 */
export function classifiedFromHtml(html) {
    if (!html) return null;

    const anchor = html.indexOf(`window["${STATE_KEY}"]`);
    if (anchor === -1) return null;

    // The tag is `window["KEY"]=JSON.parse("....")`. Walk the JS string literal
    // by hand: it is full of escaped quotes, so a lazy regex gets it wrong.
    const openQuote = html.indexOf('"', html.indexOf('JSON.parse(', anchor));
    if (openQuote === -1) return null;

    let i = openQuote + 1;
    let escaped = false;
    for (; i < html.length; i++) {
        const char = html[i];
        if (escaped) { escaped = false; continue; }
        if (char === '\\') { escaped = true; continue; }
        if (char === '"') break;
    }

    const literal = html.slice(openQuote, i + 1);

    try {
        // First parse: JS string literal -> JSON text. Second: JSON text -> object.
        const state = JSON.parse(JSON.parse(literal));
        return pick(state, CLASSIFIED_PATH);
    } catch {
        return null;
    }
}

/** Same thing, but read from the live window object inside Playwright. */
export async function classifiedFromPage(page) {
    return page.evaluate(
        ([key, path]) => {
            let cursor = window[key];
            for (const segment of path) {
                if (!cursor) return null;
                cursor = cursor[segment];
            }
            return cursor ?? null;
        },
        [STATE_KEY, CLASSIFIED_PATH],
    );
}

/* -------------------------------------------------------------------------- */
/* 2. Mapping the model to the output schema                                   */
/* -------------------------------------------------------------------------- */

const factValue = (facts, type) => asArray(facts).find((f) => f?.type === type) ?? null;

function readHardFacts(classified) {
    const facts = pick(classified, ['sections', 'hardFacts', 'facts'], []);
    return {
        rooms: toInt(factValue(facts, 'numberOfRooms')?.splitValue),
        bedrooms: toInt(factValue(facts, 'numberOfBedrooms')?.splitValue),
        livingArea: toNumber(factValue(facts, 'livingSpace')?.splitValue),
        floors: toInt(factValue(facts, 'numberOfFloors')?.splitValue),
        floor: toInt(factValue(facts, 'floorNumber')?.splitValue),
        landArea: toNumber(factValue(facts, 'plotArea')?.splitValue),
        title: pick(classified, ['sections', 'hardFacts', 'title']),
        keyfacts: asArray(pick(classified, ['sections', 'hardFacts', 'keyfacts'], [])),
    };
}

function readKeys(classified) {
    const keys = pick(classified, ['sections', 'key', 'keys'], []);
    const byLabel = (re) => asArray(keys).find((k) => re.test(k?.label || ''))?.value ?? null;
    return {
        publicId: byLabel(/identifiant/i),
        reference: byLabel(/référence/i),
    };
}

/**
 * Loi ALUR block. Only the fee-responsibility flags and the price are actually
 * knowable from a sale detail page; the rental fields exist to keep the record
 * shape stable across sale and rental listings, and stay at their neutral value.
 */
function readAlur(classified, price) {
    const feeMessage =
        pick(classified, ['sections', 'price', 'breakdown', 'message', 'value']) ??
        pick(classified, ['sections', 'price', 'components', 0, 'units', 0, 'main', 'message', 'value']) ??
        '';

    const sellerPays = /charge\s+du\s+vendeur/i.test(feeMessage);
    const buyerPays = /charge\s+de\s+l['’]?acqu[ée]reur|charge\s+de\s+l['’]?acheteur/i.test(feeMessage);

    return {
        feesPercentage: 0,
        flatRateCharges: 0,
        idTypeOfFeesAccountant: sellerPays ? 2 : buyerPays ? 1 : 0,
        idTypeOfRentalFees: 0,
        ifAnnualReimbursement: false,
        ifFeesArePurchaserResponsability: buyerPays,
        ifFeesAreSellerResponsability: sellerPays,
        ifLumpSum: false,
        ifProvisionsOnCharges: false,
        inventoryPrice: 0,
        price: price ?? 0,
        priceExcludingFees: 0,
        priceSupplement: 0,
        renterFees: 0,
        rentalPledge: 0,
        rentSupplement: 0,
        textTemplate: 2,
        rentControl: false,
        increasedReferenceRent: 0,
        feeMessage: feeMessage || null,
    };
}

function readPublisher(classified) {
    const contact = pick(classified, ['contactSections'], {}) || {};
    const card = pick(contact, ['contactCard'], {}) || {};
    const provider = pick(contact, ['provider'], {}) || {};

    const legalLines = asArray(provider.agencyLegalInformations).map(stripTags);
    const legalText = legalLines.join(' | ');

    const match = (re) => legalText.match(re)?.[1]?.trim() ?? null;

    // Email is not part of the rendered contact card; SeLoger keeps it in the
    // lead-routing payload. Sweep the whole model rather than guess a path.
    const email = JSON.stringify(classified).match(
        /"([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})"/i,
    )?.[1] ?? null;

    return {
        name: card.subtitle ?? card.title ?? null,
        displayName: card.title ?? null,
        agencyId: contact.agencyId ?? null,
        idRcu: contact.agencyId ?? null,
        phoneNumber: asArray(card.phoneNumbers)[0] ?? asArray(pick(contact, ['static', 'phoneNumbers']))[0] ?? null,
        email,
        isPrivateOwner: Boolean(card.isPrivateOwner),
        logoUrl: pick(card, ['agencyLogo', 'logoUrl']),
        website: provider.website ?? null,
        address: provider.address ?? match(/Siège\s*:?\s*([^|]+)/i),
        legalForm: match(/^\s*(SASU|SAS|SARL|EURL|SA|SCI|SNC)\b/i),
        socialReason: match(/(?:SASU|SAS|SARL|EURL|SA|SCI|SNC)\s+([A-ZÀ-Ÿ0-9'’\- ]+?)\s+(?:SASU|SAS|SARL|EURL|SA|SCI|SNC)?\s*au capital/i),
        shareCapital: toNumber(match(/au capital de\s+([\d\s   ,.]+)\s*€/i)),
        financialGuaranteeFund: match(/Garantie financière\s+([A-ZÀ-Ÿ]+)/i),
        financialGuaranteeAmount: toNumber(match(/Garantie financière[^|]*?montant de\s+([\d\s   ,.]+)\s*€/i)),
        rcs: match(/RCS\s*:?\s*([^|]+)/i),
        siret: match(/SIRET\s*:?\s*([\d\s]+)/i)?.replace(/\s/g, '') ?? null,
        professionalCardNumber: match(/[Cc]arte professionnelle\s*:?\s*([\w\s]+)/i),
        legalInformations: legalLines,
    };
}

function readPriceComparison(classified) {
    const comparison = pick(classified, ['sections', 'priceComparison'], {}) || {};
    return {
        zoneSquareMeterPrice: toNumber(pick(comparison, ['data', 'value'])),
        minSquareMeterPrice: toNumber(pick(comparison, ['data', 'low'])),
        maxSquareMeterPrice: toNumber(pick(comparison, ['data', 'high'])),
        squareMeterPriceAccuracy: pick(comparison, ['data', 'accuracy']),
        marketInsightsPlaceId: pick(comparison, ['marketInsights', 'placeId']),
    };
}

function readMedia(classified) {
    const images = asArray(pick(classified, ['domains', 'medias', 'images'], []))
        .map((image) => image?.url)
        .filter(Boolean);

    const galleryImages = asArray(pick(classified, ['sections', 'gallery', 'images'], []))
        .map((image) => image?.url)
        .filter(Boolean);

    const floorplans = asArray(pick(classified, ['domains', 'medias', 'floorplans'], []))
        .map((plan) => plan?.url ?? plan)
        .filter((value) => typeof value === 'string');

    const virtualTours = asArray(pick(classified, ['domains', 'medias', 'virtualTours'], []))
        .map((tour) => tour?.url ?? tour?.href ?? tour)
        .filter((value) => typeof value === 'string');

    const videos = asArray(pick(classified, ['domains', 'medias', 'videos'], []))
        .map((video) => video?.url ?? video)
        .filter((value) => typeof value === 'string');

    const photos = images.length ? images : galleryImages;

    return {
        photos,
        photosCount: photos.length,
        itemMainPicture: photos[0] ?? null,
        floorplans,
        virtualTours,
        videos,
        medias: [...virtualTours, ...videos],
    };
}

/**
 * Turns SeLoger's `classified` model into one flat output record.
 *
 * `dailyLife`, `transportations` and `priceVariations` are intentionally empty:
 * they are not server-rendered — the page fetches them over XHR after load, so
 * capturing them means waiting on those responses. This actor is configured to
 * skip that in exchange for speed and resilience. The keys stay present so the
 * record shape never changes.
 */
export function mapClassified(classified, requestUrl = null) {
    if (!classified) throw new Error('No classified model to map.');

    const hardFacts = readHardFacts(classified);
    const keys = readKeys(classified);
    const energy = extractEnergy(classified);
    const media = readMedia(classified);
    const tracking = pick(classified, ['legacyTracking', 'products', 0], {}) || {};

    const price = toInt(pick(classified, ['sections', 'mortgage', 'price'])) ?? toInt(tracking.price);
    const livingArea = hardFacts.livingArea ?? toNumber(tracking.space);
    const squareMeterPrice = toNumber(pick(classified, ['sections', 'priceComparison', 'pricePerSqm']));

    const address = pick(classified, ['sections', 'location', 'address'], {}) || {};
    const centroid = polygonCentroid(pick(classified, ['sections', 'location', 'geometry']));
    const isAddressPublished = Boolean(pick(classified, ['sections', 'location', 'isAddressPublished']));

    // `rawData.geoIdHierarchy` is [{ id:'AD08FR4602', typeKey:'AD08' }, ...]:
    // AD08 = district, AD06 = city, AD04 = department, AD03 = region.
    const geoId = (typeKey) =>
        asArray(pick(classified, ['rawData', 'geoIdHierarchy'], []))
            .find((entry) => entry?.typeKey === typeKey)?.id ?? null;

    const tags = pick(classified, ['tags'], {}) || {};

    const coOwnershipItems = asArray(pick(classified, ['sections', 'coOwnership', 'items'], []));
    const coOwnershipValue = (type) =>
        toNumber(coOwnershipItems.find((item) => item?.type === type)?.value);

    const features = asArray(pick(classified, ['sections', 'features', 'details', 'categories'], []))
        .flatMap((category) =>
            asArray(category.elements).map((element) => ({
                category: category.title ?? null,
                icon: element?.icon ?? null,
                value: element?.value ?? null,
                source: element?.enrichment === 'ai' ? 'ai' : 'listing',
            })),
        );

    return {
        /* --- identity ---------------------------------------------------- */
        id: toInt(pick(classified, ['metadata', 'legacyId'])) ?? toInt(tracking.id),
        publicId: keys.publicId ?? classified.id ?? null,
        reference: keys.reference,
        permalink: requestUrl,
        actorInputUrl: requestUrl,
        businessUnit: pick(classified, ['legacyTracking', 'site'], 'SL'),
        brand: classified.brand ?? null,

        /* --- headline ---------------------------------------------------- */
        title: hardFacts.title,
        headline: pick(classified, ['sections', 'description', 'headline']),
        description: pick(classified, ['sections', 'description', 'description']),
        keyfacts: hardFacts.keyfacts,

        /* --- price ------------------------------------------------------- */
        price,
        priceUnit: '€',
        squareMeterPrice,
        priceBlock: {
            price,
            priceUnit: '€',
            squareMeterPrice: squareMeterPrice === null ? null : Math.round(squareMeterPrice),
            squareMeterPriceUnit: '€ / m²',
        },
        aboutPrice: {
            text: [
                pick(classified, ['sections', 'price', 'price', 'formatted']),
                pick(classified, ['sections', 'price', 'breakdown', 'message', 'value']),
            ].filter(Boolean).join(' '),
        },
        monthlyMortgageEstimate: toInt(pick(classified, ['sections', 'mortgage', 'monthlyAmount'])),
        alur: readAlur(classified, price),
        ...readPriceComparison(classified),

        /* --- surface & layout -------------------------------------------- */
        rooms: hardFacts.rooms ?? toInt(tracking.nb_rooms),
        bedrooms: hardFacts.bedrooms ?? toInt(tracking.nb_bedrooms),
        livingArea,
        livingAreaUnit: 'm²',
        landArea: hardFacts.landArea,
        floors: hardFacts.floors,
        floor: hardFacts.floor,

        /* --- energy: the point of this actor ------------------------------ */
        dpe: energy.dpe,
        ges: energy.ges,
        energyBalance: energy.energyBalance,

        /* --- location ----------------------------------------------------- */
        city: address.city ?? null,
        zipCode: address.zipCode ?? null,
        country: address.country ?? null,
        locality: {
            // SeLoger no longer server-renders the district *name* on the detail
            // page — only its geo id. Resolve it downstream from districtGeoId if
            // you need the label ("Coeur Centre Ville" for AD08FR4602).
            district: null,
            districtGeoId: geoId('AD08') ?? pick(classified, ['sections', 'priceComparison', 'marketInsights', 'placeId']),
            cityGeoId: geoId('AD06'),
            departmentGeoId: geoId('AD04'),
            city: address.city ?? null,
            zipCode: address.zipCode ?? null,
            departmentCode: address.zipCode ? String(address.zipCode).slice(0, 2) : null,
        },
        isAddressPublished,
        // NOTE: approximate. See polygonCentroid() — SeLoger publishes a district
        // polygon, not a point, unless the seller opted into exact geocoding.
        coordinates: centroid
            ? { ...centroid, accuracy: isAddressPublished ? 1 : 2, source: 'district-polygon-centroid' }
            : null,

        /* --- co-ownership -------------------------------------------------- */
        condoProperties: coOwnershipValue('numberOfUnits'),
        condoAnnualCharges: coOwnershipValue('annualCharges') ?? 0,

        /* --- features ------------------------------------------------------ */
        features,

        /* --- media --------------------------------------------------------- */
        ...media,

        /* --- publisher ------------------------------------------------------ */
        publisher: readPublisher(classified),
        isIndividual: Boolean(pick(classified, ['contactSections', 'contactCard', 'isPrivateOwner'])),

        /* --- flags (classified.tags is an object, not an array) ---------------- */
        isExclusiveness: Boolean(tags.isExclusive),
        isNew: Boolean(tags.isNew),
        has3DVisit: Boolean(tags.has3DVisit),
        hasBrokerageFee: Boolean(tags.hasBrokerageFee),

        /* --- classification codes -------------------------------------------- */
        transactionType: toInt(tracking.distribution_type),
        transactionTypeLetters: String(tracking.distribution_type) === '2' ? 'Vente' : 'Location',
        realEstat: pick(classified, ['rawData', 'propertyTypeLabel']),
        propertyType: pick(classified, ['rawData', 'propertyType']),
        propertySubType: pick(classified, ['rawData', 'propertySubType']),
        estateTypeCode: toInt(tracking.estate_type),

        /* --- dates ------------------------------------------------------------ */
        created: pick(classified, ['metadata', 'creationDate']),
        lastModified: pick(classified, ['metadata', 'updateDate']),
        scrapedAt: new Date().toISOString(),

        /* --- client-side-only, deliberately not fetched ------------------------ */
        dailyLife: [],
        transportations: [],
        priceVariations: [],
        schools: [],
        comments: [],

        is404: false,
    };
}
