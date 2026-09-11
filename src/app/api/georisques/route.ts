import { getRisks } from "@/lib/georisques";

/**
 * GET /api/georisques?codeInsee=75056&lat=48.85&lon=2.35
 * Aggregated natural-risk summary (commune + point) from Géorisques V1.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const code = q.get("codeInsee") ?? "";
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));

  if (!/^(2[ab]\d{3}|\d{5})$/i.test(code) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ error: "Paramètres invalides (codeInsee, lat, lon)." }, { status: 400 });
  }
  try {
    return Response.json(await getRisks(code, lat, lon));
  } catch (e) {
    console.error("[georisques]", e);
    return Response.json({ error: "Géorisques indisponible." }, { status: 502 });
  }
}
