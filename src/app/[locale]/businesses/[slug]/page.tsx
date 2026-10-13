import { ArrowLeft, BadgeCheck, ChevronRight, Clock, ExternalLink, Globe, Info, MapPin, Pencil, Phone, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { BusinessCard, categoryLabel, findCategory } from "@/components/businesses/business-card";
import { ComingSoon } from "@/components/coming-soon";
import { BusinessIcon } from "@/components/icons";
import { Container } from "@/components/layout/container";
import { StoresMapLoader } from "@/components/prices/stores-map-loader";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { getBusinessBySlug, getBusinessCategories, searchBusinesses } from "@/lib/data/businesses";
import { storagePublicUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { excerpt, sourceHost, toParagraphs } from "@/lib/news/text";
import { absoluteUrl, alternates, localePath } from "@/lib/seo";

export const revalidate = 300;
type Props = PageProps<"/[locale]/businesses/[slug]">;

const telHref = (phone: string) => `tel:${phone.replace(/[^+0-9]/g, "")}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  if (!isFeatureEnabled("businesses")) return { robots: { index: false, follow: true } };
  const b = await getBusinessBySlug(slug).catch(() => null);
  if (!b) return { robots: { index: false } };
  const description = excerpt(b.description, [b.address, b.openingHours].filter(Boolean).join(". ") || b.name, 160);
  const image = storagePublicUrl("business-images", b.coverPath);
  return {
    title: b.name,
    description,
    alternates: alternates(locale, `/businesses/${b.slug}`),
    openGraph: { title: b.name, description, images: image ? [{ url: image, alt: b.coverAlt ?? "" }] : undefined },
  };
}

export default async function BusinessPage({ params }: Props) {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  setRequestLocale(locale);
  if (!isFeatureEnabled("businesses")) return <ComingSoon section={sectionByKey("businesses")} />;

  const b = await getBusinessBySlug(slug);
  if (!b) notFound();
  const t = await getTranslations();
  const categories = await getBusinessCategories().catch(() => []);
  const category = findCategory(categories, b.categorySlug);
  const more = category
    ? await searchBusinesses({ category: category.slug, pageSize: 4 }).catch(() => ({ items: [] }))
    : { items: [] };
  const related = more.items.filter((x) => x.id !== b.id).slice(0, 3);
  const cover = storagePublicUrl("business-images", b.coverPath);
  const hasCoords = b.latitude != null && b.longitude != null;
  const osm = hasCoords ? `https://www.openstreetmap.org/?mlat=${b.latitude}&mlon=${b.longitude}#map=18/${b.latitude}/${b.longitude}` : null;
  const labels = { sponsored: t("businesses.sponsored"), verified: t("businesses.verifiedShort"), addressUnknown: t("businesses.addressUnknown") };

  // Structured data carries only the facts shown on the page.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: b.name,
    url: absoluteUrl(localePath(locale, `/businesses/${b.slug}`)),
    ...(b.description ? { description: excerpt(b.description, b.description, 300) } : {}),
    ...(b.address ? { address: { "@type": "PostalAddress", streetAddress: b.address, addressLocality: "Сатпаев", addressCountry: "KZ" } } : {}),
    ...(hasCoords ? { geo: { "@type": "GeoCoordinates", latitude: b.latitude, longitude: b.longitude } } : {}),
    ...(b.phone ? { telephone: b.phone } : {}),
    ...(cover ? { image: [cover] } : {}),
    ...(b.website || b.socialUrl ? { sameAs: [b.website, b.socialUrl].filter(Boolean) } : {}),
  };

  return (
    <Container className="pt-4 sm:pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 overflow-hidden text-xs text-muted-foreground">
          <Link href="/businesses" className="shrink-0 hover:text-foreground">
            {t("businesses.title")}
          </Link>
          {category && (
            <>
              <ChevronRight className="size-3.5 shrink-0" aria-hidden />
              <Link href={`/businesses?category=${category.slug}`} className="truncate hover:text-foreground">
                {categoryLabel(category, locale)}
              </Link>
            </>
          )}
        </nav>

        <header className="mt-4 flex items-start gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <BusinessIcon name={category?.icon} className="size-8" strokeWidth={1.5} aria-hidden />
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {b.isSponsored && <Badge tone="warning">{t("businesses.sponsored")}</Badge>}
              {b.verified && b.lastVerifiedAt ? (
                <Badge tone="primary">
                  <BadgeCheck className="mr-1 size-3.5" aria-hidden />
                  {t("businesses.verified", { date: formatDate(`${b.lastVerifiedAt}T12:00:00+05:00`, locale) })}
                </Badge>
              ) : (
                <Badge tone="warning">{t("businesses.needsCheck")}</Badge>
              )}
            </div>
            <h1 className="font-display text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-4xl">{b.name}</h1>
            {category && <p className="text-sm text-muted-foreground">{categoryLabel(category, locale)}</p>}
          </div>
        </header>

        {cover && (
          <figure className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage image */}
            <img src={cover} alt={b.coverAlt ?? ""} className="aspect-[16/9] w-full object-cover" fetchPriority="high" />
          </figure>
        )}

        <dl className="mt-6 grid gap-4 rounded-2xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <dt className="text-xs text-muted-foreground">{t("businesses.address")}</dt>
              <dd>{b.address ?? t("businesses.addressUnknown")}</dd>
              {osm && (
                <dd>
                  <a href={osm} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-strong hover:underline dark:text-primary">
                    {t("businesses.route")} <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </dd>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <dt className="text-xs text-muted-foreground">{t("businesses.hours")}</dt>
              <dd className="whitespace-pre-line">{b.openingHours ?? t("businesses.hoursUnknown")}</dd>
            </div>
          </div>
          <div className="flex gap-2">
            <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <dt className="text-xs text-muted-foreground">{t("businesses.phone")}</dt>
              {b.phone || b.phoneAlt ? (
                [b.phone, b.phoneAlt].filter(Boolean).map((p) => (
                  <dd key={p}>
                    <a href={telHref(p!)} className="font-medium underline-offset-2 hover:underline">
                      {p}
                    </a>
                  </dd>
                ))
              ) : (
                <dd>{t("businesses.hoursUnknown")}</dd>
              )}
            </div>
          </div>
          {(b.website || b.socialUrl) && (
            <div className="flex gap-2">
              <Globe className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{t("businesses.contacts")}</dt>
                {[b.website, b.socialUrl].filter(Boolean).map((u) => (
                  <dd key={u} className="truncate">
                    <a href={u!} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary-strong hover:underline dark:text-primary">
                      {sourceHost(u)} <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                    </a>
                  </dd>
                ))}
              </div>
            </div>
          )}
        </dl>

        {!b.verified && (
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t("businesses.needsCheckHint")}
          </p>
        )}

        {b.description && (
          <div className="mt-6 space-y-3 text-[17px] leading-relaxed">
            {toParagraphs(b.description).map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
        )}

        {hasCoords && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-border">
            <StoresMapLoader points={[{ id: b.id, lat: b.latitude!, lng: b.longitude!, title: b.name, href: localePath(locale, `/businesses/${b.slug}`) }]} />
          </div>
        )}

        <aside className="mt-6 space-y-2 rounded-2xl border border-border bg-surface p-4 text-sm">
          <p>
            <span className="font-semibold">{t("businesses.source")}:</span> {b.sourceName}
          </p>
          {b.isSponsored && <p className="text-muted-foreground">{t("businesses.sponsoredNote")}</p>}
          {b.verified && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t("businesses.needsCheckHint")}
            </p>
          )}
        </aside>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link href="/businesses" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft aria-hidden /> {t("businesses.back")}
          </Link>
          <Link href={`/businesses/suggest?correction=${b.slug}`} className={buttonVariants({ variant: "ghost" })}>
            <Pencil aria-hidden /> {t("businesses.reportError")}
          </Link>
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="more-businesses" className="mx-auto mt-12 max-w-5xl">
          <h2 id="more-businesses" className="mb-4 font-display text-xl font-semibold">
            {t("businesses.more")}
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {related.map((x) => (
              <li key={x.id} className="flex">
                <BusinessCard item={x} category={findCategory(categories, x.categorySlug)} locale={locale} labels={labels} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
