"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LABELS: Record<Locale, string> = { ru: "RU", kk: "KZ" };
const NAMES: Record<Locale, string> = { ru: "Русский", kk: "Қазақша" };

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <div role="group" aria-label="Язык / Тіл" className={cn("flex h-9 items-center rounded-xl bg-surface-2 p-0.5", className)}>
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-label={NAMES[l]}
          aria-pressed={l === locale}
          disabled={pending}
          onClick={() => {
            if (l === locale) return;
            const qs = search.toString();
            startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { locale: l, scroll: false }));
          }}
          className={cn(
            "h-8 min-w-9 rounded-[10px] px-2 text-xs font-bold tracking-wide transition",
            l === locale ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
