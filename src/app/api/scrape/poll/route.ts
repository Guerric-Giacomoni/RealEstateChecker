import { ScrapeError, pollScrapeRun, type ListingSource } from "@/lib/scraper";

/**
 * POST /api/scrape/poll  { runId, datasetId, source, url } → a progressive
 * snapshot of the run (status, done, property?, comparables). The client calls
 * this on an interval until `done`.
 */
export async function POST(request: Request) {
  let body: { runId?: string; datasetId?: string; source?: ListingSource; url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { runId, datasetId, source } = body;
  if (!runId || !datasetId || !source) {
    return Response.json({ error: "Paramètres de suivi manquants." }, { status: 400 });
  }

  try {
    const poll = await pollScrapeRun(runId, datasetId, source, body.url ?? "");
    return Response.json(poll);
  } catch (e) {
    if (e instanceof ScrapeError) {
      return Response.json({ error: e.message, code: e.code }, { status: e.status });
    }
    console.error("[scrape/poll] unexpected error", e);
    return Response.json({ error: "Erreur inattendue lors du suivi de l'analyse." }, { status: 500 });
  }
}
