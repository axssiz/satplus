import Link from "next/link";
import { notFound } from "next/navigation";
import { storagePublicUrl } from "@/lib/env";
import { AdminError, PageHeader } from "../../_components/ui";
import { adminPage, one } from "../../_components/data";
import { ProductForm, type ProductFormValues } from "./product-form";

export const metadata = { title: "Товар" };

export default async function ProductEditPage({ params }: PageProps<"/admin/products/[id]">) {
  const { db } = await adminPage("admin");
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();

  const { data: cats, error: cErr } = await db.from("product_categories").select("id, name_ru").order("sort_order");
  if (cErr) return <AdminError message={cErr.message} />;

  let values: ProductFormValues | null = null;
  if (!isNew) {
    const { data: p, error } = await db
      .from("products")
      .select("*, brands(name), product_barcodes(barcode)")
      .eq("id", id)
      .maybeSingle();
    if (error) return <AdminError message={error.message} />;
    if (!p) notFound();
    values = {
      id: String(p.id),
      slug: String(p.slug),
      name_ru: String(p.name_ru),
      name_kk: (p.name_kk as string | null) ?? "",
      category_id: String(p.category_id),
      brand_name: one<{ name: string }>(p.brands)?.name ?? "",
      manufacturer: (p.manufacturer as string | null) ?? "",
      description_ru: (p.description_ru as string | null) ?? "",
      description_kk: (p.description_kk as string | null) ?? "",
      unit: p.unit as "kg" | "l" | "pcs",
      net_quantity: p.net_quantity == null ? "" : String(Number(p.net_quantity)),
      net_unit: (p.net_unit as string | null) ?? "",
      comparison_mode: p.comparison_mode as "identical" | "analog",
      is_weighted: !!p.is_weighted,
      fat_percent: p.fat_percent == null ? "" : String(Number(p.fat_percent)),
      specs_verified: !!p.specs_verified,
      is_active: !!p.is_active,
      popularity: Number(p.popularity ?? 0),
      barcodes: ((p.product_barcodes as { barcode: string }[] | null) ?? []).map((b) => b.barcode).join(", "),
      image_url: p.image_path ? storagePublicUrl("product-images", String(p.image_path)) : null,
    };
  }

  return (
    <>
      <PageHeader
        title={isNew ? "Новый товар" : values!.name_ru}
        actions={
          !isNew && (
            <Link href={`/admin/prices?product=${id}`} className="text-sm text-primary-strong hover:underline dark:text-primary">
              Цены по филиалам →
            </Link>
          )
        }
      />
      <ProductForm values={values} categories={(cats ?? []).map((c) => ({ id: String(c.id), name: String(c.name_ru) }))} />
    </>
  );
}
