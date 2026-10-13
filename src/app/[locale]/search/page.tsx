import { ArrowRight, Info } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { sectionIcon } from "@/components/icons";
import { Container } from "@/components/layout/container";
import { NewsCard, categoryName } from "@/components/news/news-card";
import { ProductCard } from "@/components/prices/product-card";
import { SearchBox } from "@/components/prices/search-box";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { isFeatureEnabled } from "@/config/features";
import { futureSections } from "@/config/sections";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { getCategories, searchCatalog } from "@/lib/data/catalog";
import { getNewsCategories, searchNews } from "@/lib/data/news";
import { searchPromotions } from "@/lib/data/promotions";
import { getBusinessCategories, searchBusinesses } from "@/lib/data/businesses";
import { BusinessCard, findCategory } from "@/components/businesses/business-card";
import { getServiceCategories, searchServiceListings } from "@/lib/data/services";
import { getJobCategories, searchJobListings } from "@/lib/data/jobs";
import { JobCard, findJobCategory } from "@/components/jobs/job-card";
import { EMPLOYMENT_TYPES } from "@/lib/validation";
import { ServiceCard, findServiceCategory } from "@/components/services/service-card";
import { getPromotionLabels } from "@/components/promotions/labels";
import { PromotionCard } from "@/components/promotions/promotion-card";
import { cityToday } from "@/lib/promotions/dates";
import { bestOffersByProduct } from "@/lib/pricing/compare";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/search">): Promise<Metadata> {
  const t = await getTranslations({ locale: asLocale((await params).locale), namespace: "search" });
  return { title: t("title"), robots: { index: false } };
}

