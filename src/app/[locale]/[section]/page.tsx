import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { findSectionBySlug, futureSections } from "@/config/sections";
import { asLocale, routing } from "@/i18n/routing";
import { alternates } from "@/lib/seo";

/**
 * Placeholder route for future Sat+ sections that have no module yet (/news, /jobs, …). While a section's feature flag is off,
 * it renders the "В разработке" page (never a 404). When a section is implemented, add a
 * dedicated route folder (e.g. app/[locale]/news) — static segments take precedence.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => futureSections.filter((s) => !s.hasModule).map((s) => ({ locale, section: s.slug })));
}

type Props = PageProps<"/[locale]/[section]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: l, section } = await params;
  const locale = asLocale(l);
  const s = findSectionBySlug(section);
  if (!s) return {};
  const t = await getTranslations({ locale });
  return {
    title: t(`sections.${s.key}.title`),
    description: t(`sections.${s.key}.description`),
    alternates: alternates(locale, `/${s.slug}`),
    robots: { index: false, follow: true },
  };
}

export default async function SectionPage({ params }: Props) {
  const { locale, section } = await params;
  setRequestLocale(asLocale(locale));
  const s = findSectionBySlug(section);
  if (!s) notFound();
  return <ComingSoon section={s} />;
}
