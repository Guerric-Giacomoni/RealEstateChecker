import { searchDvf, type DvfSearchParams } from "@/lib/dvf";

/**
 * GET /api/dvf/search — filtered, paginated access to the whole DVF dataset.
 * Query params: cp, dept, type, priceMin/Max, surfaceMin/Max, roomsMin,
 * sort (price|surface|price_m2|rooms|month), order (asc|desc), page, limit.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const params: DvfSearchParams = {
    cp: q.get("cp") ?? undefined,
    dept: q.get("dept") ?? undefined,
    type: q.get("type") ?? undefined,
    priceMin: Number(q.get("priceMin")) || undefined,
    priceMax: Number(q.get("priceMax")) || undefined,
    surfaceMin: Number(q.get("surfaceMin")) || undefined,
    surfaceMax: Number(q.get("surfaceMax")) || undefined,
    roomsMin: Number(q.get("roomsMin")) || undefined,
    sort: q.get("sort") ?? undefined,
    order: q.get("order") ?? undefined,
    page: Number(q.get("page")) || 0,
    limit: Number(q.get("limit")) || 50,
  };
  try {
    return Response.json(searchDvf(params));
  } catch (e) {
    console.error("[dvf/search]", e);
    return Response.json({ rows: [], total: 0, page: 0, limit: 50 }, { status: 500 });
  }
}
