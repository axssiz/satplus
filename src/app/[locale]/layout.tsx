import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { AppProviders } from "@/components/providers/app-providers";
import { asLocale, routing } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import { onest, unbounded } from "@/lib/fonts";
import { alternates } from "@/lib/seo";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: `${t("siteName")} — ${t("tagline")}`, template: `%s · ${t("siteName")}` },
    description: t("description"),
    applicationName: "Sat+",
    alternates: alternates(locale, "/"),
    openGraph: {
      type: "website",
      siteName: "Sat+",
      locale: locale === "kk" ? "kk_KZ" : "ru_RU",
      title: `${t("siteName")} — ${t("tagline")}`,
      description: t("description"),
    },
    appleWebApp: { capable: true, title: "Sat+", statusBarStyle: "default" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1714" },
  ],
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <html lang={locale} className={`${onest.variable} ${unbounded.variable}`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#main"
          className="sr-only z-50 rounded-xl bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <AppProviders>
            <Header />
            <main id="main" className="flex-1">
              {children}
            </main>
            <Footer />
            <BottomNav />
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
