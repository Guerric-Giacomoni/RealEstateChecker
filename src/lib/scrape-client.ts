import type { ScrapePoll, ScrapeStart } from "./scraper/types";

/** Thrown by the client helpers; `message` is safe to show to the user. */
export class ScrapeClientError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "ScrapeClientError";
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ScrapeClientError("Impossible de contacter le serveur. Vérifiez votre connexion.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ScrapeClientError(data.error ?? "Échec de l'analyse de l'annonce.", data.code);
  }
  return data as T;
}

/** Start an async Apify run for a listing URL. */
export function startScrapeClient(url: string): Promise<ScrapeStart> {
  return post<ScrapeStart>("/api/scrape/start", { url });
}

/** Poll a running scrape for its current progress. */
export function pollScrapeClient(
  runId: string,
  datasetId: string,
  source: string,
  url: string,
): Promise<ScrapePoll> {
  return post<ScrapePoll>("/api/scrape/poll", { runId, datasetId, source, url });
}