export default async function SearchPage({ params, searchParams }: PageProps<"/[locale]/search">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations();
  const raw = (await searchParams).q;
  const q = (typeof raw === "string" ? raw : "").trim().slice(0, 100);
  const lower = q.toLowerCase();
  const sections = q
    ? futureSections.filter((s) =>
        [t(`sections.${s.key}.title`), t(`sections.${s.key}.short`)].some((x) => x.toLowerCase().includes(lower)),
      )
    : futureSections;
  const data = q ? await load(() => Promise.all([searchCatalog({ q, pageSize: 8 }), getCategories()])) : null;
  const newsOn = isFeatureEnabled("news");
  const news = q && newsOn ? await load(() => Promise.all([searchNews({ q, pageSize: 3 }), getNewsCategories()])) : null;
  const promotionsOn = isFeatureEnabled("promotions");
  const promotions =
    q && promotionsOn ? await load(() => Promise.all([searchPromotions({ state: "active", q, pageSize: 4 }), getPromotionLabels()])) : null;
  const businessesOn = isFeatureEnabled("businesses");
  const businesses = q && businessesOn ? await load(() => Promise.all([searchBusinesses({ q, pageSize: 4 }), getBusinessCategories()])) : null;
  const servicesOn = isFeatureEnabled("services");
  const services = q && servicesOn ? await load(() => Promise.all([searchServiceListings({ q, pageSize: 4 }), getServiceCategories()])) : null;
  const jobsOn = isFeatureEnabled("jobs");
  const jobs = q && jobsOn ? await load(() => Promise.all([searchJobListings({ q, pageSize: 4 }), getJobCategories()])) : null;
  const searchable = [t("sections.prices.title"), ...futureSections.filter((s) => s.hasModule && isFeatureEnabled(s.key)).map((s) => t(`sections.${s.key}.title`))];
  const hint = t("search.hintSections", { list: searchable.join(", ") });

  return (
    <Container className="space-y-6 pt-6 sm:pt-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t("search.title")}</h1>
      <SearchBox defaultValue={q} placeholder={t("search.placeholder")} action="/search" autoFocus={!q} />
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {hint}
      </p>
      {data && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t("search.products")}</h2>
            {data.ok && data.data[0].total > 8 && (
              <Link href={`/prices?q=${encodeURIComponent(q)}`} className={buttonVariants({ variant: "link" })}>
                {t("search.showAll")} <ArrowRight aria-hidden />
              </Link>
            )}
          </div>
          {!data.ok ? (
            <DataUnavailable error={data.error} />
          ) : data.data[0].products.length === 0 ? (
            <EmptyState icon={Info} title={t("prices.nothingFound")} description={t("prices.nothingFoundHint")} />
          ) : (
            (() => {
              const s = bestOffersByProduct(data.data[0].products, data.data[0].offers);
              const icons = new Map(data.data[1].map((c) => [c.id, c.icon]));
              return (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {data.data[0].products.map((p) => (
                    <li key={p.id} className="flex">
                      <ProductCard product={p} summary={s.get(p.id)} categoryIconName={icons.get(p.categoryId)} />
                    </li>
                  ))}
                </ul>
              );
            })()
          )}
        </section>
      )}
      {news && news.ok && news.data[0].items.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t("search.news")}</h2>
            {news.data[0].total > 3 && (
              <Link href={`/news?q=${encodeURIComponent(q)}`} className={buttonVariants({ variant: "link" })}>
                {t("search.showAllNews")} <ArrowRight aria-hidden />
              </Link>
            )}
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {news.data[0].items.map((n) => (
              <li key={n.id} className="flex">
                <NewsCard
                  item={n}
                  locale={locale}
                  category={categoryName(news.data[1], n.categorySlug, locale)}
                  labels={{ important: t("news.important"), sponsored: t("news.sponsored") }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      {promotions && promotions.ok && promotions.data[0].items.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t("search.promotions")}</h2>
            {promotions.data[0].total > 4 && (
              <Link href={`/promotions?q=${encodeURIComponent(q)}`} className={buttonVariants({ variant: "link" })}>
                {t("search.showAllPromotions")} <ArrowRight aria-hidden />
              </Link>
            )}
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {promotions.data[0].items.map((p) => (
              <li key={p.id} className="flex">
                <PromotionCard item={p} locale={locale} today={cityToday()} labels={promotions.data[1]} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {businesses && businesses.ok && businesses.data[0].items.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t("search.businesses")}</h2>
            {businesses.data[0].total > 4 && (
              <Link href={`/businesses?q=${encodeURIComponent(q)}`} className={buttonVariants({ variant: "link" })}>
                {t("search.showAllBusinesses")} <ArrowRight aria-hidden />
              </Link>
            )}
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {businesses.data[0].items.map((b) => (
              <li key={b.id} className="flex">
                <BusinessCard
                  item={b}
                  category={findCategory(businesses.data[1], b.categorySlug)}
                  locale={locale}
                  labels={{ sponsored: t("businesses.sponsored"), verified: t("businesses.verifiedShort"), addressUnknown: t("businesses.addressUnknown") }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      {services && services.ok && services.data[0].items.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t("search.services")}</h2>
            {services.data[0].total > 4 && (
              <Link href={`/services?q=${encodeURIComponent(q)}`} className={buttonVariants({ variant: "link" })}>
                {t("search.showAllServices")} <ArrowRight aria-hidden />
              </Link>
            )}
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {services.data[0].items.map((s) => (
              <li key={s.id} className="flex">
                <ServiceCard
                  item={s}
                  category={findServiceCategory(services.data[1], s.categorySlug)}
                  locale={locale}
                  labels={{ sponsored: t("services.sponsored"), priceUnknown: t("services.priceUnknown") }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      {jobs && jobs.ok && jobs.data[0].items.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t("search.jobs")}</h2>
            {jobs.data[0].total > 4 && (
              <Link href={`/jobs?q=${encodeURIComponent(q)}`} className={buttonVariants({ variant: "link" })}>
                {t("search.showAllJobs")} <ArrowRight aria-hidden />
              </Link>
            )}
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {jobs.data[0].items.map((j) => (
              <li key={j.id} className="flex">
                <JobCard
                  item={j}
                  category={findJobCategory(jobs.data[1], j.categorySlug)}
                  locale={locale}
                  labels={{
                    sponsored: t("jobs.sponsored"),
                    salaryUnknown: t("jobs.salaryUnknown"),
                    noExperience: t("jobs.noExperience"),
                    employment: Object.fromEntries(EMPLOYMENT_TYPES.map((x) => [x, t(`jobs.employmentTypes.${x}`)])),
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      {sections.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t("search.sections")}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {sections.map((s) => {
              const Icon = sectionIcon(s.icon);
              return (
                <li key={s.key}>
                  <Link href={`/${s.slug}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-surface">
                    <span className={cn("grid size-10 place-items-center rounded-xl", s.accent)}>
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{t(`sections.${s.key}.title`)}</span>
                      <span className="text-xs text-muted-foreground">{t(`sections.${s.key}.short`)}</span>
                    </span>
                    {!isFeatureEnabled(s.key) && <Badge>{t("common.soon")}</Badge>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Container>
  );
}
