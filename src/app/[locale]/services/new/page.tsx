import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { Container } from "@/components/layout/container";
import { ServiceListingForm } from "@/components/services/service-listing-form";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { asLocale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { getServiceCategories } from "@/lib/data/services";
import { ServiceSignInGate } from "../sign-in-gate";

// Depends on the signed-in user; never prerender.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/services/new">): Promise<Metadata> {
  const t = await getTranslations({ locale: asLocale((await params).locale), namespace: "serviceForm" });
  return { title: t("titleNew"), robots: { index: false } };
}

export default async function NewServiceListingPage({ params }: PageProps<"/[locale]/services/new">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  if (!isFeatureEnabled("services")) return <ComingSoon section={sectionByKey("services")} />;
  const t = await getTranslations("serviceForm");
  const user = await getCurrentUser().catch(() => null);

  return (
    <Container className="max-w-2xl space-y-6 pt-6 sm:pt-10">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t("titleNew")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      {!user ? (
        <ServiceSignInGate next={locale === "kk" ? "/kk/services/new" : "/services/new"} />
      ) : (
        <NewListingForm locale={locale} />
      )}
    </Container>
  );
}

async function NewListingForm({ locale }: { locale: string }) {
  const data = await load(() => getServiceCategories());
  if (!data.ok) return <DataUnavailable error={data.error} />;
  return (
    <ServiceListingForm
      categories={data.data.map((c) => ({ id: c.id, name: locale === "kk" ? c.nameKk : c.nameRu }))}
      values={{ id: null, categoryId: "", title: "", providerName: "", description: "", priceNote: "", area: "", phone: "", hasWhatsapp: false, linkUrl: "", coverUrl: null }}
    />
  );
}
