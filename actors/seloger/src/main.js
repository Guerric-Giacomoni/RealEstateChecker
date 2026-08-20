import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

import { router } from './routes.js';
import { LABELS } from './constants.js';
import { DEFAULT_CRITERIA } from './comparables.js';

await Actor.init();

const {
    // Mode 1 — scrape these listings, nothing more.
    startUrls = [],
    // Mode 2 — scrape a listing, then find comparables for it.
    comparablesFor = [],
    // Mode 3 — run a search URL you built yourself.
    searchUrls = [],

    priceTolerance = DEFAULT_CRITERIA.priceTolerance,
    surfaceTolerance = DEFAULT_CRITERIA.surfaceTolerance,
    maxComparables = DEFAULT_CRITERIA.maxComparables,

    proxyConfiguration: proxyInput = {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
        apifyProxyCountry: 'FR',
    },
    maxConcurrency = 2,
    maxRequestRetries = 5,
    headless = true,
} = (await Actor.getInput()) ?? {};

const toUrl = (entry) => (typeof entry === 'string' ? entry : entry?.url);

// Apify's input schema has no float type, so the tolerances arrive as strings
// from the UI and as numbers from a raw API call. Accept both.
const ratio = (value, fallback) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
};

const criteria = {
    priceTolerance: ratio(priceTolerance, DEFAULT_CRITERIA.priceTolerance),
    surfaceTolerance: ratio(surfaceTolerance, DEFAULT_CRITERIA.surfaceTolerance),
    maxComparables: Number.parseInt(maxComparables, 10) || DEFAULT_CRITERIA.maxComparables,
};

const requests = [
    ...startUrls.map(toUrl).filter(Boolean).map((url) => ({
        url,
        label: LABELS.DETAIL,
        userData: { role: 'listing' },
    })),
    ...comparablesFor.map(toUrl).filter(Boolean).map((url) => ({
        url,
        label: LABELS.DETAIL,
        userData: { role: 'subject', criteria },
    })),
    ...searchUrls.map(toUrl).filter(Boolean).map((url) => ({
        url,
        label: LABELS.SERP,
        userData: { role: 'search' },
    })),
];

if (!requests.length) {
    throw new Error(
        'Nothing to do. Provide at least one of: startUrls, comparablesFor, or searchUrls.',
    );
}

const proxyConfiguration = await Actor.createProxyConfiguration(proxyInput);

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    requestHandler: router,
    maxConcurrency,
    maxRequestRetries,
    requestHandlerTimeoutSecs: 120,
    navigationTimeoutSecs: 60,

    // One IP per browser session, retired quickly. DataDome scores IP+fingerprint
    // pairs, so a session that has already been challenged is worth discarding.
    useSessionPool: true,
    persistCookiesPerSession: true,
    sessionPoolOptions: {
        maxPoolSize: 50,
        sessionOptions: { maxUsageCount: 5, maxErrorScore: 1 },
    },

    browserPoolOptions: {
        useFingerprints: true,
        fingerprintOptions: {
            fingerprintGeneratorOptions: {
                browsers: ['chrome'],
                devices: ['desktop'],
                operatingSystems: ['windows', 'macos'],
                locales: ['fr-FR'],
            },
        },
        retireBrowserAfterPageCount: 10,
    },

    launchContext: {
        launchOptions: {
            headless,
            args: ['--disable-blink-features=AutomationControlled'],
            // Escape hatch for local runs where the installed Playwright build
            // and the on-disk browser revision disagree. Unset on Apify.
            ...(process.env.CHROMIUM_EXECUTABLE_PATH
                ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
                : {}),
        },
    },

    preNavigationHooks: [
        async ({ page }, gotoOptions) => {
            // Both page types are server-rendered, so we do not need painting.
            // Dropping media/fonts/ads cuts page weight ~80% and removes most
            // of the third-party scripts that fingerprint us.
            await page.route('**/*', (route) => {
                const type = route.request().resourceType();
                const url = route.request().url();
                const isNoise =
                    ['image', 'media', 'font'].includes(type) ||
                    /doubleclick|googletagmanager|google-analytics|adtrafficquality|criteo|usercentrics|sodar/i.test(url);
                return isNoise ? route.abort() : route.continue();
            });

            await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' });
            gotoOptions.waitUntil = 'domcontentloaded';
        },
    ],

    failedRequestHandler: async ({ request, log }) => {
        log.error(`Giving up on ${request.url} after ${request.retryCount} retries.`);
        await Actor.pushData({
            recordType: 'error',
            actorInputUrl: request.url,
            label: request.label ?? null,
            error: request.errorMessages?.at(-1) ?? 'unknown',
            failed: true,
        });
    },
});

await crawler.run(requests);

await Actor.exit();
