"use server";

import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { isFeatureEnabled } from "@/config/features";
import { clientHash } from "@/lib/server/request-context";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { MAX_PHOTO_BYTES, promotionReportSchema, sniffImageType } from "@/lib/validation";
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
 * Reader reports a promotion seen in a store. Stored privately; a moderator checks it and
 * publishes it as a promotion (or rejects it). Never published automatically.
 */
export async function reportPromotion(formData: FormData): Promise<ActionResult> {
  if (!isFeatureEnabled("promotions")) return { ok: false, error: "notFound" };
  if (String(formData.get("website") ?? "").length > 0) return { ok: true }; // honeypot

  const store = String(formData.get("store") ?? "");
  const parsed = promotionReportSchema.safeParse({
    storeSlug: store === "other" ? "" : store,
    storeText: store === "other" ? (formData.get("storeText") ?? "") : undefined,
    title: formData.get("title") ?? "",
    details: formData.get("details") ?? undefined,
    endsOn: formData.get("endsOn") ?? undefined,
    sourceUrl: formData.get("sourceUrl") ?? undefined,
    contact: formData.get("contact") ?? undefined,
    consent: formData.get("consent") ?? undefined,
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
    let storeId: string | null = null;
    if (input.storeSlug) {
      // Public client: only stores visible to readers can be chosen.
      const { data: row } = await pub.from("stores").select("id").eq("slug", input.storeSlug).maybeSingle();
      if (!row) return { ok: false, error: "notFound" };
      storeId = String(row.id);
    }

    const since = (ms: number) => new Date(Date.now() - ms).toISOString();
    const count = async (from: string) => {
      const q = service.from("promotion_submissions").select("id", { count: "exact", head: true }).gte("created_at", from);
      const { count: n, error } = user ? await q.eq("user_id", user.id) : await q.eq("client_hash", hash);
      if (error) throw error;
      return n ?? 0;
    };
    const [hour, day] = await Promise.all([count(since(3_600_000)), count(since(86_400_000))]);
    if (hour >= LIMIT_PER_HOUR || day >= LIMIT_PER_DAY) return { ok: false, error: "rateLimited" };

    // The same promotion title from the same device within a day is a duplicate.
    const { count: dup } = await service
      .from("promotion_submissions")
      .select("id", { count: "exact", head: true })
      .eq("client_hash", hash)
      .eq("title", input.title)
      .gte("created_at", since(86_400_000));
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
        .from("promotion-submissions")
        .upload(photoPath, bytes, { contentType: mime, upsert: false, cacheControl: "private, max-age=0" });
      if (upErr) throw upErr;
    }

    const { error } = await service.from("promotion_submissions").insert({
      city_id: city.id,
      store_id: storeId,
      store_text: storeId ? null : (input.storeText ?? null),
      title: input.title,
      details: input.details ?? null,
      ends_on: input.endsOn ?? null,
      source_url: input.sourceUrl ?? null,
      contact: input.contact ?? null,
      photo_path: photoPath,
      user_id: user?.id ?? null,
      client_hash: hash,
    });
    if (error) {
      if (photoPath) await service.storage.from("promotion-submissions").remove([photoPath]);
      throw error;
    }
    return { ok: true };
  } catch (e) {
    console.error("[reportPromotion]", e);
    return { ok: false, error: "server" };
  }
}
