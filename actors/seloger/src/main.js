import { Actor } from 'apify';
import { PlaywrightCrawler } from 'crawlee';

import { router } from './routes.js';

await Actor.init();

const {
    startUrls = [],
    proxyConfiguration: proxyInput = {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
        apifyProxyCountry: 'FR',
    },
    maxConcurrency = 2,
    maxRequestRetries = 5,
    headless = true,
} = (await Actor.getInput()) ?? {};

if (!startUrls.length) {
    throw new Error('No startUrls provided. Pass at least one SeLoger listing URL.');
}

const proxyConfiguration = await Actor.createProxyConfiguration(proxyInput);

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    requestHandler: router,
    maxConcurrency,
    maxRequestRetries,
    // A listing page is one navigation; anything past a minute is a hung session.
    requestHandlerTimeoutSecs: 90,
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
            // The listing model is server-rendered, so we do not need the page to
            // finish painting. Dropping media/fonts/ads cuts page weight by ~80%
            // and removes most of the third-party scripts that fingerprint us.
            await page.route('**/*', (route) => {
                const type = route.request().resourceType();
                const url = route.request().url();
                const isNoise =
                    ['image', 'media', 'font'].includes(type) ||
                    /doubleclick|googletagmanager|google-analytics|adtrafficquality|criteo|usercentrics|sodar/i.test(url);
                return isNoise ? route.abort() : route.continue();
            });

            await page.setExtraHTTPHeaders({
                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            });

            // `domcontentloaded` is enough: the state blob ships in the HTML.
            gotoOptions.waitUntil = 'domcontentloaded';
        },
    ],

    failedRequestHandler: async ({ request, log }) => {
        log.error(`Giving up on ${request.url} after ${request.retryCount} retries.`);
        await Actor.pushData({
            actorInputUrl: request.url,
            error: request.errorMessages?.at(-1) ?? 'unknown',
            is404: false,
            failed: true,
        });
    },
});

await crawler.run(
    startUrls.map((entry) => (typeof entry === 'string' ? { url: entry } : entry)),
);

await Actor.exit();
