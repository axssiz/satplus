import Link from "next/link";
import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/config/features";
import { AdminError, PageHeader } from "../../_components/ui";
import { adminPage, fmtDate } from "../../_components/data";
import { ModerateJob } from "../moderate-job";
import { JOB_STATUS, JobsFlagNotice } from "../shared";
import { StaffJobForm, type StaffJobFormValues } from "./job-form";

export const metadata = { title: "Вакансия" };

const s = (v: unknown) => (v == null ? "" : String(v));

export default async function AdminJobEditPage({ params }: PageProps<"/admin/jobs/[id]">) {
  const { db, user } = await adminPage();
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();

  const cats = await db.from("job_categories").select("id, name_ru, is_active").order("sort_order");
  if (cats.error) return <AdminError message={cats.error.message} />;

  let values: StaffJobFormValues = {
    id: null,
    slug: "",
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
    sourceName: "",
    status: "published",
    expiresOn: "",
    isSponsored: false,
    hasOwner: false,
  };
  let meta: { status: keyof typeof JOB_STATUS; createdAt: string; rejectReason: string | null; slug: string } | null = null;

  if (!isNew) {
    const { data: r, error } = await db.from("job_listings").select("*").eq("id", id).maybeSingle();
    if (error) return <AdminError message={error.message} />;
    if (!r) notFound();
    meta = { status: r.status as keyof typeof JOB_STATUS, createdAt: String(r.created_at), rejectReason: (r.reject_reason as string | null) ?? null, slug: String(r.slug) };
    values = {
      id: String(r.id),
      slug: String(r.slug),
      categoryId: s(r.category_id),
      title: String(r.title),
      employerName: String(r.employer_name),
      employmentType: String(r.employment_type),
      experience: String(r.experience),
      schedule: s(r.schedule),
      salaryFrom: s(r.salary_from),
      salaryTo: s(r.salary_to),
      salaryNote: s(r.salary_note),
      description: String(r.description),
      address: s(r.address),
      contactName: s(r.contact_name),
      phone: String(r.phone),
      hasWhatsapp: !!r.has_whatsapp,
      email: s(r.email),
      linkUrl: s(r.link_url),
      sourceName: s(r.source_name),
      // Rejected vacancies can only be corrected back into review; the employer sees the result.
      status: r.status === "rejected" ? "pending" : (r.status as StaffJobFormValues["status"]),
      expiresOn: s(r.expires_on),
      isSponsored: !!r.is_sponsored,
      hasOwner: !!r.owner_id,
    };
  }

  const st = meta ? JOB_STATUS[meta.status] : null;
  return (
    <>
      <PageHeader
        title={isNew ? "Вакансия из проверенного источника" : "Вакансия"}
        description={
          isNew
            ? "Добавляйте вакансию только с согласия работодателя на публикацию контактов и с указанием источника. Зарплату — только если её назвал работодатель."
            : values.hasOwner
              ? "Вакансия работодателя. Исправляйте только явные ошибки; по существу лучше отклонить с причиной, чтобы работодатель исправил сам."
              : "Вакансия добавлена редакцией из источника."
        }
        actions={
          <Link href="/admin/jobs" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Все вакансии
          </Link>
        }
      />
      <JobsFlagNotice enabled={isFeatureEnabled("jobs")} />
      {meta && st && (
        <section className="mb-6 max-w-4xl space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
          <p>
            Статус: <strong>{st.label}</strong> · создана {fmtDate(meta.createdAt)}
            {meta.status === "published" && (
              <>
                {" · "}
                <a href={`/jobs/${meta.slug}`} target="_blank" rel="noreferrer" className="text-primary-strong hover:underline dark:text-primary">
                  открыть на сайте
                </a>
              </>
            )}
          </p>
          {meta.rejectReason && <p className="text-danger">Причина отклонения: {meta.rejectReason}</p>}
          {meta.status === "pending" && <ModerateJob id={values.id!} />}
        </section>
      )}
      <StaffJobForm
        values={values}
        categories={(cats.data ?? []).map((c) => ({ id: String(c.id), name: c.is_active ? String(c.name_ru) : `${c.name_ru} (скрыта)` }))}
        isAdmin={user.isAdmin}
      />
    </>
  );
}
