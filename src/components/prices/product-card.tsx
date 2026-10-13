import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatPack, formatRelative, formatTenge, localized, unitLabel, type AppLocale } from "@/lib/format";
import type { OfferSummary } from "@/lib/pricing/compare";
import { productPack } from "@/lib/pricing/units";
import type { Product } from "@/lib/types";
import { BasketButton, FavoriteButton } from "./list-buttons";
import { ProductVisual } from "./product-visual";
import { DemoBadge } from "./status-badge";

export function productSubtitle(product: Product, locale: AppLocale, t: (k: "packUnknown") => string) {
  const parts: string[] = [];
  if (product.brandName) parts.push(product.brandName);
  const pack = productPack(product);
  if (product.isWeighted) parts.push(`1 ${unitLabel(product.unit, locale)}`);
  else if (pack) parts.push(formatPack(pack, locale));
  else if (product.comparisonMode === "identical") parts.push(t("packUnknown"));
  return parts.join(" · ");
}

export function ProductCard({
  product,
  summary,
  categoryIconName,
  priority,
}: {
  product: Product;
  summary: OfferSummary | undefined;
  categoryIconName?: string;
  priority?: boolean;
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("prices");
  const tp = useTranslations("product");
  const min = summary?.min ?? null;
  const name = localized(product, locale);
  const subtitle = productSubtitle(product, locale, (k) => tp(k));
  const byUnit = summary?.comparableBy === "unit_price";

  return (
    <article className="group relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative">
        <ProductVisual imagePath={product.imagePath} categoryIconName={categoryIconName} alt={name} priority={priority} />
        <FavoriteButton productId={product.id} className="absolute right-2 top-2" />
        {min?.isDemo && <DemoBadge className="absolute left-2 top-2" />}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          <Link href={`/prices/p/${product.slug}`} className="after:absolute after:inset-0 after:rounded-2xl">
            {name}
          </Link>
        </h3>
        {subtitle && <p className="line-clamp-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-end justify-between gap-2">
        {min ? (
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground">
              {t("from")} · {min.storeName}
            </p>
            <p className="tabular text-lg font-bold leading-tight text-primary-strong dark:text-primary">
              {formatTenge(byUnit ? min.comparableValue : min.price, locale)}
              {byUnit && (
                <span className="ml-1 text-xs font-medium text-muted-foreground">
                  /{unitLabel(product.unit, locale)}
                </span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("inStores", { count: summary!.ranked.length })} · {formatRelative(summary!.lastVerifiedAt!, locale)}
            </p>
          </div>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">{t("unknownPrice")}</p>
        )}
        <BasketButton productId={product.id} compact className="relative z-10" />
      </div>
    </article>
  );
}
