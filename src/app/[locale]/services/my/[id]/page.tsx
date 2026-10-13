import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { Container } from "@/components/layout/container";
import { ServiceListingForm } from "@/components/services/service-listing-form";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { asLocale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { getMyServiceListings, getServiceCategories } from "@/lib/data/services";
import { storagePublicUrl } from "@/lib/env";
import { ServiceSignInGate } from "../../sign-in-gate";

export async function generateMetadata({ params }: PageProps<"/[locale]/services/my/[id]">): Promise<Metadata> {
  const t = await getTranslations({ locale: asLocale((await params).locale), namespace: "serviceForm" });
  return { title: t("titleEdit"), robots: { index: false } };
}

export default async function EditServiceListingPage({ params }: PageProps<"/[locale]/services/my/[id]">) {
  const { locale: l, id } = await params;
  const locale = asLocale(l);
  setRequestLocale(locale);
  if (!isFeatureEnabled("services")) return <ComingSoon section={sectionByKey("services")} />;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = await getTranslations("serviceForm");
  const user = await getCurrentUser().catch(() => null);

  let body: React.ReactNode;
  if (!user) {
    body = <ServiceSignInGate next={`${locale === "kk" ? "/kk" : ""}/services/my/${id}`} />;
  } else {
    const data = await load(() => Promise.all([getMyServiceListings(user.id), getServiceCategories()]));
    if (!data.ok) {
      body = <DataUnavailable error={data.error} />;
    } else {
      const listing = data.data[0].find((x) => x.id === id);
      if (!listing) notFound();
      body = (
        <ServiceListingForm
          categories={data.data[1].map((c) => ({ id: c.id, name: locale === "kk" ? c.nameKk : c.nameRu }))}
          values={{
            id: listing.id,
            categoryId: listing.categoryId ?? "",
            title: listing.title,
            providerName: listing.providerName,
            description: listing.description,
            priceNote: listing.priceNote ?? "",
            area: listing.area ?? "",
            phone: listing.phone,
            hasWhatsapp: listing.hasWhatsapp,
            linkUrl: listing.linkUrl ?? "",
            coverUrl: storagePublicUrl("service-images", listing.coverPath),
          }}
        />
      );
    }
  }

  return (
    <Container className="max-w-2xl space-y-6 pt-6 sm:pt-10">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t("titleEdit")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitleEdit")}</p>
      </header>
      {body}
    </Container>
  );
}
