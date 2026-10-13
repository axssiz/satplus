import "server-only";
import { cache } from "react";
import { createSupabasePublicClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { DataError } from "./catalog";

export type ServiceCategory = { id: string; slug: string; nameRu: string; nameKk: string; icon: string };

export type ServiceListItem = {
  id: string;
  slug: string;
  title: string;
  providerName: string;
  priceNote: string | null;
  area: string | null;
  coverPath: string | null;
  coverAlt: string | null;
  isSponsored: boolean;
  publishedAt: string | null;
  categorySlug: string | null;
};

export type ServiceListing = ServiceListItem & {
  description: string;
  phone: string;
  hasWhatsapp: boolean;
  linkUrl: string | null;
  sourceName: string | null;
  expiresOn: string;
  updatedAt: string;
};

export type ServiceStatus = "pending" | "published" | "rejected" | "archived";

export type MyServiceListing = {
  id: string;
  slug: string;
  title: string;
  status: ServiceStatus;
  rejectReason: string | null;
  expiresOn: string | null;
  createdAt: string;
  categoryId: string | null;
  providerName: string;
  description: string;
  priceNote: string | null;
  area: string | null;
  phone: string;
  hasWhatsapp: boolean;
  linkUrl: string | null;
  coverPath: string | null;
};

export const SERVICES_PAGE_SIZE = 24;

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

function mapListItem(r: Row): ServiceListItem {
  return {
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title),
    providerName: String(r.provider_name),
    priceNote: str(r.price_note),
    area: str(r.area),
    coverPath: str(r.cover_path),
    coverAlt: str(r.cover_alt),
    isSponsored: Boolean(r.is_sponsored),
    publishedAt: str(r.published_at),
    categorySlug: str(r.category_slug),
  };
}

export const getServiceCategories = cache(async (): Promise<ServiceCategory[]> => {
  const db = createSupabasePublicClient();
  const rows = check(await db.from("service_categories").select("id, slug, name_ru, name_kk, icon").order("sort_order"), "service categories");
  return rows.map((c) => ({ id: String(c.id), slug: String(c.slug), nameRu: String(c.name_ru), nameKk: String(c.name_kk), icon: String(c.icon) }));
});

export async function searchServiceListings(opts: { q?: string; category?: string; page?: number; pageSize?: number }) {
  const pageSize = opts.pageSize ?? SERVICES_PAGE_SIZE;
  const page = Math.max(1, opts.page ?? 1);
  const db = createSupabasePublicClient();
  const rows = check(
    await db.rpc("search_service_listings", {
      p_query: opts.q?.trim().slice(0, 100) || null,
      p_category: opts.category || null,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    }),
    "service listings",
  ) as Row[];
  return {
    items: rows.map(mapListItem),
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page,
    pageSize,
  };
}

export const getServiceListingBySlug = cache(async (slug: string): Promise<ServiceListing | null> => {
  if (!/^[a-z0-9-]{2,120}$/.test(slug)) return null;
  const db = createSupabasePublicClient();
  // RLS returns only published, unexpired listings to the public client.
  const row = check(
    await db
      .from("service_listings")
      .select(
        "id, slug, title, provider_name, description, price_note, area, phone, has_whatsapp, link_url, cover_path, cover_alt, source_name, is_sponsored, published_at, expires_on, updated_at, service_categories(slug)",
      )
      .eq("slug", slug)
      .maybeSingle(),
    "service listing",
  ) as Row | null;
  if (!row) return null;
  const cat = first(row.service_categories as Row | Row[] | null);
  return {
    ...mapListItem({ ...row, category_slug: cat?.slug ?? null }),
    description: String(row.description),
    phone: String(row.phone),
    hasWhatsapp: Boolean(row.has_whatsapp),
    linkUrl: str(row.link_url),
    sourceName: str(row.source_name),
    expiresOn: String(row.expires_on),
    updatedAt: String(row.updated_at),
  };
});

export async function getAllServiceSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const db = createSupabasePublicClient();
  const rows = check(await db.from("service_listings").select("slug, updated_at").order("published_at", { ascending: false }).limit(5000), "service slugs");
  return rows.map((r) => ({ slug: String(r.slug), updatedAt: String(r.updated_at) }));
}

/** The signed-in user's own listings in every state (RLS: owner_id = auth.uid()). */
export async function getMyServiceListings(userId: string): Promise<MyServiceListing[]> {
  const db = await createSupabaseServerClient();
  const rows = check(
    await db
      .from("service_listings")
      .select(
        "id, slug, title, status, reject_reason, expires_on, created_at, category_id, provider_name, description, price_note, area, phone, has_whatsapp, link_url, cover_path",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    "my service listings",
  ) as Row[];
  return rows.map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title),
    status: r.status as ServiceStatus,
    rejectReason: str(r.reject_reason),
    expiresOn: str(r.expires_on),
    createdAt: String(r.created_at),
    categoryId: str(r.category_id),
    providerName: String(r.provider_name),
    description: String(r.description),
    priceNote: str(r.price_note),
    area: str(r.area),
    phone: String(r.phone),
    hasWhatsapp: Boolean(r.has_whatsapp),
    linkUrl: str(r.link_url),
    coverPath: str(r.cover_path),
  }));
}
