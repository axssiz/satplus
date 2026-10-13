import type { FeatureKey } from "./features";

/**
 * Registry of Sat+ sections. Drives the home page grid, the "Ещё" menu,
 * search suggestions and the per-section "В разработке" pages.
 * Texts live in messages/*.json under `sections.<key>`.
 */
export type SectionIcon =
  | "tag"
  | "newspaper"
  | "badge-percent"
  | "building-2"
  | "wrench"
  | "briefcase"
  | "megaphone"
  | "calendar-days"
  | "bus"
  | "triangle-alert"
  | "star";

export type Section = {
  key: FeatureKey;
  /** Route segment, e.g. "news" -> /news */
  slug: string;
  icon: SectionIcon;
  /** Tailwind classes for the section accent (icon tile). */
  accent: string;
  /**
   * True once the section has its own route folder (e.g. app/[locale]/news). Its pages then
   * gate themselves with the feature flag; the generic placeholder route skips it.
   */
  hasModule?: boolean;
};

export const qaiArzanSection: Section = {
  key: "prices",
  slug: "prices",
  icon: "tag",
  accent: "bg-primary/12 text-primary",
};

export const futureSections: readonly Section[] = [
  { key: "news", slug: "news", icon: "newspaper", accent: "bg-sky-500/12 text-sky-600 dark:text-sky-400", hasModule: true },
  { key: "promotions", slug: "promotions", icon: "badge-percent", accent: "bg-rose-500/12 text-rose-600 dark:text-rose-400", hasModule: true },
  { key: "businesses", slug: "businesses", icon: "building-2", accent: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400", hasModule: true },
  { key: "services", slug: "services", icon: "wrench", accent: "bg-orange-500/12 text-orange-600 dark:text-orange-400", hasModule: true },
  { key: "jobs", slug: "jobs", icon: "briefcase", accent: "bg-teal-500/12 text-teal-600 dark:text-teal-400", hasModule: true },
  { key: "classifieds", slug: "classifieds", icon: "megaphone", accent: "bg-amber-500/14 text-amber-700 dark:text-amber-400" },
  { key: "events", slug: "events", icon: "calendar-days", accent: "bg-fuchsia-500/12 text-fuchsia-600 dark:text-fuchsia-400" },
  { key: "transport", slug: "transport", icon: "bus", accent: "bg-cyan-500/12 text-cyan-700 dark:text-cyan-400" },
  { key: "cityReports", slug: "city-reports", icon: "triangle-alert", accent: "bg-red-500/12 text-red-600 dark:text-red-400" },
  { key: "reviews", slug: "reviews", icon: "star", accent: "bg-yellow-500/14 text-yellow-700 dark:text-yellow-400" },
] as const;

export function findSectionBySlug(slug: string): Section | undefined {
  return futureSections.find((s) => s.slug === slug);
}

export function sectionByKey(key: FeatureKey): Section {
  const s = key === "prices" ? qaiArzanSection : futureSections.find((x) => x.key === key);
  if (!s) throw new Error(`Unknown section ${key}`);
  return s;
}
