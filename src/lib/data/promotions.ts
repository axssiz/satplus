import "server-only";
import { cache } from "react";
import { cityToday, type PromotionState } from "@/lib/promotions/dates";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { DataError } from "./catalog";

export type PromotionStore = { id: string; slug: string; name: string; isDemo: boolean };

export type PromotionListItem = {
  id: string;
  slug: string;
  title: string;
  discountLabel: string | null;
  startsOn: string | null;
  endsOn: string;
  coverPath: string | null;
  coverAlt: string | null;
  isSponsored: boolean;
  storeSlug: string;
  storeName: string;
  storeLogoPath: string | null;
  storeIsDemo: boolean;
  branchName: string | null;
  categorySlug: string | null;
};

export type Promotion = PromotionListItem & {
  storeId: string;
  description: string | null;
  conditions: string | null;
  sourceName: string;
  sourceUrl: string | null;
  branchSlug: string | null;
  branchAddress: string | null;
  categoryId: string | null;
  updatedAt: string;
};

export const PROMOTIONS_PAGE_SIZE = 12;

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) {
    console.error(`[data] ${what}:`, res.error.message);
    throw new DataError(`Failed to load ${what}`, res.error);
  }
  return res.data as T;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? null : String(v));
const first = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

function mapListItem(r: Row): PromotionListItem {
  return {
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title),
    discountLabel: str(r.discount_label),
    startsOn: str(r.starts_on),
    endsOn: String(r.ends_on),
    coverPath: str(r.cover_path),
    coverAlt: str(r.cover_alt),
    isSponsored: Boolean(r.is_sponsored),
    storeSlug: String(r.store_slug),
    storeName: String(r.store_name),
    storeLogoPath: str(r.store_logo_path),
    storeIsDemo: Boolean(r.store_is_demo),
    branchName: str(r.branch_name),
    categorySlug: str(r.category_slug),
  };
}

/** Stores visible to the public (RLS hides inactive and, outside demo mode, DEMO stores). */
export const getPromotionStores = cache(async (): Promise<PromotionStore[]> => {
  const db = createSupabasePublicClient();
  const rows = check(await db.from("stores").select("id, slug, name, is_demo").order("sort_order").order("name"), "stores");
  return rows.map((s) => ({ id: String(s.id), slug: String(s.slug), name: String(s.name), isDemo: Boolean(s.is_demo) }));
});

export async function searchPromotions(opts: {
  state?: PromotionState;
  q?: string;
  store?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}) {
  const pageSize = opts.pageSize ?? PROMOTIONS_PAGE_SIZE;
  const page = Math.max(1, opts.page ?? 1);
  const db = createSupabasePublicClient();
  const rows = check(
    await db.rpc("search_promotions", {
      p_state: opts.state ?? "active",
      p_query: opts.q?.trim().slice(0, 100) || null,
      p_store: opts.store || null,
      p_category: opts.category || null,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    }),
    "promotions",
  ) as Row[];
  return {
    items: rows.map(mapListItem),
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page,
    pageSize,
  };
}

export const getPromotionBySlug = cache(async (slug: string): Promise<Promotion | null> => {
  if (!/^[a-z0-9-]{2,120}$/.test(slug)) return null;
  const db = createSupabasePublicClient();
  // RLS returns only published promotions of visible stores; ended ones are kept and labelled.
  const row = check(
    await db
      .from("promotions")
      .select(
        "id, slug, title, description, discount_label, conditions, starts_on, ends_on, cover_path, cover_alt, source_name, source_url, is_sponsored, updated_at, store_id, category_id, stores!inner(slug, name, logo_path, is_demo), store_branches(slug, name, address), product_categories(slug)",
      )
      .eq("slug", slug)
      .maybeSingle(),
    "promotion",
  ) as Row | null;
  if (!row) return null;
  const store = first(row.stores as Row | Row[] | null);
  if (!store) return null;
  const branch = first(row.store_branches as Row | Row[] | null);
  const cat = first(row.product_categories as Row | Row[] | null);
  return {
    ...mapListItem({
      ...row,
      store_slug: store.slug,
      store_name: store.name,
      store_logo_path: store.logo_path,
      store_is_demo: store.is_demo,
      branch_name: branch?.name ?? null,
      category_slug: cat?.slug ?? null,
    }),
    storeId: String(row.store_id),
    description: str(row.description),
    conditions: str(row.conditions),
    sourceName: String(row.source_name),
    sourceUrl: str(row.source_url),
    branchSlug: str(branch?.slug),
    branchAddress: str(branch?.address),
    categoryId: str(row.category_id),
    updatedAt: String(row.updated_at),
  };
});

/** Active promotions of one store, for its QaiArzan page. Shown apart from prices; never affects the ranking. */
export async function getActivePromotionsForStore(storeSlug: string, limit = 6): Promise<PromotionListItem[]> {
  return (await searchPromotions({ state: "active", store: storeSlug, pageSize: limit })).items;
}

/** Current and upcoming promotions of real (non-DEMO) stores, for the sitemap. Ended pages are not indexed. */
export async function getAllPromotionSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const db = createSupabasePublicClient();
  const rows = check(
    await db
      .from("promotions")
      .select("slug, updated_at, stores!inner(is_demo)")
      .eq("stores.is_demo", false)
      .gte("ends_on", cityToday())
      .order("ends_on")
      .limit(5000),
    "promotion slugs",
  );
  return rows.map((r) => ({ slug: String(r.slug), updatedAt: String(r.updated_at) }));
}
