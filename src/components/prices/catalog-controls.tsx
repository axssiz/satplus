"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { NativeSelect } from "@/components/ui/input";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function CatalogControls({ hasQuery }: { hasQuery: boolean }) {
  const t = useTranslations("prices");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const sort = params.get("sort") ?? (hasQuery ? "relevance" : "popular");
  const priced = params.get("priced") === "1";

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    const qs = next.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-60")}>
      <label className="sr-only" htmlFor="catalog-sort">
        {t("sort")}
      </label>
      <NativeSelect
        id="catalog-sort"
        value={sort}
        onChange={(e) => update({ sort: e.target.value })}
        className="h-10 w-auto min-w-44 text-sm"
      >
        {hasQuery && <option value="relevance">{t("sortRelevance")}</option>}
        <option value="popular">{t("sortPopular")}</option>
        <option value="updated">{t("sortUpdated")}</option>
        <option value="name">{t("sortName")}</option>
      </NativeSelect>
      <button
        type="button"
        role="switch"
        aria-checked={priced}
        onClick={() => update({ priced: priced ? null : "1" })}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition",
          priced ? "border-primary bg-primary-soft text-primary-strong dark:text-primary" : "border-border bg-card text-muted-foreground",
        )}
      >
        <span className={cn("relative h-5 w-8 rounded-full transition", priced ? "bg-primary" : "bg-border")}>
          <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", priced ? "left-3.5" : "left-0.5")} />
        </span>
        {t("onlyWithPrices")}
      </button>
    </div>
  );
}
