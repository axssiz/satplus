import type { BaseUnit, Pack, PackUnit } from "@/lib/types";

export type AppLocale = "ru" | "kk";

const intlLocale = (l: AppLocale) => (l === "kk" ? "kk-KZ" : "ru-RU");

/** "1 250 ₸" — whole tenge unless there are tiyns. */
export function formatTenge(value: number, locale: AppLocale): string {
  const fraction = Math.round(value * 100) % 100 !== 0;
  const n = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: fraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
  return `${n} ₸`;
}

export function formatNumber(value: number, locale: AppLocale, digits = 0): string {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: digits }).format(value);
}

const UNIT_LABELS: Record<AppLocale, Record<PackUnit, string>> = {
  ru: { g: "г", kg: "кг", ml: "мл", l: "л", pcs: "шт" },
  kk: { g: "г", kg: "кг", ml: "мл", l: "л", pcs: "дана" },
};

export function unitLabel(unit: PackUnit | BaseUnit, locale: AppLocale): string {
  return UNIT_LABELS[locale][unit];
}

export function formatPack(pack: Pack, locale: AppLocale): string {
  return `${formatNumber(pack.quantity, locale, 3)} ${unitLabel(pack.unit, locale)}`;
}

export function formatDate(iso: string, locale: AppLocale, withTime = false): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Almaty",
  }).format(new Date(iso));
}

export function formatRelative(iso: string, locale: AppLocale, now: Date = new Date()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(0, "minute");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  return formatDate(iso, locale);
}

export function localized<T extends { nameRu: string; nameKk: string | null }>(item: T, locale: AppLocale): string {
  return locale === "kk" && item.nameKk ? item.nameKk : item.nameRu;
}
