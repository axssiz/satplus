import { ChevronRight, Info, PlusCircle, Scale, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { Container } from "@/components/layout/container";
import { BasketButton, FavoriteButton } from "@/components/prices/list-buttons";
import { OffersTable } from "@/components/prices/offers-table";
import { PriceHistoryChart } from "@/components/prices/price-history-chart";
import { ReportDialog, ViewBeacon, WantPriceButton } from "@/components/prices/product-actions";
import { productSubtitle } from "@/components/prices/product-card";
import { ProductVisual } from "@/components/prices/product-visual";
import { DemoBadge } from "@/components/prices/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import {
  getAnalogs,
  getBranches,
  getCategories,
  getHistory,
  getOffersForProducts,
  getProductBySlug,
  getPublicStats,
  getRequestCounts,
} from "@/lib/data/catalog";
import { storagePublicUrl } from "@/lib/env";
import { formatPack, formatRelative, formatTenge, localized, unitLabel, type AppLocale } from "@/lib/format";
import { bestOffersByProduct, summarizeOffers } from "@/lib/pricing/compare";
import { productPack } from "@/lib/pricing/units";
import { absoluteUrl, alternates, localePath } from "@/lib/seo";

export const revalidate = 60;

type Props = PageProps<"/[locale]/prices/p/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  const product = await getProductBySlug(slug).catch(() => null);
  if (!product) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  const name = localized(product, locale);
  const image = storagePublicUrl("product-images", product.imagePath);
  return {
    title: `${name} — ${locale === "kk" ? "Сәтбаевтағы бағалар" : "цены в Сатпаеве"}`,
    description: `${name}. ${t("pricesDescription")}`,
    alternates: alternates(locale, `/prices/p/${slug}`),
    openGraph: { title: name, description: t("pricesDescription"), images: image ? [image] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { locale: l, slug } = await params;
  const locale = asLocale(l) as AppLocale;
  setRequestLocale(locale);
  if (!/^[a-z0-9-]{2,96}$/.test(slug)) notFound();
  const t = await getTranslations();

  const first = await load(() => getProductBySlug(slug));
  if (!first.ok) {
    return (
      <Container className="pt-10">
        <DataUnavailable error={first.error} />
      </Container>
    );
  }
  const product = first.data;
  if (!product || !product.isActive) notFound();

  const data = await load(() =>
    Promise.all([
      getOffersForProducts([product.id]),
      getBranches(),
      getCategories(),
      getHistory(product.id, 90),
      getAnalogs(product.id),
      getRequestCounts([product.id]),
      getPublicStats(),
    ]),
  );
  if (!data.ok) {
    return (
      <Container className="pt-10">
        <DataUnavailable error={data.error} />
      </Container>
    );
  }
  const [offers, branches, categories, history, analogs, requests, stats] = data.data;
  const summary = summarizeOffers(product, offers);
  const category = categories.find((c) => c.id === product.categoryId);
  const name = localized(product, locale);
  const pack = productPack(product);
  const unit = unitLabel(product.unit, locale);
  const byUnit = summary.comparableBy === "unit_price";
  const val = (o: { price: number; comparableValue: number }) => (byUnit ? o.comparableValue : o.price);
  const hasDemo = offers.some((o) => o.isDemo);
  const analogSummaries = bestOffersByProduct(analogs.products, analogs.offers);
  const analogRows = analogs.products
    .map((p) => ({ p, s: analogSummaries.get(p.id) }))
    .filter((r) => r.s?.min && r.s.min.unitPrice !== null)
    .sort((a, b) => a.s!.min!.unitPrice! - b.s!.min!.unitPrice!);

  const modeTitle = product.isWeighted ? t("product.modeWeighted") : product.comparisonMode === "identical" ? t("product.modeIdentical") : t("product.modeAnalog");
  const modeHint = product.isWeighted
    ? t("product.modeWeightedHint")
    : product.comparisonMode === "identical"
      ? t("product.modeIdenticalHint")
      : t("product.modeAnalogHint", { unit });

  // Structured data only for real (non-demo) verified prices.
  const realRanked = summary.ranked.filter((o) => !o.isDemo);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    ...(product.brandName ? { brand: { "@type": "Brand", name: product.brandName } } : {}),
    ...(product.barcodes[0] ? { gtin: product.barcodes[0] } : {}),
    url: absoluteUrl(localePath(locale, `/prices/p/${product.slug}`)),
    ...(realRanked.length > 0 && product.comparisonMode === "identical"
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "KZT",
            lowPrice: realRanked[0].price,
            highPrice: realRanked[realRanked.length - 1].price,
            offerCount: realRanked.length,
          },
        }
      : {}),
  };

  return (
    <Container className="space-y-6 pt-4 sm:pt-8">
      <ViewBeacon productId={product.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <nav aria-label="Breadcrumb" className="flex items-center gap-1 overflow-hidden text-xs text-muted-foreground">
        <Link href="/prices" className="shrink-0 hover:text-foreground">
          {t("product.breadcrumbPrices")}
        </Link>
        {category && (
          <>
            <ChevronRight className="size-3.5 shrink-0" aria-hidden />
            <Link href={`/prices/category/${category.slug}`} className="truncate hover:text-foreground">
              {locale === "kk" ? category.nameKk : category.nameRu}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        {/* Left: product facts */}
        <div className="space-y-4">
          <div className="relative">
            <ProductVisual imagePath={product.imagePath} categoryIconName={category?.icon} alt={name} size="lg" priority className="max-h-72 lg:max-h-none" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{productSubtitle(product, locale, (k) => t(`product.${k}`))}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <BasketButton productId={product.id} />
            <FavoriteButton productId={product.id} withLabel />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
            {product.brandName && (
              <div>
                <dt className="text-xs text-muted-foreground">{t("product.brand")}</dt>
                <dd className="font-medium">{product.brandName}</dd>
              </div>
            )}
            {product.manufacturer && (
              <div>
                <dt className="text-xs text-muted-foreground">{t("product.manufacturer")}</dt>
                <dd className="font-medium">{product.manufacturer}</dd>
              </div>
            )}
            {category && (
              <div>
                <dt className="text-xs text-muted-foreground">{t("product.category")}</dt>
                <dd className="font-medium">{locale === "kk" ? category.nameKk : category.nameRu}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-muted-foreground">{t("product.pack")}</dt>
              <dd className="font-medium">
                {product.isWeighted ? `1 ${unit}` : pack ? formatPack(pack, locale) : t("product.packUnknown")}
              </dd>
            </div>
            {product.fatPercent !== null && (
              <div>
                <dt className="text-xs text-muted-foreground">{t("product.fat")}</dt>
                <dd className="font-medium">{product.fatPercent.toLocaleString(locale === "kk" ? "kk-KZ" : "ru-RU")}%</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-muted-foreground">{t("product.unit")}</dt>
              <dd className="font-medium">1 {unit}</dd>
            </div>
            {product.barcodes.length > 0 && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">{t("product.barcode")}</dt>
                <dd className="font-mono text-xs">{product.barcodes.join(", ")}</dd>
              </div>
            )}
          </dl>
          {!product.specsVerified && (
            <p className="flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-xs text-warning-foreground">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("product.specsUnverified")}
            </p>
          )}
          {(product.descriptionRu || product.descriptionKk) && (
            <p className="text-sm text-muted-foreground">
              {locale === "kk" ? (product.descriptionKk ?? product.descriptionRu) : product.descriptionRu}
            </p>
          )}
        </div>

        {/* Right: comparison */}
        <div className="space-y-6">
          <div className="flex items-start gap-3 rounded-2xl bg-primary-soft/60 p-4">
            <Scale className="mt-0.5 size-5 shrink-0 text-primary-strong dark:text-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold">{modeTitle}</p>
              <p className="text-sm text-muted-foreground">{modeHint}</p>
            </div>
          </div>

          {hasDemo && (
            <p className="flex items-start gap-2 rounded-xl border border-fuchsia-300/50 bg-fuchsia-500/8 p-3 text-xs">
              <DemoBadge /> <span>{t("common.demoNotice")}</span>
            </p>
          )}

          {summary.min ? (
            <section aria-label={t("product.minPrice")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="col-span-2 rounded-2xl border border-deal/60 bg-deal-soft/70 p-4 sm:col-span-1">
                <p className="text-xs font-medium text-muted-foreground">{t("product.minPrice")}</p>
                <p className="tabular font-display text-2xl font-semibold text-primary-strong dark:text-primary">
                  {formatTenge(val(summary.min), locale)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {summary.min.storeName}
                  {byUnit && ` · ${t("prices.perUnit", { unit })}`}
                </p>
              </div>
              <div className="rounded-2xl bg-surface p-4">
                <p className="text-xs text-muted-foreground">{t("product.maxPrice")}</p>
                <p className="tabular text-lg font-semibold">{formatTenge(val(summary.max!), locale)}</p>
                <p className="truncate text-xs text-muted-foreground">{summary.max!.storeName}</p>
              </div>
              <div className="rounded-2xl bg-surface p-4">
                <p className="text-xs text-muted-foreground">{t("product.difference")}</p>
                <p className="tabular text-lg font-semibold">{summary.spread !== null ? formatTenge(summary.spread, locale) : "—"}</p>
                <p className="text-xs text-muted-foreground">{summary.spreadPercent !== null ? `${summary.spreadPercent}%` : ""}</p>
              </div>
              <div className="col-span-2 rounded-2xl bg-surface p-4 sm:col-span-1">
                <p className="text-xs text-muted-foreground">{t("product.lastConfirmed")}</p>
                <p className="text-lg font-semibold">{formatRelative(summary.lastVerifiedAt!, locale)}</p>
              </div>
            </section>
          ) : (
            <EmptyState
              icon={Info}
              title={t("product.noConfirmed")}
              description={t("product.noConfirmedHint")}
              action={<WantPriceButton productId={product.id} slug={product.slug} initialCount={requests.get(product.id) ?? 0} />}
            />
          )}

          <div className="flex flex-wrap gap-2">
            <Link href={`/prices/add?product=${product.slug}`} className={buttonVariants({ size: "lg" })}>
              <PlusCircle aria-hidden /> {summary.ranked.length ? t("product.updatePrice") : t("product.addPrice")}
            </Link>
            <ReportDialog targetType="product" targetId={product.id} />
          </div>

          <section aria-labelledby="offers-title" className="space-y-3">
            <h2 id="offers-title" className="text-lg font-semibold">{t("product.pricesTitle")}</h2>
            <OffersTable product={product} summary={summary} branches={branches} staleDays={stats.staleDays} />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>{t("product.historyTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <PriceHistoryChart
                product={product}
                points={history}
                labels={branches.map((b) => [b.id, b.storeName] as [string, string])}
              />
            </CardContent>
          </Card>

          {analogs.products.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("product.analogsTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                {analogRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("product.analogsEmpty")}</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {analogRows.map(({ p, s }) => (
                      <li key={p.id}>
                        <Link href={`/prices/p/${p.slug}`} className="flex items-center justify-between gap-3 py-3 hover:text-primary-strong">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{localized(p, locale)}</span>
                            <span className="text-xs text-muted-foreground">{s!.min!.storeName}</span>
                          </span>
                          <span className="tabular shrink-0 text-sm font-semibold">
                            {formatTenge(s!.min!.unitPrice!, locale)} / {unitLabel(p.unit, locale)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Container>
  );
}
