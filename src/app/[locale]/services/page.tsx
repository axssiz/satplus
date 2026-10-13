import { ClipboardList, PlusCircle, SearchX, Wrench } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { ServiceIcon } from "@/components/icons";
import { Container } from "@/components/layout/container";
import { SearchBox } from "@/components/prices/search-box";
import { ServiceCard, findServiceCategory, serviceCategoryLabel } from "@/components/services/service-card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { getServiceCategories, searchServiceListings } from "@/lib/data/services";
import { alternates } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Props = PageProps<"/[locale]/services">;

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale });
  if (!isFeatureEnabled("services")) {
    return { title: t("sections.services.title"), description: t("sections.services.description"), robots: { index: false, follow: true } };
  }
  return {
    title: t("meta.servicesTitle"),
    description: t("meta.servicesDescription"),
    alternates: alternates(locale, "/services"),
    openGraph: { title: t("meta.servicesTitle"), description: t("meta.servicesDescription") },
    robots: str(sp.q) || str(sp.page) ? { index: false, follow: true } : undefined,
  };
}

export default async function ServicesPage({ params, searchParams }: Props) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  if (!isFeatureEnabled("services")) return <ComingSoon section={sectionByKey("services")} />;

  const t = await getTranslations();
  const sp = await searchParams;
  const q = str(sp.q).trim().slice(0, 100);
  const category = /^[a-z0-9-]{2,64}$/.test(str(sp.category)) ? str(sp.category) : "";
  const page = Math.max(1, Math.min(500, Number.parseInt(str(sp.page) || "1", 10) || 1));

  const data = await load(() => Promise.all([getServiceCategories(), searchServiceListings({ q, category, page })]));

  const qs = (patch: Record<string, string | undefined>) => {
    const merged = { q: q || undefined, category: category || undefined, page: page > 1 ? String(page) : undefined, ...patch };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === "1")) p.set(k, v);
    const s = p.toString();
    return s ? `/services?${s}` : "/services";
  };
  const labels = { sponsored: t("services.sponsored"), priceUnknown: t("services.priceUnknown") };

  return (
    <Container className="space-y-6 pt-6 sm:pt-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700 dark:text-orange-400">
            <Wrench className="size-4" aria-hidden /> Sat+
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-4xl">{t("services.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{t("services.subtitle")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/services/my" className={buttonVariants({ variant: "ghost" })}>
            <ClipboardList aria-hidden /> {t("services.my")}
          </Link>
          <Link href="/services/new" className={buttonVariants({ variant: "outline" })}>
            <PlusCircle aria-hidden /> {t("services.add")}
          </Link>
        </div>
      </header>

      <SearchBox
        defaultValue={q}
        placeholder={t("services.searchPlaceholder")}
        action="/services"
        size="md"
        scanner={false}
        extraParams={{ category: category || undefined }}
      />

      {!data.ok ? (
        <DataUnavailable error={data.error} />
      ) : (
        <>
          <nav aria-label={t("services.categories")} className="-mx-4 overflow-x-auto px-4 pb-1">
            <ul className="flex w-max gap-2">
              {[{ slug: "", name: t("services.allCategories"), icon: "" }, ...data.data[0].map((c) => ({ slug: c.slug, name: serviceCategoryLabel(c, locale)!, icon: c.icon }))].map(
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
                        {c.icon && <ServiceIcon name={c.icon} className="size-4" aria-hidden />}
                        {c.name}
                      </Link>
                    </li>
                  );
                },
              )}
            </ul>
          </nav>

          {(q || category) && <p className="text-sm text-muted-foreground">{t("services.results", { count: data.data[1].total })}</p>}

          {data.data[1].items.length === 0 ? (
            q || category ? (
              <EmptyState icon={SearchX} title={t("services.emptySearch")} description={t("services.emptySearchHint")} />
            ) : (
              <EmptyState
                icon={Wrench}
                title={t("services.empty")}
                description={t("services.emptyHint")}
                action={
                  <Link href="/services/new" className={buttonVariants({ variant: "soft" })}>
                    <PlusCircle aria-hidden /> {t("services.add")}
                  </Link>
                }
              />
            )
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.data[1].items.map((item) => (
                <li key={item.id} className="flex">
                  <ServiceCard item={item} category={findServiceCategory(data.data[0], item.categorySlug)} locale={locale} labels={labels} />
                </li>
              ))}
            </ul>
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
