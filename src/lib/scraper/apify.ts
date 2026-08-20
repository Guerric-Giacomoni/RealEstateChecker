import { ScrapeError } from "./types";

/**
 * Apify layer.
 *
 * We call ready-made Apify actors that return already-structured listing data:
 *
 *   Leboncoin → scrapifier/leboncoin-universal-scraper   (input: urls_list[])
 *   SeLoger   → our own seloger-listing-scraper           (input: comparablesFor[])
 *
 * Runs are started ASYNC and polled, because a SeLoger comparables run can take
 * several minutes (DataDome retries) — far longer than the synchronous endpoint
 * (or a browser request) will wait. The token comes from env so it never
 * reaches the browser (this only runs in the /api/scrape/* routes).
 */

export const LEBONCOIN_ACTOR =
  process.env.APIFY_LEBONCOIN_ACTOR || "scrapifier~leboncoin-universal-scraper";
export const SELOGER_ACTOR =
  process.env.APIFY_SELOGER_ACTOR || "enheartening_scorecard~seloger-listing-scraper";

const TERMINAL_STATUSES = ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT", "TIMED_OUT"];

/** True once a run has stopped (successfully or not). */
export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.includes(status);
}

function token(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) {
    throw new ScrapeError(
      "Aucun token Apify configuré. Ajoutez APIFY_TOKEN (voir .env.example).",
      "provider_not_configured",
      500,
    );
  }
  return t;
}

/** Start an actor run (async) and return its id + default dataset id. */
export async function startApifyRun(
  actorId: string,
  input: unknown,
): Promise<{ runId: string; datasetId: string }> {
  const id = actorId.replace("/", "~");
  const res = await apiFetch(`https://api.apify.com/v2/acts/${id}/runs?token=${token()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const run = (await res.json().catch(() => null))?.data;
  if (!run?.id || !run?.defaultDatasetId) {
    throw new ScrapeError("Réponse Apify inattendue au démarrage du run.", "fetch_failed");
  }
  return { runId: run.id, datasetId: run.defaultDatasetId };
}

/** Current status of a run (RUNNING, SUCCEEDED, FAILED…). */
export async function getApifyRunStatus(runId: string): Promise<string> {
  const res = await apiFetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token()}`);
  return (await res.json().catch(() => null))?.data?.status ?? "UNKNOWN";
}

/** Items pushed to a run's dataset so far (grows as the run progresses). */
export async function getApifyDatasetItems(datasetId: string): Promise<unknown[]> {
  const res = await apiFetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token()}&clean=true`,
  );
  const items = await res.json().catch(() => null);
  return Array.isArray(items) ? items : [];
}

/** Shared fetch with a per-request timeout and Apify error mapping. */
async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  } catch (e) {
    throw new ScrapeError(`Apify n'a pas répondu (${(e as Error).message}).`, "fetch_failed");
  }
  if (res.status === 401) {
    throw new ScrapeError("Token Apify invalide.", "provider_not_configured", 500);
  }
  if (res.status === 402) {
    throw new ScrapeError("Quota / crédits Apify épuisés.", "fetch_failed");
  }
  if (res.status === 404) {
    throw new ScrapeError("Acteur ou run Apify introuvable.", "fetch_failed", 500);
  }
  if (!res.ok) {
    const detail = await res
      .json()
      .then((b) => b?.error?.message ?? null)
      .catch(() => null);
    throw new ScrapeError(
      `Apify a renvoyé une erreur ${res.status}${detail ? ` : ${detail}` : ""}.`,
      "fetch_failed",
    );
  }
  return res;
}
