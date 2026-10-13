import Link from "next/link";
import { AdminError, PageHeader } from "../../_components/ui";
import { adminPage } from "../../_components/data";
import { NewsCategoryForm } from "./news-category-form";

export const metadata = { title: "Категории новостей" };

export default async function NewsCategoriesPage() {
  const { db } = await adminPage("admin");
  const { data, error } = await db.from("news_categories").select("id, slug, name_ru, name_kk, sort_order, is_active").order("sort_order");
  if (error) return <AdminError message={error.message} />;
  return (
    <>
      <PageHeader
        title="Категории новостей"
        description="Порядок определяет последовательность фильтров в ленте."
        actions={
          <Link href="/admin/news" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Все новости
          </Link>
        }
      />
      <section className="mb-6 rounded-2xl border border-primary/30 bg-card p-4">
        <h2 className="mb-3 font-semibold">Новая категория</h2>
        <NewsCategoryForm />
      </section>
      <div className="grid grid-cols-1 gap-3">
        {(data ?? []).map((c) => (
          <div key={String(c.id)} className="rounded-2xl border border-border bg-card p-4">
            <NewsCategoryForm
              v={{
                id: String(c.id),
                slug: String(c.slug),
                name_ru: String(c.name_ru),
                name_kk: String(c.name_kk),
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
