import { getCrime } from "@/lib/crime";

/**
 * GET /api/crime/{codeInsee} → délinquance for a commune (commune / dept /
 * France rates, per SSMSI). Cached server-side. Returns null when the commune
 * has no published data.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^(2[ab]\d{3}|\d{5})$/i.test(code)) {
    return Response.json({ error: "Code INSEE invalide." }, { status: 400 });
  }
  try {
    return Response.json(await getCrime(code));
  } catch (e) {
    console.error("[crime]", e);
    return Response.json({ error: "SSMSI indisponible." }, { status: 502 });
  }
}
