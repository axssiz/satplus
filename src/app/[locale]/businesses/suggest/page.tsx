import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { BusinessSuggestForm } from "@/components/businesses/business-suggest-form";
import { ComingSoon } from "@/components/coming-soon";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { Container } from "@/components/layout/container";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { asLocale } from "@/i18n/routing";
import { getBusinessBySlug, getBusinessCategories } from "@/lib/data/businesses";

type Props = PageProps<"/[locale]/businesses/suggest">;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: asLocale((await params).locale), namespace: "businessSuggest" });
  const correction = typeof (await searchParams).correction === "string";
  return { title: correction ? t("titleCorrection") : t("title"), robots: { index: false } };
}

export default async function SuggestBusinessPage({ params, searchParams }: Props) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  if (!isFeatureEnabled("businesses")) return <ComingSoon section={sectionByKey("businesses")} />;
  const t = await getTranslations("businessSuggest");
  const raw = (await searchParams).correction;
  const correctionSlug = typeof raw === "string" ? raw : null;

  const data = await load(() => Promise.all([getBusinessCategories(), correctionSlug ? getBusinessBySlug(correctionSlug) : Promise.resolve(null)]));
  if (data.ok && correctionSlug && !data.data[1]) notFound();
  const target = data.ok ? data.data[1] : null;

  return (
    <Container className="max-w-2xl space-y-6 pt-6 sm:pt-10">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{target ? t("titleCorrection") : t("title")}</h1>
        <p className="text-sm text-muted-foreground">{target ? t("subtitleCorrection", { name: target.name }) : t("subtitle")}</p>
      </header>
      {!data.ok ? (
        <DataUnavailable error={data.error} />
      ) : (
        <BusinessSuggestForm
          categories={data.data[0].map((c) => ({ id: c.id, name: locale === "kk" ? c.nameKk : c.nameRu }))}
          correction={target ? { slug: target.slug, name: target.name } : undefined}
        />
      )}
    </Container>
  );
}
