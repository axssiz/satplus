"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const safeNext = (v: unknown) => (typeof v === "string" && /^\/[a-zA-Z0-9/_-]*$/.test(v) && !v.startsWith("//") ? v : "/account");

export async function sendMagicLink(formData: FormData): Promise<Result> {
  const email = z.email().max(254).safeParse(String(formData.get("email") ?? "").trim());
  if (!email.success) return { ok: false, error: "email" };
  const next = safeNext(formData.get("next"));
  try {
    const db = await createSupabaseServerClient();
    const { error } = await db.auth.signInWithOtp({
      email: email.data,
      options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
    });
    if (error) {
      console.error("[sendMagicLink]", error.message);
      return { ok: false, error: "send" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[sendMagicLink]", e);
    return { ok: false, error: "send" };
  }
}

export async function signOut(): Promise<void> {
  const db = await createSupabaseServerClient();
  await db.auth.signOut();
  revalidatePath("/", "layout");
}

export async function updateDisplayName(formData: FormData): Promise<Result> {
  const parsed = z.string().trim().min(2).max(40).safeParse(String(formData.get("displayName") ?? ""));
  if (!parsed.success) return { ok: false, error: "validation" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const db = await createSupabaseServerClient();
  const { error } = await db.from("profiles").update({ display_name: parsed.data }).eq("id", user.id);
  if (error) return { ok: false, error: "server" };
  revalidatePath("/[locale]/account", "page");
  return { ok: true };
}

/** Deletes the caller's personal data, evidence photos and finally the auth account. */
export async function deleteMyData(): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  try {
    const db = await createSupabaseServerClient();
    const service = createSupabaseServiceClient();
    // Reader photos attached to news suggestions are removed before the rows are deleted.
    const { data: newsPhotos } = await service
      .from("news_submissions")
      .select("photo_path")
      .eq("user_id", user.id)
      .neq("status", "approved")
      .not("photo_path", "is", null);
    const newsPaths = (newsPhotos ?? []).map((r) => String(r.photo_path));
    if (newsPaths.length) await service.storage.from("news-submissions").remove(newsPaths);
    // Same for photos attached to promotion reports.
    const { data: promoPhotos } = await service
      .from("promotion_submissions")
      .select("photo_path")
      .eq("user_id", user.id)
      .neq("status", "approved")
      .not("photo_path", "is", null);
    const promoPaths = (promoPhotos ?? []).map((r) => String(r.photo_path));
    if (promoPaths.length) await service.storage.from("promotion-submissions").remove(promoPaths);
    // And for photos attached to organisation suggestions.
    const { data: bizPhotos } = await service
      .from("business_submissions")
      .select("photo_path")
      .eq("user_id", user.id)
      .neq("status", "approved")
      .not("photo_path", "is", null);
    const bizPaths = (bizPhotos ?? []).map((r) => String(r.photo_path));
    if (bizPaths.length) await service.storage.from("business-submissions").remove(bizPaths);
    // Service listings are deleted with the account, so their photos go too.
    const { data: svcPhotos } = await service.from("service_listings").select("cover_path").eq("owner_id", user.id).not("cover_path", "is", null);
    const svcPaths = (svcPhotos ?? []).map((r) => String(r.cover_path));
    if (svcPaths.length) await service.storage.from("service-images").remove(svcPaths);
    const { data: paths, error } = await db.rpc("delete_my_data");
    if (error) throw error;
    const list = (paths as string[] | null) ?? [];
    if (list.length) await service.storage.from("price-evidence").remove(list);
    const { error: delErr } = await service.auth.admin.deleteUser(user.id);
    if (delErr) throw delErr;
    await db.auth.signOut();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    console.error("[deleteMyData]", e);
    return { ok: false, error: "server" };
  }
}
