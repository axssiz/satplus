import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComingSoon } from "@/components/coming-soon";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { JobListingForm } from "@/components/jobs/job-listing-form";
import { Container } from "@/components/layout/container";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { asLocale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { getJobCategories } from "@/lib/data/jobs";
import { JobSignInGate } from "../sign-in-gate";

// Depends on the signed-in user; never prerender.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/jobs/new">): Promise<Metadata> {
  const t = await getTranslations({ locale: asLocale((await params).locale), namespace: "jobForm" });
  return { title: t("titleNew"), robots: { index: false } };
}

export default async function NewJobListingPage({ params }: PageProps<"/[locale]/jobs/new">) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  if (!isFeatureEnabled("jobs")) return <ComingSoon section={sectionByKey("jobs")} />;
  const t = await getTranslations("jobForm");
  const user = await getCurrentUser().catch(() => null);

  return (
    <Container className="max-w-2xl space-y-6 pt-6 sm:pt-10">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t("titleNew")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      {!user ? <JobSignInGate next={locale === "kk" ? "/kk/jobs/new" : "/jobs/new"} /> : <NewJobForm locale={locale} />}
    </Container>
  );
}

async function NewJobForm({ locale }: { locale: string }) {
  const data = await load(() => getJobCategories());
  if (!data.ok) return <DataUnavailable error={data.error} />;
  return (
    <JobListingForm
      categories={data.data.map((c) => ({ id: c.id, name: locale === "kk" ? c.nameKk : c.nameRu }))}
      values={{
        id: null,
        categoryId: "",
        title: "",
        employerName: "",
        employmentType: "full",
        experience: "any",
        schedule: "",
        salaryFrom: "",
        salaryTo: "",
        salaryNote: "",
        description: "",
        address: "",
        contactName: "",
        phone: "",
        hasWhatsapp: false,
        email: "",
        linkUrl: "",
      }}
    />
  );
}
