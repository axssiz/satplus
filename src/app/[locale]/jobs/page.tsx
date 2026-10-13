import { Briefcase, ClipboardList, PlusCircle, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { JobIcon } from "@/components/icons";
import { JobCard, findJobCategory, jobCategoryLabel } from "@/components/jobs/job-card";
import { Container } from "@/components/layout/container";
import { SearchBox } from "@/components/prices/search-box";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NativeSelect } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { getJobCategories, searchJobListings } from "@/lib/data/jobs";
import { alternates } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { EMPLOYMENT_TYPES, type EmploymentType } from "@/lib/validation";

type Props = PageProps<"/[locale]/jobs">;

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale });
  if (!isFeatureEnabled("jobs")) {
    return { title: t("sections.jobs.title"), description: t("sections.jobs.description"), robots: { index: false, follow: true } };
  }
  const filtered = ["q", "page", "type", "salary", "noexp"].some((k) => str(sp[k]));
  return {
    title: t("meta.jobsTitle"),
    description: t("meta.jobsDescription"),
    alternates: alternates(locale, "/jobs"),
    openGraph: { title: t("meta.jobsTitle"), description: t("meta.jobsDescription") },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function JobsPage({ params, searchParams }: Props) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  if (!isFeatureEnabled("jobs")) return <ComingSoon section={sectionByKey("jobs")} />;

  const t = await getTranslations();
  const sp = await searchParams;
  const q = str(sp.q).trim().slice(0, 100);
  const category = /^[a-z0-9-]{2,64}$/.test(str(sp.category)) ? str(sp.category) : "";
  const employment = (EMPLOYMENT_TYPES as readonly string[]).includes(str(sp.type)) ? (str(sp.type) as EmploymentType) : undefined;
  const withSalary = str(sp.salary) === "1";
  const noExperience = str(sp.noexp) === "1";
  const page = Math.max(1, Math.min(500, Number.parseInt(str(sp.page) || "1", 10) || 1));
  const filtered = !!(q || category || employment || withSalary || noExperience);

  const data = await load(() =>
    Promise.all([getJobCategories(), searchJobListings({ q, category, employment, withSalary, noExperience, page })]),
  );

  const qs = (patch: Record<string, string | undefined>) => {
    const merged = {
      q: q || undefined,
      category: category || undefined,
      type: employment,
      salary: withSalary ? "1" : undefined,
      noexp: noExperience ? "1" : undefined,
      page: page > 1 ? String(page) : undefined,
      ...patch,
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === "1")) p.set(k, v);
    const s = p.toString();
    return s ? `/jobs?${s}` : "/jobs";
  };
  const labels = {
    sponsored: t("jobs.sponsored"),
    salaryUnknown: t("jobs.salaryUnknown"),
    noExperience: t("jobs.noExperience"),
    employment: Object.fromEntries(EMPLOYMENT_TYPES.map((x) => [x, t(`jobs.employmentTypes.${x}`)])),
  };

  return (
    <Container className="space-y-6 pt-6 sm:pt-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 dark:text-teal-400">
            <Briefcase className="size-4" aria-hidden /> Sat+
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-4xl">{t("jobs.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{t("jobs.subtitle")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/jobs/my" className={buttonVariants({ variant: "ghost" })}>
            <ClipboardList aria-hidden /> {t("jobs.my")}
          </Link>
          <Link href="/jobs/new" className={buttonVariants({ variant: "outline" })}>
            <PlusCircle aria-hidden /> {t("jobs.add")}
          </Link>
        </div>
      </header>

      <SearchBox
        defaultValue={q}
        placeholder={t("jobs.searchPlaceholder")}
        action="/jobs"
        size="md"
        scanner={false}
        extraParams={{ category: category || undefined, type: employment, salary: withSalary ? "1" : undefined, noexp: noExperience ? "1" : undefined }}
      />

      {!data.ok ? (
        <DataUnavailable error={data.error} />
      ) : (
        <>
          <nav aria-label={t("jobs.categories")} className="-mx-4 overflow-x-auto px-4 pb-1">
            <ul className="flex w-max gap-2">
              {[{ slug: "", name: t("jobs.allCategories"), icon: "" }, ...data.data[0].map((c) => ({ slug: c.slug, name: jobCategoryLabel(c, locale)!, icon: c.icon }))].map((c) => {
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
                      {c.icon && <JobIcon name={c.icon} className="size-4" aria-hidden />}
                      {c.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <form action={locale === "kk" ? "/kk/jobs" : "/jobs"} aria-label={t("jobs.filters")} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-card p-3">
            {q && <input type="hidden" name="q" value={q} />}
            {category && <input type="hidden" name="category" value={category} />}
            <NativeSelect name="type" defaultValue={employment ?? ""} aria-label={t("jobs.employment")} className="h-10 w-auto min-w-48">
              <option value="">{t("jobs.employmentAny")}</option>
              {EMPLOYMENT_TYPES.map((x) => (
                <option key={x} value={x}>
                  {t(`jobs.employmentTypes.${x}`)}
                </option>
              ))}
            </NativeSelect>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="salary" value="1" defaultChecked={withSalary} className="size-4 accent-[var(--primary)]" />
              {t("jobs.withSalary")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="noexp" value="1" defaultChecked={noExperience} className="size-4 accent-[var(--primary)]" />
              {t("jobs.noExperience")}
            </label>
            <div className="ml-auto flex gap-2">
              {(employment || withSalary || noExperience) && (
                <Link href={qs({ type: undefined, salary: undefined, noexp: undefined, page: undefined })} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  {t("jobs.reset")}
                </Link>
              )}
              <Button type="submit" size="sm" variant="secondary">
                {t("jobs.apply")}
              </Button>
            </div>
          </form>

          {filtered && <p className="text-sm text-muted-foreground">{t("jobs.results", { count: data.data[1].total })}</p>}

          {data.data[1].items.length === 0 ? (
            filtered ? (
              <EmptyState icon={SearchX} title={t("jobs.emptySearch")} description={t("jobs.emptySearchHint")} />
            ) : (
              <EmptyState
                icon={Briefcase}
                title={t("jobs.empty")}
                description={t("jobs.emptyHint")}
                action={
                  <Link href="/jobs/new" className={buttonVariants({ variant: "soft" })}>
                    <PlusCircle aria-hidden /> {t("jobs.add")}
                  </Link>
                }
              />
            )
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.data[1].items.map((item) => (
                <li key={item.id} className="flex">
                  <JobCard item={item} category={findJobCategory(data.data[0], item.categorySlug)} locale={locale} labels={labels} />
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
