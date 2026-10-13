"use server";

import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { isFeatureEnabled } from "@/config/features";
import { clientHash } from "@/lib/server/request-context";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { MAX_PHOTO_BYTES, businessSuggestionSchema, sniffImageType } from "@/lib/validation";
import type { ActionResult } from "./public";

const CITY_SLUG = "satpaev";
const LIMIT_PER_HOUR = 5;
const LIMIT_PER_DAY = 15;

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

/**
 * Reader suggests a new organisation or a correction to a published one. Stored privately;
 * a moderator checks it and updates the directory (or rejects it). Never published automatically.
 */
export async function suggestBusiness(formData: FormData): Promise<ActionResult> {
  if (!isFeatureEnabled("businesses")) return { ok: false, error: "notFound" };
  if (String(formData.get("website_hp") ?? "").length > 0) return { ok: true }; // honeypot

  const get = (k: string) => formData.get(k) ?? undefined;
  const parsed = businessSuggestionSchema.safeParse({
    kind: get("kind"),
    businessSlug: get("businessSlug"),
    name: get("name"),
    categoryId: get("categoryId"),
    address: get("address"),
    phone: get("phone"),
    website: get("website"),
    openingHours: get("openingHours"),
    details: get("details"),
    isOwner: get("isOwner"),
    contact: get("contact"),
    consent: get("consent"),
  });
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const input = parsed.data;

  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto && photo.size > MAX_PHOTO_BYTES) return { ok: false, error: "photoTooLarge" };

  try {
    const pub = createSupabasePublicClient();
    const service = createSupabaseServiceClient();
    const [user, hash] = await Promise.all([getCurrentUser(), clientHash()]);

    const { data: city } = await pub.from("cities").select("id").eq("slug", CITY_SLUG).maybeSingle();
    if (!city) return { ok: false, error: "server" };
    let businessId: string | null = null;
    if (input.kind === "correction") {
      // Public client: corrections only for organisations readers can see.
      const { data: b } = await pub.from("businesses").select("id").eq("slug", input.businessSlug!).maybeSingle();
      if (!b) return { ok: false, error: "notFound" };
      businessId = String(b.id);
    }
    if (input.categoryId) {
      const { data: cat } = await pub.from("business_categories").select("id").eq("id", input.categoryId).maybeSingle();
      if (!cat) return { ok: false, error: "notFound" };
    }

    const since = (ms: number) => new Date(Date.now() - ms).toISOString();
    const count = async (from: string) => {
      const q = service.from("business_submissions").select("id", { count: "exact", head: true }).gte("created_at", from);
      const { count: n, error } = user ? await q.eq("user_id", user.id) : await q.eq("client_hash", hash);
      if (error) throw error;
      return n ?? 0;
    };
    const [hour, day] = await Promise.all([count(since(3_600_000)), count(since(86_400_000))]);
    if (hour >= LIMIT_PER_HOUR || day >= LIMIT_PER_DAY) return { ok: false, error: "rateLimited" };

    // Same organisation (by name, or the same correction target) from the same device within a day is a duplicate.
    const dupQuery = service
      .from("business_submissions")
      .select("id", { count: "exact", head: true })
      .eq("client_hash", hash)
      .gte("created_at", since(86_400_000));
    const { count: dup } = businessId ? await dupQuery.eq("business_id", businessId) : await dupQuery.eq("name", input.name!);
    if ((dup ?? 0) > 0) return { ok: false, error: "duplicate" };

    let photoPath: string | null = null;
    if (hasPhoto) {
      const bytes = new Uint8Array(await photo.arrayBuffer());
      const mime = sniffImageType(bytes);
      if (!mime) return { ok: false, error: "photoType" };
      const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      const now = new Date();
      photoPath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`;
      const { error: upErr } = await service.storage
        .from("business-submissions")
        .upload(photoPath, bytes, { contentType: mime, upsert: false, cacheControl: "private, max-age=0" });
      if (upErr) throw upErr;
    }

    const { error } = await service.from("business_submissions").insert({
      city_id: city.id,
      kind: input.kind,
      business_id: businessId,
      name: input.kind === "new" ? input.name : null,
      category_id: input.categoryId ?? null,
      address: input.address ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      opening_hours: input.openingHours ?? null,
      details: input.details ?? null,
      is_owner: input.isOwner,
      contact: input.contact ?? null,
      photo_path: photoPath,
      user_id: user?.id ?? null,
      client_hash: hash,
    });
    if (error) {
      if (photoPath) await service.storage.from("business-submissions").remove([photoPath]);
      throw error;
    }
    return { ok: true };
  } catch (e) {
    console.error("[suggestBusiness]", e);
    return { ok: false, error: "server" };
  }
}
