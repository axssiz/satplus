import type { MetadataRoute } from "next";
import { isFeatureEnabled } from "@/config/features";
import { getAllProductSlugs, getBranches, getCategories } from "@/lib/data/catalog";
import { getAllNewsSlugs } from "@/lib/data/news";
import { getAllPromotionSlugs } from "@/lib/data/promotions";
import { getAllBusinessSlugs } from "@/lib/data/businesses";
import { getAllJobSlugs } from "@/lib/data/jobs";
import { getAllServiceSlugs } from "@/lib/data/services";
import { absoluteUrl, localePath } from "@/lib/seo";

export const revalidate = 3600;

function entry(path: string, lastModified?: string, priority = 0.6): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteUrl(localePath("ru", path)),
    lastModified,
    priority,
    alternates: { languages: { ru: absoluteUrl(localePath("ru", path)), kk: absoluteUrl(localePath("kk", path)) } },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const items: MetadataRoute.Sitemap = [
    entry("/", undefined, 1),
    entry("/prices", undefined, 0.9),
    entry("/prices/basket", undefined, 0.5),
    entry("/prices/stores", undefined, 0.6),
    entry("/privacy", undefined, 0.2),
    entry("/terms", undefined, 0.2),
  ];
  try {
    const [products, categories, branches] = await Promise.all([getAllProductSlugs(), getCategories(), getBranches()]);
    for (const c of categories) items.push(entry(`/prices/category/${c.slug}`, undefined, 0.7));
    for (const p of products) items.push(entry(`/prices/p/${p.slug}`, p.updatedAt, 0.8));
    for (const b of branches) if (!b.storeIsDemo) items.push(entry(`/prices/stores/${b.slug}`, undefined, 0.5));
    if (isFeatureEnabled("news")) {
      items.push(entry("/news", undefined, 0.8));
      for (const n of await getAllNewsSlugs()) items.push(entry(`/news/${n.slug}`, n.updatedAt, 0.7));
    }
    if (isFeatureEnabled("promotions")) {
      items.push(entry("/promotions", undefined, 0.7));
      for (const p of await getAllPromotionSlugs()) items.push(entry(`/promotions/${p.slug}`, p.updatedAt, 0.5));
    }
    if (isFeatureEnabled("businesses")) {
      items.push(entry("/businesses", undefined, 0.7));
      for (const b of await getAllBusinessSlugs()) items.push(entry(`/businesses/${b.slug}`, b.updatedAt, 0.6));
    }
    if (isFeatureEnabled("services")) {
      items.push(entry("/services", undefined, 0.7));
      for (const s of await getAllServiceSlugs()) items.push(entry(`/services/${s.slug}`, s.updatedAt, 0.5));
    }
    if (isFeatureEnabled("jobs")) {
      items.push(entry("/jobs", undefined, 0.7));
      for (const j of await getAllJobSlugs()) items.push(entry(`/jobs/${j.slug}`, j.updatedAt, 0.5));
    }
  } catch (e) {
    console.error("[sitemap]", e);
  }
  return items;
}
