import "server-only";
import { cache } from "react";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import type { Category, HistoryPoint, PriceOffer, Product, StoreBranch } from "@/lib/types";
import {
  BRANCH_SELECT,
  CATEGORY_SELECT,
  OFFER_SELECT,
  PRODUCT_SELECT,
  mapBranch,
  mapCategory,
  mapHistory,
  mapOffer,
  mapProduct,
} from "./mappers";

export class DataError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "DataError";
  }
}

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) {
    console.error(`[data] ${what}:`, res.error.message);
    throw new DataError(`Failed to load ${what}`, res.error);
  }
  return res.data as T;
}

export const getCategories = cache(async (): Promise<Category[]> => {
  const db = createSupabasePublicClient();
  const rows = check(
    await db.from("product_categories").select(CATEGORY_SELECT).order("sort_order"),
    "categories",
  );
  return rows.map(mapCategory);
});

export const getProductBySlug = cache(async (slug: string): Promise<Product | null> => {
  const db = createSupabasePublicClient();
  const row = check(await db.from("products").select(PRODUCT_SELECT).eq("slug", slug).maybeSingle(), "product");
  return row ? mapProduct(row) : null;
});

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const db = createSupabasePublicClient();
  const rows = check(await db.from("products").select(PRODUCT_SELECT).in("id", ids.slice(0, 200)), "products");
  const byId = new Map(rows.map((r) => [String(r.id), mapProduct(r)]));
  return ids.map((id) => byId.get(id)).filter((p): p is Product => !!p);
}

export async function getOffersForProducts(productIds: string[]): Promise<PriceOffer[]> {
  if (productIds.length === 0) return [];
  const db = createSupabasePublicClient();
  const rows = check(
    await db.from("current_prices").select(OFFER_SELECT).in("product_id", productIds.slice(0, 200)).limit(5000),
    "prices",
  );
  return rows.map(mapOffer);
}

export async function getOffersForBranch(branchId: string): Promise<PriceOffer[]> {
  const db = createSupabasePublicClient();
  const rows = check(
    await db.from("current_prices").select(OFFER_SELECT).eq("branch_id", branchId).limit(5000),
    "branch prices",
  );
  return rows.map(mapOffer);
}

export type CatalogSort = "popular" | "updated" | "name" | "relevance";

export type CatalogQuery = {
  q?: string;
  category?: string;
  onlyPriced?: boolean;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
  branchId?: string;
};

export type CatalogResult = {
  products: Product[];
  offers: PriceOffer[];
  total: number;
  page: number;
  pageSize: number;
};

export async function searchCatalog(query: CatalogQuery): Promise<CatalogResult> {
  const db = createSupabasePublicClient();
  const pageSize = query.pageSize ?? 24;
  const page = Math.max(1, query.page ?? 1);
  const rows = check(
    await db.rpc("search_products", {
      p_query: query.q ?? null,
      p_category_slug: query.category ?? null,
      p_only_priced: query.onlyPriced ?? false,
      p_sort: query.sort ?? (query.q ? "relevance" : "popular"),
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
      p_branch_id: query.branchId ?? null,
    }),
    "search",
  ) as { id: string; total_count: number }[];
  const ids = rows.map((r) => r.id);
  const [products, offers] = await Promise.all([getProductsByIds(ids), getOffersForProducts(ids)]);
  return { products, offers, total: rows[0] ? Number(rows[0].total_count) : 0, page, pageSize };
}

export async function getRecentVerified(limit = 8): Promise<{ products: Product[]; offers: PriceOffer[] }> {
  const db = createSupabasePublicClient();
  const rows = check(
    await db
      .from("current_prices")
      .select(OFFER_SELECT)
      .eq("effective_status", "verified")
      .order("observed_at", { ascending: false })
      .limit(limit * 4),
    "recent prices",
  );
  const offers = rows.map(mapOffer);
  const ids = [...new Set(offers.map((o) => o.productId))].slice(0, limit);
  const products = await getProductsByIds(ids);
  return { products, offers: offers.filter((o) => ids.includes(o.productId)) };
}

export async function getHistory(productId: string, days = 90): Promise<HistoryPoint[]> {
  const db = createSupabasePublicClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = check(
    await db
      .from("price_history")
      .select("product_id, branch_id, price, status, pack_quantity, pack_unit, observed_at, is_demo")
      .eq("product_id", productId)
      .gte("observed_at", since)
      .order("observed_at", { ascending: true })
      .limit(2000),
    "history",
  );
  return rows.map(mapHistory);
}

export const getBranches = cache(async (): Promise<StoreBranch[]> => {
  const db = createSupabasePublicClient();
  const rows = check(await db.from("store_branches").select(BRANCH_SELECT).limit(500), "branches");
  return rows
    .map(mapBranch)
    .sort((a, b) => Number(a.storeIsDemo) - Number(b.storeIsDemo) || a.storeName.localeCompare(b.storeName, "ru"));
});

export async function getBranchBySlug(slug: string): Promise<StoreBranch | null> {
  const db = createSupabasePublicClient();
  const row = check(await db.from("store_branches").select(BRANCH_SELECT).eq("slug", slug).maybeSingle(), "branch");
  return row ? mapBranch(row) : null;
}

export type PublicStats = {
  products: number;
  branches: number;
  freshVerified: number;
  updates7d: number;
  staleDays: number;
};

export async function getPublicStats(): Promise<PublicStats> {
  const db = createSupabasePublicClient();
  const s = check(await db.rpc("public_price_stats"), "stats") as Record<string, number>;
  return {
    products: Number(s.products ?? 0),
    branches: Number(s.branches ?? 0),
    freshVerified: Number(s.fresh_verified ?? 0),
    updates7d: Number(s.updates_7d ?? 0),
    staleDays: Number(s.stale_days ?? 14),
  };
}

export async function getAnalogs(productId: string): Promise<{ products: Product[]; offers: PriceOffer[] }> {
  const db = createSupabasePublicClient();
  const groups = check(
    await db.from("product_equivalences").select("group_id").eq("product_id", productId),
    "equivalence groups",
  );
  if (groups.length === 0) return { products: [], offers: [] };
  const members = check(
    await db
      .from("product_equivalences")
      .select("product_id")
      .in(
        "group_id",
        groups.map((g) => g.group_id),
      ),
    "equivalent products",
  );
  const ids = [...new Set(members.map((m) => String(m.product_id)))].filter((id) => id !== productId);
  const [products, offers] = await Promise.all([getProductsByIds(ids), getOffersForProducts(ids)]);
  return { products, offers };
}

export async function getRequestCounts(productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const db = createSupabasePublicClient();
  const rows = check(await db.rpc("price_request_counts", { p_product_ids: productIds }), "request counts") as {
    product_id: string;
    open_requests: number;
  }[];
  return new Map(rows.map((r) => [r.product_id, Number(r.open_requests)]));
}

export async function getAllProductSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const db = createSupabasePublicClient();
  const rows = check(await db.from("products").select("slug, updated_at").eq("is_active", true).limit(10000), "slugs");
  return rows.map((r) => ({ slug: String(r.slug), updatedAt: String(r.updated_at) }));
}
