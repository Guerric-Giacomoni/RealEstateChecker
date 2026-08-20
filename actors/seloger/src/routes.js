import { createPlaywrightRouter } from 'crawlee';
import { Dataset } from 'apify';

import { BLOCK_MARKERS, LABELS, SERP_STATE_KEY } from './constants.js';
import { classifiedFromPage, classifiedFromHtml, mapClassified } from './extractor.js';
import { serpFromPage, serpFromHtml, mapSerpResults } from './serp.js';
import { buildComparablesSearchUrl, selectComparables } from './comparables.js';

export const router = createPlaywrightRouter();

/** True when DataDome (or a soft-block interstitial) answered instead of SeLoger. */
function looksBlocked(html, status) {
    if (status === 403 || status === 429) return true;
    if (!html) return true;
    const head = html.slice(0, 8000);
    return BLOCK_MARKERS.some((marker) => head.includes(marker));
}

/** Shared guard: throws on a block so Crawlee retries on a fresh session. */
async function guard({ page, response, request }) {
    const status = response?.status();
    const html = await page.content();

    if (looksBlocked(html, status)) {
        throw new Error(`Blocked or challenged (HTTP ${status}) — retrying with a new session.`);
    }
    return { html, status, url: request.url };
}

/* -------------------------------------------------------------------------- */
/* Listing detail pages                                                       */
/* -------------------------------------------------------------------------- */

async function handleDetail(context) {
    const { request, page, log, crawler } = context;
    const { html, status } = await guard(context);

    if (status === 404 || /annonce (n['’]est plus disponible|introuvable)/i.test(html)) {
        log.warning(`Listing gone: ${request.url}`);
        await Dataset.pushData({ recordType: 'subject', actorInputUrl: request.url, is404: true });
        return;
    }

    let classified = await classifiedFromPage(page);
    if (!classified) {
        log.debug('window state unavailable, falling back to HTML parsing.');
        classified = classifiedFromHtml(html);
    }
    if (!classified) {
        throw new Error(
            'Listing model not found in page. SeLoger may have changed its state key — check src/constants.js.',
        );
    }

    const record = mapClassified(classified, request.url);
    const { role = 'listing', criteria = {} } = request.userData ?? {};

    log.info(
        `✓ ${record.reference ?? record.id} — ${record.price} € — ${record.livingArea} m² — DPE ${record.dpe ?? '?'} / GES ${record.ges ?? '?'}`,
    );

    await Dataset.pushData({
        recordType: role === 'subject' ? 'subject' : 'listing',
        ...record,
    });

    if (role !== 'subject') return;

    /* ---- comparables: derive the search from what we just scraped ---- */

    const search = buildComparablesSearchUrl(record, criteria);

    if (!search.url) {
        log.warning(
            `Cannot build a comparables search for ${request.url} — missing ${search.missing.join(', ')}.`,
        );
        await Dataset.pushData({
            recordType: 'comparablesSummary',
            subjectId: record.id,
            searchUrl: null,
            skipped: true,
            reason: `missing ${search.missing.join(', ')}`,
        });
        return;
    }

    log.info(
        `→ comparables search: ${search.params.estateTypes} in ${search.params.locations}, ` +
        `${search.params.priceMin}–${search.params.priceMax} €, ${search.params.spaceMin}–${search.params.spaceMax} m²`,
    );

    await crawler.addRequests([
        {
            url: search.url,
            label: LABELS.SERP,
            userData: { role: 'comparables', subject: record, criteria, searchParams: search.params },
        },
    ]);
}

router.addHandler(LABELS.DETAIL, handleDetail);

/* -------------------------------------------------------------------------- */
/* Search-results pages                                                       */
/* -------------------------------------------------------------------------- */

router.addHandler(LABELS.SERP, async (context) => {
    const { request, page, log } = context;
    const { html } = await guard(context);

    // The fetcher cache ships in the HTML, but the inline script has to have
    // executed before `window` exposes it. Give it a moment, then fall back to
    // parsing the raw HTML — which works even if scripts never ran at all.
    await page
        .waitForFunction((key) => Boolean(window[key]?.data), SERP_STATE_KEY, { timeout: 15_000 })
        .catch(() => {});

    let pageProps = await serpFromPage(page);
    if (!pageProps) pageProps = serpFromHtml(html);

    if (!pageProps) {
        throw new Error(
            'Search results not found in page. SeLoger may have changed its SERP state key — check src/constants.js.',
        );
    }

    const { results, totalCount, page: pageNumber } = mapSerpResults(pageProps);
    const { role, subject, criteria = {}, searchParams = null } = request.userData ?? {};

    log.info(`Search returned ${results.length} cards (${totalCount} total matches, page ${pageNumber}).`);

    if (role !== 'comparables' || !subject) {
        // Plain search mode: emit every card as its own record.
        for (const result of results) {
            await Dataset.pushData({ recordType: 'searchResult', searchUrl: request.url, ...result });
        }
        return;
    }

    const comparables = selectComparables(subject, results, criteria);

    for (const comparable of comparables) {
        await Dataset.pushData({
            recordType: 'comparable',
            subjectId: subject.id,
            searchUrl: request.url,
            ...comparable,
        });
    }

    const prices = comparables.map((c) => c.squareMeterPrice).filter(Number.isFinite).sort((a, b) => a - b);
    const median = prices.length
        ? prices.length % 2
            ? prices[(prices.length - 1) / 2]
            : Number(((prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2).toFixed(2))
        : null;

    await Dataset.pushData({
        recordType: 'comparablesSummary',
        subjectId: subject.id,
        subjectReference: subject.reference,
        subjectPrice: subject.price,
        subjectLivingArea: subject.livingArea,
        subjectSquareMeterPrice: subject.squareMeterPrice,
        searchUrl: request.url,
        searchParams,
        totalMatches: totalCount,
        cardsOnPage: results.length,
        comparablesReturned: comparables.length,
        // Only page 1 is read: with a ±15% / ±20% filter the match count is
        // almost always under 30, and we cap the output at 10 anyway.
        truncatedByPageSize: totalCount > results.length,
        medianComparableSquareMeterPrice: median,
        subjectVsMedianPct:
            median && subject.squareMeterPrice
                ? Number((((subject.squareMeterPrice - median) / median) * 100).toFixed(1))
                : null,
    });

    log.info(
        `✓ ${comparables.length} comparables for ${subject.reference ?? subject.id}` +
        (median ? ` — median ${median} €/m² vs subject ${subject.squareMeterPrice} €/m²` : ''),
    );
});

/* Anything unlabelled is treated as a listing detail page. */
router.addDefaultHandler(handleDetail);
