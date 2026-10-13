import NextLink from "next/link";
import { Award, Briefcase, ClipboardList, LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DeleteDataButton, DisplayNameForm, SignInForm, SignOutButton } from "@/components/account/account-forms";
import { Container } from "@/components/layout/container";
import { PriceStatusBadge } from "@/components/prices/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isFeatureEnabled } from "@/config/features";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatTenge, localized, type AppLocale } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PriceStatus } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/[locale]/account">): Promise<Metadata> {
  const t = await getTranslations({ locale: asLocale((await params).locale), namespace: "account" });
  return { title: t("title"), robots: { index: false } };
}

export default async function AccountPage({ params, searchParams }: PageProps<"/[locale]/account">) {
  const locale = asLocale((await params).locale) as AppLocale;
  setRequestLocale(locale);
  const t = await getTranslations("account");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const user = await getCurrentUser().catch(() => null);

  if (!user) {
    return (
      <Container className="max-w-md pt-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t("signInTitle")}</CardTitle>
            <CardDescription>{t("signInSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <SignInForm next={next} />
          </CardContent>
        </Card>
      </Container>
    );
  }

  const db = await createSupabaseServerClient();
  const [{ data: profile }, { data: rep }, { data: subs }] = await Promise.all([
    db.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    db.from("user_reputation").select("points").eq("user_id", user.id).maybeSingle(),
    db
      .from("price_submissions")
      .select("id, price, status, approved_as, created_at, products(name_ru, name_kk), store_branches(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <Container className="max-w-2xl space-y-5 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {user.isModerator && (
            <NextLink href="/admin" className={buttonVariants({ variant: "soft" })}>
              <LayoutDashboard aria-hidden /> {t("adminPanel")}
            </NextLink>
          )}
          <SignOutButton />
        </div>
      </div>
      {isFeatureEnabled("services") && (
        <Link href="/services/my" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm font-medium hover:bg-surface">
          <ClipboardList className="size-5 text-primary" aria-hidden /> {t("myServices")}
        </Link>
      )}
      {isFeatureEnabled("jobs") && (
        <Link href="/jobs/my" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm font-medium hover:bg-surface">
          <Briefcase className="size-5 text-primary" aria-hidden /> {t("myJobs")}
        </Link>
      )}
      <Card>
        <CardHeader><CardTitle>{t("displayName")}</CardTitle></CardHeader>
        <CardContent><DisplayNameForm initial={profile?.display_name ?? ""} /></CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Award className="size-5 text-primary" aria-hidden /> {t("reputation")}</CardTitle>
          <CardDescription>{t("pointsNote")}</CardDescription>
        </CardHeader>
        <CardContent><p className="font-display text-3xl font-semibold">{t("points", { count: rep?.points ?? 0 })}</p></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("mySubmissions")}</CardTitle></CardHeader>
        <CardContent>
          {!subs || subs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noSubmissions")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {subs.map((s) => {
                const p = (Array.isArray(s.products) ? s.products[0] : s.products) as { name_ru: string; name_kk: string | null } | null;
                const b = (Array.isArray(s.store_branches) ? s.store_branches[0] : s.store_branches) as { name: string } | null;
                const status: PriceStatus = s.status === "approved" ? (s.approved_as === "estimated" ? "estimated" : "verified") : s.status === "rejected" ? "rejected" : "pending";
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p ? localized({ nameRu: p.name_ru, nameKk: p.name_kk }, locale) : "—"}</span>
                      <span className="text-xs text-muted-foreground">{b?.name} · {formatDate(s.created_at, locale)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="tabular font-semibold">{formatTenge(Number(s.price), locale)}</span>
                      <PriceStatusBadge status={status} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
      <div className="rounded-2xl border border-danger/30 p-4">
        <p className="text-sm text-muted-foreground">{t("deleteDataHint")}</p>
        <div className="mt-2"><DeleteDataButton /></div>
      </div>
      <Link href="/privacy" className="text-xs text-muted-foreground underline">Privacy</Link>
    </Container>
  );
}
