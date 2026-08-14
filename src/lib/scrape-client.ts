import type { ScrapeResult } from "./scraper/types";

/** Thrown by the client helper; `message` is safe to show to the user. */
export class ScrapeClientError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "ScrapeClientError";
  }
}

/** Call POST /api/scrape from the browser to scrape a listing URL. */
export async function scrapeListingClient(url: string): Promise<ScrapeResult> {
  let res: Response;
  try {
    res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new ScrapeClientError("Impossible de contacter le serveur. Vérifiez votre connexion.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ScrapeClientError(data.error ?? "Échec de l'analyse de l'annonce.", data.code);
  }
  return data as ScrapeResult;
}
