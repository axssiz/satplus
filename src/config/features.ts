/**
 * Central feature flags for Sat+ sections.
 *
 * A disabled section keeps its route, card on the home page and navigation entry,
 * but renders the "В разработке" page instead of a 404. Flip a flag to `true`
 * only when the section's module (pages, API, admin) actually exists.
 *
 * Each flag can be overridden per environment with NEXT_PUBLIC_FEATURE_<KEY>=true|false,
 * e.g. NEXT_PUBLIC_FEATURE_NEWS=true.
 */
export const features = {
  prices: true,
  news: true,
  promotions: true,
  businesses: true,
  services: true,
  jobs: true,
  classifieds: false,
  events: false,
  transport: false,
  cityReports: false,
  reviews: false,
} as const satisfies Record<string, boolean>;

export type FeatureKey = keyof typeof features;

// Explicit references so Next.js inlines them at build time.
const overrides: Partial<Record<FeatureKey, string | undefined>> = {
  prices: process.env.NEXT_PUBLIC_FEATURE_PRICES,
  news: process.env.NEXT_PUBLIC_FEATURE_NEWS,
  promotions: process.env.NEXT_PUBLIC_FEATURE_PROMOTIONS,
  businesses: process.env.NEXT_PUBLIC_FEATURE_BUSINESSES,
  services: process.env.NEXT_PUBLIC_FEATURE_SERVICES,
  jobs: process.env.NEXT_PUBLIC_FEATURE_JOBS,
  classifieds: process.env.NEXT_PUBLIC_FEATURE_CLASSIFIEDS,
  events: process.env.NEXT_PUBLIC_FEATURE_EVENTS,
  transport: process.env.NEXT_PUBLIC_FEATURE_TRANSPORT,
  cityReports: process.env.NEXT_PUBLIC_FEATURE_CITY_REPORTS,
  reviews: process.env.NEXT_PUBLIC_FEATURE_REVIEWS,
};

export function isFeatureEnabled(key: FeatureKey): boolean {
  const override = overrides[key];
  if (override === "true") return true;
  if (override === "false") return false;
  return features[key];
}
