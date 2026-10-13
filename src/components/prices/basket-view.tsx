"use client";

import { AlertTriangle, Minus, Plus, ShoppingBasket, Store, Trash2, Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { loadProductsWithOffers } from "@/app/actions/public";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { useBasket } from "@/lib/client/lists";
import { formatDate, formatPack, formatTenge, localized, unitLabel, type AppLocale } from "@/lib/format";
import { compareBasket } from "@/lib/pricing/basket";
import { packsEqual } from "@/lib/pricing/units";
import type { Pack, PriceOffer, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProductPicker } from "./product-picker";
import { DemoBadge } from "./status-badge";

function packKey(p: Pack) {
  return `${p.quantity}|${p.unit}`;
}

export function BasketView() {
  const t = useTranslations("basket");
  const locale = useLocale() as AppLocale;
  const basket = useBasket();
  const [data, setData] = useState<{ products: Product[]; offers: PriceOffer[] } | null>(null);
  const [error, setError] = useState(false);
  const idsKey = basket.items.map((i) => i.productId).sort().join(",");

  useEffect(() => {
    if (!basket.hydrated) return;
    const ids = idsKey ? idsKey.split(",") : [];
    let cancelled = false;
    loadProductsWithOffers(ids).then((res) => {
      if (cancelled) return;
      if (res.ok && res.data) {
        setData(res.data);
        setError(false);
      } else setError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [idsKey, basket.hydrated]);

  const productById = useMemo(() => new Map((data?.products ?? []).map((p) => [p.id, p])), [data]);
  const result = useMemo(
    () => (data ? compareBasket(basket.items, data.products, data.offers) : null),
    [basket.items, data],
  );
  const name = (id: string) => {
    const p = productById.get(id);
    return p ? localized(p, locale) : "…";
  };

  if (!basket.hydrated) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* List */}
      <section className="space-y-3">
        <ProductPicker placeholder={t("searchPlaceholder")} onPick={(p) => basket.add(p.id)} exclude={basket.items.map((i) => i.productId)} />
        {basket.items.length === 0 ? (
          <EmptyState icon={ShoppingBasket} title={t("empty")} description={t("emptyHint")} />
        ) : (
          <>
            <ul className="space-y-2">
              {basket.items.map((item) => {
                const p = productById.get(item.productId);
                const isAnalog = p && p.comparisonMode === "analog" && !p.isWeighted;
                const packs: Pack[] = [];
                if (isAnalog)
                  for (const o of data?.offers ?? [])
                    if (o.productId === p.id && o.pack && o.effectiveStatus === "verified" && !packs.some((x) => packsEqual(x, o.pack)))
                      packs.push(o.pack);
                const step = p?.isWeighted || (isAnalog && !item.pack) ? 0.5 : 1;
                const qtyUnit = p?.isWeighted || (isAnalog && !item.pack) ? unitLabel(p!.unit, locale) : unitLabel("pcs", locale);
                return (
                  <li key={item.productId} className="rounded-2xl border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={p ? `/prices/p/${p.slug}` : "#"} className="min-w-0 text-sm font-semibold hover:underline">
                        {name(item.productId)}
                      </Link>
                      <button
                        type="button"
                        onClick={() => basket.remove(item.productId)}
                        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-surface-2"
                        aria-label={t("remove")}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="flex items-center rounded-xl bg-surface-2" role="group" aria-label={t("quantity")}>
                        <button
                          type="button"
                          className="grid size-9 place-items-center rounded-xl hover:bg-border/60"
                          onClick={() => basket.set(item.productId, { quantity: Math.max(step, +(item.quantity - step).toFixed(3)) })}
                          aria-label="−"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="tabular min-w-14 text-center text-sm font-semibold">
                          {item.quantity} {qtyUnit}
                        </span>
                        <button
                          type="button"
                          className="grid size-9 place-items-center rounded-xl hover:bg-border/60"
                          onClick={() => basket.set(item.productId, { quantity: Math.min(1000, +(item.quantity + step).toFixed(3)) })}
                          aria-label="+"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                      {isAnalog && (
                        <NativeSelect
                          aria-label={t("packLabel")}
                          className="h-9 w-auto min-w-0 flex-1 text-xs"
                          value={item.pack ? packKey(item.pack) : ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) basket.set(item.productId, { pack: null });
                            else {
                              const [q, u] = v.split("|");
                              basket.set(item.productId, { pack: { quantity: Number(q), unit: u as Pack["unit"] }, quantity: Math.max(1, Math.round(item.quantity)) });
                            }
                          }}
                        >
                          <option value="">{t("packAny", { unit: unitLabel(p!.unit, locale) })}</option>
                          {packs.map((pk) => (
                            <option key={packKey(pk)} value={packKey(pk)}>
                              {formatPack(pk, locale)}
                            </option>
                          ))}
                        </NativeSelect>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <Button variant="ghost" size="sm" onClick={basket.clear} className="text-muted-foreground">
              <Trash2 aria-hidden /> {t("clear")}
            </Button>
          </>
        )}
      </section>

      {/* Results */}
      <section className="space-y-4" aria-live="polite">
        {basket.items.length > 0 && !result && !error && <Skeleton className="h-64 w-full" />}
        {error && <p className="rounded-xl bg-danger-soft p-4 text-sm text-danger">{t("noData")}</p>}
        {result && result.status === "no_data" && (
          <EmptyState icon={AlertTriangle} title={t("noData")} />
        )}
        {result && (result.status === "partial" || (result.status === "complete" && !result.cheapestComplete)) && (
          <div className="flex gap-3 rounded-2xl bg-warning-soft p-4 text-sm text-warning-foreground">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">{t("notEnoughData")}</p>
              <p className="mt-1">{t("notEnoughDataHint")}</p>
            </div>
          </div>
        )}
        {result && result.cheapestComplete && (
          <div className="rounded-3xl border border-deal/60 bg-deal-soft/60 p-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Trophy className="size-4 text-primary" aria-hidden /> {t("cheapestStore")}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-lg font-semibold">
              {result.cheapestComplete.storeName} {result.cheapestComplete.isDemo && <DemoBadge />}
            </p>
            <p className="tabular font-display text-3xl font-semibold text-primary-strong dark:text-primary">
              {formatTenge(result.cheapestComplete.total, locale)}
            </p>
            {result.spread !== null && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("difference")}: <span className="tabular font-semibold text-foreground">{formatTenge(result.spread, locale)}</span>
              </p>
            )}
          </div>
        )}
        {result && result.split.lines.length > 0 && result.split.storeCount > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-semibold">{t("split")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("splitStores", { count: result.split.storeCount })}</p>
            <p className="tabular mt-2 text-2xl font-semibold">
              {formatTenge(result.split.total, locale)}
              {!result.split.complete && <span className="ml-2 text-xs font-normal text-muted-foreground">({t("partialTotal")})</span>}
            </p>
            {result.savings !== null && result.savings > 0 && (
              <p className="mt-1 text-sm">
                <span className="font-semibold text-primary-strong dark:text-primary">
                  {t("savings")}: {formatTenge(result.savings, locale)}
                </span>{" "}
                <span className="text-muted-foreground">{t("savingsNote")}</span>
              </p>
            )}
            <ul className="mt-3 divide-y divide-border text-sm">
              {basket.items.map((item) => {
                const line = result.split.lines.find((l) => l.productId === item.productId);
                const offer = line && data?.offers.find((o) => o.id === line.offerId);
                return (
                  <li key={item.productId} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate">{name(item.productId)}</span>
                      <span className="text-xs text-muted-foreground">{offer ? offer.storeName : t("nowhere")}</span>
                    </span>
                    <span className="tabular shrink-0 font-medium">
                      {line ? `${line.approximate ? "≈ " : ""}${formatTenge(line.cost, locale)}` : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {result && result.stores.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">{t("storesTable")}</h2>
            <ul className="space-y-2">
              {result.stores.map((s) => (
                <li
                  key={s.branchId}
                  className={cn(
                    "rounded-2xl border p-4",
                    s === result.cheapestComplete ? "border-deal/60 bg-deal-soft/30" : "border-border bg-card",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                        <Store className="size-4 text-muted-foreground" aria-hidden />
                        {s.storeName} {s.isDemo && <DemoBadge />}
                      </p>
                      <p className={cn("mt-0.5 text-xs", s.complete ? "text-primary-strong dark:text-primary" : "text-warning-foreground")}>
                        {s.complete ? t("complete") : t("missingItems", { count: s.missing.length })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-lg font-semibold">{formatTenge(s.total, locale)}</p>
                      {!s.complete && <p className="text-xs text-muted-foreground">{t("partialTotal")}</p>}
                    </div>
                  </div>
                  {!s.complete && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("missingList")}: {s.missing.map(name).join(", ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {result && result.status !== "empty" && result.status !== "no_data" && (
          <div className="space-y-1 text-xs text-muted-foreground">
            {result.split.lines.some((l) => l.approximate) && <p>{t("approxNote")}</p>}
            {result.oldestObservedAt && <p>{t("pricesAsOf", { date: formatDate(result.oldestObservedAt, locale) })}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
