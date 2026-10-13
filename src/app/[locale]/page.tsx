import { ArrowRight, BadgePercent, CalendarDays, Megaphone, Newspaper, PenLine, PlusCircle, ShoppingBasket, Sparkles, Tag } from "lucide-react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { QaiArzanLogo } from "@/components/brand";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { categoryIcon, sectionIcon } from "@/components/icons";
import { Container } from "@/components/layout/container";
import { NewsCard, categoryName } from "@/components/news/news-card";
import { RecentPrices } from "@/components/prices/recent-prices";
import { SearchBox } from "@/components/prices/search-box";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { isFeatureEnabled } from "@/config/features";
import { futureSections } from "@/config/sections";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { getCategories, getPublicStats, getRecentVerified } from "@/lib/data/catalog";
import { getLatestNews, getNewsCategories } from "@/lib/data/news";
import { searchPromotions } from "@/lib/data/promotions";
import { getPromotionLabels } from "@/components/promotions/labels";
import { PromotionCard } from "@/components/promotions/promotion-card";
import { cityToday } from "@/lib/promotions/dates";
import { formatNumber, type AppLocale } from "@/lib/format";
import { cn } from "@/lib/utils";

export const revalidate = 60;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  setRequestLocale(asLocale((await params).locale));
  const t = await getTranslations();
  const loc = (await getLocale()) as AppLocale;

  const data = await load(() => Promise.all([getPublicStats(), getCategories(), getRecentVerified(6)]));
  const news = isFeatureEnabled("news") ? await load(() => Promise.all([getLatestNews(3), getNewsCategories()])) : null;
  const promotions = isFeatureEnabled("promotions")
    ? await load(() => Promise.all([searchPromotions({ state: "active", pageSize: 4 }), getPromotionLabels()]))
    : null;
  const cityDate = cityToday();
  const today = new Intl.DateTimeFormat(loc === "kk" ? "kk-KZ" : "ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Almaty",
  }).format(new Date());

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[28rem] bg-[radial-gradient(60%_60%_at_20%_30%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_70%),radial-gradient(40%_50%_at_85%_10%,color-mix(in_oklch,var(--deal)_16%,transparent),transparent_70%)]"
        />
        <Container className="relative pb-6 pt-8 sm:pt-14">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            {t("home.greeting")}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-[2rem] font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            {t("home.heroTitle")}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">{t("home.heroSubtitle")}</p>
          <div className="mt-6 max-w-2xl">
            <SearchBox placeholder={t("home.searchPlaceholder")} />
            <p className="mt-2 px-1 text-xs text-muted-foreground">{t("home.checkPriceHint")}</p>
          </div>
        </Container>
      </section>

      {/* QaiArzan */}
      <Container className="space-y-6">
        <section
          aria-labelledby="qai-title"
          className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
        >
          <div className="relative bg-[linear-gradient(135deg,var(--primary-soft),transparent_60%)] p-5 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <QaiArzanLogo />
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarDays className="size-3.5" aria-hidden />
                {t("home.today")} · {today}
              </span>
            </div>
            <h2 id="qai-title" className="mt-5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {t("home.qaiTitle")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{t("home.qaiSubtitle")}</p>

            {data.ok && (
              <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                {[
                  { value: data.data[0].freshVerified, label: t("home.statFresh"), accent: true },
                  { value: data.data[0].products, label: t("home.statProducts") },
                  { value: data.data[0].branches, label: t("home.statBranches") },
                  { value: data.data[0].updates7d, label: t("home.statUpdates") },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col rounded-2xl border border-border/70 bg-card/80 p-3 backdrop-blur sm:p-4">
                    <dt className="order-2 text-xs leading-snug text-muted-foreground">{s.label}</dt>
                    <dd
                      className={cn(
                        "tabular font-display text-2xl font-semibold",
                        s.accent && "text-primary-strong dark:text-primary",
                      )}
                    >
                      {formatNumber(s.value, loc)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/prices" className={buttonVariants({ size: "lg" })}>
                <Tag aria-hidden /> {t("home.comparePrices")}
              </Link>
              <Link href="/prices/basket" className={buttonVariants({ size: "lg", variant: "outline" })}>
                <ShoppingBasket aria-hidden /> {t("home.compareBasket")}
              </Link>
              <Link href="/prices/add" className={buttonVariants({ size: "lg", variant: "soft" })}>
                <PlusCircle aria-hidden /> {t("home.addPrice")}
              </Link>
            </div>
          </div>

          {data.ok ? (
            <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1fr_1.3fr]">
              <div>
                <h3 className="text-sm font-semibold">{t("home.popularCategories")}</h3>
                <ul className="mt-3 grid grid-cols-2 gap-2">
                  {data.data[1].map((c) => {
                    const Icon = categoryIcon(c.icon);
                    return (
                      <li key={c.id}>
                        <Link
                          href={`/prices/category/${c.slug}`}
                          className="flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-3 py-2.5 text-sm font-medium transition hover:border-primary/40 hover:bg-primary-soft/40"
                        >
                          <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                          <span className="line-clamp-2 leading-tight">{loc === "kk" ? c.nameKk : c.nameRu}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{t("home.recentVerified")}</h3>
                  <Link href="/prices?sort=updated" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-strong dark:text-primary">
                    {t("common.all")} <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
                {data.data[2].products.length > 0 ? (
                  <RecentPrices
                    products={data.data[2].products}
                    offers={data.data[2].offers}
                    categoryIcons={new Map(data.data[1].map((c) => [c.id, c.icon]))}
                  />
                ) : (
                  <EmptyState
                    className="mt-3"
                    icon={Tag}
                    title={t("home.noVerifiedYet")}
                    description={t("home.noVerifiedYetHint")}
                    action={
                      <Link href="/prices/add" className={buttonVariants({ variant: "soft" })}>
                        {t("home.addPrice")}
                      </Link>
                    }
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="p-5 sm:p-8">
              <DataUnavailable error={data.error} />
            </div>
          )}
        </section>

        {/* Latest news (only when the section is live) */}
        {news && (
          <section aria-labelledby="news-title" className="pt-6">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 id="news-title" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight sm:text-2xl">
                <Newspaper className="size-5 text-sky-600 dark:text-sky-400" aria-hidden /> {t("home.latestNews")}
              </h2>
              <Link href="/news" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-strong dark:text-primary">
                {t("common.all")} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            {!news.ok ? (
              <DataUnavailable error={news.error} />
            ) : news.data[0].length === 0 ? (
              <EmptyState
                icon={Newspaper}
                title={t("home.noNewsYet")}
                description={t("home.noNewsYetHint")}
                action={
                  <Link href="/news/suggest" className={buttonVariants({ variant: "soft" })}>
                    <PenLine aria-hidden /> {t("news.suggest")}
                  </Link>
                }
              />
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {news.data[0].map((n) => (
                  <li key={n.id} className="flex">
                    <NewsCard
                      item={n}
                      locale={loc}
                      category={categoryName(news.data[1], n.categorySlug, loc)}
                      labels={{ important: t("news.important"), sponsored: t("news.sponsored") }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Active promotions (only when the section is live) */}
        {promotions && (
          <section aria-labelledby="promotions-title" className="pt-6">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 id="promotions-title" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight sm:text-2xl">
                <BadgePercent className="size-5 text-rose-600 dark:text-rose-400" aria-hidden /> {t("home.activePromotions")}
              </h2>
              <Link href="/promotions" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-strong dark:text-primary">
                {t("common.all")} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            {!promotions.ok ? (
              <DataUnavailable error={promotions.error} />
            ) : promotions.data[0].items.length === 0 ? (
              <EmptyState
                icon={BadgePercent}
                title={t("home.noPromotionsYet")}
                description={t("home.noPromotionsYetHint")}
                action={
                  <Link href="/promotions/report" className={buttonVariants({ variant: "soft" })}>
                    <Megaphone aria-hidden /> {t("promotions.report")}
                  </Link>
                }
              />
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {promotions.data[0].items.map((p) => (
                  <li key={p.id} className="flex">
                    <PromotionCard item={p} locale={loc} today={cityDate} labels={promotions.data[1]} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Future services */}
        <section aria-labelledby="services-title" className="pt-6">
          <div className="mb-4 flex flex-col gap-1">
            <h2 id="services-title" className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
              {t("home.servicesTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("home.servicesSubtitle")}</p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {futureSections.map((s) => {
              const Icon = sectionIcon(s.icon);
              const enabled = isFeatureEnabled(s.key);
              return (
                <li key={s.key}>
                  <Link
                    href={`/${s.slug}`}
                    className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={cn("grid size-11 place-items-center rounded-2xl", s.accent)}>
                        <Icon className="size-5" aria-hidden />
                      </span>
                      {!enabled && <Badge>{t("common.soon")}</Badge>}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-snug">{t(`sections.${s.key}.title`)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t(`sections.${s.key}.short`)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </Container>
    </>
  );
}
