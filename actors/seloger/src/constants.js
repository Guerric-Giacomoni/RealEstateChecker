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
