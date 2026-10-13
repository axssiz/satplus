import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { Container } from "@/components/layout/container";
import { NewsSuggestForm } from "@/components/news/news-suggest-form";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { asLocale } from "@/i18n/routing";
import { getNewsCategories } from "@/lib/data/news";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[locale]/news/suggest">): Promise<Metadata> {
  const t = await getTranslations({ locale: asLocale((await params).locale), namespace: "newsSuggest" });
  return { title: t("title"), robots: { index: false } };
}

export default async function SuggestNewsPage({ params }: PageProps<"/[locale]/news/suggest">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  if (!isFeatureEnabled("news")) return <ComingSoon section={sectionByKey("news")} />;
  const t = await getTranslations("newsSuggest");
  const data = await load(() => getNewsCategories());

  return (
    <Container className="max-w-2xl space-y-6 pt-6 sm:pt-10">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      {!data.ok ? (
        <DataUnavailable error={data.error} />
      ) : (
        <NewsSuggestForm categories={data.data.map((c) => ({ id: c.id, name: locale === "kk" ? c.nameKk : c.nameRu }))} />
      )}
    </Container>
  );
}
