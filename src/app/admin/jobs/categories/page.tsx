import Link from "next/link";
import { JOB_ICON_NAMES } from "@/components/icons";
import { AdminError, PageHeader } from "../../_components/ui";
import { adminPage } from "../../_components/data";
import { JobCategoryForm } from "./job-category-form";

export const metadata = { title: "Сферы вакансий" };

export default async function JobCategoriesPage() {
  const { db } = await adminPage("admin");
  const { data, error } = await db.from("job_categories").select("id, slug, name_ru, name_kk, icon, sort_order, is_active").order("sort_order");
  if (error) return <AdminError message={error.message} />;
  return (
    <>
      <PageHeader
        title="Сферы вакансий"
        description="Порядок определяет последовательность фильтров в разделе «Работа и вакансии»."
        actions={
          <Link href="/admin/jobs" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Все вакансии
          </Link>
        }
      />
      <section className="mb-6 rounded-2xl border border-primary/30 bg-card p-4">
        <h2 className="mb-3 font-semibold">Новая сфера</h2>
        <JobCategoryForm icons={JOB_ICON_NAMES} />
      </section>
      <div className="grid grid-cols-1 gap-3">
        {(data ?? []).map((c) => (
          <div key={String(c.id)} className="rounded-2xl border border-border bg-card p-4">
            <JobCategoryForm
              icons={JOB_ICON_NAMES}
              v={{
                id: String(c.id),
                slug: String(c.slug),
                name_ru: String(c.name_ru),
                name_kk: String(c.name_kk),
                icon: String(c.icon),
                sort_order: Number(c.sort_order),
                is_active: !!c.is_active,
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
