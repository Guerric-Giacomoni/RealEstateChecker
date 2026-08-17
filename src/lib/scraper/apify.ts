import { ScrapeError } from "./types";

/**
 * Apify layer.
 *
 * Instead of fetching HTML ourselves and fighting DataDome, we call ready-made
 * Apify actors that return already-structured listing data:
 *
 *   Leboncoin → scrapifier/leboncoin-universal-scraper   (input: urls_list[])
 *   SeLoger   → azzouzana/seloger-mass-products-...       (input: startUrls[])
 *
 * The token comes from env so it never reaches the browser (this only runs in
 * the /api/scrape route). Actor IDs are overridable via env if they change.
 */

export const LEBONCOIN_ACTOR =
  process.env.APIFY_LEBONCOIN_ACTOR || "scrapifier~leboncoin-universal-scraper";
export const SELOGER_ACTOR =
  process.env.APIFY_SELOGER_ACTOR || "enheartening_scorecard~seloger-listing-scraper";

/**
 * Run an actor synchronously and return its dataset items.
 * Actor IDs use `~` (not `/`) in the API path, e.g. `user~actor-name`.
 */
export async function runApifyActor(actorId: string, input: unknown): Promise<unknown[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new ScrapeError(
      "Aucun token Apify configuré. Ajoutez APIFY_TOKEN (voir .env.example).",
      "provider_not_configured",
      500,
    );
  }

  const id = actorId.replace("/", "~");
  const endpoint = `https://api.apify.com/v2/acts/${id}/run-sync-get-dataset-items?token=${token}`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      // Actor runs (proxy + anti-bot) are slow; the sync endpoint allows minutes.
      signal: AbortSignal.timeout(180_000),
    });
  } catch (e) {
    const aborted = (e as Error).name === "TimeoutError";
    throw new ScrapeError(
      aborted
        ? "Le scraping a dépassé le délai d'attente. Réessayez."
        : `Apify n'a pas répondu (${(e as Error).message}).`,
      "fetch_failed",
    );
  }

  if (res.status === 401) {
    throw new ScrapeError("Token Apify invalide.", "provider_not_configured", 500);
  }
  if (res.status === 402) {
    throw new ScrapeError("Quota / crédits Apify épuisés.", "fetch_failed");
  }
  if (res.status === 404) {
    throw new ScrapeError("Acteur Apify introuvable.", "fetch_failed", 500);
  }
  if (!res.ok) {
    // Apify errors carry a JSON body { error: { type, message } } — surface it
    // so schema/input failures (400) are actually diagnosable.
    const detail = await apifyErrorMessage(res);
    throw new ScrapeError(
      `Apify a renvoyé une erreur ${res.status}${detail ? ` : ${detail}` : ""}.`,
      "fetch_failed",
    );
  }

  let items: unknown;
  try {
    items = await res.json();
  } catch {
    throw new ScrapeError("Réponse Apify illisible.", "parse_failed");
  }
  if (!Array.isArray(items)) {
    throw new ScrapeError("Réponse Apify inattendue.", "parse_failed");
  }
  return items;
}

/** Best-effort extraction of Apify's error message from a failed response. */
async function apifyErrorMessage(res: Response): Promise<string | null> {
  try {
    const body = await res.json();
    return body?.error?.message ?? null;
  } catch {
    return null;
  }
}
