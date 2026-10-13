"use server";

import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { isFeatureEnabled } from "@/config/features";
import { clientHash } from "@/lib/server/request-context";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { MAX_PHOTO_BYTES, newsSuggestionSchema, sniffImageType } from "@/lib/validation";
import type { ActionResult } from "./public";

const CITY_SLUG = "satpaev";
const LIMIT_PER_HOUR = 3;
const LIMIT_PER_DAY = 10;

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

/**
 * Reader suggests a news item. It is stored privately and never published automatically:
 * a moderator turns it into an article (or rejects it) in the admin panel.
 */
export async function suggestNews(formData: FormData): Promise<ActionResult> {
  if (!isFeatureEnabled("news")) return { ok: false, error: "notFound" };
  if (String(formData.get("website") ?? "").length > 0) return { ok: true }; // honeypot

  const parsed = newsSuggestionSchema.safeParse({
    title: formData.get("title") ?? "",
    body: formData.get("body") ?? "",
    categoryId: formData.get("categoryId") ?? undefined,
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
    if (input.categoryId) {
      const { data: cat } = await pub.from("news_categories").select("id").eq("id", input.categoryId).maybeSingle();
      if (!cat) return { ok: false, error: "notFound" };
    }

    // Rate limits per device (and per account when signed in).
    const since = (ms: number) => new Date(Date.now() - ms).toISOString();
    const count = async (from: string) => {
      const q = service.from("news_submissions").select("id", { count: "exact", head: true }).gte("created_at", from);
      const { count: n, error } = user ? await q.eq("user_id", user.id) : await q.eq("client_hash", hash);
      if (error) throw error;
      return n ?? 0;
    };
    const [hour, day] = await Promise.all([count(since(3_600_000)), count(since(86_400_000))]);
    if (hour >= LIMIT_PER_HOUR || day >= LIMIT_PER_DAY) return { ok: false, error: "rateLimited" };

    // Same title from the same device within a day is a duplicate.
    const { count: dup } = await service
      .from("news_submissions")
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
        .from("news-submissions")
        .upload(photoPath, bytes, { contentType: mime, upsert: false, cacheControl: "private, max-age=0" });
      if (upErr) throw upErr;
    }

    const { error } = await service.from("news_submissions").insert({
      city_id: city.id,
      category_id: input.categoryId ?? null,
      title: input.title,
      body: input.body,
      source_url: input.sourceUrl ?? null,
      contact: input.contact ?? null,
      photo_path: photoPath,
      user_id: user?.id ?? null,
      client_hash: hash,
    });
    if (error) {
      if (photoPath) await service.storage.from("news-submissions").remove([photoPath]);
      throw error;
    }
    return { ok: true };
  } catch (e) {
    console.error("[suggestNews]", e);
    return { ok: false, error: "server" };
  }
}
