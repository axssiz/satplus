"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { fail, guard, type AdminResult } from "@/lib/server/admin-guard";
import { createSupabaseServerClient, PUBLIC_DATA_TAG } from "@/lib/supabase/server";
import { promotionSchema, sniffImageType } from "@/lib/validation";

const MAX_COVER_BYTES = 3 * 1024 * 1024;

function refreshPromotions() {
  revalidatePath("/", "layout");
  // Cached Supabase reads are shared between pages; expire them so every page sees the change.
  updateTag(PUBLIC_DATA_TAG);
}

/** Create or update a promotion (optionally publishing a reader report). */
export async function savePromotion(formData: FormData): Promise<AdminResult<{ id: string }>> {
  return guard<{ id: string }>("moderator", async () => {
    const parsed = promotionSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
    const v = parsed.data;
    const db = await createSupabaseServerClient();

    let coverPath: string | null | undefined; // undefined = keep current
    const cover = formData.get("cover");
    if (cover instanceof File && cover.size > 0) {
      if (cover.size > MAX_COVER_BYTES) return { ok: false, error: "Изображение больше 3 МБ" };
      const bytes = new Uint8Array(await cover.arrayBuffer());
      const mime = sniffImageType(bytes);
      if (!mime) return { ok: false, error: "Изображение: только JPEG, PNG или WEBP" };
      coverPath = `${new Date().getUTCFullYear()}/${randomUUID()}.${mime.split("/")[1].replace("jpeg", "jpg")}`;
      const { error } = await db.storage.from("promotion-images").upload(coverPath, bytes, { contentType: mime, cacheControl: "31536000" });
      fail(error);
    } else if (v.removeCover) {
      coverPath = null;
    }

    const payload: Record<string, unknown> = {
      id: v.id ?? "",
      slug: v.slug,
      store_id: v.storeId,
      branch_id: v.branchId ?? "",
      category_id: v.categoryId ?? "",
      title: v.title,
      description: v.description ?? "",
      discount_label: v.discountLabel ?? "",
      conditions: v.conditions ?? "",
      starts_on: v.startsOn ?? "",
      ends_on: v.endsOn,
      source_name: v.sourceName,
      source_url: v.sourceUrl ?? "",
      cover_alt: v.coverAlt ?? "",
      status: v.status,
      is_sponsored: v.isSponsored,
    };
    if (coverPath !== undefined) payload.cover_path = coverPath ?? "";

    const { data, error } = await db.rpc("staff_save_promotion", { p: payload, p_submission_id: v.submissionId ?? null });
    if (error?.code === "23505") return { ok: false, error: "Акция с таким слагом уже есть — измените адрес страницы" };
    if (error?.code === "23514") return { ok: false, error: "Проверьте даты и филиал: филиал должен принадлежать выбранному магазину" };
    fail(error);
    refreshPromotions();
    revalidatePath("/admin", "layout");
    return { ok: true, data: { id: String(data) }, message: v.status === "published" ? "Акция опубликована" : "Акция сохранена" };
  });
}

export async function deletePromotion(id: string): Promise<AdminResult> {
  return guard("admin", async () => {
    z.uuid().parse(id);
    const db = await createSupabaseServerClient();
    const { data: row } = await db.from("promotions").select("cover_path").eq("id", id).maybeSingle();
    const { error } = await db.rpc("staff_delete_promotion", { p_id: id });
    fail(error);
    if (row?.cover_path) await db.storage.from("promotion-images").remove([String(row.cover_path)]);
    refreshPromotions();
    return { ok: true, message: "Акция удалена" };
  });
}

export async function rejectPromotionSubmission(id: string, reason: string): Promise<AdminResult> {
  return guard("moderator", async () => {
    z.uuid().parse(id);
    const r = z.string().trim().min(2, "Укажите причину").max(300).parse(reason);
    const db = await createSupabaseServerClient();
    const { error } = await db.rpc("reject_promotion_submission", { p_submission_id: id, p_reason: r });
    fail(error);
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Сообщение отклонено" };
  });
}
