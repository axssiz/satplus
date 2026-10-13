import { Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { NewsCategory, NewsListItem } from "@/lib/data/news";
import { storagePublicUrl } from "@/lib/env";
import { formatDate, type AppLocale } from "@/lib/format";
import { excerpt } from "@/lib/news/text";
import { cn } from "@/lib/utils";

export type NewsCardLabels = { important: string; sponsored: string };

export function categoryName(categories: NewsCategory[], slug: string | null, locale: AppLocale): string | null {
  const c = slug ? categories.find((x) => x.slug === slug) : undefined;
  return c ? (locale === "kk" ? c.nameKk : c.nameRu) : null;
}

/** Feed card. `featured` renders a larger card with the cover on top. */
export function NewsCard({
  item,
  locale,
  category,
  labels,
  featured = false,
  priority = false,
}: {
  item: NewsListItem;
  locale: AppLocale;
  category: string | null;
  labels: NewsCardLabels;
  featured?: boolean;
  priority?: boolean;
}) {
  const cover = storagePublicUrl("news-images", item.coverPath);
  return (
    <article
      className={cn(
        "group relative flex h-full w-full overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift",
        featured ? "flex-col" : "flex-row sm:flex-col",
      )}
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden bg-sky-500/10",
          featured ? (cover ? "aspect-[16/9] w-full" : "aspect-[3/1] w-full") : "aspect-square w-28 sm:aspect-[16/9] sm:w-full",
        )}
      >
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
          <div className="grid size-full place-items-center text-sky-600/70 dark:text-sky-400/70">
            <Newspaper className={featured ? "size-12" : "size-8"} strokeWidth={1.5} aria-hidden />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {item.isImportant && <Badge tone="danger">{labels.important}</Badge>}
          {item.isSponsored && <Badge tone="warning">{labels.sponsored}</Badge>}
          {category && <span className="font-medium text-sky-700 dark:text-sky-400">{category}</span>}
          <time dateTime={item.publishedAt}>{formatDate(item.publishedAt, locale)}</time>
          {item.lang !== locale && (
            <span className="rounded bg-surface-2 px-1 font-semibold uppercase">{item.lang === "kk" ? "KZ" : "RU"}</span>
          )}
        </div>
        <h3 className={cn("font-semibold leading-snug tracking-tight", featured ? "text-lg sm:text-2xl" : "line-clamp-3 text-[15px]")}>
          <Link href={`/news/${item.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {item.title}
          </Link>
        </h3>
        {(featured || item.summary) && (
          <p className={cn("text-sm text-muted-foreground", featured ? "line-clamp-3" : "line-clamp-2 max-sm:hidden")}>
            {excerpt(item.summary, item.summary ?? "", featured ? 240 : 140)}
          </p>
        )}
        <p className="mt-auto truncate text-xs text-muted-foreground">{item.sourceName}</p>
      </div>
    </article>
  );
}
