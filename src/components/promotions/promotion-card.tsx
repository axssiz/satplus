import { BadgePercent, CalendarClock } from "lucide-react";
import { DemoBadge } from "@/components/prices/status-badge";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { PromotionListItem } from "@/lib/data/promotions";
import { storagePublicUrl } from "@/lib/env";
import type { AppLocale } from "@/lib/format";
import { daysBetween, promotionState } from "@/lib/promotions/dates";
import { cn } from "@/lib/utils";

export type PromotionCardLabels = {
  sponsored: string;
  ended: string;
  lastDay: string;
  daysLeft: (count: number) => string;
  until: (date: string) => string;
  startsIn: (date: string) => string;
};

/** Short, date-only label ("до 20 окт."); full year only when it differs from today's. */
export function shortDate(date: string, locale: AppLocale, today: string): string {
  const d = new Date(`${date}T12:00:00+05:00`);
  return new Intl.DateTimeFormat(locale === "kk" ? "kk-KZ" : "ru-RU", {
    day: "numeric",
    month: "short",
    ...(date.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
    timeZone: "Asia/Almaty",
  }).format(d);
}

export function PromotionDeadline({
  startsOn,
  endsOn,
  today,
  locale,
  labels,
  className,
}: {
  startsOn: string | null;
  endsOn: string;
  today: string;
  locale: AppLocale;
  labels: PromotionCardLabels;
  className?: string;
}) {
  const state = promotionState(startsOn, endsOn, today);
  if (state === "ended") return <span className={cn("text-muted-foreground", className)}>{labels.ended}</span>;
  if (state === "upcoming") {
    return <span className={cn("text-info", className)}>{labels.startsIn(shortDate(startsOn!, locale, today))}</span>;
  }
  const left = daysBetween(today, endsOn);
  return (
    <span className={cn(left <= 2 ? "font-semibold text-danger" : "text-muted-foreground", className)}>
      {left === 0 ? labels.lastDay : left <= 7 ? labels.daysLeft(left) : labels.until(shortDate(endsOn, locale, today))}
    </span>
  );
}

/** List card. Never shows a price: promotions live apart from QaiArzan prices. */
export function PromotionCard({
  item,
  locale,
  today,
  labels,
  showStore = true,
  priority = false,
}: {
  item: PromotionListItem;
  locale: AppLocale;
  today: string;
  labels: PromotionCardLabels;
  showStore?: boolean;
  priority?: boolean;
}) {
  const cover = storagePublicUrl("promotion-images", item.coverPath);
  const ended = promotionState(item.startsOn, item.endsOn, today) === "ended";
  return (
    <article
      className={cn(
        "group relative flex h-full w-full flex-row overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift sm:flex-col",
        ended && "opacity-75",
      )}
    >
      <div className="relative aspect-square w-28 shrink-0 overflow-hidden bg-rose-500/10 sm:aspect-[16/9] sm:w-full">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage image with fixed box
          <img
            src={cover}
            alt={item.coverAlt ?? ""}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="grid size-full place-items-center text-rose-600/70 dark:text-rose-400/70">
            <BadgePercent className="size-9" strokeWidth={1.5} aria-hidden />
          </div>
        )}
        {item.discountLabel && (
          <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-lg bg-rose-600 px-2 py-0.5 text-sm font-bold text-white shadow-soft">
            {item.discountLabel}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {item.isSponsored && <Badge tone="warning">{labels.sponsored}</Badge>}
          {item.storeIsDemo && <DemoBadge />}
          {showStore && <span className="truncate font-semibold text-rose-700 dark:text-rose-400">{item.storeName}</span>}
        </div>
        <h3 className="line-clamp-3 text-[15px] font-semibold leading-snug tracking-tight">
          <Link href={`/promotions/${item.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {item.title}
          </Link>
        </h3>
        <p className="mt-auto flex items-center gap-1.5 text-xs">
          <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <PromotionDeadline startsOn={item.startsOn} endsOn={item.endsOn} today={today} locale={locale} labels={labels} />
        </p>
      </div>
    </article>
  );
}
