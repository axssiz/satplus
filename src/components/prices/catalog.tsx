import { PackageSearch } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { QaiArzanLogo } from "@/components/brand";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { categoryIcon } from "@/components/icons";
import { Container } from "@/components/layout/container";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Link } from "@/i18n/navigation";
import { getCategories, searchCatalog, type CatalogSort } from "@/lib/data/catalog";
import type { AppLocale } from "@/lib/format";
import { bestOffersByProduct } from "@/lib/pricing/compare";
import { cn } from "@/lib/utils";
import { CatalogControls } from "./catalog-controls";
import { ProductCard } from "./product-card";
import { SearchBox } from "./search-box";

export type CatalogParams = {
  q?: string;
  sort?: string;
  priced?: string;
  page?: string;
};

const SORTS: CatalogSort[] = ["popular", "updated", "name", "relevance"];

export async function Catalog({ params, categorySlug }: { params: CatalogParams; categorySlug?: string }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const q = (params.q ?? "").trim().slice(0, 100) || undefined;
  const sort = SORTS.includes(params.sort as CatalogSort) ? (params.sort as CatalogSort) : undefined;
  const page = Math.max(1, Math.min(500, Number.parseInt(params.page ?? "1", 10) || 1));

  const data = await load(() =>
    Promise.all([
      getCategories(),
      searchCatalog({ q, category: categorySlug, onlyPriced: params.priced === "1", sort, page }),
    ]),
  );

  const qs = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { q, sort: params.sort, priced: params.priced, page: String(page), ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === "1")) sp.set(k, v);
    const s = sp.toString();
    return s ? `?${s}` : "";
  };
  const base = categorySlug ? `/prices/category/${categorySlug}` : "/prices";

  return (
    <Container className="space-y-6 pt-6 sm:pt-10">
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <QaiArzanLogo />
            <p className="text-sm text-muted-foreground">{t("prices.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/prices/basket" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("nav.basket")}
            </Link>
            <Link href="/prices/stores" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("nav.stores")}
            </Link>
            <Link href="/prices/add" className={buttonVariants({ size: "sm" })}>
              {t("nav.addPrice")}
            </Link>
          </div>
        </div>
        <SearchBox
          defaultValue={q ?? ""}
          placeholder={t("prices.searchPlaceholder")}
          action={base}
          size="md"
          extraParams={{ priced: params.priced }}
        />
      </header>

      {!data.ok ? (
        <DataUnavailable error={data.error} />
      ) : (
        <>
          <nav aria-label={t("prices.categories")} className="relative -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex w-max gap-2 pb-1 sm:w-auto sm:flex-wrap">
              <li>
                <Link
                  href={`/prices${qs({ page: undefined })}`}
                  aria-current={!categorySlug ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center rounded-full border px-4 text-sm font-medium transition",
                    !categorySlug ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-surface",
                  )}
                >
                  {t("prices.allCategories")}
                </Link>
              </li>
              {data.data[0].map((c) => {
                const Icon = categoryIcon(c.icon);
                const active = c.slug === categorySlug;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/prices/category/${c.slug}${qs({ page: undefined })}`}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-10 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition",
                        active ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-surface",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                      {locale === "kk" ? c.nameKk : c.nameRu}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
              {t("prices.results", { count: data.data[1].total })}
            </p>
            <Suspense>
              <CatalogControls hasQuery={!!q} />
            </Suspense>
          </div>

          {data.data[1].products.length === 0 ? (
            <EmptyState icon={PackageSearch} title={t("prices.nothingFound")} description={t("prices.nothingFoundHint")} />
          ) : (
            <CatalogGrid result={data.data[1]} categories={data.data[0]} />
          )}

          {data.data[1].total > data.data[1].pageSize && (
            <Pagination
              page={page}
              totalPages={Math.ceil(data.data[1].total / data.data[1].pageSize)}
              hrefFor={(p) => `${base}${qs({ page: String(p) })}`}
              labels={{ prev: t("prices.prev"), next: t("prices.next") }}
              status={t("prices.pageOf", { page, total: Math.ceil(data.data[1].total / data.data[1].pageSize) })}
            />
          )}
        </>
      )}
    </Container>
  );
}

function CatalogGrid({
  result,
  categories,
}: {
  result: Awaited<ReturnType<typeof searchCatalog>>;
  categories: Awaited<ReturnType<typeof getCategories>>;
}) {
  const summaries = bestOffersByProduct(result.products, result.offers);
  const icons = new Map(categories.map((c) => [c.id, c.icon]));
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {result.products.map((p, i) => (
        <li key={p.id} className="flex">
          <ProductCard
            product={p}
            summary={summaries.get(p.id)}
            categoryIconName={icons.get(p.categoryId)}
            priority={i < 4}
          />
        </li>
      ))}
    </ul>
  );
}
