import { ArrowLeft, CalendarClock, ChevronRight, ExternalLink, Info, Megaphone, Store, Tag } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { Container } from "@/components/layout/container";
import { getPromotionLabels } from "@/components/promotions/labels";
import { PromotionCard, PromotionDeadline, shortDate } from "@/components/promotions/promotion-card";
import { DemoBadge } from "@/components/prices/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { getBranches, getCategories } from "@/lib/data/catalog";
import { getPromotionBySlug, searchPromotions } from "@/lib/data/promotions";
import { storagePublicUrl } from "@/lib/env";
import { localized } from "@/lib/format";
import { excerpt, sourceHost, toParagraphs } from "@/lib/news/text";
import { cityToday, promotionState } from "@/lib/promotions/dates";
import { alternates } from "@/lib/seo";

export const revalidate = 300;
type Props = PageProps<"/[locale]/promotions/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  if (!isFeatureEnabled("promotions")) return { robots: { index: false, follow: true } };
  const p = await getPromotionBySlug(slug).catch(() => null);
  if (!p) return { robots: { index: false } };
  const title = `${p.discountLabel ? `${p.discountLabel} · ` : ""}${p.title} — ${p.storeName}`;
  const description = excerpt(p.description, p.conditions ?? p.title, 160);
  const image = storagePublicUrl("promotion-images", p.coverPath);
  const ended = promotionState(p.startsOn, p.endsOn, cityToday()) === "ended";
  return {
    title,
    description,
    alternates: alternates(locale, `/promotions/${p.slug}`),
    openGraph: { title, description, images: image ? [{ url: image, alt: p.coverAlt ?? "" }] : undefined },
    // Ended and DEMO promotions stay reachable but are not indexed.
    robots: ended || p.storeIsDemo ? { index: false, follow: true } : undefined,
  };
}

