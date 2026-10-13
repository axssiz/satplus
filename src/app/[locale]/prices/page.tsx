import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Catalog } from "@/components/prices/catalog";
import { asLocale } from "@/i18n/routing";
import { alternates } from "@/lib/seo";

export async function generateMetadata({ params, searchParams }: PageProps<"/[locale]/prices">): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("pricesTitle"),
    description: t("pricesDescription"),
    alternates: alternates(locale, "/prices"),
    // Filtered/search result pages are not indexed; the clean catalog is.
    robots: Object.keys(sp).length > 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function PricesPage({ params, searchParams }: PageProps<"/[locale]/prices">) {
  setRequestLocale(asLocale((await params).locale));
  const sp = (await searchParams) as Record<string, string | undefined>;
  return <Catalog params={sp} />;
}
