"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteJobListingStaff, saveJobListingStaff } from "@/app/actions/admin-jobs";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { slugify } from "@/lib/news/text";
import { Check, useAdminAction } from "../../_components/forms";
import { EMPLOYMENT_LABEL, EXPERIENCE_LABEL } from "../shared";

export type StaffJobFormValues = {
  id: string | null;
  slug: string;
  categoryId: string;
  title: string;
  employerName: string;
  employmentType: string;
  experience: string;
  schedule: string;
  salaryFrom: string;
  salaryTo: string;
  salaryNote: string;
  description: string;
  address: string;
  contactName: string;
  phone: string;
  hasWhatsapp: boolean;
  email: string;
  linkUrl: string;
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

export function StaffJobForm({ values: v, categories, isAdmin }: { values: StaffJobFormValues; categories: { id: string; name: string }[]; isAdmin: boolean }) {
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
          () => saveJobListingStaff(fd),
          (r) => {
            if (!v.id && r.data?.id) router.replace(`/admin/jobs/${r.data.id}`);
          },
        );
      }}
    >
      {v.id && <input type="hidden" name="id" value={v.id} />}

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Должность *" className="sm:col-span-2">
          <Input
            name="title"
            required
            minLength={3}
            maxLength={120}
            defaultValue={v.title}
            onChange={(e) => {
              if (!slugTouched) setSlug(slugify(e.target.value, 100));
            }}
          />
        </Field>
        <Field label="Сфера *">
          <NativeSelect name="categoryId" required defaultValue={v.categoryId}>
            <option value="" disabled>
              Выберите сферу
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
        <Field label="Работодатель *">
          <Input name="employerName" required minLength={2} maxLength={120} defaultValue={v.employerName} />
        </Field>
        <Field label="Телефон *">
          <Input name="phone" type="tel" required pattern={PHONE_PATTERN} defaultValue={v.phone} />
        </Field>
        <Field label="Занятость">
          <NativeSelect name="employmentType" defaultValue={v.employmentType}>
            {Object.entries(EMPLOYMENT_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Опыт">
          <NativeSelect name="experience" defaultValue={v.experience}>
            {Object.entries(EXPERIENCE_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="График">
          <Input name="schedule" maxLength={120} defaultValue={v.schedule} />
        </Field>
        <Field label="Место работы">
          <Input name="address" maxLength={200} defaultValue={v.address} />
        </Field>
        <Field label="Зарплата от, ₸" hint="Только если указал работодатель">
          <Input name="salaryFrom" inputMode="numeric" defaultValue={v.salaryFrom} />
        </Field>
        <Field label="Зарплата до, ₸">
          <Input name="salaryTo" inputMode="numeric" defaultValue={v.salaryTo} />
        </Field>
        <Field label="Комментарий к зарплате" className="sm:col-span-2">
          <Input name="salaryNote" maxLength={120} defaultValue={v.salaryNote} />
        </Field>
        <Field label="Описание *" className="sm:col-span-2">
          <Textarea name="description" required minLength={20} maxLength={5000} rows={8} defaultValue={v.description} />
        </Field>
        <Field label="Контактное лицо">
          <Input name="contactName" maxLength={80} defaultValue={v.contactName} />
        </Field>
        <Field label="Почта">
          <Input name="email" type="email" maxLength={254} defaultValue={v.email} />
        </Field>
        <Field label="Сайт или соцсеть" hint="Только https://">
          <Input name="linkUrl" type="url" pattern="https://.*" maxLength={500} defaultValue={v.linkUrl} />
        </Field>
        <div className="flex items-end pb-2.5">
          <Check name="hasWhatsapp" label="Есть WhatsApp на этом номере" defaultChecked={v.hasWhatsapp} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <Field
          label={v.hasOwner ? "Источник" : "Источник *"}
          hint={v.hasOwner ? "Вакансию подал сам работодатель" : "Откуда вакансия и согласие работодателя: звонок, письмо, договор"}
        >
          <Input name="sourceName" required={!v.hasOwner} minLength={2} maxLength={120} defaultValue={v.sourceName} />
        </Field>
        <Field label="Статус">
          <NativeSelect name="status" defaultValue={v.status}>
            <option value="pending">На проверке (скрыто)</option>
            <option value="published">Опубликована</option>
            <option value="archived">Закрыта (скрыто)</option>
          </NativeSelect>
        </Field>
        <Field label="Активна до" hint="Пусто — 30 дней с публикации">
          <Input name="expiresOn" type="date" defaultValue={v.expiresOn} />
        </Field>
        <div className="flex items-end pb-2.5">
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
              if (!window.confirm("Удалить вакансию без возможности восстановления? Чтобы просто скрыть, выберите статус «Закрыта».")) return;
              run(() => deleteJobListingStaff(v.id!), () => router.replace("/admin/jobs"));
            }}
          >
            <Trash2 aria-hidden /> Удалить
          </Button>
        )}
      </div>
    </form>
  );
}
