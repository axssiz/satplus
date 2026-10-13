import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/layout/container";
import { FavoritesView } from "@/components/prices/favorites-view";
import { asLocale } from "@/i18n/routing";
import { getCategories } from "@/lib/data/catalog";

export async function generateMetadata({ params }: PageProps<"/[locale]/favorites">): Promise<Metadata> {
  const t = await getTranslations({ locale: asLocale((await params).locale), namespace: "favorites" });
  return { title: t("title"), robots: { index: false } };
}

export default async function FavoritesPage({ params }: PageProps<"/[locale]/favorites">) {
  setRequestLocale(asLocale((await params).locale));
  const t = await getTranslations("favorites");
  const categories = await getCategories().catch(() => []);
  return (
    <Container className="space-y-6 pt-6 sm:pt-10">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      <FavoritesView categoryIcons={Object.fromEntries(categories.map((c) => [c.id, c.icon]))} />
    </Container>
  );
}
