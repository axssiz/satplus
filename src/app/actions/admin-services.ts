"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { SERVICE_ICON_NAMES } from "@/components/icons";
import { fail, guard, type AdminResult } from "@/lib/server/admin-guard";
import { createSupabaseServerClient, PUBLIC_DATA_TAG } from "@/lib/supabase/server";
import { MAX_PHOTO_BYTES, sniffImageType, staffServiceListingSchema } from "@/lib/validation";

const BUCKET = "service-images";

function refreshServices() {
  revalidatePath("/", "layout");
  // Cached Supabase reads are shared between pages; expire them so every page sees the change.
  updateTag(PUBLIC_DATA_TAG);
}

/** Approve a pending listing (live for 90 days) or reject it with a reason the owner will see. */
export async function moderateServiceListing(id: string, action: "approve" | "reject", reason?: string): Promise<AdminResult> {
  return guard("moderator", async () => {
    z.uuid().parse(id);
    const r = action === "reject" ? z.string().trim().min(2, "Укажите причину").max(300).parse(reason ?? "") : null;
    const db = await createSupabaseServerClient();
    const { error } = await db.rpc("staff_moderate_service_listing", { p_id: id, p_action: action, p_reason: r });
    if (error?.message.includes("already moderated")) return { ok: false, error: "Объявление уже проверено" };
    fail(error);
    refreshServices();
    revalidatePath("/admin", "layout");
    return { ok: true, message: action === "approve" ? "Объявление опубликовано" : "Объявление отклонено" };
  });
}

/** Staff create a listing from a verified source or correct any listing. */
export async function saveServiceListingStaff(formData: FormData): Promise<AdminResult<{ id: string }>> {
  return guard<{ id: string }>("moderator", async () => {
    const parsed = staffServiceListingSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
    const v = parsed.data;
    if (!v.id && !v.sourceName) return { ok: false, error: "Укажите источник: откуда известны данные мастера" };
    const db = await createSupabaseServerClient();

    let previousCover: string | null = null;
    if (v.id) {
      const { data: row } = await db.from("service_listings").select("cover_path").eq("id", v.id).maybeSingle();
      previousCover = (row?.cover_path as string | null) ?? null;
    }
    let coverPath: string | null | undefined; // undefined = keep current
    const cover = formData.get("cover");
    if (cover instanceof File && cover.size > 0) {
      if (cover.size > MAX_PHOTO_BYTES) return { ok: false, error: "Фото больше 5 МБ" };
      const bytes = new Uint8Array(await cover.arrayBuffer());
      const mime = sniffImageType(bytes);
      if (!mime) return { ok: false, error: "Фото: только JPEG, PNG или WEBP" };
      coverPath = `staff/${randomUUID()}.${mime.split("/")[1].replace("jpeg", "jpg")}`;
      const { error } = await db.storage.from(BUCKET).upload(coverPath, bytes, { contentType: mime, cacheControl: "31536000" });
      fail(error);
    } else if (v.removeCover) {
      coverPath = null;
    }

    const payload: Record<string, unknown> = {
      id: v.id ?? "",
      slug: v.slug,
      category_id: v.categoryId,
      title: v.title,
      provider_name: v.providerName,
      description: v.description,
      price_note: v.priceNote ?? "",
      area: v.area ?? "",
      phone: v.phone,
      has_whatsapp: v.hasWhatsapp,
      link_url: v.linkUrl ?? "",
      cover_alt: v.coverAlt ?? "",
      source_name: v.sourceName ?? "",
      status: v.status,
      expires_on: v.expiresOn ?? "",
      is_sponsored: v.isSponsored,
    };
    if (coverPath !== undefined) payload.cover_path = coverPath ?? "";

    const { data, error } = await db.rpc("staff_save_service_listing", { p: payload });
    if (error) {
      if (coverPath) await db.storage.from(BUCKET).remove([coverPath]);
      if (error.code === "23505") return { ok: false, error: "Объявление с таким слагом уже есть — измените адрес страницы" };
      if (error.code === "23514") return { ok: false, error: "Проверьте телефон, ссылку и источник" };
    }
    fail(error);
    if (coverPath !== undefined && previousCover) await db.storage.from(BUCKET).remove([previousCover]);
    refreshServices();
    revalidatePath("/admin", "layout");
    return { ok: true, data: { id: String(data) }, message: "Объявление сохранено" };
  });
}

export async function deleteServiceListingStaff(id: string): Promise<AdminResult> {
  return guard("admin", async () => {
    z.uuid().parse(id);
    const db = await createSupabaseServerClient();
    const { data, error } = await db.rpc("staff_delete_service_listing", { p_id: id });
    fail(error);
    if (data) await db.storage.from(BUCKET).remove([String(data)]);
    refreshServices();
    return { ok: true, message: "Объявление удалено" };
  });
}

/** Close a complaint; `hide` also takes the listing off the site. */
export async function resolveListingComplaint(id: string, status: "resolved" | "dismissed", note: string, hide: boolean): Promise<AdminResult> {
  return guard("moderator", async () => {
    z.uuid().parse(id);
    z.enum(["resolved", "dismissed"]).parse(status);
    const n = z.string().trim().max(300).parse(note ?? "");
    const db = await createSupabaseServerClient();
    const { error } = await db.rpc("staff_resolve_listing_complaint", { p_id: id, p_status: status, p_note: n, p_hide: hide });
    if (error?.message.includes("already handled")) return { ok: false, error: "Жалоба уже обработана" };
    fail(error);
    if (hide) refreshServices();
    revalidatePath("/admin", "layout");
    return { ok: true, message: hide ? "Объявление скрыто, жалоба закрыта" : status === "resolved" ? "Жалоба закрыта" : "Жалоба отклонена" };
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
  icon: z.string().refine((v) => SERVICE_ICON_NAMES.includes(v), "Выберите иконку из списка"),
  sort_order: z.coerce.number().int().min(0).max(10000).default(100),
  is_active: z
    .union([z.literal("on"), z.literal("")])
    .optional()
    .transform((v) => v === "on"),
});

export async function saveServiceCategory(formData: FormData): Promise<AdminResult> {
  return guard("admin", async () => {
    const parsed = categorySchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте поля" };
    const { id, ...row } = parsed.data;
    const db = await createSupabaseServerClient();
    const { error } = id ? await db.from("service_categories").update(row).eq("id", id) : await db.from("service_categories").insert(row);
    if (error?.code === "23505") return { ok: false, error: "Такой слаг уже есть" };
    fail(error);
    refreshServices();
    return { ok: true, message: "Категория сохранена" };
  });
}
