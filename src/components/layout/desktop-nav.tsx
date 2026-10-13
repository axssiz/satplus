"use client";

import { useTranslations } from "next-intl";
import { isFeatureEnabled } from "@/config/features";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function DesktopNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  // Tablets (md) get the core sections; the rest stays in the menu until lg.
  const items: { href: string; label: string; match: (p: string) => boolean; wideOnly?: boolean }[] = [
    { href: "/", label: t("home"), match: (p: string) => p === "/", wideOnly: true },
    { href: "/prices", label: t("prices"), match: (p: string) => p === "/prices" || p.startsWith("/prices/p") || p.startsWith("/prices/category") },
    { href: "/prices/basket", label: t("basket"), match: (p: string) => p.startsWith("/prices/basket"), wideOnly: true },
    { href: "/prices/stores", label: t("stores"), match: (p: string) => p.startsWith("/prices/stores") },
    { href: "/favorites", label: t("favorites"), match: (p: string) => p.startsWith("/favorites"), wideOnly: true },
    ...(isFeatureEnabled("news") ? [{ href: "/news", label: t("news"), match: (p: string) => p.startsWith("/news") }] : []),
    ...(isFeatureEnabled("promotions") ? [{ href: "/promotions", label: t("promotions"), match: (p: string) => p.startsWith("/promotions") }] : []),
  ];
  return (
    <nav aria-label={t("mainNavigation")} className="ml-4 hidden items-center gap-1 md:flex">
      {items.map((i) => {
        const active = i.match(pathname);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-medium transition",
              i.wideOnly && "hidden lg:block",
              active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
