import { queryHospitals } from "@/lib/hospitals";

/**
 * GET /api/hospitals?lat=48.9&lon=2.33&radius=10
 * Health establishments (FINESS) within `radius` km of a point. Never throws.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  const radius = Number(q.get("radius") ?? "10");

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !(radius > 0)) {
    return Response.json({ hospitals: [] });
  }
  try {
    return Response.json({ hospitals: await queryHospitals(lat, lon, radius) });
  } catch (e) {
    console.error("[hospitals]", e);
    return Response.json({ hospitals: [] });
  }
}
