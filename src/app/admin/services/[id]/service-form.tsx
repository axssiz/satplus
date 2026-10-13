"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteServiceListingStaff, saveServiceListingStaff } from "@/app/actions/admin-services";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { slugify } from "@/lib/news/text";
import { Check, useAdminAction } from "../../_components/forms";

export type StaffServiceFormValues = {
  id: string | null;
  slug: string;
  categoryId: string;
  title: string;
  providerName: string;
  description: string;
  priceNote: string;
  area: string;
  phone: string;
  hasWhatsapp: boolean;
  linkUrl: string;
  coverUrl: string | null;
  coverAlt: string;
  sourceName: string;
  status: "pending" | "published" | "archived";
  expiresOn: string;
  isSponsored: boolean;
  hasOwner: boolean;
};

function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`grid grid-cols-1 gap-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {hint && <FieldHint>{hint}</FieldHint>}
    </label>
  );
}

const PHONE_PATTERN = "\\+?[0-9 \\(\\)\\-]{6,24}";

export function StaffServiceForm({ values: v, categories, isAdmin }: { values: StaffServiceFormValues; categories: { id: string; name: string }[]; isAdmin: boolean }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [slug, setSlug] = useState(v.slug);
  const [slugTouched, setSlugTouched] = useState(!!v.id);

  return (
    <form
      className="grid max-w-4xl grid-cols-1 gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(
          () => saveServiceListingStaff(fd),
          (r) => {
            if (!v.id && r.data?.id) router.replace(`/admin/services/${r.data.id}`);
          },
        );
      }}
    >
      {v.id && <input type="hidden" name="id" value={v.id} />}

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Услуга *" className="sm:col-span-2">
          <Input
            name="title"
            required
            minLength={5}
            maxLength={120}
            defaultValue={v.title}
            onChange={(e) => {
              if (!slugTouched) setSlug(slugify(e.target.value, 100));
            }}
          />
        </Field>
        <Field label="Категория *">
          <NativeSelect name="categoryId" required defaultValue={v.categoryId}>
            <option value="" disabled>
              Выберите категорию
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Адрес страницы (слаг) *" hint="латиница, цифры, дефис">
          <Input
            name="slug"
            required
            pattern="[a-z0-9\-]{2,110}"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
        </Field>
        <Field label="Мастер *" hint="Имя, бригада или ИП, как просил мастер">
          <Input name="providerName" required minLength={2} maxLength={80} defaultValue={v.providerName} />
        </Field>
        <Field label="Телефон *">
          <Input name="phone" type="tel" required pattern={PHONE_PATTERN} defaultValue={v.phone} />
        </Field>
        <Field label="Описание *" className="sm:col-span-2">
          <Textarea name="description" required minLength={20} maxLength={3000} rows={6} defaultValue={v.description} />
        </Field>
        <Field label="Цена" hint="Как пишет мастер, например «от 5 000 ₸ за выезд»">
          <Input name="priceNote" maxLength={120} defaultValue={v.priceNote} />
        </Field>
        <Field label="Где работает">
          <Input name="area" maxLength={120} defaultValue={v.area} />
        </Field>
        <Field label="Сайт или соцсеть" hint="Только https://">
          <Input name="linkUrl" type="url" pattern="https://.*" maxLength={500} defaultValue={v.linkUrl} />
        </Field>
        <div className="flex items-end pb-2.5">
          <Check name="hasWhatsapp" label="Есть WhatsApp на этом номере" defaultChecked={v.hasWhatsapp} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Фото</Label>
          {v.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview
            <img src={v.coverUrl} alt="" className="aspect-[16/9] w-full rounded-xl border border-border object-cover" />
          )}
          <Input name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="h-auto py-2" />
          <FieldHint>JPEG, PNG или WEBP до 5 МБ, только с разрешения мастера.</FieldHint>
          {v.coverUrl && <Check name="removeCover" label="Убрать фото" />}
          <Field label="Подпись к фото (alt)">
            <Input name="coverAlt" maxLength={200} defaultValue={v.coverAlt} />
          </Field>
        </div>
        <div className="grid content-start gap-4">
          <Field label={v.hasOwner ? "Источник" : "Источник *"} hint={v.hasOwner ? "Объявление подал сам мастер" : "Откуда данные и согласие мастера: звонок, письмо, договор"}>
            <Input name="sourceName" required={!v.hasOwner} minLength={2} maxLength={120} defaultValue={v.sourceName} />
          </Field>
          <Field label="Статус">
            <NativeSelect name="status" defaultValue={v.status}>
              <option value="pending">На проверке (скрыто)</option>
              <option value="published">Опубликовано</option>
              <option value="archived">Снято (скрыто)</option>
            </NativeSelect>
          </Field>
          <Field label="Активно до" hint="Пусто — 90 дней с публикации">
            <Input name="expiresOn" type="date" defaultValue={v.expiresOn} />
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
          Сохранить
        </Button>
        {isAdmin && v.id && (
          <Button
            type="button"
            variant="danger"
            className="ml-auto"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Удалить объявление без возможности восстановления? Чтобы просто скрыть, выберите статус «Снято».")) return;
              run(() => deleteServiceListingStaff(v.id!), () => router.replace("/admin/services"));
            }}
          >
            <Trash2 aria-hidden /> Удалить
          </Button>
        )}
      </div>
    </form>
  );
}
