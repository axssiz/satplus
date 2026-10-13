import { formatNumber, type AppLocale } from "@/lib/format";

/**
 * Salary as the employer stated it: «от 150 000 ₸», «до 200 000 ₸» or «150 000 – 200 000 ₸».
 * Returns null when neither bound is given; the page then says the salary is not stated
 * (it is never estimated).
 */
export function formatSalary(from: number | null | undefined, to: number | null | undefined, locale: AppLocale): string | null {
  const f = from ?? null;
  const t = to ?? null;
  if (f === null && t === null) return null;
  const n = (v: number) => formatNumber(v, locale);
  if (f !== null && t !== null) return f === t ? `${n(f)} ₸` : `${n(f)} – ${n(t)} ₸`;
  if (f !== null) return locale === "kk" ? `${n(f)} ₸ бастап` : `от ${n(f)} ₸`;
  return locale === "kk" ? `${n(t!)} ₸ дейін` : `до ${n(t!)} ₸`;
}
