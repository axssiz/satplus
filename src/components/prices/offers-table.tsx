import { Crown, ExternalLink, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatPack, formatRelative, formatTenge, unitLabel, type AppLocale } from "@/lib/format";
import type { OfferSummary, RankedOffer } from "@/lib/pricing/compare";
import { offerUnitPrice } from "@/lib/pricing/units";
import type { PriceOffer, Product, StoreBranch } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DemoBadge, PriceStatusBadge } from "./status-badge";

function OfferRow({
  product,
  offer,
  best,
  muted,
}: {
  product: Product;
  offer: PriceOffer | RankedOffer;
  best?: boolean;
  muted?: boolean;
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations();
  const unit = "unitPrice" in offer ? offer.unitPrice : offerUnitPrice(product, offer);
  const showUnit = !product.isWeighted && unit !== null && (product.comparisonMode === "analog" || !!offer.pack);
  return (
    <li
      className={cn(
        "relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border p-3 sm:flex-nowrap sm:p-4",
        best ? "border-deal bg-deal-soft/60 shadow-[0_0_0_3px_color-mix(in_oklch,var(--deal)_25%,transparent)]" : "border-border bg-card",
        muted && "opacity-80",
      )}
    >
      <div className="min-w-0 flex-1 basis-40">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={`/prices/stores/${offer.branchSlug}`} className="font-semibold hover:underline">
            {offer.storeName}
          </Link>
          {offer.isDemo && <DemoBadge />}
          {best && (
            <span className="inline-flex items-center gap-1 rounded-full bg-deal px-2 py-0.5 text-[11px] font-bold text-deal-foreground">
              <Crown className="size-3" aria-hidden /> {t("product.bestPrice")}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {offer.branchAddress ?? offer.branchName}
          {offer.brandLabel && ` · ${offer.brandLabel}`}
          {offer.pack && product.comparisonMode === "analog" && ` · ${formatPack(offer.pack, locale)}`}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <PriceStatusBadge status={offer.effectiveStatus} />
          <span>{formatRelative(offer.observedAt, locale)}</span>
          <span>·</span>
          <span>{t(`source.${offer.sourceType as "admin_check"}`)}</span>
          {offer.sourceUrl && (
            <a href={offer.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-0.5 underline">
              <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </p>
        {offer.sourceNote && offer.status === "estimated" && (
          <p className="mt-1 text-xs text-warning-foreground">{offer.sourceNote}</p>
        )}
      </div>
      <div className="ml-auto text-right">
        <p className={cn("tabular text-xl font-bold", best && "text-primary-strong dark:text-primary")}>
          {formatTenge(offer.price, locale)}
        </p>
        {showUnit && (
          <p className="tabular text-xs text-muted-foreground">
            {formatTenge(unit!, locale)} / {unitLabel(product.unit, locale)}
          </p>
        )}
        {product.isWeighted && <p className="text-xs text-muted-foreground">/ {unitLabel(product.unit, locale)}</p>}
      </div>
    </li>
  );
}

export function OffersTable({
  product,
  summary,
  branches,
  staleDays,
}: {
  product: Product;
  summary: OfferSummary;
  branches: StoreBranch[];
  staleDays: number;
}) {
  const t = useTranslations("product");
  const withData = new Set(
    [...summary.ranked, ...summary.estimated, ...summary.stale, ...summary.incomparable].map((o) => o.branchId),
  );
  const noData = branches.filter((b) => !withData.has(b.id));

  return (
    <div className="space-y-6">
      {summary.ranked.length > 0 && (
        <ol className="space-y-2" aria-label={t("pricesTitle")}>
          {summary.ranked.map((o) => (
            <OfferRow key={o.id} product={product} offer={o} best={o.isBest && summary.ranked.length > 1} />
          ))}
        </ol>
      )}
      {summary.estimated.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("estimatedTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("estimatedNote")}</p>
          <ul className="space-y-2">
            {summary.estimated.map((o) => (
              <OfferRow key={o.id} product={product} offer={o} muted />
            ))}
          </ul>
        </section>
      )}
      {summary.stale.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("staleTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("staleNote", { days: staleDays })}</p>
          <ul className="space-y-2">
            {summary.stale.map((o) => (
              <OfferRow key={o.id} product={product} offer={o} muted />
            ))}
          </ul>
        </section>
      )}
      {summary.incomparable.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("incomparableTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("incomparableNote")}</p>
          <ul className="space-y-2">
            {summary.incomparable.map((o) => (
              <OfferRow key={o.id} product={product} offer={o} muted />
            ))}
          </ul>
        </section>
      )}
      {noData.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("noDataStores")}</h3>
          <p className="text-xs text-muted-foreground">{t("noDataStoresNote")}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {noData.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border px-3 py-2">
                <span className="min-w-0 truncate text-sm">
                  {b.storeName}
                  {b.storeIsDemo && <DemoBadge className="ml-1.5" />}
                </span>
                <Link
                  href={`/prices/add?product=${product.slug}&branch=${b.slug}`}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-strong dark:text-primary"
                >
                  <Plus className="size-3.5" aria-hidden /> {t("addPrice")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
