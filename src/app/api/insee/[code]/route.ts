import { getMarketStats } from "@/lib/insee";

/**
 * GET /api/insee/{codeInsee} → local INSEE statistics for a commune
 * (population history + median income vs France). Cached server-side.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^(2[ab]\d{3}|\d{5})$/i.test(code)) {
    return Response.json({ error: "Code INSEE invalide." }, { status: 400 });
  }
  try {
    return Response.json(await getMarketStats(code));
  } catch (e) {
    console.error("[insee]", e);
    return Response.json({ error: "INSEE indisponible." }, { status: 502 });
  }
}
