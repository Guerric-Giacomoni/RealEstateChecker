import { ScrapeError, startScrapeRun } from "@/lib/scraper";

/**
 * POST /api/scrape/start  { url } → start the Apify run, return { runId,
 * datasetId, source }. The client then polls /api/scrape/poll. Runs server-side
 * only, so APIFY_TOKEN never reaches the browser.
 */
export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return Response.json({ error: "URL manquante." }, { status: 400 });
  }

  try {
    const started = await startScrapeRun(url);
    return Response.json(started);
  } catch (e) {
    if (e instanceof ScrapeError) {
      return Response.json({ error: e.message, code: e.code }, { status: e.status });
    }
    console.error("[scrape/start] unexpected error", e);
    return Response.json({ error: "Erreur inattendue au démarrage de l'analyse." }, { status: 500 });
  }
}
