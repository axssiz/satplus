"use client";

import { FileText, Heart, Menu, PlusCircle, ShieldCheck, ShoppingBasket, Store, Tag, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { QaiArzanLogo } from "@/components/brand";
import { sectionIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { futureSections } from "@/config/sections";
import { isFeatureEnabled } from "@/config/features";
import { Link } from "@/i18n/navigation";
import { ThemeSelector } from "./theme-toggle";

export function MenuSheet() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const qai = [
    { href: "/prices", label: t("nav.prices"), Icon: Tag },
    { href: "/prices/basket", label: t("nav.basket"), Icon: ShoppingBasket },
    { href: "/prices/stores", label: t("nav.stores"), Icon: Store },
    { href: "/prices/add", label: t("nav.addPrice"), Icon: PlusCircle },
    { href: "/favorites", label: t("nav.favorites"), Icon: Heart },
  ];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label={t("nav.menu")}
        className="grid size-9 place-items-center rounded-xl text-foreground hover:bg-surface-2"
      >
        <Menu className="size-5" />
      </DialogTrigger>
      <DialogContent side="right" closeLabel={t("common.close")} className="gap-6 p-5 pt-6">
        <DialogTitle className="sr-only">{t("nav.menu")}</DialogTitle>
        <section className="space-y-2">
          <QaiArzanLogo />
          <ul className="grid grid-cols-2 gap-2 pt-1">
            {qai.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={close}
                  className="flex h-full items-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-sm font-medium hover:bg-surface-2"
                >
                  <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-1">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("more.services")}</h2>
          <ul>
            {futureSections.map((s) => {
              const Icon = sectionIcon(s.icon);
              return (
                <li key={s.key}>
                  <Link href={`/${s.slug}`} onClick={close} className="flex items-center gap-3 rounded-xl px-1 py-2 hover:bg-surface">
                    <span className={`grid size-8 place-items-center rounded-lg ${s.accent}`}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="flex-1 text-sm font-medium">{t(`sections.${s.key}.title`)}</span>
                    {!isFeatureEnabled(s.key) && <Badge>{t("common.soon")}</Badge>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("more.settings")}</h2>
          <ThemeSelector />
          <Link href="/account" onClick={close} className="flex items-center gap-3 rounded-xl px-1 py-2 text-sm font-medium hover:bg-surface">
            <UserRound className="size-4 text-muted-foreground" aria-hidden /> {t("nav.account")}
          </Link>
          <Link href="/privacy" onClick={close} className="flex items-center gap-3 rounded-xl px-1 py-2 text-sm hover:bg-surface">
            <ShieldCheck className="size-4 text-muted-foreground" aria-hidden /> {t("more.privacy")}
          </Link>
          <Link href="/terms" onClick={close} className="flex items-center gap-3 rounded-xl px-1 py-2 text-sm hover:bg-surface">
            <FileText className="size-4 text-muted-foreground" aria-hidden /> {t("more.terms")}
          </Link>
        </section>
      </DialogContent>
    </Dialog>
  );
}
