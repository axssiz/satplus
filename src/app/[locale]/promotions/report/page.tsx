import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { Container } from "@/components/layout/container";
import { PromotionReportForm } from "@/components/promotions/promotion-report-form";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { asLocale } from "@/i18n/routing";
import { getPromotionStores } from "@/lib/data/promotions";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[locale]/promotions/report">): Promise<Metadata> {
  const t = await getTranslations({ locale: asLocale((await params).locale), namespace: "promotionReport" });
  return { title: t("title"), robots: { index: false } };
}

export default async function ReportPromotionPage({ params }: PageProps<"/[locale]/promotions/report">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  if (!isFeatureEnabled("promotions")) return <ComingSoon section={sectionByKey("promotions")} />;
  const t = await getTranslations("promotionReport");
  const data = await load(() => getPromotionStores());

  return (
    <Container className="max-w-2xl space-y-6 pt-6 sm:pt-10">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      {!data.ok ? (
        <DataUnavailable error={data.error} />
      ) : (
        <PromotionReportForm stores={data.data.map((s) => ({ slug: s.slug, name: s.isDemo ? `${s.name} (DEMO)` : s.name }))} />
      )}
    </Container>
  );
}
