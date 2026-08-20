import {
  LEBONCOIN_ACTOR,
  SELOGER_ACTOR,
  getApifyDatasetItems,
  getApifyRunStatus,
  isTerminalStatus,
  startApifyRun,
} from "./apify";
import { mapLeboncoinItem } from "./leboncoin";
import { mapSelogerDataset } from "./seloger";
import { ScrapeError, type ListingSource, type ScrapePoll, type ScrapeStart } from "./types";

export { ScrapeError };
export type { ListingSource, ScrapePoll, ScrapeStart };

/** Identify the portal from a pasted URL. */
export function detectSource(rawUrl: string): ListingSource {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "unknown";
  }
  if (host.endsWith("leboncoin.fr")) return "leboncoin";
  if (host.endsWith("seloger.com")) return "seloger";
  if (host.endsWith("bienici.com")) return "bienici";
  if (host.endsWith("pap.fr")) return "pap";
  return "unknown";
}

/** Start the Apify run for a listing URL (async) — the client then polls it. */
export async function startScrapeRun(rawUrl: string): Promise<ScrapeStart> {
  const url = rawUrl.trim();
  const source = detectSource(url);

  if (source === "seloger") {
    // `comparablesFor` scrapes the listing AND its comparables in one run
    // (subject record first, then comparable records). requestListSources →
    // objects, not strings, so Apify's input validation passes.
    const run = await startApifyRun(SELOGER_ACTOR, { comparablesFor: [{ url }] });
    return { ...run, source };
  }

  if (source === "leboncoin") {
    const run = await startApifyRun(LEBONCOIN_ACTOR, {
      urls_list: [url],
      max_pages: 1,
      limit_per_page: 1,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"],
        apifyProxyCountry: "FR",
      },
    });
    return { ...run, source };
  }

  if (source === "unknown") {
    throw new ScrapeError(
      "URL non reconnue. Collez un lien Leboncoin ou SeLoger (Bien'ici, PAP à venir).",
      "unsupported_url",
      400,
    );
  }
  throw new ScrapeError(
    `${source} n'est pas encore pris en charge — Leboncoin et SeLoger pour l'instant.`,
    "unsupported_url",
    400,
  );
}

/**
 * Snapshot a running scrape: run status + whatever it has pushed so far, mapped
 * into a progressive result. `property` is present once the subject exists;
 * `comparables` fill in near the end.
 */
export async function pollScrapeRun(
  runId: string,
  datasetId: string,
  source: ListingSource,
  url: string,
): Promise<ScrapePoll> {
  const [status, items] = await Promise.all([
    getApifyRunStatus(runId),
    getApifyDatasetItems(datasetId),
  ]);
  const poll: ScrapePoll = { status, done: isTerminalStatus(status), comparables: [], warnings: [] };

  if (items.length) {
    try {
      const mapped =
        source === "seloger" ? mapSelogerDataset(items, url) : mapLeboncoinItem(items[0], url);
      poll.property = mapped.property;
      poll.assumptions = mapped.assumptions;
      poll.comparables = mapped.comparables;
      poll.warnings = mapped.warnings;
    } catch {
      // Subject not scraped yet (early poll) — leave property undefined and let
      // the client keep polling.
    }
  }
  return poll;
}
