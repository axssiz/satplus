import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";
import { terms } from "@/content/legal";
import { asLocale } from "@/i18n/routing";
import { alternates } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  return { title: terms[locale].title, alternates: alternates(locale, "/terms") };
}

export default async function Page({ params }: PageProps<"/[locale]/terms">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  return <LegalPage doc={terms[locale]} />;
}
