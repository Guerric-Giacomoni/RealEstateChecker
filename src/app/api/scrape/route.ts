import { ScrapeError, scrapeListing } from "@/lib/scraper";

/**
 * POST /api/scrape  { url } → run the matching Apify actor and map the result.
 * Runs server-side only, so APIFY_TOKEN never reaches the browser.
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
    const result = await scrapeListing(url);
    return Response.json(result);
  } catch (e) {
    if (e instanceof ScrapeError) {
      return Response.json({ error: e.message, code: e.code }, { status: e.status });
    }
    console.error("[scrape] unexpected error", e);
    return Response.json({ error: "Erreur inattendue lors de l'analyse." }, { status: 500 });
  }
}
