import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";

/** Path for a locale with the "as-needed" prefix strategy. */
export function localePath(locale: string, path: string): string {
  const clean = path === "/" ? "" : path;
  return locale === routing.defaultLocale ? clean || "/" : `/${locale}${clean}`;
}

export function absoluteUrl(path: string): string {
  return `${publicEnv.siteUrl}${path}`;
}

export function alternates(locale: string, path: string): Metadata["alternates"] {
  return {
    canonical: localePath(locale, path),
    languages: {
      ru: localePath("ru", path),
      kk: localePath("kk", path),
      "x-default": localePath("ru", path),
    },
  };
}
