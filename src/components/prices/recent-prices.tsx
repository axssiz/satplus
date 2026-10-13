import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatPack, formatRelative, formatTenge, localized, type AppLocale } from "@/lib/format";
import type { PriceOffer, Product } from "@/lib/types";
import { categoryIcon } from "@/components/icons";
import { DemoBadge, PriceStatusBadge } from "./status-badge";

/** Latest verified prices: one row per product, newest first. */
export function RecentPrices({
  products,
  offers,
  categoryIcons,
}: {
  products: Product[];
  offers: PriceOffer[];
  categoryIcons: Map<string, string>;
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("prices");
  const latest = new Map<string, PriceOffer>();
  for (const o of offers) {
    const cur = latest.get(o.productId);
    if (!cur || o.observedAt > cur.observedAt) latest.set(o.productId, o);
  }
  const rows = products
    .map((p) => ({ p, o: latest.get(p.id) }))
    .filter((r): r is { p: Product; o: PriceOffer } => !!r.o)
    .sort((a, b) => b.o.observedAt.localeCompare(a.o.observedAt));

  return (
    <ul className="divide-y divide-border">
      {rows.map(({ p, o }) => {
        const Icon = categoryIcon(categoryIcons.get(p.categoryId));
        return (
          <li key={o.id}>
            <Link
              href={`/prices/p/${p.slug}`}
              className="flex items-center gap-3 py-3 transition hover:bg-surface/70 sm:rounded-xl sm:px-2"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-strong dark:text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{localized(p, locale)}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="truncate">{o.storeName}</span>
                  {o.pack && <span>· {formatPack(o.pack, locale)}</span>}
                  <span>· {formatRelative(o.observedAt, locale)}</span>
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="tabular text-base font-bold">{formatTenge(o.price, locale)}</span>
                {o.isDemo ? <DemoBadge /> : <PriceStatusBadge status="verified" />}
              </span>
            </Link>
          </li>
        );
      })}
      {rows.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">{t("unknownPrice")}</li>}
    </ul>
  );
}
