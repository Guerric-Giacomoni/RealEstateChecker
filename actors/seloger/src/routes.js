import { createPlaywrightRouter } from 'crawlee';
import { Dataset } from 'apify';

import { BLOCK_MARKERS } from './constants.js';
import { classifiedFromPage, classifiedFromHtml, mapClassified } from './extractor.js';

export const router = createPlaywrightRouter();

/** True when DataDome (or a soft-block interstitial) answered instead of SeLoger. */
function looksBlocked(html, status) {
    if (status === 403 || status === 429) return true;
    if (!html) return true;
    const head = html.slice(0, 8000);
    return BLOCK_MARKERS.some((marker) => head.includes(marker));
}

router.addDefaultHandler(async ({ request, page, response, log }) => {
    const status = response?.status();
    const html = await page.content();

    if (looksBlocked(html, status)) {
        // Throwing hands the request back to Crawlee, which retries it on a new
        // proxy session with a fresh fingerprint. Do not swallow this.
        throw new Error(`Blocked or challenged (HTTP ${status}) — retrying with a new session.`);
    }

    if (status === 404 || /annonce (n['’]est plus disponible|introuvable)/i.test(html)) {
        log.warning(`Listing gone: ${request.url}`);
        await Dataset.pushData({ actorInputUrl: request.url, is404: true });
        return;
    }

    // Preferred path: read the hydrated object straight off `window`.
    // Fallback: parse the same blob out of the raw HTML, which still works if
    // the page's JS failed to run (blocked script, aborted navigation).
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

    if (!record.price || !record.id) {
        log.warning(`Sparse record for ${request.url} (id=${record.id}, price=${record.price}).`);
    }

    log.info(`✓ ${record.reference ?? record.id} — ${record.price} € — ${record.livingArea} m² — DPE ${record.dpe ?? '?'} / GES ${record.ges ?? '?'}`);

    await Dataset.pushData(record);
});
