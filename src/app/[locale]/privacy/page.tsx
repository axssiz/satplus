import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";
import { privacy } from "@/content/legal";
import { asLocale } from "@/i18n/routing";
import { alternates } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  return { title: privacy[locale].title, alternates: alternates(locale, "/privacy") };
}

export default async function Page({ params }: PageProps<"/[locale]/privacy">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  return <LegalPage doc={privacy[locale]} />;
}
