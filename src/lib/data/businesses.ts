import "server-only";
import { cache } from "react";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { DataError } from "./catalog";

export type BusinessCategory = { id: string; slug: string; nameRu: string; nameKk: string; icon: string };

export type BusinessListItem = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  phone: string | null;
  openingHours: string | null;
  latitude: number | null;
  longitude: number | null;
  coverPath: string | null;
  coverAlt: string | null;
  isSponsored: boolean;
  verified: boolean;
  categorySlug: string | null;
};

export type Business = BusinessListItem & {
  description: string | null;
  phoneAlt: string | null;
  website: string | null;
  socialUrl: string | null;
  sourceName: string;
  lastVerifiedAt: string | null;
  updatedAt: string;
};

export const BUSINESSES_PAGE_SIZE = 24;

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) {
    console.error(`[data] ${what}:`, res.error.message);
    throw new DataError(`Failed to load ${what}`, res.error);
  }
  return res.data as T;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? null : String(v));
const num = (v: unknown) => (v == null ? null : Number(v));

function mapListItem(r: Row): BusinessListItem {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    address: str(r.address),
    phone: str(r.phone),
    openingHours: str(r.opening_hours),
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    coverPath: str(r.cover_path),
    coverAlt: str(r.cover_alt),
    isSponsored: Boolean(r.is_sponsored),
    verified: r.verification_status === "verified",
    categorySlug: str(r.category_slug),
  };
}

export const getBusinessCategories = cache(async (): Promise<BusinessCategory[]> => {
  const db = createSupabasePublicClient();
  const rows = check(await db.from("business_categories").select("id, slug, name_ru, name_kk, icon").order("sort_order"), "business categories");
  return rows.map((c) => ({ id: String(c.id), slug: String(c.slug), nameRu: String(c.name_ru), nameKk: String(c.name_kk), icon: String(c.icon) }));
});

export async function searchBusinesses(opts: { q?: string; category?: string; page?: number; pageSize?: number }) {
  const pageSize = opts.pageSize ?? BUSINESSES_PAGE_SIZE;
  const page = Math.max(1, opts.page ?? 1);
  const db = createSupabasePublicClient();
  const rows = check(
    await db.rpc("search_businesses", {
      p_query: opts.q?.trim().slice(0, 100) || null,
      p_category: opts.category || null,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    }),
    "businesses",
  ) as Row[];
  return {
    items: rows.map(mapListItem),
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page,
    pageSize,
  };
}

export const getBusinessBySlug = cache(async (slug: string): Promise<Business | null> => {
  if (!/^[a-z0-9-]{2,120}$/.test(slug)) return null;
  const db = createSupabasePublicClient();
  // RLS returns only published organisations to the public client.
  const row = check(
    await db
      .from("businesses")
      .select(
        "id, slug, name, description, address, latitude, longitude, phone, phone_alt, website, social_url, opening_hours, cover_path, cover_alt, source_name, verification_status, last_verified_at, is_sponsored, updated_at, business_categories(slug)",
      )
      .eq("slug", slug)
      .maybeSingle(),
    "business",
  ) as Row | null;
  if (!row) return null;
  const cat = row.business_categories as { slug: string } | { slug: string }[] | null;
  const categorySlug = Array.isArray(cat) ? (cat[0]?.slug ?? null) : (cat?.slug ?? null);
  return {
    ...mapListItem({ ...row, category_slug: categorySlug }),
    description: str(row.description),
    phoneAlt: str(row.phone_alt),
    website: str(row.website),
    socialUrl: str(row.social_url),
    sourceName: String(row.source_name),
    lastVerifiedAt: str(row.last_verified_at),
    updatedAt: String(row.updated_at),
  };
});

export async function getAllBusinessSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const db = createSupabasePublicClient();
  const rows = check(await db.from("businesses").select("slug, updated_at").order("name").limit(5000), "business slugs");
  return rows.map((r) => ({ slug: String(r.slug), updatedAt: String(r.updated_at) }));
}
