"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BadgePercent,
  BarChart3,
  Briefcase,
  Building2,
  ClipboardCheck,
  FileClock,
  FolderTree,
  HandCoins,
  Menu,
  MessageSquareWarning,
  MessageSquareMore,
  Newspaper,
  Package,
  Settings,
  Store,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { SatLogo } from "@/components/brand";
import { ThemeToggleButton } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Обзор", icon: BarChart3, admin: false },
  { href: "/admin/moderation", label: "Модерация", icon: ClipboardCheck, admin: false },
  { href: "/admin/prices", label: "Цены", icon: HandCoins, admin: false },
  { href: "/admin/requests", label: "Запросы цен", icon: MessageSquareMore, admin: false },
  { href: "/admin/news", label: "Новости", icon: Newspaper, admin: false },
  { href: "/admin/promotions", label: "Акции", icon: BadgePercent, admin: false },
  { href: "/admin/businesses", label: "Организации", icon: Building2, admin: false },
  { href: "/admin/services", label: "Услуги", icon: Wrench, admin: false },
  { href: "/admin/jobs", label: "Вакансии", icon: Briefcase, admin: false },
  { href: "/admin/complaints", label: "Жалобы", icon: MessageSquareWarning, admin: false },
  { href: "/admin/products", label: "Товары", icon: Package, admin: true },
  { href: "/admin/categories", label: "Категории", icon: FolderTree, admin: true },
  { href: "/admin/stores", label: "Магазины и филиалы", icon: Store, admin: true },
  { href: "/admin/users", label: "Пользователи и роли", icon: Users, admin: true },
  { href: "/admin/audit", label: "Журнал действий", icon: FileClock, admin: true },
  { href: "/admin/settings", label: "Настройки", icon: Settings, admin: true },
];

export function AdminNav({ email, isAdmin }: { email: string | null; isAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visible = items.filter((i) => isAdmin || !i.admin);

  return (
    <aside className="sticky top-0 z-30 border-b border-border bg-card lg:h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-2 px-4 py-3 lg:py-5">
        <Link href="/admin" className="flex items-center gap-2 font-semibold">
          <SatLogo className="h-7 w-auto" />
          <span className="text-sm text-muted-foreground">Админ</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggleButton />
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-xl hover:bg-surface-2 lg:hidden"
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      <nav className={cn("flex-col gap-0.5 px-2 pb-3 lg:flex", open ? "flex" : "hidden")} aria-label="Разделы админ-панели">
        {visible.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-primary-soft text-primary-strong dark:text-primary" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon className="size-4.5 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
        <div className="mt-3 border-t border-border px-3 pt-3 text-xs text-muted-foreground">
          <p className="truncate">{email}</p>
          <p>{isAdmin ? "Администратор" : "Модератор"}</p>
          <Link href="/" className="mt-2 inline-block text-primary-strong hover:underline dark:text-primary">
            ← На сайт
          </Link>
        </div>
      </nav>
    </aside>
  );
}
