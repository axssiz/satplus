import { ArrowLeft, CalendarDays, ChevronRight, ExternalLink, Info, MapPin, MessageCircle, Phone, ShieldAlert, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { ServiceIcon } from "@/components/icons";
import { Container } from "@/components/layout/container";
import { ServiceCard, findServiceCategory, serviceCategoryLabel } from "@/components/services/service-card";
import { ServiceComplaintForm } from "@/components/services/service-complaint-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { getServiceCategories, getServiceListingBySlug, searchServiceListings } from "@/lib/data/services";
import { storagePublicUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { excerpt, sourceHost, toParagraphs } from "@/lib/news/text";
import { alternates } from "@/lib/seo";
import { telHref, whatsappHref } from "@/lib/services/contact";
import { cn } from "@/lib/utils";

export const revalidate = 300;
type Props = PageProps<"/[locale]/services/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  if (!isFeatureEnabled("services")) return { robots: { index: false, follow: true } };
  const s = await getServiceListingBySlug(slug).catch(() => null);
  if (!s) return { robots: { index: false } };
  const description = excerpt(s.description, s.title, 160);
  const image = storagePublicUrl("service-images", s.coverPath);
  return {
    title: `${s.title} — ${s.providerName}`,
    description,
    alternates: alternates(locale, `/services/${s.slug}`),
    openGraph: { title: s.title, description, images: image ? [{ url: image, alt: s.coverAlt ?? "" }] : undefined },
  };
}

export default async function ServiceListingPage({ params }: Props) {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  setRequestLocale(locale);
  if (!isFeatureEnabled("services")) return <ComingSoon section={sectionByKey("services")} />;

  const s = await getServiceListingBySlug(slug);
  if (!s) notFound();
  const t = await getTranslations();
  const categories = await getServiceCategories().catch(() => []);
  const category = findServiceCategory(categories, s.categorySlug);
  const more = category ? await searchServiceListings({ category: category.slug, pageSize: 4 }).catch(() => ({ items: [] })) : { items: [] };
  const related = more.items.filter((x) => x.id !== s.id).slice(0, 3);
  const cover = storagePublicUrl("service-images", s.coverPath);
  const wa = s.hasWhatsapp ? whatsappHref(s.phone) : null;
  const labels = { sponsored: t("services.sponsored"), priceUnknown: t("services.priceUnknown") };
  const day = (d: string) => formatDate(d.length === 10 ? `${d}T12:00:00+05:00` : d, locale);

  return (
    <Container className="pt-4 sm:pt-8">
      <article className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 overflow-hidden text-xs text-muted-foreground">
          <Link href="/services" className="shrink-0 hover:text-foreground">
            {t("services.title")}
          </Link>
          {category && (
            <>
              <ChevronRight className="size-3.5 shrink-0" aria-hidden />
              <Link href={`/services?category=${category.slug}`} className="truncate hover:text-foreground">
                {serviceCategoryLabel(category, locale)}
              </Link>
            </>
          )}
        </nav>

        <header className="mt-4 flex items-start gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <ServiceIcon name={category?.icon} className="size-8" strokeWidth={1.5} aria-hidden />
          </div>
          <div className="min-w-0 space-y-2">
            {s.isSponsored && <Badge tone="warning">{t("services.sponsored")}</Badge>}
            <h1 className="font-display text-[1.6rem] font-semibold leading-tight tracking-tight sm:text-4xl">{s.title}</h1>
            <p className="text-base font-medium">{s.providerName}</p>
          </div>
        </header>

        {cover && (
          <figure className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage image */}
            <img src={cover} alt={s.coverAlt ?? ""} className="max-h-[28rem] w-full object-cover" fetchPriority="high" />
          </figure>
        )}

        <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-4 text-sm">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex gap-2">
              <Wallet className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-xs text-muted-foreground">{t("services.price")}</dt>
                <dd className={s.priceNote ? "font-medium" : "text-muted-foreground"}>{s.priceNote ?? t("services.priceUnknown")}</dd>
              </div>
            </div>
            {s.area && (
              <div className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <dt className="text-xs text-muted-foreground">{t("services.area")}</dt>
                  <dd>{s.area}</dd>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="text-xs text-muted-foreground">{t("services.phone")}</dt>
                <dd>
                  <a href={telHref(s.phone)} className="font-semibold underline-offset-2 hover:underline">
                    {s.phone}
                  </a>
                </dd>
              </div>
            </div>
            {s.linkUrl && (
              <div className="flex min-w-0 gap-2">
                <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{t("services.link")}</dt>
                  <dd className="truncate">
                    <a href={s.linkUrl} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-primary-strong hover:underline dark:text-primary">
                      {sourceHost(s.linkUrl)}
                    </a>
                  </dd>
                </div>
              </div>
            )}
          </dl>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a href={telHref(s.phone)} className={cn(buttonVariants(), "sm:flex-1")}>
              <Phone aria-hidden /> {s.phone}
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer nofollow" className={cn(buttonVariants({ variant: "outline" }), "sm:flex-1")}>
                <MessageCircle aria-hidden /> {t("services.whatsapp")}
              </a>
            )}
          </div>
        </section>

        <div className="mt-6 space-y-3 text-[17px] leading-relaxed">
          {toParagraphs(s.description).map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>

        <aside className="mt-6 space-y-2 rounded-2xl border border-border bg-surface p-4 text-sm">
          <p className="flex items-start gap-2 font-medium">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {t("services.disclaimer")}
          </p>
          {s.publishedAt && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5 shrink-0" aria-hidden /> {t("services.published", { date: day(s.publishedAt) })} ·{" "}
              {t("services.activeUntil", { date: day(s.expiresOn) })}
            </p>
          )}
          {s.sourceName && (
            <p className="text-xs text-muted-foreground">
              {t("services.source")}: {s.sourceName}
            </p>
          )}
          {s.isSponsored && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t("services.sponsoredNote")}
            </p>
          )}
        </aside>

        <div className="mt-6 flex flex-col items-start gap-3">
          <Link href="/services" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft aria-hidden /> {t("services.back")}
          </Link>
          <ServiceComplaintForm slug={s.slug} />
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="more-services" className="mx-auto mt-12 max-w-5xl">
          <h2 id="more-services" className="mb-4 font-display text-xl font-semibold">
            {t("services.more")}
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {related.map((x) => (
              <li key={x.id} className="flex">
                <ServiceCard item={x} category={findServiceCategory(categories, x.categorySlug)} locale={locale} labels={labels} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
