"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { isFeatureEnabled } from "@/config/features";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/news/text";
import { fileListingComplaint } from "@/lib/server/listing-complaints";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient, PUBLIC_DATA_TAG } from "@/lib/supabase/server";
import { MAX_PHOTO_BYTES, serviceListingSchema, sniffImageType } from "@/lib/validation";

export type ServiceActionError =
  | "validation"
  | "auth"
  | "activeLimit"
  | "dailyLimit"
  | "photoTooLarge"
  | "photoType"
  | "notFound"
  | "renewTooEarly"
  | "rateLimited"
  | "duplicate"
  | "server";

export type ServiceActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: ServiceActionError; fieldErrors?: Record<string, string> };

const BUCKET = "service-images";

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

/** Maps the RAISE messages of the database functions to form errors. */
function dbError(message: string | undefined): ServiceActionError | null {
  if (!message) return null;
  if (message.includes("service_active_limit")) return "activeLimit";
  if (message.includes("service_daily_limit")) return "dailyLimit";
  if (message.includes("service_renew_too_early")) return "renewTooEarly";
  if (message.includes("not found")) return "notFound";
  if (message.includes("not authenticated")) return "auth";
  return null;
}

function refresh() {
  revalidatePath("/", "layout");
  updateTag(PUBLIC_DATA_TAG);
}

function parseListing(formData: FormData) {
  const get = (k: string) => formData.get(k) ?? undefined;
  return serviceListingSchema.safeParse({
    id: get("id"),
    categoryId: get("categoryId"),
    title: get("title"),
    providerName: get("providerName"),
    description: get("description"),
    priceNote: get("priceNote"),
    area: get("area"),
    phone: get("phone"),
    hasWhatsapp: get("hasWhatsapp"),
    linkUrl: get("linkUrl"),
    removeCover: get("removeCover"),
    consent: get("consent"),
  });
}

/** Stores an already re-encoded photo (the form strips metadata) under the owner's folder. */
async function uploadPhoto(formData: FormData, userId: string): Promise<{ path: string | null } | { error: ServiceActionError }> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { path: null };
  if (photo.size > MAX_PHOTO_BYTES) return { error: "photoTooLarge" };
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const mime = sniffImageType(bytes);
  if (!mime) return { error: "photoType" };
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${randomUUID()}.${ext}`;
  const { error } = await createSupabaseServiceClient()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false, cacheControl: "31536000" });
  if (error) throw error;
  return { path };
}

async function removePhoto(path: string | null | undefined) {
  if (path) await createSupabaseServiceClient().storage.from(BUCKET).remove([path]);
}

/** A signed-in provider submits a new listing or edits their own (both go to moderation). */
export async function saveServiceListing(formData: FormData): Promise<ServiceActionResult<{ id: string }>> {
  if (!isFeatureEnabled("services")) return { ok: false, error: "notFound" };
  const parsed = parseListing(formData);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const v = parsed.data;

  let uploaded: string | null = null;
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "auth" };
    const db = await createSupabaseServerClient();

    let previousCover: string | null = null;
    if (v.id) {
      const { data: own } = await db.from("service_listings").select("cover_path").eq("id", v.id).eq("owner_id", user.id).maybeSingle();
      if (!own) return { ok: false, error: "notFound" };
      previousCover = (own.cover_path as string | null) ?? null;
    }

    const up = await uploadPhoto(formData, user.id);
    if ("error" in up) return { ok: false, error: up.error };
    uploaded = up.path;

    const payload: Record<string, unknown> = {
      slug: slugify(v.title, 100) || "usluga",
      category_id: v.categoryId,
      title: v.title,
      provider_name: v.providerName,
      description: v.description,
      price_note: v.priceNote ?? "",
      area: v.area ?? "",
      phone: v.phone,
      has_whatsapp: v.hasWhatsapp,
      link_url: v.linkUrl ?? "",
      cover_alt: v.title,
    };
    const coverChanged = uploaded !== null || (v.removeCover && previousCover !== null);
    if (coverChanged || !v.id) payload.cover_path = uploaded ?? "";

    const { data, error } = v.id
      ? await db.rpc("update_my_service_listing", { p_id: v.id, p: payload })
      : await db.rpc("submit_service_listing", { p: payload });
    if (error) {
      await removePhoto(uploaded);
      const mapped = dbError(error.message);
      if (mapped) return { ok: false, error: mapped };
      if (error.code === "23514") return { ok: false, error: "validation" };
      throw error;
    }
    if (v.id && coverChanged) await removePhoto(previousCover);
    refresh();
    return { ok: true, data: { id: v.id ?? String(data) } };
  } catch (e) {
    console.error("[saveServiceListing]", e);
    await removePhoto(uploaded).catch(() => undefined);
    return { ok: false, error: "server" };
  }
}

/** Owner actions from «Мои объявления». */
export async function myServiceListingAction(id: string, action: "archive" | "restore" | "renew" | "delete"): Promise<ServiceActionResult> {
  if (!z.uuid().safeParse(id).success || !["archive", "restore", "renew", "delete"].includes(action)) return { ok: false, error: "validation" };
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "auth" };
    const db = await createSupabaseServerClient();
    if (action === "delete") {
      const { data, error } = await db.rpc("delete_my_service_listing", { p_id: id });
      if (error) {
        const mapped = dbError(error.message);
        if (mapped) return { ok: false, error: mapped };
        throw error;
      }
      await removePhoto(data as string | null);
    } else {
      const { error } = await db.rpc("my_service_listing_action", { p_id: id, p_action: action });
      if (error) {
        const mapped = dbError(error.message);
        if (mapped) return { ok: false, error: mapped };
        throw error;
      }
    }
    refresh();
    return { ok: true };
  } catch (e) {
    console.error("[myServiceListingAction]", e);
    return { ok: false, error: "server" };
  }
}

/** Anyone can report a live listing; moderators review complaints in the admin panel. */
export async function reportServiceListing(formData: FormData): Promise<ServiceActionResult> {
  if (!isFeatureEnabled("services")) return { ok: false, error: "notFound" };
  return fileListingComplaint(formData, "service_listing", "reportServiceListing");
}