export default async function PromotionPage({ params }: Props) {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  setRequestLocale(locale);
  if (!isFeatureEnabled("promotions")) return <ComingSoon section={sectionByKey("promotions")} />;

  const p = await getPromotionBySlug(slug);
  if (!p) notFound();
  const t = await getTranslations();
  const today = cityToday();
  const state = promotionState(p.startsOn, p.endsOn, today);
  const [labels, categories, branches, more] = await Promise.all([
    getPromotionLabels(),
    getCategories().catch(() => []),
    getBranches().catch(() => []),
    searchPromotions({ state: "active", store: p.storeSlug, pageSize: 4 }).catch(() => ({ items: [] })),
  ]);
  const category = categories.find((c) => c.slug === p.categorySlug);
  const storeBranch = p.branchSlug ?? branches.find((b) => b.storeSlug === p.storeSlug)?.slug ?? null;
  const cover = storagePublicUrl("promotion-images", p.coverPath);
  const host = sourceHost(p.sourceUrl);
  const related = more.items.filter((x) => x.id !== p.id).slice(0, 3);
  const period = p.startsOn
    ? t("promotions.periodRange", { from: shortDate(p.startsOn, locale, today), to: shortDate(p.endsOn, locale, today) })
    : t("promotions.periodUntil", { to: shortDate(p.endsOn, locale, today) });

  return (
    <Container className="pt-4 sm:pt-8">
      <article className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 overflow-hidden text-xs text-muted-foreground">
          <Link href="/promotions" className="shrink-0 hover:text-foreground">
            {t("promotions.title")}
          </Link>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
          <Link href={`/promotions?store=${p.storeSlug}`} className="truncate hover:text-foreground">
            {p.storeName}
          </Link>
        </nav>

        {state === "ended" && (
          <p role="status" className="mt-4 rounded-2xl border border-border bg-surface-2 p-4 text-sm">
            <strong className="block text-base">{t("promotions.ended")}</strong>
            {t("promotions.endedNote", { date: shortDate(p.endsOn, locale, today) })}
          </p>
        )}

        <header className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {p.discountLabel && <span className="rounded-lg bg-rose-600 px-2.5 py-1 text-base font-bold text-white">{p.discountLabel}</span>}
            {p.isSponsored && <Badge tone="warning">{t("promotions.sponsored")}</Badge>}
            {p.storeIsDemo && <DemoBadge />}
          </div>
          <h1 className="font-display text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-4xl">{p.title}</h1>
          <dl className="grid gap-3 rounded-2xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <Store className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{t("promotions.where")}</dt>
                <dd className="font-medium">{p.storeName}</dd>
                <dd className="text-muted-foreground">
                  {p.branchName ? t("promotions.branchOnly", { name: [p.branchName, p.branchAddress].filter(Boolean).join(", ") }) : t("promotions.allBranches")}
                </dd>
              </div>
            </div>
            <div className="flex gap-2">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-xs text-muted-foreground">{t("promotions.period")}</dt>
                <dd className="font-medium">{period}</dd>
                <dd>
                  <PromotionDeadline startsOn={p.startsOn} endsOn={p.endsOn} today={today} locale={locale} labels={labels} />
                </dd>
              </div>
            </div>
            {category && (
              <div className="flex gap-2">
                <Tag className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <dt className="text-xs text-muted-foreground">{t("promotions.category")}</dt>
                  <dd>
                    <Link href={`/promotions?category=${category.slug}`} className="underline-offset-2 hover:underline">
                      {localized(category, locale)}
                    </Link>
                  </dd>
                </div>
              </div>
            )}
          </dl>
        </header>

        {cover && (
          <figure className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage image */}
            <img src={cover} alt={p.coverAlt ?? ""} className="max-h-[70vh] w-full object-contain" fetchPriority="high" />
          </figure>
        )}

        {p.description && (
          <section className="mt-6 space-y-3 text-[17px] leading-relaxed">
            <h2 className="sr-only">{t("promotions.details")}</h2>
            {toParagraphs(p.description).map((para, i) => (
              <p key={i} className="whitespace-pre-line">
                {para}
              </p>
            ))}
          </section>
        )}
        {p.conditions && (
          <section className="mt-6 space-y-2">
            <h2 className="text-lg font-semibold">{t("promotions.conditions")}</h2>
            {toParagraphs(p.conditions).map((para, i) => (
              <p key={i} className="whitespace-pre-line text-muted-foreground">
                {para}
              </p>
            ))}
          </section>
        )}

        <aside className="mt-8 space-y-3 rounded-2xl border border-border bg-surface p-4 text-sm">
          <p className="font-semibold">
            {t("promotions.source")}: <span className="font-normal">{p.sourceName}</span>
          </p>
          {p.sourceUrl && host && (
            <a
              href={p.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1.5 font-medium text-primary-strong hover:underline dark:text-primary"
            >
              {t("promotions.openSource")} ({host}) <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
          {p.isSponsored && <p className="text-muted-foreground">{t("promotions.sponsoredNote")}</p>}
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t("promotions.checkNote")} {t("promotions.notPriceNote")}
          </p>
        </aside>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link href="/promotions" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft aria-hidden /> {t("promotions.back")}
          </Link>
          {storeBranch && (
            <Link href={`/prices/stores/${storeBranch}`} className={buttonVariants({ variant: "ghost" })}>
              <Tag aria-hidden /> {t("promotions.storePrices")}
            </Link>
          )}
          <Link href="/promotions/report" className={buttonVariants({ variant: "ghost" })}>
            <Megaphone aria-hidden /> {t("promotions.report")}
          </Link>
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="more-promotions" className="mx-auto mt-12 max-w-5xl">
          <h2 id="more-promotions" className="mb-4 font-display text-xl font-semibold">
            {t("promotions.more")}
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {related.map((x) => (
              <li key={x.id} className="flex">
                <PromotionCard item={x} locale={locale} today={today} labels={labels} showStore={false} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
