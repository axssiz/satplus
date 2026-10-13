"use client";

import { useRouter } from "next/navigation";
import { saveProduct } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { useAdminAction, Check } from "../../_components/forms";

export type ProductFormValues = {
  id: string;
  slug: string;
  name_ru: string;
  name_kk: string;
  category_id: string;
  brand_name: string;
  manufacturer: string;
  description_ru: string;
  description_kk: string;
  unit: "kg" | "l" | "pcs";
  net_quantity: string;
  net_unit: string;
  comparison_mode: "identical" | "analog";
  is_weighted: boolean;
  fat_percent: string;
  specs_verified: boolean;
  is_active: boolean;
  popularity: number;
  barcodes: string;
  image_url: string | null;
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="grid grid-cols-1 gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <FieldHint>{hint}</FieldHint>}
    </label>
  );
}

export function ProductForm({ values: v, categories }: { values: ProductFormValues | null; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  return (
    <form
      className="grid grid-cols-1 max-w-4xl gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(
          () => saveProduct(fd),
          (r) => {
            if (!v && r.data?.id) router.replace(`/admin/products/${r.data.id}`);
          },
        );
      }}
    >
      {v && <input type="hidden" name="id" value={v.id} />}
      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Название (RU) *"><Input name="name_ru" required minLength={2} maxLength={160} defaultValue={v?.name_ru} /></Field>
        <Field label="Название (KZ)" hint="Если пусто — показывается русское название"><Input name="name_kk" maxLength={160} defaultValue={v?.name_kk} /></Field>
        <Field label="Слаг (адрес страницы) *" hint="латиница, цифры, дефис"><Input name="slug" required pattern="[a-z0-9\-]{2,96}" defaultValue={v?.slug} /></Field>
        <Field label="Категория *">
          <NativeSelect name="category_id" required defaultValue={v?.category_id ?? ""}>
            <option value="" disabled>Выберите…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Бренд" hint="Новый бренд создаётся автоматически"><Input name="brand_name" maxLength={80} defaultValue={v?.brand_name} /></Field>
        <Field label="Производитель"><Input name="manufacturer" maxLength={120} defaultValue={v?.manufacturer} /></Field>
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
        <Field label="Базовая единица сравнения *">
          <NativeSelect name="unit" defaultValue={v?.unit ?? "pcs"}>
            <option value="kg">кг</option>
            <option value="l">л</option>
            <option value="pcs">шт</option>
          </NativeSelect>
        </Field>
        <Field label="Фасовка, количество" hint="Пусто для весового товара"><Input name="net_quantity" inputMode="decimal" defaultValue={v?.net_quantity} /></Field>
        <Field label="Фасовка, единица">
          <NativeSelect name="net_unit" defaultValue={v?.net_unit ?? ""}>
            <option value="">—</option>
            <option value="g">г</option>
            <option value="kg">кг</option>
            <option value="ml">мл</option>
            <option value="l">л</option>
            <option value="pcs">шт</option>
          </NativeSelect>
        </Field>
        <Field label="Режим сравнения" hint="Аналоги сравниваются по цене за единицу">
          <NativeSelect name="comparison_mode" defaultValue={v?.comparison_mode ?? "identical"}>
            <option value="identical">Идентичный товар</option>
            <option value="analog">Аналоги (разные бренды/фасовки)</option>
          </NativeSelect>
        </Field>
        <Field label="Жирность, %"><Input name="fat_percent" inputMode="decimal" defaultValue={v?.fat_percent} /></Field>
        <Field label="Популярность (сортировка)"><Input name="popularity" type="number" min={0} defaultValue={v?.popularity ?? 0} /></Field>
        <div className="flex flex-wrap gap-4 sm:col-span-3">
          <Check name="is_weighted" label="Весовой товар" defaultChecked={v?.is_weighted} />
          <Check name="specs_verified" label="Характеристики проверены" defaultChecked={v?.specs_verified} />
          <Check name="is_active" label="Показывать на сайте" defaultChecked={v?.is_active ?? true} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Штрихкоды" hint="EAN/UPC, 8–14 цифр, через запятую"><Input name="barcodes" defaultValue={v?.barcodes} /></Field>
        <Field label="Фото товара" hint="JPEG/PNG/WEBP до 2 МБ">
          <Input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="py-2" />
        </Field>
        {v?.image_url && (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview
          <img src={v.image_url} alt="" className="size-24 rounded-xl border border-border object-contain" />
        )}
        <Field label="Описание (RU)"><Textarea name="description_ru" maxLength={2000} defaultValue={v?.description_ru} /></Field>
        <Field label="Описание (KZ)"><Textarea name="description_kk" maxLength={2000} defaultValue={v?.description_kk} /></Field>
      </section>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить"}</Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/products")}>К списку</Button>
      </div>
    </form>
  );
}
