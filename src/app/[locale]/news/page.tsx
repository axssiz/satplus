import { Newspaper, PenLine, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { Container } from "@/components/layout/container";
import { NewsCard, categoryName } from "@/components/news/news-card";
import { SearchBox } from "@/components/prices/search-box";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { getNewsCategories, searchNews } from "@/lib/data/news";
import { alternates } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Props = PageProps<"/[locale]/news">;

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale });
  if (!isFeatureEnabled("news")) {
    return { title: t("sections.news.title"), description: t("sections.news.description"), robots: { index: false, follow: true } };
  }
  return {
    title: t("meta.newsTitle"),
    description: t("meta.newsDescription"),
    alternates: alternates(locale, "/news"),
    openGraph: { title: t("meta.newsTitle"), description: t("meta.newsDescription") },
    // Search/filter result pages are not indexed; the clean feed is.
    robots: str(sp.q) || str(sp.page) ? { index: false, follow: true } : undefined,
  };
}

export default async function NewsFeedPage({ params, searchParams }: Props) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  if (!isFeatureEnabled("news")) return <ComingSoon section={sectionByKey("news")} />;

  const t = await getTranslations();
  const sp = await searchParams;
  const q = str(sp.q).trim().slice(0, 100);
  const category = /^[a-z0-9-]{2,64}$/.test(str(sp.category)) ? str(sp.category) : "";
  const page = Math.max(1, Math.min(500, Number.parseInt(str(sp.page) || "1", 10) || 1));

  const data = await load(() => Promise.all([getNewsCategories(), searchNews({ q, category, page })]));

  const qs = (patch: Record<string, string | undefined>) => {
    const merged = { q: q || undefined, category: category || undefined, page: page > 1 ? String(page) : undefined, ...patch };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === "1")) p.set(k, v);
    const s = p.toString();
    return s ? `/news?${s}` : "/news";
  };

  const labels = { important: t("news.important"), sponsored: t("news.sponsored") };

  return (
    <Container className="space-y-6 pt-6 sm:pt-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 dark:text-sky-400">
            <Newspaper className="size-4" aria-hidden /> Sat+
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-4xl">{t("news.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{t("news.subtitle")}</p>
        </div>
        <Link href="/news/suggest" className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>
          <PenLine aria-hidden /> {t("news.suggest")}
        </Link>
      </header>

      <SearchBox
        defaultValue={q}
        placeholder={t("news.searchPlaceholder")}
        action="/news"
        size="md"
        scanner={false}
        extraParams={{ category: category || undefined }}
      />

      {!data.ok ? (
        <DataUnavailable error={data.error} />
      ) : (
        <>
          <nav aria-label={t("news.categories")} className="-mx-4 overflow-x-auto px-4 pb-1">
            <ul className="flex w-max gap-2">
              {[{ slug: "", name: t("news.allCategories") }, ...data.data[0].map((c) => ({ slug: c.slug, name: locale === "kk" ? c.nameKk : c.nameRu }))].map(
                (c) => {
                  const active = c.slug === category;
                  return (
                    <li key={c.slug || "all"}>
                      <Link
                        href={qs({ category: c.slug || undefined, page: undefined })}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition",
                          active
                            ? "border-transparent bg-foreground text-background"
                            : "border-border bg-card text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {c.name}
                      </Link>
                    </li>
                  );
                },
              )}
            </ul>
          </nav>

          {q && <p className="text-sm text-muted-foreground">{t("news.results", { count: data.data[1].total })}</p>}

          {data.data[1].items.length === 0 ? (
            q || category ? (
              <EmptyState icon={SearchX} title={t("news.emptySearch")} description={t("news.emptySearchHint")} />
            ) : (
              <EmptyState
                icon={Newspaper}
                title={t("news.empty")}
                description={t("news.emptyHint")}
                action={
                  <Link href="/news/suggest" className={buttonVariants({ variant: "soft" })}>
                    <PenLine aria-hidden /> {t("news.suggest")}
                  </Link>
                }
              />
            )
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.data[1].items.map((item, i) => {
                const featured = i === 0 && page === 1 && !q;
                return (
                  <li key={item.id} className={cn("flex", featured && "sm:col-span-2 lg:col-span-2 lg:row-span-2")}>
                    <NewsCard
                      item={item}
                      locale={locale}
                      category={categoryName(data.data[0], item.categorySlug, locale)}
                      labels={labels}
                      featured={featured}
                      priority={i < 2}
                    />
                  </li>
                );
              })}
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
