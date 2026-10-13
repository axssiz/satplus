import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { AdminError, PageHeader } from "../_components/ui";
import { adminPage, one, unitRu } from "../_components/data";
import { ProductTable, type ProductRow } from "./product-table";

export const metadata = { title: "Товары" };

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const { db } = await adminPage("admin");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const cat = typeof sp.category === "string" ? sp.category : "";
  const state = typeof sp.state === "string" ? sp.state : "";

  let query = db
    .from("products")
    .select("id, slug, name_ru, name_kk, is_active, specs_verified, net_quantity, net_unit, is_weighted, unit, comparison_mode, product_categories(name_ru), brands(name), product_barcodes(barcode)")
    .order("name_ru")
    .limit(300);
  if (q) query = /^\d{8,14}$/.test(q) ? query : query.ilike("search_text", `%${q.toLowerCase()}%`);
  if (cat) query = query.eq("category_id", cat);
  if (state === "inactive") query = query.eq("is_active", false);
  if (state === "active") query = query.eq("is_active", true);
  if (state === "unverified") query = query.eq("specs_verified", false);

  const [{ data, error }, { data: cats }, { data: priceCounts }] = await Promise.all([
    query,
    db.from("product_categories").select("id, name_ru").order("sort_order"),
    db.from("verified_prices").select("product_id").eq("is_demo", false).limit(20000),
  ]);
  if (error) return <AdminError message={error.message} />;
  const counts = new Map<string, number>();
  for (const p of priceCounts ?? []) counts.set(String(p.product_id), (counts.get(String(p.product_id)) ?? 0) + 1);

  let rows: ProductRow[] = (data ?? []).map((p) => ({
    id: String(p.id),
    slug: String(p.slug),
    name: String(p.name_ru),
    hasKk: !!p.name_kk,
    category: one<{ name_ru: string }>(p.product_categories)?.name_ru ?? "—",
    brand: one<{ name: string }>(p.brands)?.name ?? null,
    pack: p.net_quantity ? `${Number(p.net_quantity)} ${unitRu(p.net_unit)}` : p.is_weighted ? `весовой, за ${unitRu(p.unit)}` : "—",
    analog: p.comparison_mode === "analog",
    active: !!p.is_active,
    specsVerified: !!p.specs_verified,
    barcodes: ((p.product_barcodes as { barcode: string }[] | null) ?? []).map((b) => b.barcode),
    prices: counts.get(String(p.id)) ?? 0,
  }));
  if (/^\d{8,14}$/.test(q)) rows = rows.filter((r) => r.barcodes.includes(q));

  return (
    <>
      <PageHeader
        title="Товары"
        description="Карточки товаров. Характеристики без отметки «проверены» показываются как непроверенные."
        actions={
          <Button asChild size="sm">
            <Link href="/admin/products/new"><Plus aria-hidden /> Новый товар</Link>
          </Button>
        }
      />
      <form className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Input name="q" defaultValue={q} placeholder="Название, бренд или штрихкод" aria-label="Поиск" />
        <NativeSelect name="category" defaultValue={cat} aria-label="Категория">
          <option value="">Все категории</option>
          {(cats ?? []).map((c) => (
            <option key={String(c.id)} value={String(c.id)}>{String(c.name_ru)}</option>
          ))}
        </NativeSelect>
        <NativeSelect name="state" defaultValue={state} aria-label="Состояние">
          <option value="">Любые</option>
          <option value="active">Активные</option>
          <option value="inactive">Скрытые</option>
          <option value="unverified">Характеристики не проверены</option>
        </NativeSelect>
        <Button type="submit" variant="secondary">Найти</Button>
      </form>
      <ProductTable rows={rows} />
    </>
  );
}
