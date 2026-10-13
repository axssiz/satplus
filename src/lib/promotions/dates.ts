/** Date helpers for promotions. Dates are plain `YYYY-MM-DD` strings in Almaty (UTC+5) wall time. */

export type PromotionState = "active" | "upcoming" | "ended";

const DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in Сатпаев (UTC+5, no daylight saving). */
export function cityToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 5 * 3_600_000).toISOString().slice(0, 10);
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Same rule as SQL `search_promotions`: valid from `startsOn` (inclusive) through `endsOn` (inclusive). */
export function promotionState(startsOn: string | null, endsOn: string, today: string): PromotionState {
  if (endsOn < today) return "ended";
  if (startsOn && startsOn > today) return "upcoming";
  return "active";
}

/** Whole days from `today` to `date` (0 = today, negative = in the past). */
export function daysBetween(today: string, date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}
