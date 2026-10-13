import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { Container } from "@/components/layout/container";
import { PriceForm } from "@/components/prices/price-form";
import { asLocale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { getBranches, getProductBySlug } from "@/lib/data/catalog";

export async function generateMetadata({ params }: PageProps<"/[locale]/prices/add">): Promise<Metadata> {
  const t = await getTranslations({ locale: asLocale((await params).locale), namespace: "addPrice" });
  return { title: t("title"), robots: { index: false } };
}

export default async function AddPricePage({ params, searchParams }: PageProps<"/[locale]/prices/add">) {
  setRequestLocale(asLocale((await params).locale));
  const sp = (await searchParams) as Record<string, string | undefined>;
  const t = await getTranslations("addPrice");
  const productSlug = typeof sp.product === "string" && /^[a-z0-9-]{2,96}$/.test(sp.product) ? sp.product : null;
  const data = await load(() =>
    Promise.all([getBranches(), productSlug ? getProductBySlug(productSlug) : Promise.resolve(null), getCurrentUser()]),
  );

  return (
    <Container className="max-w-2xl space-y-6 pt-6 sm:pt-10">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      {!data.ok ? (
        <DataUnavailable error={data.error} />
      ) : (
        <PriceForm
          signedIn={!!data.data[2]}
          branches={data.data[0].map((b) => ({ id: b.id, slug: b.slug, label: b.address ? `${b.storeName}, ${b.address}` : b.name, isDemo: b.storeIsDemo }))}
          initialBranchId={data.data[0].find((b) => b.slug === sp.branch)?.id}
          initialProduct={
            data.data[1]
              ? {
                  id: data.data[1].id,
                  slug: data.data[1].slug,
                  nameRu: data.data[1].nameRu,
                  nameKk: data.data[1].nameKk,
                  unit: data.data[1].unit,
                  comparisonMode: data.data[1].comparisonMode,
                  isWeighted: data.data[1].isWeighted,
                  netQuantity: data.data[1].netQuantity,
                  netUnit: data.data[1].netUnit,
                  brandName: data.data[1].brandName,
                }
              : null
          }
        />
      )}
    </Container>
  );
}
