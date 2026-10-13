import Link from "next/link";
import { SERVICE_ICON_NAMES } from "@/components/icons";
import { AdminError, PageHeader } from "../../_components/ui";
import { adminPage } from "../../_components/data";
import { ServiceCategoryForm } from "./service-category-form";

export const metadata = { title: "Категории услуг" };

export default async function ServiceCategoriesPage() {
  const { db } = await adminPage("admin");
  const { data, error } = await db.from("service_categories").select("id, slug, name_ru, name_kk, icon, sort_order, is_active").order("sort_order");
  if (error) return <AdminError message={error.message} />;
  return (
    <>
      <PageHeader
        title="Категории услуг"
        description="Порядок определяет последовательность фильтров в разделе «Услуги»."
        actions={
          <Link href="/admin/services" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Все объявления
          </Link>
        }
      />
      <section className="mb-6 rounded-2xl border border-primary/30 bg-card p-4">
        <h2 className="mb-3 font-semibold">Новая категория</h2>
        <ServiceCategoryForm icons={SERVICE_ICON_NAMES} />
      </section>
      <div className="grid grid-cols-1 gap-3">
        {(data ?? []).map((c) => (
          <div key={String(c.id)} className="rounded-2xl border border-border bg-card p-4">
            <ServiceCategoryForm
              icons={SERVICE_ICON_NAMES}
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
