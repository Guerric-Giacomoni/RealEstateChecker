import { getLycees } from "@/lib/schools";

/**
 * GET /api/schools/{codeInsee} → lycées (GT) + bac results for a commune,
 * from data.education.gouv.fr. Cached server-side.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^(2[ab]\d{3}|\d{5})$/i.test(code)) {
    return Response.json({ error: "Code INSEE invalide." }, { status: 400 });
  }
  try {
    return Response.json({ lycees: await getLycees(code) });
  } catch (e) {
    console.error("[schools]", e);
    return Response.json({ lycees: [] });
  }
}
