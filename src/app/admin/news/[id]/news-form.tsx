"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteNews, saveNews } from "@/app/actions/admin-news";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { slugify } from "@/lib/news/text";
import { Check, useAdminAction } from "../../_components/forms";

export type NewsFormValues = {
  id: string | null;
  submissionId: string | null;
  slug: string;
  title: string;
  summary: string;
  body: string;
  lang: "ru" | "kk";
  categoryId: string;
  sourceName: string;
  sourceUrl: string;
  coverUrl: string | null;
  coverAlt: string;
  status: "draft" | "published" | "archived";
  publishedAt: string; // datetime-local, Almaty time
  isImportant: boolean;
  isSponsored: boolean;
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

export function NewsForm({
  values: v,
  categories,
  isAdmin,
  publicUrl,
}: {
  values: NewsFormValues;
  categories: { id: string; name: string }[];
  isAdmin: boolean;
  publicUrl: string | null;
}) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [slug, setSlug] = useState(v.slug);
  const [slugTouched, setSlugTouched] = useState(!!v.id);
  const [status, setStatus] = useState(v.status);

  return (
    <form
      className="grid max-w-4xl grid-cols-1 gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(
          () => saveNews(fd),
          (r) => {
            if (!v.id && r.data?.id) router.replace(`/admin/news/${r.data.id}`);
          },
        );
      }}
    >
      {v.id && <input type="hidden" name="id" value={v.id} />}
      {v.submissionId && <input type="hidden" name="submissionId" value={v.submissionId} />}

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4">
        <Field label="Заголовок *">
          <Input
            name="title"
            required
            minLength={5}
            maxLength={200}
            defaultValue={v.title}
            onChange={(e) => {
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Адрес страницы (слаг) *" hint="латиница, цифры, дефис" className="sm:col-span-2">
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
          <Field label="Язык материала">
            <NativeSelect name="lang" defaultValue={v.lang}>
              <option value="ru">Русский</option>
              <option value="kk">Қазақша</option>
            </NativeSelect>
          </Field>
        </div>
        <Field label="Анонс" hint="1–2 предложения для ленты и поисковиков. До 400 символов.">
          <Textarea name="summary" maxLength={400} rows={2} defaultValue={v.summary} />
        </Field>
        <Field label="Текст *" hint="Обычный текст. Абзацы разделяйте пустой строкой. HTML не поддерживается.">
          <Textarea name="body" required minLength={20} maxLength={20000} rows={14} defaultValue={v.body} />
        </Field>
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Источник *" hint="Кто сообщил: акимат, учреждение, редакция Sat+ и т.п.">
          <Input name="sourceName" required minLength={2} maxLength={120} defaultValue={v.sourceName} />
        </Field>
        <Field label="Ссылка на источник" hint="Только https://">
          <Input name="sourceUrl" type="url" pattern="https://.*" maxLength={500} defaultValue={v.sourceUrl} />
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
        <div className="flex flex-col justify-end gap-2">
          <Check name="isImportant" label="Важная новость (отметка в ленте)" defaultChecked={v.isImportant} />
          {isAdmin ? (
            <Check name="isSponsored" label="Партнёрский материал (всегда помечается на сайте)" defaultChecked={v.isSponsored} />
          ) : (
            v.isSponsored && <input type="hidden" name="isSponsored" value="on" />
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Обложка</Label>
          {v.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview
            <img src={v.coverUrl} alt="" className="aspect-[16/9] w-full rounded-xl border border-border object-cover" />
          )}
          <Input name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="h-auto py-2" />
          <FieldHint>JPEG, PNG или WEBP до 3 МБ. Используйте только фото, на которые есть права.</FieldHint>
          {v.coverUrl && <Check name="removeCover" label="Убрать обложку" />}
        </div>
        <Field label="Подпись к обложке (alt)" hint="Что изображено; для незрячих читателей и поисковиков">
          <Input name="coverAlt" maxLength={200} defaultValue={v.coverAlt} />
        </Field>
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Статус">
          <NativeSelect name="status" value={status} onChange={(e) => setStatus(e.target.value as NewsFormValues["status"])}>
            <option value="draft">Черновик</option>
            <option value="published">Опубликована</option>
            <option value="archived">В архиве (скрыта)</option>
          </NativeSelect>
        </Field>
        <Field label="Дата и время публикации (Алматы)" hint="Пусто — сейчас. Будущая дата — публикация по расписанию.">
          <Input name="publishedAt" type="datetime-local" defaultValue={v.publishedAt} />
        </Field>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {status === "published" ? (v.submissionId ? "Опубликовать предложение" : "Сохранить и опубликовать") : "Сохранить"}
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
              if (!window.confirm("Удалить новость без возможности восстановления? Чтобы просто скрыть, выберите статус «В архиве».")) return;
              run(() => deleteNews(v.id!), () => router.replace("/admin/news"));
            }}
          >
            <Trash2 aria-hidden /> Удалить
          </Button>
        )}
      </div>
    </form>
  );
}
