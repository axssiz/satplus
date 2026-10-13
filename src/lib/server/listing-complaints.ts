import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { clientHash } from "@/lib/server/request-context";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { listingComplaintSchema } from "@/lib/validation";

export type ComplaintError = "validation" | "notFound" | "rateLimited" | "duplicate" | "server";
export type ComplaintResult = { ok: true } | { ok: false; error: ComplaintError; fieldErrors?: Record<string, string> };

const COMPLAINTS_PER_DAY = 10;

const TARGETS = {
  service_listing: "service_listings",
  job_listing: "job_listings",
} as const;

/**
 * Stores a reader's complaint about a live listing (services, vacancies). Anyone can report;
 * one device may file 10 complaints a day and one open complaint per listing.
 */
export async function fileListingComplaint(formData: FormData, targetType: keyof typeof TARGETS, label: string): Promise<ComplaintResult> {
  if (String(formData.get("website_hp") ?? "").length > 0) return { ok: true }; // honeypot
  const parsed = listingComplaintSchema.safeParse({
    listingSlug: formData.get("listingSlug") ?? undefined,
    reason: formData.get("reason") ?? undefined,
    message: formData.get("message") ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, error: "validation", fieldErrors };
  }
  const v = parsed.data;
  try {
    const pub = createSupabasePublicClient();
    const service = createSupabaseServiceClient();
    const [user, hash] = await Promise.all([getCurrentUser(), clientHash()]);
    const { data: listing } = await pub.from(TARGETS[targetType]).select("id").eq("slug", v.listingSlug).maybeSingle();
    if (!listing) return { ok: false, error: "notFound" };

    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count: today, error: cErr } = await service
      .from("listing_complaints")
      .select("id", { count: "exact", head: true })
      .eq("client_hash", hash)
      .gte("created_at", since);
    if (cErr) throw cErr;
    if ((today ?? 0) >= COMPLAINTS_PER_DAY) return { ok: false, error: "rateLimited" };
    const { count: dup } = await service
      .from("listing_complaints")
      .select("id", { count: "exact", head: true })
      .eq("client_hash", hash)
      .eq("target_id", listing.id)
      .eq("status", "open");
    if ((dup ?? 0) > 0) return { ok: false, error: "duplicate" };

    const { error } = await service.from("listing_complaints").insert({
      target_type: targetType,
      target_id: listing.id,
      reason: v.reason,
      message: v.message ?? null,
      reporter_id: user?.id ?? null,
      client_hash: hash,
    });
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error(`[${label}]`, e);
    return { ok: false, error: "server" };
  }
}
