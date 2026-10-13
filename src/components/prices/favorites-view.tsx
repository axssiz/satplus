"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { loadProductsWithOffers } from "@/app/actions/public";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { useFavorites } from "@/lib/client/lists";
import { bestOffersByProduct } from "@/lib/pricing/compare";
import type { PriceOffer, Product } from "@/lib/types";
import { ProductCard } from "./product-card";

export function FavoritesView({ categoryIcons }: { categoryIcons: Record<string, string> }) {
  const t = useTranslations();
  const fav = useFavorites();
  const [data, setData] = useState<{ products: Product[]; offers: PriceOffer[] } | null>(null);
  const key = fav.ids.join(",");
  useEffect(() => {
    if (!fav.hydrated) return;
    let cancelled = false;
    loadProductsWithOffers(key ? key.split(",") : []).then((r) => !cancelled && setData(r.ok && r.data ? r.data : { products: [], offers: [] }));
    return () => {
      cancelled = true;
    };
  }, [key, fav.hydrated]);
  const summaries = useMemo(() => (data ? bestOffersByProduct(data.products, data.offers) : new Map()), [data]);

  if (!fav.hydrated || (fav.ids.length > 0 && !data))
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  if (fav.ids.length === 0)
    return (
      <EmptyState
        icon={Heart}
        title={t("favorites.empty")}
        description={t("favorites.emptyHint")}
        action={<Link href="/prices" className={buttonVariants({ variant: "soft" })}>{t("common.toPrices")}</Link>}
      />
    );
  const visible = (data?.products ?? []).filter((p) => fav.ids.includes(p.id));
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {visible.map((p) => (
        <li key={p.id} className="flex">
          <ProductCard product={p} summary={summaries.get(p.id)} categoryIconName={categoryIcons[p.categoryId]} />
        </li>
      ))}
    </ul>
  );
}
