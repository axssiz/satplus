"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { mapOffer, mapProduct, OFFER_SELECT, PRODUCT_SELECT } from "@/lib/data/mappers";
import { checkAnomaly } from "@/lib/pricing/anomaly";
import { comparisonBasis } from "@/lib/pricing/compare";
import { offerUnitPrice } from "@/lib/pricing/units";
import { clientHash } from "@/lib/server/request-context";
import { readSettings } from "@/lib/server/settings";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import type { Pack } from "@/lib/types";
import {
  almatyDate,
  MAX_PHOTO_BYTES,
  priceRequestSchema,
  priceSubmissionSchema,
  reportSchema,
  sniffImageType,
} from "@/lib/validation";

export type ActionError =
  | "validation"
  | "rateLimited"
  | "duplicate"
  | "photoTooLarge"
  | "photoType"
  | "notFound"
  | "server";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: ActionError; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

const honeypotTripped = (fd: FormData) => String(fd.get("website") ?? "").length > 0;

/** Observed timestamp: today -> now; earlier days -> 12:00 Almaty time. */
function observedAtFor(date: string): string {
  const now = new Date();
  if (date === almatyDate(now)) return now.toISOString();
  return new Date(`${date}T12:00:00+05:00`).toISOString();
}

export async function submitPrice(formData: FormData): Promise<ActionResult> {
  if (honeypotTripped(formData)) return { ok: true }; // Silently drop bots.

  const raw = Object.fromEntries(
    ["productId", "branchId", "kind", "price", "packQuantity", "packUnit", "brandLabel", "observedDate", "comment", "consent", "photoKind", "photoRedacted"].map(
      (k) => [k, formData.get(k) ?? undefined],
    ),
  );
  const parsed = priceSubmissionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  const input = parsed.data;

  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto && photo.size > MAX_PHOTO_BYTES) return { ok: false, error: "photoTooLarge" };

  try {
    const pub = createSupabasePublicClient();
    const service = createSupabaseServiceClient();
    const [user, hash, settings] = await Promise.all([getCurrentUser(), clientHash(), readSettings(pub)]);

    // Product and branch must exist and be publicly visible (RLS via the anon client).
    const [{ data: productRow }, { data: branchRow }] = await Promise.all([
      pub.from("products").select(PRODUCT_SELECT).eq("id", input.productId).maybeSingle(),
      pub.from("store_branches").select("id").eq("id", input.branchId).maybeSingle(),
    ]);
    if (!productRow || !branchRow) return { ok: false, error: "notFound" };
    const product = mapProduct(productRow);

    let pack: Pack | null = null;
    if (product.comparisonMode === "analog" && !product.isWeighted) {
      if (!input.packQuantity || !input.packUnit) {
        return { ok: false, error: "validation", fieldErrors: { packQuantity: "packRequired" } };
      }
      pack = { quantity: input.packQuantity, unit: input.packUnit };
      if (offerUnitPrice(product, { price: input.price, pack }) === null) {
        return { ok: false, error: "validation", fieldErrors: { packUnit: "packRequired" } };
      }
    }

    // Rate limiting (per device, and per account when signed in) + duplicate protection.
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const limit = user ? settings.submissionLimitUserHour : settings.submissionLimitAnonHour;
    const countQuery = service.from("price_submissions").select("id", { count: "exact", head: true }).gte("created_at", hourAgo);
    const { count, error: countError } = user
      ? await countQuery.eq("user_id", user.id)
      : await countQuery.eq("client_hash", hash);
    if (countError) throw countError;
    if ((count ?? 0) >= limit) return { ok: false, error: "rateLimited" };

    const tenMinAgo = new Date(Date.now() - 600_000).toISOString();
    const { count: dup } = await service
      .from("price_submissions")
      .select("id", { count: "exact", head: true })
      .eq("client_hash", hash)
      .eq("product_id", product.id)
      .eq("branch_id", input.branchId)
      .gte("created_at", tenMinAgo);
    if ((dup ?? 0) > 0) return { ok: false, error: "duplicate" };

    // Anomaly check against current accepted prices.
    const { data: offerRows } = await pub.from("current_prices").select(OFFER_SELECT).eq("product_id", product.id);
    const offers = (offerRows ?? []).map(mapOffer);
    const byUnit = comparisonBasis(product) === "unit_price";
    const valueOf = (o: { price: number; pack: Pack | null }) => (byUnit ? offerUnitPrice(product, o) : o.price);
    const submitted = valueOf({ price: input.price, pack }) ?? input.price;
    const same = offers.find((o) => o.branchId === input.branchId);
    const others = offers
      .filter((o) => o.branchId !== input.branchId && o.effectiveStatus === "verified")
      .map(valueOf)
      .filter((v): v is number => v !== null);
    const anomaly = checkAnomaly(submitted, same ? valueOf(same) : null, others, settings.anomalyThresholdPct);

    // Optional photo: verify real signature, store privately.
    let evidence: { path: string; mime: string; size: number } | null = null;
    if (hasPhoto) {
      const bytes = new Uint8Array(await photo.arrayBuffer());
      const mime = sniffImageType(bytes);
      if (!mime) return { ok: false, error: "photoType" };
      const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      const now = new Date();
      const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`;
      const { error: upErr } = await service.storage
        .from("price-evidence")
        .upload(path, bytes, { contentType: mime, upsert: false, cacheControl: "private, max-age=0" });
      if (upErr) throw upErr;
      evidence = { path, mime, size: bytes.length };
    }

    const { data: inserted, error: insErr } = await service
      .from("price_submissions")
      .insert({
        product_id: product.id,
        branch_id: input.branchId,
        kind: input.kind,
        price: input.price,
        pack_quantity: pack?.quantity ?? null,
        pack_unit: pack?.unit ?? null,
        brand_label: input.brandLabel ?? null,
        observed_at: observedAtFor(input.observedDate),
        comment: input.comment ?? null,
        user_id: user?.id ?? null,
        client_hash: hash,
        source: "user",
        reference_price: anomaly.referencePrice,
        is_anomalous: anomaly.isAnomalous,
        anomaly_reason: anomaly.reason
          ? `${anomaly.reason}${anomaly.deviationPercent !== null ? ` (${anomaly.deviationPercent}%)` : ""}`
          : null,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      if (evidence) await service.storage.from("price-evidence").remove([evidence.path]);
      throw insErr;
    }

    if (evidence) {
      const { error: evErr } = await service.from("price_evidence").insert({
        submission_id: inserted.id,
        storage_path: evidence.path,
        kind: input.photoKind ?? "price_tag",
        mime_type: evidence.mime,
        size_bytes: evidence.size,
        redacted_by_user: input.photoRedacted === "1",
      });
      if (evErr) {
        await service.storage.from("price-evidence").remove([evidence.path]);
        console.error("[submitPrice] evidence insert failed", evErr.message);
      }
    }
    return { ok: true };
  } catch (e) {
    console.error("[submitPrice]", e);
    return { ok: false, error: "server" };
  }
}

export async function reportError(formData: FormData): Promise<ActionResult> {
  if (honeypotTripped(formData)) return { ok: true };
  const parsed = reportSchema.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    reason: formData.get("reason"),
    message: formData.get("message") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: "validation", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  try {
    const service = createSupabaseServiceClient();
    const [user, hash] = await Promise.all([getCurrentUser(), clientHash()]);
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await service
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("client_hash", hash)
      .gte("created_at", hourAgo);
    if ((count ?? 0) >= 10) return { ok: false, error: "rateLimited" };
    const { error } = await service.from("reports").insert({
      target_type: parsed.data.targetType,
      target_id: parsed.data.targetId,
      reason: parsed.data.reason,
      message: parsed.data.message ?? null,
      reporter_id: user?.id ?? null,
      client_hash: hash,
    });
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error("[reportError]", e);
    return { ok: false, error: "server" };
  }
}

export async function requestPrice(productId: string, slug: string): Promise<ActionResult<{ count: number }>> {
  const parsed = priceRequestSchema.safeParse({ productId });
  if (!parsed.success) return { ok: false, error: "validation" };
  try {
    const service = createSupabaseServiceClient();
    const [user, hash] = await Promise.all([getCurrentUser(), clientHash()]);
    const voterKey = user ? `user:${user.id}` : `anon:${hash.slice(0, 40)}`;
    const { error } = await service
      .from("price_requests")
      .insert({ product_id: parsed.data.productId, voter_key: voterKey, user_id: user?.id ?? null });
    if (error && error.code !== "23505") throw error;
    const { data } = await createSupabasePublicClient().rpc("price_request_counts", { p_product_ids: [parsed.data.productId] });
    const count = Array.isArray(data) && data[0] ? Number(data[0].open_requests) : 0;
    if (/^[a-z0-9-]{2,96}$/.test(slug)) revalidatePath("/[locale]/prices/p/[slug]", "page");
    return { ok: true, data: { count } };
  } catch (e) {
    console.error("[requestPrice]", e);
    return { ok: false, error: "server" };
  }
}

export async function recordView(productId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/.test(productId)) return;
  try {
    await createSupabasePublicClient().rpc("record_product_view", { p_product_id: productId });
  } catch {
    // Analytics must never break the page.
  }
}

/** Products and current prices for the basket / favorites (read-only). */
export async function loadProductsWithOffers(
  ids: string[],
): Promise<ActionResult<{ products: import("@/lib/types").Product[]; offers: import("@/lib/types").PriceOffer[] }>> {
  const clean = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/.test(id)).slice(0, 200);
  if (clean.length === 0) return { ok: true, data: { products: [], offers: [] } };
  try {
    const { getProductsByIds, getOffersForProducts } = await import("@/lib/data/catalog");
    const [products, offers] = await Promise.all([getProductsByIds(clean), getOffersForProducts(clean)]);
    return { ok: true, data: { products: products.filter((p) => p.isActive), offers } };
  } catch (e) {
    console.error("[loadProductsWithOffers]", e);
    return { ok: false, error: "server" };
  }
}
