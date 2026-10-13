import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ru", "kk"],
  defaultLocale: "ru",
  // Russian lives at "/", Kazakh at "/kk/...". So QaiArzan stays at /prices.
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

export function asLocale(value: string): Locale {
  return (routing.locales as readonly string[]).includes(value) ? (value as Locale) : routing.defaultLocale;
}
