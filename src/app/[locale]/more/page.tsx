import { ChevronRight, FileText, PlusCircle, ShieldCheck, ShoppingBasket, Store, Tag, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { QaiArzanLogo } from "@/components/brand";
import { sectionIcon } from "@/components/icons";
import { Container } from "@/components/layout/container";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeSelector } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { isFeatureEnabled } from "@/config/features";
import { futureSections } from "@/config/sections";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/more">): Promise<Metadata> {
  const t = await getTranslations({ locale: asLocale((await params).locale), namespace: "more" });
  return { title: t("title") };
}

export default async function MorePage({ params }: PageProps<"/[locale]/more">) {
  setRequestLocale(asLocale((await params).locale));
  const t = await getTranslations();
  const row = "flex items-center gap-3 px-4 py-3.5 hover:bg-surface";
  return (
    <Container className="max-w-2xl space-y-6 pt-6 sm:pt-10">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{t("more.title")}</h1>
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3"><QaiArzanLogo /></div>
        <ul className="divide-y divide-border">
          {[
            { href: "/prices", label: t("nav.prices"), Icon: Tag },
            { href: "/prices/basket", label: t("nav.basket"), Icon: ShoppingBasket },
            { href: "/prices/stores", label: t("nav.stores"), Icon: Store },
            { href: "/prices/add", label: t("nav.addPrice"), Icon: PlusCircle },
          ].map(({ href, label, Icon }) => (
            <li key={href}>
              <Link href={href} className={row}>
                <Icon className="size-5 text-primary" aria-hidden />
                <span className="flex-1 text-sm font-medium">{label}</span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("more.services")}</h2>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {futureSections.map((s) => {
            const Icon = sectionIcon(s.icon);
            return (
              <li key={s.key}>
                <Link href={`/${s.slug}`} className={row}>
                  <span className={cn("grid size-9 place-items-center rounded-xl", s.accent)}>
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{t(`sections.${s.key}.title`)}</span>
                    <span className="text-xs text-muted-foreground">{t(`sections.${s.key}.short`)}</span>
                  </span>
                  {!isFeatureEnabled(s.key) && <Badge>{t("common.soon")}</Badge>}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("more.settings")}</h2>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="text-sm font-medium">{t("common.language")}</span>
          <Suspense><LanguageSwitcher /></Suspense>
        </div>
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <span className="text-sm font-medium">{t("common.theme")}</span>
          <ThemeSelector />
        </div>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {[
            { href: "/account", label: t("nav.account"), Icon: UserRound },
            { href: "/privacy", label: t("more.privacy"), Icon: ShieldCheck },
            { href: "/terms", label: t("more.terms"), Icon: FileText },
          ].map(({ href, label, Icon }) => (
            <li key={href}>
              <Link href={href} className={row}>
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <span className="flex-1 text-sm font-medium">{label}</span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
