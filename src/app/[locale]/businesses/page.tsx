import { Building2, MapPin, PlusCircle, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BusinessCard, categoryLabel, findCategory } from "@/components/businesses/business-card";
import { ComingSoon } from "@/components/coming-soon";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { BusinessIcon } from "@/components/icons";
import { Container } from "@/components/layout/container";
import { StoresMapLoader } from "@/components/prices/stores-map-loader";
import { SearchBox } from "@/components/prices/search-box";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { getBusinessCategories, searchBusinesses } from "@/lib/data/businesses";
import { alternates, localePath } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Props = PageProps<"/[locale]/businesses">;

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale });
  if (!isFeatureEnabled("businesses")) {
    return { title: t("sections.businesses.title"), description: t("sections.businesses.description"), robots: { index: false, follow: true } };
  }
  return {
    title: t("meta.businessesTitle"),
    description: t("meta.businessesDescription"),
    alternates: alternates(locale, "/businesses"),
    openGraph: { title: t("meta.businessesTitle"), description: t("meta.businessesDescription") },
    robots: str(sp.q) || str(sp.page) ? { index: false, follow: true } : undefined,
  };
}

export default async function BusinessesPage({ params, searchParams }: Props) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  if (!isFeatureEnabled("businesses")) return <ComingSoon section={sectionByKey("businesses")} />;

  const t = await getTranslations();
  const sp = await searchParams;
  const q = str(sp.q).trim().slice(0, 100);
  const category = /^[a-z0-9-]{2,64}$/.test(str(sp.category)) ? str(sp.category) : "";
  const page = Math.max(1, Math.min(500, Number.parseInt(str(sp.page) || "1", 10) || 1));

  const data = await load(() => Promise.all([getBusinessCategories(), searchBusinesses({ q, category, page })]));

  const qs = (patch: Record<string, string | undefined>) => {
    const merged = { q: q || undefined, category: category || undefined, page: page > 1 ? String(page) : undefined, ...patch };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === "1")) p.set(k, v);
    const s = p.toString();
    return s ? `/businesses?${s}` : "/businesses";
  };
  const labels = { sponsored: t("businesses.sponsored"), verified: t("businesses.verifiedShort"), addressUnknown: t("businesses.addressUnknown") };

  return (
    <Container className="space-y-6 pt-6 sm:pt-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 dark:text-indigo-400">
            <Building2 className="size-4" aria-hidden /> Sat+
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-4xl">{t("businesses.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{t("businesses.subtitle")}</p>
        </div>
        <Link href="/businesses/suggest" className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>
          <PlusCircle aria-hidden /> {t("businesses.suggest")}
        </Link>
      </header>

      <SearchBox
        defaultValue={q}
        placeholder={t("businesses.searchPlaceholder")}
        action="/businesses"
        size="md"
        scanner={false}
        extraParams={{ category: category || undefined }}
      />

      {!data.ok ? (
        <DataUnavailable error={data.error} />
      ) : (
        <>
          <nav aria-label={t("businesses.categories")} className="-mx-4 overflow-x-auto px-4 pb-1">
            <ul className="flex w-max gap-2">
              {[{ slug: "", name: t("businesses.allCategories"), icon: "" }, ...data.data[0].map((c) => ({ slug: c.slug, name: categoryLabel(c, locale)!, icon: c.icon }))].map(
                (c) => {
                  const active = c.slug === category;
                  return (
                    <li key={c.slug || "all"}>
                      <Link
                        href={qs({ category: c.slug || undefined, page: undefined })}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition",
                          active ? "border-transparent bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {c.icon && <BusinessIcon name={c.icon} className="size-4" aria-hidden />}
                        {c.name}
                      </Link>
                    </li>
                  );
                },
              )}
            </ul>
          </nav>

          {(q || category) && <p className="text-sm text-muted-foreground">{t("businesses.results", { count: data.data[1].total })}</p>}

          {data.data[1].items.length === 0 ? (
            q || category ? (
              <EmptyState icon={SearchX} title={t("businesses.emptySearch")} description={t("businesses.emptySearchHint")} />
            ) : (
              <EmptyState
                icon={Building2}
                title={t("businesses.empty")}
                description={t("businesses.emptyHint")}
                action={
                  <Link href="/businesses/suggest" className={buttonVariants({ variant: "soft" })}>
                    <PlusCircle aria-hidden /> {t("businesses.suggest")}
                  </Link>
                }
              />
            )
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.data[1].items.map((item) => (
                  <li key={item.id} className="flex">
                    <BusinessCard item={item} category={findCategory(data.data[0], item.categorySlug)} locale={locale} labels={labels} />
                  </li>
                ))}
              </ul>
              <section aria-labelledby="businesses-map" className="space-y-3">
                <h2 id="businesses-map" className="flex items-center gap-2 text-lg font-semibold">
                  <MapPin className="size-5 text-indigo-600 dark:text-indigo-400" aria-hidden /> {t("businesses.map")}
                </h2>
                {(() => {
                  const points = data.data[1].items
                    .filter((b) => b.latitude != null && b.longitude != null)
                    .map((b) => ({ id: b.id, lat: b.latitude!, lng: b.longitude!, title: b.name, href: localePath(locale, `/businesses/${b.slug}`) }));
                  return points.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-border">
                      <StoresMapLoader points={points} />
                    </div>
                  ) : (
                    <p className="flex items-center gap-2 rounded-2xl bg-surface p-4 text-sm text-muted-foreground">
                      <MapPin className="size-4 shrink-0" aria-hidden /> {t("businesses.mapEmpty")}
                    </p>
                  );
                })()}
              </section>
            </>
          )}

          {data.data[1].total > data.data[1].pageSize && (
            <Pagination
              page={page}
              totalPages={Math.ceil(data.data[1].total / data.data[1].pageSize)}
              hrefFor={(p) => qs({ page: String(p) })}
              labels={{ prev: t("prices.prev"), next: t("prices.next") }}
              status={t("prices.pageOf", { page, total: Math.ceil(data.data[1].total / data.data[1].pageSize) })}
            />
          )}
        </>
      )}
    </Container>
  );
}
