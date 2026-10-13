import { BadgePercent, Megaphone, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { Container } from "@/components/layout/container";
import { getPromotionLabels } from "@/components/promotions/labels";
import { PromotionCard } from "@/components/promotions/promotion-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, NativeSelect } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { getCategories } from "@/lib/data/catalog";
import { getPromotionStores, searchPromotions } from "@/lib/data/promotions";
import { localized } from "@/lib/format";
import { cityToday, type PromotionState } from "@/lib/promotions/dates";
import { alternates, localePath } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Props = PageProps<"/[locale]/promotions">;

const STATES: PromotionState[] = ["active", "upcoming", "ended"];
const SLUG = /^[a-z0-9-]{2,96}$/;

function str(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale });
  if (!isFeatureEnabled("promotions")) {
    return { title: t("sections.promotions.title"), description: t("sections.promotions.description"), robots: { index: false, follow: true } };
  }
  const filtered = ["q", "page", "state", "store", "category"].some((k) => str(sp[k]));
  return {
    title: t("meta.promotionsTitle"),
    description: t("meta.promotionsDescription"),
    alternates: alternates(locale, "/promotions"),
    openGraph: { title: t("meta.promotionsTitle"), description: t("meta.promotionsDescription") },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function PromotionsPage({ params, searchParams }: Props) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  if (!isFeatureEnabled("promotions")) return <ComingSoon section={sectionByKey("promotions")} />;

  const t = await getTranslations();
  const sp = await searchParams;
  const q = str(sp.q).trim().slice(0, 100);
  const state = (STATES as string[]).includes(str(sp.state)) ? (str(sp.state) as PromotionState) : "active";
  const store = SLUG.test(str(sp.store)) ? str(sp.store) : "";
  const category = SLUG.test(str(sp.category)) ? str(sp.category) : "";
  const page = Math.max(1, Math.min(500, Number.parseInt(str(sp.page) || "1", 10) || 1));
  const today = cityToday();

  const [data, labels] = await Promise.all([
    load(() => Promise.all([getPromotionStores(), getCategories(), searchPromotions({ state, q, store, category, page })])),
    getPromotionLabels(),
  ]);

  const qs = (patch: Record<string, string | undefined>) => {
    const merged = {
      state: state === "active" ? undefined : state,
      q: q || undefined,
      store: store || undefined,
      category: category || undefined,
      page: page > 1 ? String(page) : undefined,
      ...patch,
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === "1") && !(k === "state" && v === "active")) p.set(k, v);
    const s = p.toString();
    return s ? `/promotions?${s}` : "/promotions";
  };

  const emptyTitle = state === "upcoming" ? t("promotions.emptyUpcoming") : state === "ended" ? t("promotions.emptyEnded") : t("promotions.empty");

  return (
    <Container className="space-y-6 pt-6 sm:pt-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-700 dark:text-rose-400">
            <BadgePercent className="size-4" aria-hidden /> Sat+
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-4xl">{t("promotions.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{t("promotions.subtitle")}</p>
        </div>
        <Link href="/promotions/report" className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>
          <Megaphone aria-hidden /> {t("promotions.report")}
        </Link>
      </header>

      <nav aria-label={t("promotions.stateLabel")} className="-mx-4 overflow-x-auto px-4 pb-1">
        <ul className="flex w-max gap-2">
          {STATES.map((s) => {
            const active = s === state;
            return (
              <li key={s}>
                <Link
                  href={qs({ state: s, page: undefined })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition",
                    active ? "border-transparent bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`promotions.states.${s}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {!data.ok ? (
        <DataUnavailable error={data.error} />
      ) : (
        <>
          <form action={localePath(locale, "/promotions")} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            {state !== "active" && <input type="hidden" name="state" value={state} />}
            <Input type="search" name="q" defaultValue={q} placeholder={t("promotions.searchPlaceholder")} aria-label={t("promotions.searchPlaceholder")} maxLength={100} />
            <NativeSelect name="store" defaultValue={store} aria-label={t("promotions.store")}>
              <option value="">{t("promotions.allStores")}</option>
              {data.data[0].map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.isDemo ? `${s.name} (DEMO)` : s.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect name="category" defaultValue={category} aria-label={t("promotions.category")}>
              <option value="">{t("promotions.allCategories")}</option>
              {data.data[1].map((c) => (
                <option key={c.id} value={c.slug}>
                  {localized(c, locale)}
                </option>
              ))}
            </NativeSelect>
            <Button type="submit" variant="secondary">
              {t("promotions.apply")}
            </Button>
          </form>

          {(q || store || category) && <p className="text-sm text-muted-foreground">{t("promotions.results", { count: data.data[2].total })}</p>}

          {data.data[2].items.length === 0 ? (
            q || store || category ? (
              <EmptyState icon={SearchX} title={t("promotions.emptySearch")} description={t("promotions.emptySearchHint")} />
            ) : (
              <EmptyState
                icon={BadgePercent}
                title={emptyTitle}
                description={state === "active" ? t("promotions.emptyHint") : undefined}
                action={
                  state === "active" ? (
                    <Link href="/promotions/report" className={buttonVariants({ variant: "soft" })}>
                      <Megaphone aria-hidden /> {t("promotions.report")}
                    </Link>
                  ) : undefined
                }
              />
            )
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.data[2].items.map((item, i) => (
                <li key={item.id} className="flex">
                  <PromotionCard item={item} locale={locale} today={today} labels={labels} priority={i < 2} />
                </li>
              ))}
            </ul>
          )}

          {data.data[2].total > data.data[2].pageSize && (
            <Pagination
              page={page}
              totalPages={Math.ceil(data.data[2].total / data.data[2].pageSize)}
              hrefFor={(p) => qs({ page: String(p) })}
              labels={{ prev: t("prices.prev"), next: t("prices.next") }}
              status={t("prices.pageOf", { page, total: Math.ceil(data.data[2].total / data.data[2].pageSize) })}
            />
          )}

          <p className="text-xs text-muted-foreground">{t("promotions.notPriceNote")}</p>
        </>
      )}
    </Container>
  );
}
