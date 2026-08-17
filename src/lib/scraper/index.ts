import { LEBONCOIN_ACTOR, SELOGER_ACTOR, runApifyActor } from "./apify";
import { mapLeboncoinItem } from "./leboncoin";
import { mapSelogerItem } from "./seloger";
import { ScrapeError, type ListingSource, type ScrapeResult } from "./types";

export { ScrapeError };
export type { ScrapeResult, ListingSource };

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

/** Fetch (via Apify) + map a listing URL into the app's Property/Assumptions shape. */
export async function scrapeListing(rawUrl: string): Promise<ScrapeResult> {
  const url = rawUrl.trim();
  const source = detectSource(url);

  if (source === "leboncoin") {
    const items = await runApifyActor(LEBONCOIN_ACTOR, {
      urls_list: [url],
      max_pages: 1,
      limit_per_page: 1,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"],
        apifyProxyCountry: "FR",
      },
    });
    return mapLeboncoinItem(firstItem(items), url);
  }

  if (source === "seloger") {
    // The actor's `startUrls` uses the requestListSources editor, so Apify's
    // input validation requires objects ({ url }), not bare strings.
    const items = await runApifyActor(SELOGER_ACTOR, { startUrls: [{ url }] });
    return mapSelogerItem(firstItem(items), url);
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

function firstItem(items: unknown[]): unknown {
  if (items.length === 0) {
    throw new ScrapeError(
      "Aucune donnée renvoyée pour cette annonce (lien expiré ou introuvable ?).",
      "not_found",
      404,
    );
  }
  return items[0];
}
