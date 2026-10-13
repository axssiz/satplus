import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { DataUnavailable, load } from "@/components/data-unavailable";
import { JobListingForm } from "@/components/jobs/job-listing-form";
import { Container } from "@/components/layout/container";
import { isFeatureEnabled } from "@/config/features";
import { sectionByKey } from "@/config/sections";
import { asLocale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth";
import { getJobCategories, getMyJobListings } from "@/lib/data/jobs";
import { JobSignInGate } from "../../sign-in-gate";

export async function generateMetadata({ params }: PageProps<"/[locale]/jobs/my/[id]">): Promise<Metadata> {
  const t = await getTranslations({ locale: asLocale((await params).locale), namespace: "jobForm" });
  return { title: t("titleEdit"), robots: { index: false } };
}

export default async function EditJobListingPage({ params }: PageProps<"/[locale]/jobs/my/[id]">) {
  const { locale: l, id } = await params;
  const locale = asLocale(l);
  setRequestLocale(locale);
  if (!isFeatureEnabled("jobs")) return <ComingSoon section={sectionByKey("jobs")} />;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = await getTranslations("jobForm");
  const user = await getCurrentUser().catch(() => null);

  let body: React.ReactNode;
  if (!user) {
    body = <JobSignInGate next={`${locale === "kk" ? "/kk" : ""}/jobs/my/${id}`} />;
  } else {
    const data = await load(() => Promise.all([getMyJobListings(user.id), getJobCategories()]));
    if (!data.ok) {
      body = <DataUnavailable error={data.error} />;
    } else {
      const job = data.data[0].find((x) => x.id === id);
      if (!job) notFound();
      body = (
        <JobListingForm
          categories={data.data[1].map((c) => ({ id: c.id, name: locale === "kk" ? c.nameKk : c.nameRu }))}
          values={{
            id: job.id,
            categoryId: job.categoryId ?? "",
            title: job.title,
            employerName: job.employerName,
            employmentType: job.employmentType,
            experience: job.experience,
            schedule: job.schedule ?? "",
            salaryFrom: job.salaryFrom == null ? "" : String(job.salaryFrom),
            salaryTo: job.salaryTo == null ? "" : String(job.salaryTo),
            salaryNote: job.salaryNote ?? "",
            description: job.description,
            address: job.address ?? "",
            contactName: job.contactName ?? "",
            phone: job.phone,
            hasWhatsapp: job.hasWhatsapp,
            email: job.email ?? "",
            linkUrl: job.linkUrl ?? "",
          }}
        />
      );
    }
  }

  return (
    <Container className="max-w-2xl space-y-6 pt-6 sm:pt-10">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t("titleEdit")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitleEdit")}</p>
      </header>
      {body}
    </Container>
  );
}
