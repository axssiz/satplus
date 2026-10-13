"use client";

import { Check, Heart, ShoppingBasket } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useBasket, useFavorites } from "@/lib/client/lists";
import { cn } from "@/lib/utils";

export function FavoriteButton({ productId, className, withLabel = false }: { productId: string; className?: string; withLabel?: boolean }) {
  const t = useTranslations("prices");
  const fav = useFavorites();
  const active = fav.hydrated && fav.has(productId);
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? t("favoriteRemove") : t("favoriteAdd")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        fav.toggle(productId);
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full transition active:scale-95",
        withLabel ? "h-11 border border-border bg-card px-4 text-sm font-semibold hover:bg-surface" : "size-9 bg-card/90 shadow-soft backdrop-blur hover:bg-card",
        className,
      )}
    >
      <Heart
        className={cn("size-[18px] transition", active ? "fill-rose-500 text-rose-500" : "text-muted-foreground")}
        aria-hidden
      />
      {withLabel && <span>{active ? t("favoriteRemove") : t("favoriteAdd")}</span>}
    </button>
  );
}

export function BasketButton({ productId, className, compact = false }: { productId: string; className?: string; compact?: boolean }) {
  const t = useTranslations("prices");
  const basket = useBasket();
  const inBasket = basket.hydrated && basket.has(productId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!inBasket) {
          basket.add(productId);
          toast.success(t("addedToBasket"));
        }
      }}
      aria-label={inBasket ? t("inBasket") : t("addToBasket")}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition active:scale-95",
        inBasket ? "bg-primary-soft text-primary-strong dark:text-primary" : "bg-surface-2 text-foreground hover:bg-border/70",
        compact ? "size-9" : "h-11 px-4",
        className,
      )}
    >
      {inBasket ? <Check className="size-4" aria-hidden /> : <ShoppingBasket className="size-4" aria-hidden />}
      {!compact && <span>{inBasket ? t("inBasket") : t("addToBasket")}</span>}
    </button>
  );
}
