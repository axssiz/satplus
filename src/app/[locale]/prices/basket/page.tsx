import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { BasketView } from "@/components/prices/basket-view";
import { asLocale } from "@/i18n/routing";
import { alternates } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/prices/basket">): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "basket" });
  return { title: t("title"), description: t("subtitle"), alternates: alternates(locale, "/prices/basket") };
}

export default async function BasketPage({ params }: PageProps<"/[locale]/prices/basket">) {
  setRequestLocale(asLocale((await params).locale));
  const t = await getTranslations("basket");
  return (
    <Container className="space-y-6 pt-6 sm:pt-10">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      <BasketView />
    </Container>
  );
}
