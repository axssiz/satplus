import { BadgeCheck, Clock, MapPin } from "lucide-react";
import { BusinessIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { BusinessCategory, BusinessListItem } from "@/lib/data/businesses";
import { storagePublicUrl } from "@/lib/env";
import type { AppLocale } from "@/lib/format";

export type BusinessCardLabels = { sponsored: string; verified: string; addressUnknown: string };

export function findCategory(categories: BusinessCategory[], slug: string | null): BusinessCategory | undefined {
  return slug ? categories.find((c) => c.slug === slug) : undefined;
}

export function categoryLabel(c: BusinessCategory | undefined, locale: AppLocale): string | null {
  return c ? (locale === "kk" ? c.nameKk : c.nameRu) : null;
}

/** Directory card. Only verified facts are shown; missing ones say so instead of guessing. */
export function BusinessCard({
  item,
  category,
  locale,
  labels,
}: {
  item: BusinessListItem;
  category: BusinessCategory | undefined;
  locale: AppLocale;
  labels: BusinessCardLabels;
}) {
  const cover = storagePublicUrl("business-images", item.coverPath);
  return (
    <article className="group relative flex h-full w-full gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift sm:p-4">
      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage image with fixed box
          <img src={cover} alt={item.coverAlt ?? ""} loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <BusinessIcon name={category?.icon} className="size-6" strokeWidth={1.75} aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {item.isSponsored && <Badge tone="warning">{labels.sponsored}</Badge>}
          {category && <span className="font-medium text-indigo-700 dark:text-indigo-400">{categoryLabel(category, locale)}</span>}
          {item.verified && (
            <span className="inline-flex items-center gap-0.5 text-primary-strong dark:text-primary" title={labels.verified}>
              <BadgeCheck className="size-3.5" aria-hidden />
              <span className="sr-only">{labels.verified}</span>
            </span>
          )}
        </div>
        <h3 className="font-semibold leading-snug tracking-tight">
          <Link href={`/businesses/${item.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {item.name}
          </Link>
        </h3>
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-2">{item.address ?? labels.addressUnknown}</span>
        </p>
        {item.openingHours && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-1">{item.openingHours}</span>
          </p>
        )}
      </div>
    </article>
  );
}
