import { NextResponse, type NextRequest } from "next/server";
import { searchCatalog } from "@/lib/data/catalog";

export type ProductLite = {
  id: string;
  slug: string;
  nameRu: string;
  nameKk: string | null;
  unit: string;
  comparisonMode: string;
  isWeighted: boolean;
  netQuantity: number | null;
  netUnit: string | null;
  brandName: string | null;
};

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ items: [] });
  try {
    const result = await searchCatalog({ q, pageSize: 10, sort: "relevance" });
    const items: ProductLite[] = result.products.map((p) => ({
      id: p.id,
      slug: p.slug,
      nameRu: p.nameRu,
      nameKk: p.nameKk,
      unit: p.unit,
      comparisonMode: p.comparisonMode,
      isWeighted: p.isWeighted,
      netQuantity: p.netQuantity,
      netUnit: p.netUnit,
      brandName: p.brandName,
    }));
    return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (e) {
    console.error("[api/products/search]", e);
    return NextResponse.json({ items: [], error: "unavailable" }, { status: 503 });
  }
}
