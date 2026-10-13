import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Clock,
  ExternalLink,
  GraduationCap,
  Info,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldAlert,
  User,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { JobIcon } from "@/components/icons";
import { JobCard, findJobCategory, jobCategoryLabel } from "@/components/jobs/job-card";
import { Container } from "@/components/layout/container";
import { ServiceComplaintForm } from "@/components/services/service-complaint-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { getJobCategories, getJobListingBySlug, searchJobListings } from "@/lib/data/jobs";
import { formatDate } from "@/lib/format";
import { formatSalary } from "@/lib/jobs/salary";
import { excerpt, sourceHost, toParagraphs } from "@/lib/news/text";
import { alternates } from "@/lib/seo";
import { telHref, whatsappHref } from "@/lib/services/contact";
import { cn } from "@/lib/utils";
import { EMPLOYMENT_TYPES } from "@/lib/validation";

export const revalidate = 300;
type Props = PageProps<"/[locale]/jobs/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  if (!isFeatureEnabled("jobs")) return { robots: { index: false, follow: true } };
  const j = await getJobListingBySlug(slug).catch(() => null);
  if (!j) return { robots: { index: false } };
  const description = excerpt(j.description, j.title, 160);
  return {
    title: `${j.title} — ${j.employerName}`,
    description,
    alternates: alternates(locale, `/jobs/${j.slug}`),
    openGraph: { title: j.title, description },
  };
}

function Fact({ icon: Icon, label, children, className }: { icon: typeof Wallet; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 gap-2", className)}>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words">{children}</dd>
      </div>
    </div>
  );
}

export default async function JobListingPage({ params }: Props) {
  const { locale: l, slug } = await params;
  const locale = asLocale(l);
  setRequestLocale(locale);
  if (!isFeatureEnabled("jobs")) return <ComingSoon section={sectionByKey("jobs")} />;

  const j = await getJobListingBySlug(slug);
  if (!j) notFound();
  const t = await getTranslations();
  const categories = await getJobCategories().catch(() => []);
  const category = findJobCategory(categories, j.categorySlug);
  const more = category ? await searchJobListings({ category: category.slug, pageSize: 4 }).catch(() => ({ items: [] })) : { items: [] };
  const related = more.items.filter((x) => x.id !== j.id).slice(0, 3);
  const wa = j.hasWhatsapp ? whatsappHref(j.phone) : null;
  const salary = formatSalary(j.salaryFrom, j.salaryTo, locale);
  const labels = {
    sponsored: t("jobs.sponsored"),
    salaryUnknown: t("jobs.salaryUnknown"),
    noExperience: t("jobs.noExperience"),
    employment: Object.fromEntries(EMPLOYMENT_TYPES.map((x) => [x, t(`jobs.employmentTypes.${x}`)])),
  };
  const day = (d: string) => formatDate(d.length === 10 ? `${d}T12:00:00+05:00` : d, locale);

  return (
    <Container className="pt-4 sm:pt-8">
      <article className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 overflow-hidden text-xs text-muted-foreground">
          <Link href="/jobs" className="shrink-0 hover:text-foreground">
            {t("jobs.title")}
          </Link>
          {category && (
            <>
              <ChevronRight className="size-3.5 shrink-0" aria-hidden />
              <Link href={`/jobs?category=${category.slug}`} className="truncate hover:text-foreground">
                {jobCategoryLabel(category, locale)}
              </Link>
            </>
          )}
        </nav>

        <header className="mt-4 flex items-start gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
            <JobIcon name={category?.icon} className="size-8" strokeWidth={1.5} aria-hidden />
          </div>
          <div className="min-w-0 space-y-2">
            {j.isSponsored && <Badge tone="warning">{t("jobs.sponsored")}</Badge>}
            <h1 className="font-display text-[1.6rem] font-semibold leading-tight tracking-tight sm:text-4xl">{j.title}</h1>
            <p className="text-base font-medium">{j.employerName}</p>
          </div>
        </header>

        <p className="mt-5 text-2xl font-semibold tracking-tight">
          {salary ?? <span className="text-lg font-medium text-muted-foreground">{t("jobs.salaryUnknown")}</span>}
        </p>
        {j.salaryNote && <p className="mt-1 text-sm text-muted-foreground">{j.salaryNote}</p>}

        <section className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-4 text-sm">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact icon={Briefcase} label={t("jobs.employment")}>
              {t(`jobs.employmentTypes.${j.employmentType}`)}
            </Fact>
            <Fact icon={GraduationCap} label={t("jobs.experience")}>
              {t(`jobs.experienceLevels.${j.experience}`)}
            </Fact>
            {j.schedule && (
              <Fact icon={Clock} label={t("jobs.schedule")}>
                {j.schedule}
              </Fact>
            )}
            {j.address && (
              <Fact icon={MapPin} label={t("jobs.address")}>
                {j.address}
              </Fact>
            )}
            {j.contactName && (
              <Fact icon={User} label={t("jobs.contact")}>
                {j.contactName}
              </Fact>
            )}
            <Fact icon={Phone} label={t("jobs.phone")}>
              <a href={telHref(j.phone)} className="font-semibold underline-offset-2 hover:underline">
                {j.phone}
              </a>
            </Fact>
            {j.email && (
              <Fact icon={Mail} label={t("jobs.email")}>
                <a href={`mailto:${j.email}`} className="text-primary-strong hover:underline dark:text-primary">
                  {j.email}
                </a>
              </Fact>
            )}
            {j.linkUrl && (
              <Fact icon={ExternalLink} label={t("jobs.link")}>
                <a href={j.linkUrl} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-primary-strong hover:underline dark:text-primary">
                  {sourceHost(j.linkUrl)}
                </a>
              </Fact>
            )}
          </dl>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a href={telHref(j.phone)} className={cn(buttonVariants(), "sm:flex-1")}>
              <Phone aria-hidden /> {j.phone}
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer nofollow" className={cn(buttonVariants({ variant: "outline" }), "sm:flex-1")}>
                <MessageCircle aria-hidden /> {t("jobs.whatsapp")}
              </a>
            )}
          </div>
        </section>

        <div className="mt-6 space-y-3 text-[17px] leading-relaxed">
          {toParagraphs(j.description).map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>

        <aside className="mt-6 space-y-2 rounded-2xl border border-border bg-surface p-4 text-sm">
          <p className="flex items-start gap-2 font-medium">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {t("jobs.disclaimer")}
          </p>
          {j.publishedAt && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5 shrink-0" aria-hidden /> {t("jobs.published", { date: day(j.publishedAt) })} ·{" "}
              {t("jobs.activeUntil", { date: day(j.expiresOn) })}
            </p>
          )}
          {j.sourceName && (
            <p className="text-xs text-muted-foreground">
              {t("jobs.source")}: {j.sourceName}
            </p>
          )}
          {j.isSponsored && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t("jobs.sponsoredNote")}
            </p>
          )}
        </aside>

        <div className="mt-6 flex flex-col items-start gap-3">
          <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft aria-hidden /> {t("jobs.back")}
          </Link>
          <ServiceComplaintForm slug={j.slug} target="job" />
        </div>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="more-jobs" className="mx-auto mt-12 max-w-5xl">
          <h2 id="more-jobs" className="mb-4 font-display text-xl font-semibold">
            {t("jobs.more")}
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {related.map((x) => (
              <li key={x.id} className="flex">
                <JobCard item={x} category={findJobCategory(categories, x.categorySlug)} locale={locale} labels={labels} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
