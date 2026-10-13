import { ExternalLink, PenLine, PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { Container } from "@/components/layout/container";
import { MyListingActions } from "@/components/services/my-listing-actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { getMyServiceListings, type MyServiceListing } from "@/lib/data/services";
import { formatDate } from "@/lib/format";
import { cityToday, daysBetween } from "@/lib/promotions/dates";
import { cn } from "@/lib/utils";
import { ServiceSignInGate } from "../sign-in-gate";

// Depends on the signed-in user; never prerender.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/services/my">): Promise<Metadata> {
  const t = await getTranslations({ locale: asLocale((await params).locale), namespace: "myServices" });
  return { title: t("title"), robots: { index: false } };
}

const TONE = { pending: "info", published: "primary", rejected: "danger", archived: "neutral", expired: "warning" } as const;

/** What the owner can do with a listing in its current state. */
function actionsFor(l: MyServiceListing, today: string): ("archive" | "restore" | "renew" | "delete")[] {
  if (l.status === "archived") return ["restore", "delete"];
  if (l.status === "published" && l.expiresOn && daysBetween(today, l.expiresOn) <= 30) return ["renew", "archive", "delete"];
  if (l.status === "rejected") return ["delete"];
  return ["archive", "delete"];
}

export default async function MyServiceListingsPage({ params }: PageProps<"/[locale]/services/my">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  if (!isFeatureEnabled("services")) return <ComingSoon section={sectionByKey("services")} />;
  const t = await getTranslations("myServices");
  const user = await getCurrentUser().catch(() => null);
  const today = cityToday();
  const day = (d: string) => formatDate(`${d}T12:00:00+05:00`, locale);

  return (
    <Container className="max-w-3xl space-y-6 pt-6 sm:pt-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {user && (
          <Link href="/services/new" className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>
            <PlusCircle aria-hidden /> {t("add")}
          </Link>
        )}
      </header>
      {!user ? (
        <ServiceSignInGate next={locale === "kk" ? "/kk/services/my" : "/services/my"} />
      ) : (
        await (async () => {
          const data = await load(() => getMyServiceListings(user.id));
          if (!data.ok) return <DataUnavailable error={data.error} />;
          if (data.data.length === 0) {
            return (
              <EmptyState
                icon={PlusCircle}
                title={t("empty")}
                action={
                  <Link href="/services/new" className={buttonVariants({ variant: "soft" })}>
                    <PlusCircle aria-hidden /> {t("add")}
                  </Link>
                }
              />
            );
          }
          return (
            <ul className="space-y-3">
              {data.data.map((l) => {
                const expired = l.status === "published" && !!l.expiresOn && l.expiresOn < today;
                const state = expired ? "expired" : l.status;
                return (
                  <li key={l.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge tone={TONE[state]}>{t(`status.${state}`)}</Badge>
                      {l.status === "published" && l.expiresOn && (
                        <span>{expired ? t("expiredOn", { date: day(l.expiresOn) }) : t("activeUntil", { date: day(l.expiresOn) })}</span>
                      )}
                    </div>
                    <h2 className="font-semibold">{l.title}</h2>
                    {l.status === "rejected" && l.rejectReason && (
                      <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{t("rejectReason", { reason: l.rejectReason })}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {l.status === "published" && !expired && (
                        <Link href={`/services/${l.slug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          <ExternalLink aria-hidden /> {t("view")}
                        </Link>
                      )}
                      <Link href={`/services/my/${l.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        <PenLine aria-hidden /> {t("edit")}
                      </Link>
                      <MyListingActions id={l.id} actions={actionsFor(l, today)} />
                    </div>
                  </li>
                );
              })}
            </ul>
          );
        })()
      )}
    </Container>
  );
}
