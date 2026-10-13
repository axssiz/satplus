"use client";

import { Heart, Home, LayoutGrid, Search, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = [
    { href: "/", label: t("home"), Icon: Home, active: pathname === "/" },
    { href: "/prices", label: t("prices"), Icon: Tag, active: pathname.startsWith("/prices") },
    { href: "/search", label: t("search"), Icon: Search, active: pathname.startsWith("/search") },
    { href: "/favorites", label: t("favorites"), Icon: Heart, active: pathname.startsWith("/favorites") },
    { href: "/more", label: t("more"), Icon: LayoutGrid, active: pathname.startsWith("/more") },
  ];
  return (
    <nav
      aria-label={t("mainNavigation")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {items.map(({ href, label, Icon, active }) => (
          <li key={href} className="flex">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition",
                active ? "text-primary-strong dark:text-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-12 place-items-center rounded-full transition",
                  active ? "bg-primary-soft" : "group-active:bg-surface-2",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} aria-hidden />
              </span>
              <span className="max-w-full truncate px-0.5">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
