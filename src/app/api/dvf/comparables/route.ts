import { queryDvfComparables } from "@/lib/dvf";

/**
 * GET /api/dvf/comparables?cp=75009&type=Appartement&surface=50
 * Returns past sold comparables (DVF 2025) for a postal code + type, ordered by
 * surface proximity. Never throws to the client — returns an empty list instead.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cp = searchParams.get("cp") ?? "";
  const type = searchParams.get("type") ?? "Appartement";
  const surface = Number(searchParams.get("surface") ?? "0");

  if (!/^\d{5}$/.test(cp)) {
    return Response.json({ comps: [] });
  }

  try {
    return Response.json({ comps: await queryDvfComparables(cp, type, surface) });
  } catch (e) {
    console.error("[dvf/comparables]", e);
    return Response.json({ comps: [] });
  }
}
