import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Inbox } from "lucide-react";
import { isFeatureEnabled } from "@/config/features";
import { storagePublicUrl } from "@/lib/env";
import { slugify } from "@/lib/news/text";
import { isoToAlmatyLocal } from "@/lib/validation";
import { AdminError, PageHeader } from "../../_components/ui";
import { adminPage, fmtDate } from "../../_components/data";
import { isFuture, NewsFlagNotice } from "../shared";
import { RejectSuggestion } from "../suggestions/reject-suggestion";
import { NewsForm, type NewsFormValues } from "./news-form";

export const metadata = { title: "Новость" };

const UUID = /^[0-9a-f-]{36}$/;

export default async function NewsEditPage({ params, searchParams }: PageProps<"/admin/news/[id]">) {
  const { db, user } = await adminPage();
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  if (!isNew && !UUID.test(id)) notFound();
  const fromId = isNew && typeof sp.from === "string" && UUID.test(sp.from) ? sp.from : null;

  const { data: cats, error: cErr } = await db.from("news_categories").select("id, name_ru").order("sort_order");
  if (cErr) return <AdminError message={cErr.message} />;

  let values: NewsFormValues = {
    id: null,
    submissionId: null,
    slug: "",
    title: "",
    summary: "",
    body: "",
    lang: "ru",
    categoryId: "",
    sourceName: "",
    sourceUrl: "",
    coverUrl: null,
    coverAlt: "",
    status: "draft",
    publishedAt: "",
    isImportant: false,
    isSponsored: false,
  };
  let publicUrl: string | null = null;
  let suggestion: {
    id: string;
    title: string;
    body: string;
    contact: string | null;
    sourceUrl: string | null;
    createdAt: string;
    status: string;
    photoUrl: string | null;
  } | null = null;

  if (!isNew) {
    const { data: n, error } = await db.from("news").select("*").eq("id", id).maybeSingle();
    if (error) return <AdminError message={error.message} />;
    if (!n) notFound();
    values = {
      id: String(n.id),
      submissionId: null,
      slug: String(n.slug),
      title: String(n.title),
      summary: (n.summary as string | null) ?? "",
      body: String(n.body),
      lang: n.lang === "kk" ? "kk" : "ru",
      categoryId: (n.category_id as string | null) ?? "",
      sourceName: String(n.source_name),
      sourceUrl: (n.source_url as string | null) ?? "",
      coverUrl: storagePublicUrl("news-images", n.cover_path as string | null),
      coverAlt: (n.cover_alt as string | null) ?? "",
      status: n.status as NewsFormValues["status"],
      publishedAt: n.published_at ? isoToAlmatyLocal(String(n.published_at)) : "",
      isImportant: !!n.is_important,
      isSponsored: !!n.is_sponsored,
    };
    if (n.status === "published" && n.published_at && !isFuture(String(n.published_at))) {
      publicUrl = `/news/${n.slug}`;
    }
  } else if (fromId) {
    const { data: s, error } = await db.from("news_submissions").select("*").eq("id", fromId).maybeSingle();
    if (error) return <AdminError message={error.message} />;
    if (!s) notFound();
    let photoUrl: string | null = null;
    if (s.photo_path) {
      const { data: signed } = await db.storage.from("news-submissions").createSignedUrl(String(s.photo_path), 900);
      photoUrl = signed?.signedUrl ?? null;
    }
    suggestion = {
      id: String(s.id),
      title: String(s.title),
      body: String(s.body),
      contact: (s.contact as string | null) ?? null,
      sourceUrl: (s.source_url as string | null) ?? null,
      createdAt: String(s.created_at),
      status: String(s.status),
      photoUrl,
    };
    values = {
      ...values,
      submissionId: s.status === "pending" ? String(s.id) : null,
      title: String(s.title),
      slug: slugify(String(s.title)),
      body: String(s.body),
      categoryId: (s.category_id as string | null) ?? "",
      sourceUrl: (s.source_url as string | null) ?? "",
      sourceName: "Сообщение читателя, проверено редакцией Sat+",
    };
  }

  return (
    <>
      <PageHeader
        title={isNew ? (suggestion ? "Публикация предложения" : "Новая новость") : "Редактирование новости"}
        description={
          suggestion
            ? "Проверьте факты и источник, отредактируйте текст. Предложение будет отмечено опубликованным вместе с сохранением новости."
            : "Материал без источника опубликовать нельзя."
        }
        actions={
          <Link href="/admin/news" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Все новости
          </Link>
        }
      />
      <NewsFlagNotice enabled={isFeatureEnabled("news")} />

      {suggestion && (
        <section className="mb-6 max-w-4xl space-y-3 rounded-2xl border border-info/30 bg-info-soft/40 p-4 text-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <Inbox className="size-4" aria-hidden /> Исходное сообщение читателя · {fmtDate(suggestion.createdAt)}
          </h2>
          {suggestion.status !== "pending" && (
            <p className="font-medium text-warning-foreground">Это предложение уже обработано ({suggestion.status === "approved" ? "опубликовано" : "отклонено"}).</p>
          )}
          <p className="font-medium">{suggestion.title}</p>
          <p className="whitespace-pre-line text-muted-foreground">{suggestion.body}</p>
          {suggestion.sourceUrl && (
            <a href={suggestion.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary-strong hover:underline dark:text-primary">
              {suggestion.sourceUrl} <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
          {suggestion.contact && <p>Контакт (не публикуется): {suggestion.contact}</p>}
          {suggestion.photoUrl && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Фото читателя (личный бакет, ссылка действует 15 минут). Публикуйте только с разрешения автора.</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
              <img src={suggestion.photoUrl} alt="Фото из предложения" className="max-h-80 rounded-xl border border-border" />
            </div>
          )}
          {suggestion.status === "pending" && <RejectSuggestion id={suggestion.id} redirectTo="/admin/news/suggestions" />}
        </section>
      )}

      <NewsForm values={values} categories={(cats ?? []).map((c) => ({ id: String(c.id), name: String(c.name_ru) }))} isAdmin={user.isAdmin} publicUrl={publicUrl} />
    </>
  );
}
