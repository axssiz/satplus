import { ArrowRight, BadgePercent, Clock, MapPin, Phone, PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { Container } from "@/components/layout/container";
import { ProductCard } from "@/components/prices/product-card";
import { DemoBadge } from "@/components/prices/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { getPromotionLabels } from "@/components/promotions/labels";
import { PromotionCard } from "@/components/promotions/promotion-card";
import { isFeatureEnabled } from "@/config/features";
import { getBranchBySlug, getCategories, getOffersForBranch, getProductsByIds } from "@/lib/data/catalog";
import { getActivePromotionsForStore } from "@/lib/data/promotions";
import { cityToday } from "@/lib/promotions/dates";
import { formatDate, type AppLocale } from "@/lib/format";
import { bestOffersByProduct } from "@/lib/pricing/compare";
import { alternates } from "@/lib/seo";

export const revalidate = 60;
type Props = PageProps<"/[locale]/prices/stores/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  const b = await getBranchBySlug(slug).catch(() => null);
  if (!b) return {};
  return {
    title: `${b.storeName} — QaiArzan`,
    alternates: alternates(locale, `/prices/stores/${slug}`),
    robots: b.storeIsDemo ? { index: false } : undefined,
  };
}

export default async function BranchPage({ params }: Props) {
  const { locale: l, slug } = await params;
  const locale = asLocale(l) as AppLocale;
  setRequestLocale(locale);
  if (!/^[a-z0-9-]{2,96}$/.test(slug)) notFound();
  const t = await getTranslations("stores");
  const first = await load(() => getBranchBySlug(slug));
  if (!first.ok) return <Container className="pt-10"><DataUnavailable error={first.error} /></Container>;
  const branch = first.data;
  if (!branch) notFound();

  const data = await load(async () => {
    const offers = await getOffersForBranch(branch.id);
    const [products, categories] = await Promise.all([getProductsByIds([...new Set(offers.map((o) => o.productId))]), getCategories()]);
    return { offers, products, categories };
  });

  // Promotions are shown apart from prices and never change the price comparison.
  const promotions = isFeatureEnabled("promotions")
    ? await Promise.all([getActivePromotionsForStore(branch.storeSlug, 4), getPromotionLabels()]).catch((e) => {
        console.error("[store page] promotions", e);
        return null;
      })
    : null;
  const tAll = await getTranslations();

  return (
    <Container className="space-y-6 pt-6 sm:pt-10">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{branch.storeName}</h1>
          {branch.storeIsDemo ? <DemoBadge /> : <Badge tone={branch.verificationStatus === "verified" ? "primary" : "warning"}>{t(`verification.${branch.verificationStatus}`)}</Badge>}
        </div>
        <dl className="grid gap-3 rounded-2xl border border-border bg-card p-4 text-sm sm:grid-cols-3">
          <div className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /><div><dt className="text-xs text-muted-foreground">{t("address")}</dt><dd>{branch.address ?? t("addressUnknown")}</dd></div></div>
          <div className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /><div><dt className="text-xs text-muted-foreground">{t("hours")}</dt><dd>{branch.openingHours ?? t("hoursUnknown")}</dd></div></div>
          <div className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /><div><dt className="text-xs text-muted-foreground">{t("phone")}</dt><dd>{branch.phone ? <a className="underline" href={`tel:${branch.phone.replace(/[^+0-9]/g, "")}`}>{branch.phone}</a> : t("hoursUnknown")}</dd></div></div>
        </dl>
        {branch.lastVerifiedAt && <p className="text-xs text-muted-foreground">{t("lastVerified")}: {formatDate(branch.lastVerifiedAt, locale)}</p>}
        <Link href={`/prices/add?branch=${branch.slug}`} className={buttonVariants()}>
          <PlusCircle aria-hidden /> {t("addPriceHere")}
        </Link>
      </header>
      {promotions && promotions[0].length > 0 && (
        <section aria-labelledby="store-promotions" className="space-y-3 rounded-3xl border border-rose-500/20 bg-rose-500/5 p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="store-promotions" className="flex items-center gap-2 text-lg font-semibold">
                <BadgePercent className="size-5 text-rose-600 dark:text-rose-400" aria-hidden /> {t("promotionsHere")}
              </h2>
              <p className="text-xs text-muted-foreground">{t("promotionsHereNote")}</p>
            </div>
            <Link href={`/promotions?store=${branch.storeSlug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary-strong dark:text-primary">
              {tAll("common.all")} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {promotions[0].map((p) => (
              <li key={p.id} className="flex">
                <PromotionCard item={p} locale={locale} today={cityToday()} labels={promotions[1]} showStore={false} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("pricesHere")}</h2>
        {!data.ok ? (
          <DataUnavailable error={data.error} />
        ) : data.data.products.length === 0 ? (
          <EmptyState icon={PlusCircle} title={t("pricesCount", { count: 0 })} />
        ) : (
          (() => {
            const summaries = bestOffersByProduct(data.data.products, data.data.offers);
            const icons = new Map(data.data.categories.map((c) => [c.id, c.icon]));
            return (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {data.data.products.map((p) => (
                  <li key={p.id} className="flex">
                    <ProductCard product={p} summary={summaries.get(p.id)} categoryIconName={icons.get(p.categoryId)} />
                  </li>
                ))}
              </ul>
            );
          })()
        )}
      </section>
    </Container>
  );
}
