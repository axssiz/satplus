import "server-only";
import { cache } from "react";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { DataError } from "./catalog";

export type NewsCategory = { id: string; slug: string; nameRu: string; nameKk: string };

export type NewsListItem = {
  id: string;
  slug: string;
  categorySlug: string | null;
  lang: "ru" | "kk";
  title: string;
  summary: string | null;
  coverPath: string | null;
  coverAlt: string | null;
  sourceName: string;
  isImportant: boolean;
  isSponsored: boolean;
  publishedAt: string;
};

export type NewsArticle = NewsListItem & {
  body: string;
  sourceUrl: string | null;
  categoryId: string | null;
  updatedAt: string;
};

export const NEWS_PAGE_SIZE = 12;

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) {
    console.error(`[data] ${what}:`, res.error.message);
    throw new DataError(`Failed to load ${what}`, res.error);
  }
  return res.data as T;
}

type Row = Record<string, unknown>;

function mapListItem(r: Row): NewsListItem {
  return {
    id: String(r.id),
    slug: String(r.slug),
    categorySlug: (r.category_slug as string | null) ?? null,
    lang: r.lang === "kk" ? "kk" : "ru",
    title: String(r.title),
    summary: (r.summary as string | null) ?? null,
    coverPath: (r.cover_path as string | null) ?? null,
    coverAlt: (r.cover_alt as string | null) ?? null,
    sourceName: String(r.source_name),
    isImportant: Boolean(r.is_important),
    isSponsored: Boolean(r.is_sponsored),
    publishedAt: String(r.published_at),
  };
}

export const getNewsCategories = cache(async (): Promise<NewsCategory[]> => {
  const db = createSupabasePublicClient();
  const rows = check(await db.from("news_categories").select("id, slug, name_ru, name_kk").order("sort_order"), "news categories");
  return rows.map((c) => ({ id: String(c.id), slug: String(c.slug), nameRu: String(c.name_ru), nameKk: String(c.name_kk) }));
});

export async function searchNews(opts: { q?: string; category?: string; page?: number; pageSize?: number }) {
  const pageSize = opts.pageSize ?? NEWS_PAGE_SIZE;
  const page = Math.max(1, opts.page ?? 1);
  const db = createSupabasePublicClient();
  const rows = check(
    await db.rpc("search_news", {
      p_query: opts.q?.trim().slice(0, 100) || null,
      p_category: opts.category || null,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    }),
    "news",
  ) as Row[];
  return {
    items: rows.map(mapListItem),
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page,
    pageSize,
  };
}

export async function getLatestNews(limit: number): Promise<NewsListItem[]> {
  return (await searchNews({ page: 1, pageSize: limit })).items;
}

export const getNewsBySlug = cache(async (slug: string): Promise<NewsArticle | null> => {
  if (!/^[a-z0-9-]{2,120}$/.test(slug)) return null;
  const db = createSupabasePublicClient();
  // RLS returns only published, already dated articles to the public client.
  const row = check(
    await db
      .from("news")
      .select(
        "id, slug, lang, title, summary, body, cover_path, cover_alt, source_name, source_url, is_important, is_sponsored, published_at, updated_at, category_id, news_categories(slug)",
      )
      .eq("slug", slug)
      .maybeSingle(),
    "news article",
  ) as Row | null;
  if (!row) return null;
  const cat = row.news_categories as { slug: string } | { slug: string }[] | null;
  const categorySlug = Array.isArray(cat) ? (cat[0]?.slug ?? null) : (cat?.slug ?? null);
  return {
    ...mapListItem({ ...row, category_slug: categorySlug }),
    body: String(row.body),
    sourceUrl: (row.source_url as string | null) ?? null,
    categoryId: (row.category_id as string | null) ?? null,
    updatedAt: String(row.updated_at),
  };
});

export async function getAllNewsSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const db = createSupabasePublicClient();
  const rows = check(
    await db.from("news").select("slug, updated_at").order("published_at", { ascending: false }).limit(5000),
    "news slugs",
  );
  return rows.map((r) => ({ slug: String(r.slug), updatedAt: String(r.updated_at) }));
}
