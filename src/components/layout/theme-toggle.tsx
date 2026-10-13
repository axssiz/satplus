"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};
/** true on the client after hydration, false during SSR — without a setState-in-effect. */
function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function ThemeSelector() {
  const t = useTranslations("common");
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const options = [
    { value: "light", label: t("themeLight"), Icon: Sun },
    { value: "dark", label: t("themeDark"), Icon: Moon },
    { value: "system", label: t("themeSystem"), Icon: Monitor },
  ] as const;
  return (
    <div role="radiogroup" aria-label={t("theme")} className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
      {options.map(({ value, label, Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition",
              active ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ThemeToggleButton({ className }: { className?: string }) {
  const t = useTranslations("common");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? t("themeLight") : t("themeDark")}
      className={cn("grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-surface-2 hover:text-foreground", className)}
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
