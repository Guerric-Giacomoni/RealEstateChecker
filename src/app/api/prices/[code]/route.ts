import { getPriceHistory } from "@/lib/prices";

/**
 * GET /api/prices/{codeInsee} → yearly average €/m² for a commune (DVF
 * indicators, 2015–2024). Cached server-side. Null when no data for the code.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^(2[ab]\d{3}|\d{5})$/i.test(code)) {
    return Response.json({ error: "Code INSEE invalide." }, { status: 400 });
  }
  try {
    return Response.json(await getPriceHistory(code));
  } catch (e) {
    console.error("[prices]", e);
    return Response.json({ error: "Prix indisponibles." }, { status: 502 });
  }
}
