"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteBusiness, saveBusiness } from "@/app/actions/admin-businesses";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { slugify } from "@/lib/news/text";
import { Check, useAdminAction } from "../../_components/forms";

export type BusinessFormValues = {
  id: string | null;
  submissionId: string | null;
  slug: string;
  name: string;
  categoryId: string;
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  phone: string;
  phoneAlt: string;
  website: string;
  socialUrl: string;
  openingHours: string;
  coverUrl: string | null;
  coverAlt: string;
  sourceName: string;
  verified: boolean;
  lastVerifiedAt: string;
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

const PHONE_PATTERN = "\\+?[0-9 \\(\\)\\-]{6,24}";

export function BusinessForm({
  values: v,
  categories,
  isAdmin,
  publicUrl,
}: {
  values: BusinessFormValues;
  categories: Option[];
  isAdmin: boolean;
  publicUrl: string | null;
}) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [slug, setSlug] = useState(v.slug);
  const [slugTouched, setSlugTouched] = useState(!!v.id);
  const [status, setStatus] = useState(v.status);
  const [verified, setVerified] = useState(v.verified);

  return (
    <form
      className="grid max-w-4xl grid-cols-1 gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(
          () => saveBusiness(fd),
          (r) => {
            if (v.submissionId) router.replace("/admin/businesses/suggestions");
            else if (!v.id && r.data?.id) router.replace(`/admin/businesses/${r.data.id}`);
          },
        );
      }}
    >
      {v.id && <input type="hidden" name="id" value={v.id} />}
      {v.submissionId && <input type="hidden" name="submissionId" value={v.submissionId} />}

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Название *" className="sm:col-span-2">
          <Input
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={v.name}
            onChange={(e) => {
              if (!slugTouched) setSlug(slugify(e.target.value, 110));
            }}
          />
        </Field>
        <Field label="Категория">
          <NativeSelect name="categoryId" defaultValue={v.categoryId}>
            <option value="">Без категории</option>
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
            pattern="[a-z0-9\-]{2,120}"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
        </Field>
        <Field label="Описание" hint="Коротко, без рекламных обещаний. Обычный текст." className="sm:col-span-2">
          <Textarea name="description" maxLength={2000} rows={4} defaultValue={v.description} />
        </Field>
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Адрес" hint="Как на вывеске: улица, дом" className="sm:col-span-2">
          <Input name="address" maxLength={200} defaultValue={v.address} />
        </Field>
        <Field label="Широта" hint="Например 47.9001. Пусто — без точки на карте">
          <Input name="latitude" inputMode="decimal" pattern="-?[0-9]{1,2}(\.[0-9]{1,6})?" defaultValue={v.latitude} />
        </Field>
        <Field label="Долгота" hint="Например 67.5339. Обе координаты или ни одной">
          <Input name="longitude" inputMode="decimal" pattern="-?[0-9]{1,3}(\.[0-9]{1,6})?" defaultValue={v.longitude} />
        </Field>
        <Field label="Телефон">
          <Input name="phone" type="tel" pattern={PHONE_PATTERN} defaultValue={v.phone} />
        </Field>
        <Field label="Второй телефон">
          <Input name="phoneAlt" type="tel" pattern={PHONE_PATTERN} defaultValue={v.phoneAlt} />
        </Field>
        <Field label="Сайт" hint="Только https://">
          <Input name="website" type="url" pattern="https://.*" maxLength={500} defaultValue={v.website} />
        </Field>
        <Field label="Соцсеть" hint="Instagram, 2ГИС и т. п., только https://">
          <Input name="socialUrl" type="url" pattern="https://.*" maxLength={500} defaultValue={v.socialUrl} />
        </Field>
        <Field label="График работы" hint="Как указано организацией, например «Пн–Пт 9:00–18:00»" className="sm:col-span-2">
          <Input name="openingHours" maxLength={300} defaultValue={v.openingHours} />
        </Field>
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Источник *" hint="Откуда данные: вывеска, звонок, официальный сайт, сообщение представителя" className="sm:col-span-2">
          <Input name="sourceName" required minLength={2} maxLength={120} defaultValue={v.sourceName} />
        </Field>
        <label className="flex items-center gap-2 self-end text-sm sm:pb-2.5">
          <input type="checkbox" name="verified" checked={verified} onChange={(e) => setVerified(e.currentTarget.checked)} className="size-4 accent-[var(--primary)]" />
          Данные проверены модератором
        </label>
        <Field label={verified ? "Дата проверки *" : "Дата проверки"}>
          <Input name="lastVerifiedAt" type="date" required={verified} defaultValue={v.lastVerifiedAt} />
        </Field>
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Фото</Label>
          {v.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview
            <img src={v.coverUrl} alt="" className="aspect-[16/9] w-full rounded-xl border border-border object-cover" />
          )}
          <Input name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="h-auto py-2" />
          <FieldHint>JPEG, PNG или WEBP до 3 МБ. Только фото, на которые есть права (своё фото, материалы организации).</FieldHint>
          {v.coverUrl && <Check name="removeCover" label="Убрать фото" />}
        </div>
        <div className="grid content-start gap-4">
          <Field label="Подпись к фото (alt)">
            <Input name="coverAlt" maxLength={200} defaultValue={v.coverAlt} />
          </Field>
          <Field label="Статус">
            <NativeSelect name="status" value={status} onChange={(e) => setStatus(e.target.value as BusinessFormValues["status"])}>
              <option value="draft">Черновик</option>
              <option value="published">Опубликована</option>
              <option value="archived">Скрыта</option>
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
          {v.submissionId ? (v.id ? "Сохранить исправление" : "Сохранить и принять сообщение") : status === "published" ? "Сохранить и опубликовать" : "Сохранить"}
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
              if (!window.confirm("Удалить организацию без возможности восстановления? Чтобы просто скрыть, выберите статус «Скрыта».")) return;
              run(() => deleteBusiness(v.id!), () => router.replace("/admin/businesses"));
            }}
          >
            <Trash2 aria-hidden /> Удалить
          </Button>
        )}
      </div>
    </form>
  );
}
