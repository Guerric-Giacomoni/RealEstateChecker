import { queryDvfByPolygon } from "@/lib/dvf";
import type { Ring } from "@/lib/geo";

/**
 * POST /api/dvf/zone
 *   body: { polygon: [[lat, lon], …], roomsMin?, surfaceMin?, surfaceMax? }
 *
 * Returns past sold properties (DVF 2025) whose coordinates fall inside the
 * drawn polygon — both apartments and houses. Never throws: empty list instead.
 */
export async function POST(request: Request) {
  let body: {
    polygon?: unknown;
    roomsMin?: unknown;
    surfaceMin?: unknown;
    surfaceMax?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ comps: [] });
  }

  const polygon = body.polygon;
  const validRing =
    Array.isArray(polygon) &&
    polygon.length >= 3 &&
    polygon.every(
      (p) => Array.isArray(p) && p.length === 2 && p.every((n) => Number.isFinite(n)),
    );
  if (!validRing) return Response.json({ comps: [] });

  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : undefined);

  try {
    const comps = await queryDvfByPolygon(polygon as Ring, {
      roomsMin: num(body.roomsMin),
      surfaceMin: num(body.surfaceMin),
      surfaceMax: num(body.surfaceMax),
    });
    return Response.json({ comps });
  } catch (e) {
    console.error("[dvf/zone]", e);
    return Response.json({ comps: [] });
  }
}
