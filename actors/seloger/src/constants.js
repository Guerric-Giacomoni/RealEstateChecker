/**
 * The whole listing model is server-rendered into the HTML inside a single
 * <script> tag that looks like:
 *
 *   window["__UFRN_LIFECYCLE_SERVERREQUEST__"]=JSON.parse("{\"app_cldp\":{\"data\":{\"classified\":{...
 *
 * Note the double encoding: the tag contains a JS *string literal* which itself
 * contains JSON. So parsing the HTML means JSON.parse() twice.
 */
export const STATE_KEY = '__UFRN_LIFECYCLE_SERVERREQUEST__';

/** Path to the listing model inside that blob. */
export const CLASSIFIED_PATH = ['app_cldp', 'data', 'classified'];

/** Substrings that mean DataDome (or a soft-block page) served us instead of SeLoger. */
export const BLOCK_MARKERS = [
    'geo.captcha-delivery.com',
    'captcha-delivery',
    'datadome',
    'Vous avez été bloqué',
    'blocked because we believe you are using automation tools',
];

/**
 * Search-results pages (`/classified-search`) hydrate from a DIFFERENT global
 * than detail pages — the fetcher cache rather than the lifecycle blob:
 *
 *   window.__UFRN_FETCHER__.data['classified-serp-init-data'].pageProps
 *     ├─ classifieds:     ["26U2BBCHZNQ3", ...]   ordered public ids
 *     ├─ classifiedsData: { "26U2BBCHZNQ3": {...} } card payload, keyed by id
 *     └─ totalCount:      32                      matches across all pages
 *
 * Each card carries numeric rawData (price, surface.main, nbroom, nbbedroom)
 * and `energyClass` (the DPE letter) — so a comparables run needs ONE search
 * request, not one detail request per comparable.
 */
export const SERP_STATE_KEY = '__UFRN_FETCHER__';
export const SERP_DATA_KEY = 'classified-serp-init-data';

/** SeLoger renders 30 cards per search page. We cap well below that. */
export const SERP_PAGE_SIZE = 30;

/** Request labels for the Crawlee router. */
export const LABELS = {
    DETAIL: 'DETAIL',
    SERP: 'SERP',
};
