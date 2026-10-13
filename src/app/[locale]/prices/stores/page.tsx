import { ChevronRight, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { Container } from "@/components/layout/container";
import { StoresMapLoader } from "@/components/prices/stores-map-loader";
import { DemoBadge } from "@/components/prices/status-badge";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { getBranches } from "@/lib/data/catalog";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { alternates, localePath } from "@/lib/seo";

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps<"/[locale]/prices/stores">): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "stores" });
  return { title: t("title"), description: t("subtitle"), alternates: alternates(locale, "/prices/stores") };
}

async function freshCounts(staleDays = 14): Promise<Map<string, number>> {
  const db = createSupabasePublicClient();
  const since = new Date(Date.now() - staleDays * 86_400_000).toISOString();
  const { data } = await db.from("verified_prices").select("branch_id").eq("status", "verified").gte("observed_at", since).limit(10000);
  const m = new Map<string, number>();
  for (const r of data ?? []) m.set(String(r.branch_id), (m.get(String(r.branch_id)) ?? 0) + 1);
  return m;
}

export default async function StoresPage({ params }: PageProps<"/[locale]/prices/stores">) {
  setRequestLocale(asLocale((await params).locale));
  const t = await getTranslations("stores");
  const locale = await getLocale();
  const data = await load(() => Promise.all([getBranches(), freshCounts()]));

  return (
    <Container className="space-y-6 pt-6 sm:pt-10">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      {!data.ok ? (
        <DataUnavailable error={data.error} />
      ) : (
        <>
          <section aria-label={t("map")} className="overflow-hidden rounded-2xl border border-border">
            {(() => {
              const points = data.data[0]
                .filter((b) => b.latitude !== null && b.longitude !== null)
                .map((b) => ({ id: b.id, lat: b.latitude!, lng: b.longitude!, title: b.storeName, href: localePath(locale, `/prices/stores/${b.slug}`) }));
              return points.length > 0 ? (
                <StoresMapLoader points={points} />
              ) : (
                <p className="flex items-center gap-2 bg-surface p-4 text-sm text-muted-foreground">
                  <MapPin className="size-4 shrink-0" aria-hidden /> {t("mapEmpty")}
                </p>
              );
            })()}
          </section>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.data[0].map((b) => (
              <li key={b.id}>
                <Link href={`/prices/stores/${b.slug}`} className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:shadow-lift">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{b.storeName}</p>
                    {b.storeIsDemo ? (
                      <DemoBadge />
                    ) : (
                      <Badge tone={b.verificationStatus === "verified" ? "primary" : "warning"}>{t(`verification.${b.verificationStatus}`)}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{b.address ?? t("addressUnknown")}</p>
                  <p className="mt-auto flex items-center justify-between pt-2 text-sm">
                    <span className="font-medium">{t("pricesCount", { count: data.data[1].get(b.id) ?? 0 })}</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Container>
  );
}
