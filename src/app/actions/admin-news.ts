"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { fail, guard, type AdminResult } from "@/lib/server/admin-guard";
import { createSupabaseServerClient, PUBLIC_DATA_TAG } from "@/lib/supabase/server";
import { almatyLocalToIso, newsArticleSchema, sniffImageType } from "@/lib/validation";

const MAX_COVER_BYTES = 3 * 1024 * 1024;

function refreshNews() {
  revalidatePath("/", "layout");
  // Cached Supabase reads are shared between pages; expire them so every page sees the change.
  updateTag(PUBLIC_DATA_TAG);
}

/** Create or update an article (optionally publishing a reader suggestion). */
export async function saveNews(formData: FormData): Promise<AdminResult<{ id: string }>> {
  return guard<{ id: string }>("moderator", async () => {
    const parsed = newsArticleSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
    const v = parsed.data;
    const db = await createSupabaseServerClient();

    // Cover upload goes first so the article row only ever points at an existing file.
    let coverPath: string | null | undefined; // undefined = keep current
    const cover = formData.get("cover");
    if (cover instanceof File && cover.size > 0) {
      if (cover.size > MAX_COVER_BYTES) return { ok: false, error: "Обложка больше 3 МБ" };
      const bytes = new Uint8Array(await cover.arrayBuffer());
      const mime = sniffImageType(bytes);
      if (!mime) return { ok: false, error: "Обложка: только JPEG, PNG или WEBP" };
      coverPath = `${new Date().getUTCFullYear()}/${randomUUID()}.${mime.split("/")[1].replace("jpeg", "jpg")}`;
      const { error } = await db.storage.from("news-images").upload(coverPath, bytes, { contentType: mime, cacheControl: "31536000" });
      fail(error);
    } else if (v.removeCover) {
      coverPath = null;
    }

    const payload: Record<string, unknown> = {
      id: v.id ?? "",
      slug: v.slug,
      title: v.title,
      summary: v.summary ?? "",
      body: v.body,
      lang: v.lang,
      category_id: v.categoryId ?? "",
      source_name: v.sourceName,
      source_url: v.sourceUrl ?? "",
      cover_alt: v.coverAlt ?? "",
      status: v.status,
      published_at: v.publishedAt ? almatyLocalToIso(v.publishedAt) : "",
      is_important: v.isImportant,
      is_sponsored: v.isSponsored,
    };
    if (coverPath !== undefined) payload.cover_path = coverPath ?? "";

    const { data, error } = await db.rpc("staff_save_news", { p: payload, p_submission_id: v.submissionId ?? null });
    if (error?.code === "23505") return { ok: false, error: "Новость с таким слагом уже есть — измените адрес страницы" };
    fail(error);
    refreshNews();
    revalidatePath("/admin", "layout");
    const message = v.status === "published" ? "Новость опубликована" : "Новость сохранена";
    return { ok: true, data: { id: String(data) }, message };
  });
}

export async function deleteNews(id: string): Promise<AdminResult> {
  return guard("admin", async () => {
    z.uuid().parse(id);
    const db = await createSupabaseServerClient();
    const { data: row } = await db.from("news").select("cover_path").eq("id", id).maybeSingle();
    const { error } = await db.rpc("staff_delete_news", { p_news_id: id });
    fail(error);
    if (row?.cover_path) await db.storage.from("news-images").remove([String(row.cover_path)]);
    refreshNews();
    return { ok: true, message: "Новость удалена" };
  });
}

export async function rejectNewsSubmission(id: string, reason: string): Promise<AdminResult> {
  return guard("moderator", async () => {
    z.uuid().parse(id);
    const r = z.string().trim().min(2, "Укажите причину").max(300).parse(reason);
    const db = await createSupabaseServerClient();
    const { error } = await db.rpc("reject_news_submission", { p_submission_id: id, p_reason: r });
    fail(error);
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Предложение отклонено" };
  });
}

const categorySchema = z.object({
  id: z
    .union([z.literal(""), z.uuid()])
    .optional()
    .transform((v) => (v ? v : undefined)),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,64}$/, "Слаг: латиница, цифры, дефис"),
  name_ru: z.string().trim().min(2).max(60),
  name_kk: z.string().trim().min(2).max(60),
  sort_order: z.coerce.number().int().min(0).max(10000).default(100),
  is_active: z
    .union([z.literal("on"), z.literal("")])
    .optional()
    .transform((v) => v === "on"),
});

export async function saveNewsCategory(formData: FormData): Promise<AdminResult> {
  return guard("admin", async () => {
    const parsed = categorySchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
    const { id, ...row } = parsed.data;
    const db = await createSupabaseServerClient();
    const { error } = id ? await db.from("news_categories").update(row).eq("id", id) : await db.from("news_categories").insert(row);
    if (error?.code === "23505") return { ok: false, error: "Такой слаг уже есть" };
    fail(error);
    refreshNews();
    return { ok: true, message: "Категория сохранена" };
  });
}
