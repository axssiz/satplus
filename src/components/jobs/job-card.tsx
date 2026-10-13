import { Clock, MapPin, Wallet } from "lucide-react";
import { JobIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { JobCategory, JobListItem } from "@/lib/data/jobs";
import type { AppLocale } from "@/lib/format";
import { formatSalary } from "@/lib/jobs/salary";

export type JobCardLabels = { sponsored: string; salaryUnknown: string; employment: Record<string, string>; noExperience: string };

export function findJobCategory(categories: JobCategory[], slug: string | null): JobCategory | undefined {
  return slug ? categories.find((c) => c.slug === slug) : undefined;
}

export function jobCategoryLabel(c: JobCategory | undefined, locale: AppLocale): string | null {
  return c ? (locale === "kk" ? c.nameKk : c.nameRu) : null;
}

/** List card. Salary only as the employer stated it; nothing is estimated. */
export function JobCard({ item, category, locale, labels }: { item: JobListItem; category: JobCategory | undefined; locale: AppLocale; labels: JobCardLabels }) {
  const salary = formatSalary(item.salaryFrom, item.salaryTo, locale);
  return (
    <article className="group relative flex h-full w-full gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift sm:p-4">
      <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-400">
        <JobIcon name={category?.icon} className="size-6" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {item.isSponsored && <Badge tone="warning">{labels.sponsored}</Badge>}
          {category && <span className="font-medium text-teal-700 dark:text-teal-400">{jobCategoryLabel(category, locale)}</span>}
        </div>
        <h3 className="font-semibold leading-snug tracking-tight">
          <Link href={`/jobs/${item.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {item.title}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground">{item.employerName}</p>
        <p className="flex items-start gap-1.5 text-sm">
          <Wallet className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className={salary ? "font-semibold" : "text-muted-foreground"}>{salary ?? labels.salaryUnknown}</span>
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5 shrink-0" aria-hidden />
            {labels.employment[item.employmentType]}
            {item.schedule ? `, ${item.schedule}` : ""}
          </span>
          {item.experience === "none" && <Badge tone="primary">{labels.noExperience}</Badge>}
        </p>
        {item.address && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-1">{item.address}</span>
          </p>
        )}
      </div>
    </article>
  );
}
