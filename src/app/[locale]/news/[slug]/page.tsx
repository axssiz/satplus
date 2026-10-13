import { ArrowLeft, ChevronRight, Clock, ExternalLink, Info, Newspaper, PenLine } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { Container } from "@/components/layout/container";
import { NewsCard, categoryName } from "@/components/news/news-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { getNewsBySlug, getNewsCategories, searchNews } from "@/lib/data/news";
import { storagePublicUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { excerpt, readingMinutes, sourceHost, toParagraphs } from "@/lib/news/text";
import { absoluteUrl, alternates, localePath } from "@/lib/seo";

type Props = PageProps<"/[locale]/news/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  if (!isFeatureEnabled("news")) return { robots: { index: false, follow: true } };
  const article = await getNewsBySlug(slug).catch(() => null);
  if (!article) return { robots: { index: false } };
  const description = excerpt(article.summary, article.body, 160);
  const image = storagePublicUrl("news-images", article.coverPath);
  return {
    title: article.title,
    description,
    alternates: alternates(locale, `/news/${article.slug}`),
    openGraph: {
      type: "article",
      title: article.title,
      description,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: image ? [{ url: image, alt: article.coverAlt ?? "" }] : undefined,
    },
  };
}

export default async function NewsArticlePage({ params }: Props) {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  setRequestLocale(locale);
  if (!isFeatureEnabled("news")) return <ComingSoon section={sectionByKey("news")} />;

  const article = await getNewsBySlug(slug);
  if (!article) notFound();
  const t = await getTranslations();
  const [categories, more] = await Promise.all([
    getNewsCategories().catch(() => []),
    searchNews({ page: 1, pageSize: 4 }).catch(() => ({ items: [] })),
  ]);
  const category = categoryName(categories, article.categorySlug, locale);
  const cover = storagePublicUrl("news-images", article.coverPath);
  const host = sourceHost(article.sourceUrl);
  const related = more.items.filter((n) => n.id !== article.id).slice(0, 3);
  const edited = new Date(article.updatedAt).getTime() - new Date(article.publishedAt).getTime() > 3_600_000;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title.slice(0, 110),
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: article.lang === "kk" ? "kk" : "ru",
    mainEntityOfPage: absoluteUrl(localePath(locale, `/news/${article.slug}`)),
    ...(cover ? { image: [cover] } : {}),
    publisher: { "@type": "Organization", name: "Sat+" },
    ...(article.sourceUrl ? { isBasedOn: article.sourceUrl } : {}),
  };

  return (
    <Container className="pt-4 sm:pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 overflow-hidden text-xs text-muted-foreground">
          <Link href="/news" className="shrink-0 hover:text-foreground">
            {t("news.title")}
          </Link>
          {category && article.categorySlug && (
            <>
              <ChevronRight className="size-3.5 shrink-0" aria-hidden />
              <Link href={`/news?category=${article.categorySlug}`} className="truncate hover:text-foreground">
                {category}
              </Link>
            </>
          )}
        </nav>

        <header className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {article.isImportant && <Badge tone="danger">{t("news.important")}</Badge>}
            {article.isSponsored && <Badge tone="warning">{t("news.sponsored")}</Badge>}
            {article.lang !== locale && (
              <Badge tone="info">{article.lang === "kk" ? t("news.inKazakh") : t("news.inRussian")}</Badge>
            )}
          </div>
          <h1 className="font-display text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-4xl" lang={article.lang}>
            {article.title}
          </h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>
              {t("news.published")}{" "}
              <time dateTime={article.publishedAt}>{formatDate(article.publishedAt, locale, true)}</time>
            </span>
            {edited && (
              <span>
                {t("news.updated")} <time dateTime={article.updatedAt}>{formatDate(article.updatedAt, locale, true)}</time>
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden /> {t("news.readingTime", { minutes: readingMinutes(article.body) })}
            </span>
          </p>
          {article.summary && (
            <p className="text-lg leading-relaxed text-foreground/85" lang={article.lang}>
              {article.summary}
            </p>
          )}
        </header>

        {cover && (
          <figure className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage image */}
            <img src={cover} alt={article.coverAlt ?? ""} className="aspect-[16/9] w-full object-cover" fetchPriority="high" />
            {article.coverAlt && <figcaption className="px-4 py-2 text-xs text-muted-foreground">{article.coverAlt}</figcaption>}
          </figure>
        )}

        <div className="mt-6 space-y-4 text-[17px] leading-relaxed" lang={article.lang}>
          {toParagraphs(article.body).map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>

        <aside className="mt-8 space-y-3 rounded-2xl border border-border bg-surface p-4 text-sm">
          <p className="font-semibold">
            {t("news.source")}: <span className="font-normal">{article.sourceName}</span>
          </p>
          {article.sourceUrl && host && (
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1.5 font-medium text-primary-strong hover:underline dark:text-primary"
            >
              {t("news.openSource")} ({host}) <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
          {article.isSponsored && <p className="text-muted-foreground">{t("news.sponsoredNote")}</p>}
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t("news.sourceNote")}
          </p>
        </aside>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link href="/news" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft aria-hidden /> {t("news.back")}
          </Link>
          <Link href="/news/suggest" className={buttonVariants({ variant: "ghost" })}>
            <PenLine aria-hidden /> {t("news.suggest")}
          </Link>
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="more-news" className="mx-auto mt-12 max-w-5xl">
          <h2 id="more-news" className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
            <Newspaper className="size-5 text-sky-600 dark:text-sky-400" aria-hidden /> {t("news.more")}
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {related.map((n) => (
              <li key={n.id} className="flex">
                <NewsCard
                  item={n}
                  locale={locale}
                  category={categoryName(categories, n.categorySlug, locale)}
                  labels={{ important: t("news.important"), sponsored: t("news.sponsored") }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
