import { MapPin, Wallet } from "lucide-react";
import { ServiceIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { ServiceCategory, ServiceListItem } from "@/lib/data/services";
import { storagePublicUrl } from "@/lib/env";
import type { AppLocale } from "@/lib/format";

export type ServiceCardLabels = { sponsored: string; priceUnknown: string };

export function findServiceCategory(categories: ServiceCategory[], slug: string | null): ServiceCategory | undefined {
  return slug ? categories.find((c) => c.slug === slug) : undefined;
}

export function serviceCategoryLabel(c: ServiceCategory | undefined, locale: AppLocale): string | null {
  return c ? (locale === "kk" ? c.nameKk : c.nameRu) : null;
}

/** Catalogue card. Price is the provider's own wording; nothing is computed or compared. */
export function ServiceCard({
  item,
  category,
  locale,
  labels,
}: {
  item: ServiceListItem;
  category: ServiceCategory | undefined;
  locale: AppLocale;
  labels: ServiceCardLabels;
}) {
  const cover = storagePublicUrl("service-images", item.coverPath);
  return (
    <article className="group relative flex h-full w-full gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift sm:p-4">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage image with fixed box
          <img src={cover} alt={item.coverAlt ?? ""} loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <ServiceIcon name={category?.icon} className="size-7" strokeWidth={1.75} aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {item.isSponsored && <Badge tone="warning">{labels.sponsored}</Badge>}
          {category && <span className="font-medium text-orange-700 dark:text-orange-400">{serviceCategoryLabel(category, locale)}</span>}
        </div>
        <h3 className="font-semibold leading-snug tracking-tight">
          <Link href={`/services/${item.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {item.title}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground">{item.providerName}</p>
        <p className="flex items-start gap-1.5 text-sm">
          <Wallet className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className={item.priceNote ? "font-medium" : "text-muted-foreground"}>{item.priceNote ?? labels.priceUnknown}</span>
        </p>
        {item.area && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-1">{item.area}</span>
          </p>
        )}
      </div>
    </article>
  );
}
