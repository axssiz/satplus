"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deletePromotion, savePromotion } from "@/app/actions/admin-promotions";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { slugify } from "@/lib/news/text";
import { Check, useAdminAction } from "../../_components/forms";

export type PromotionFormValues = {
  id: string | null;
  submissionId: string | null;
  slug: string;
  storeId: string;
  branchId: string;
  categoryId: string;
  title: string;
  description: string;
  discountLabel: string;
  conditions: string;
  startsOn: string;
  endsOn: string;
  sourceName: string;
  sourceUrl: string;
  coverUrl: string | null;
  coverAlt: string;
  status: "draft" | "published" | "archived";
  isSponsored: boolean;
};

type Option = { id: string; name: string };

function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`grid grid-cols-1 gap-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {hint && <FieldHint>{hint}</FieldHint>}
    </label>
  );
}

export function PromotionForm({
  values: v,
  stores,
  branches,
  categories,
  isAdmin,
  publicUrl,
}: {
  values: PromotionFormValues;
  stores: (Option & { slug: string })[];
  branches: (Option & { storeId: string })[];
  categories: Option[];
  isAdmin: boolean;
  publicUrl: string | null;
}) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [slug, setSlug] = useState(v.slug);
  const [slugTouched, setSlugTouched] = useState(!!v.id);
  const [title, setTitle] = useState(v.title);
  const [storeId, setStoreId] = useState(v.storeId);
  const [branchId, setBranchId] = useState(v.branchId);
  const [status, setStatus] = useState(v.status);

  const storeSlug = stores.find((s) => s.id === storeId)?.slug ?? "";
  const autoSlug = (t: string, s: string) => slugify([s, t].filter(Boolean).join(" "), 110);

  return (
    <form
      className="grid max-w-4xl grid-cols-1 gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(
          () => savePromotion(fd),
          (r) => {
            if (!v.id && r.data?.id) router.replace(`/admin/promotions/${r.data.id}`);
          },
        );
      }}
    >
      {v.id && <input type="hidden" name="id" value={v.id} />}
      {v.submissionId && <input type="hidden" name="submissionId" value={v.submissionId} />}

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Магазин *">
          <NativeSelect
            name="storeId"
            required
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value);
              setBranchId("");
              const s = stores.find((x) => x.id === e.target.value)?.slug ?? "";
              if (!slugTouched) setSlug(autoSlug(title, s));
            }}
          >
            <option value="" disabled>
              Выберите магазин
            </option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Филиал" hint="Пусто — акция действует во всех магазинах сети в городе">
          <NativeSelect name="branchId" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Все филиалы</option>
            {branches
              .filter((b) => b.storeId === storeId)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </NativeSelect>
        </Field>
        <Field label="Название акции *" className="sm:col-span-2">
          <Input
            name="title"
            required
            minLength={5}
            maxLength={160}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(autoSlug(e.target.value, storeSlug));
            }}
          />
        </Field>
        <Field label="Метка скидки" hint="Как в магазине: «−20%», «2 по цене 1». До 40 символов.">
          <Input name="discountLabel" maxLength={40} defaultValue={v.discountLabel} />
        </Field>
        <Field label="Адрес страницы (слаг) *" hint="латиница, цифры, дефис">
          <Input
            name="slug"
            required
            pattern="[a-z0-9\-]{2,120}"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
        </Field>
        <Field label="Описание" hint="Обычный текст, абзацы через пустую строку." className="sm:col-span-2">
          <Textarea name="description" maxLength={4000} rows={5} defaultValue={v.description} />
        </Field>
        <Field label="Условия" hint="Ограничения: карта магазина, минимальная сумма, «пока есть в наличии»." className="sm:col-span-2">
          <Textarea name="conditions" maxLength={1000} rows={3} defaultValue={v.conditions} />
        </Field>
        <Field label="Категория товаров">
          <NativeSelect name="categoryId" defaultValue={v.categoryId}>
            <option value="">Без категории</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Начало" hint="Пусто — действует уже сейчас">
          <Input name="startsOn" type="date" defaultValue={v.startsOn} />
        </Field>
        <Field label="Последний день акции *" hint="Включительно, по времени Алматы. После этой даты акция уйдёт в «Завершились».">
          <Input name="endsOn" type="date" required defaultValue={v.endsOn} />
        </Field>
        <Field label="Источник *" hint="Где подтверждено: сайт сети, плакат в магазине, сообщение покупателя">
          <Input name="sourceName" required minLength={2} maxLength={120} defaultValue={v.sourceName} />
        </Field>
        <Field label="Ссылка на источник" hint="Только https://">
          <Input name="sourceUrl" type="url" pattern="https://.*" maxLength={500} defaultValue={v.sourceUrl} />
        </Field>
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Изображение</Label>
          {v.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview
            <img src={v.coverUrl} alt="" className="aspect-[16/9] w-full rounded-xl border border-border object-cover" />
          )}
          <Input name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="h-auto py-2" />
          <FieldHint>JPEG, PNG или WEBP до 3 МБ. Только изображения, на которые есть права (материалы магазина, своё фото).</FieldHint>
          {v.coverUrl && <Check name="removeCover" label="Убрать изображение" />}
        </div>
        <div className="grid content-start gap-4">
          <Field label="Подпись к изображению (alt)">
            <Input name="coverAlt" maxLength={200} defaultValue={v.coverAlt} />
          </Field>
          <Field label="Статус">
            <NativeSelect name="status" value={status} onChange={(e) => setStatus(e.target.value as PromotionFormValues["status"])}>
              <option value="draft">Черновик</option>
              <option value="published">Опубликована</option>
              <option value="archived">Снята (скрыта)</option>
            </NativeSelect>
          </Field>
          {isAdmin ? (
            <Check name="isSponsored" label="Рекламное размещение (всегда помечается, не поднимает в списке)" defaultChecked={v.isSponsored} />
          ) : (
            v.isSponsored && <input type="hidden" name="isSponsored" value="on" />
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {status === "published" ? (v.submissionId ? "Опубликовать сообщение" : "Сохранить и опубликовать") : "Сохранить"}
        </Button>
        {publicUrl && (
          <Button asChild variant="outline">
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden /> Открыть на сайте
            </a>
          </Button>
        )}
        {isAdmin && v.id && (
          <Button
            type="button"
            variant="danger"
            className="ml-auto"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Удалить акцию без возможности восстановления? Чтобы просто скрыть, выберите статус «Снята».")) return;
              run(() => deletePromotion(v.id!), () => router.replace("/admin/promotions"));
            }}
          >
            <Trash2 aria-hidden /> Удалить
          </Button>
        )}
      </div>
    </form>
  );
}
