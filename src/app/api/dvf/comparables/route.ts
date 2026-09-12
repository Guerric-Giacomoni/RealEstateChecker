import { queryDvfByRadius, queryDvfComparables } from "@/lib/dvf";

/**
 * GET /api/dvf/comparables
 *   ?cp=75009&type=Appartement&surface=50           → whole postal code
 *   ?lat=48.9&lon=2.33&radius=1&type=Appartement     → within `radius` km of a point
 *
 * Returns past sold comparables (DVF 2025). Never throws — empty list instead.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cp = searchParams.get("cp") ?? "";
  const type = searchParams.get("type") ?? "Appartement";
  const surface = Number(searchParams.get("surface") ?? "0");
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const radius = Number(searchParams.get("radius"));

  const useRadius =
    Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(radius) && radius > 0;

  if (!useRadius && !/^\d{5}$/.test(cp)) {
    return Response.json({ comps: [] });
  }

  try {
    const comps = useRadius
      ? await queryDvfByRadius(lat, lon, type, radius)
      : await queryDvfComparables(cp, type, surface);
    return Response.json({ comps });
  } catch (e) {
    console.error("[dvf/comparables]", e);
    return Response.json({ comps: [] });
  }
}
