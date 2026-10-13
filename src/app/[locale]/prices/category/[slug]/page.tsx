import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Catalog } from "@/components/prices/catalog";
import { asLocale } from "@/i18n/routing";
import { getCategories } from "@/lib/data/catalog";
import { alternates } from "@/lib/seo";

async function findCategory(slug: string) {
  try {
    return (await getCategories()).find((c) => c.slug === slug) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps<"/[locale]/prices/category/[slug]">): Promise<Metadata> {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  const t = await getTranslations({ locale, namespace: "meta" });
  const c = await findCategory(slug);
  const name = c ? (locale === "kk" ? c.nameKk : c.nameRu) : "";
  return {
    title: name ? `${name} — QaiArzan` : t("pricesTitle"),
    description: t("pricesDescription"),
    alternates: alternates(locale, `/prices/category/${slug}`),
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/[locale]/prices/category/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(asLocale(locale));
  if (!/^[a-z0-9-]{2,64}$/.test(slug)) notFound();
  const categories = await getCategories().catch(() => null);
  if (categories && !categories.some((c) => c.slug === slug)) notFound();
  const sp = (await searchParams) as Record<string, string | undefined>;
  return <Catalog params={sp} categorySlug={slug} />;
}
