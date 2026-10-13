"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { fail, guard } from "@/lib/server/admin-guard";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient, PUBLIC_DATA_TAG } from "@/lib/supabase/server";
import { PACK_UNITS, sniffImageType } from "@/lib/validation";

export type { AdminResult } from "@/lib/server/admin-guard";

const SOURCE_TYPES = ["admin_check", "store_website", "price_tag_photo", "receipt", "import"] as const;

async function audit(actorId: string, action: string, entityType: string, entityId: string | null, details: Record<string, unknown> = {}) {
  try {
    await createSupabaseServiceClient()
      .from("admin_audit_logs")
      .insert({ actor_id: actorId, action, entity_type: entityType, entity_id: entityId, details });
  } catch (e) {
    console.error("[audit]", e);
  }
}

function refreshPublic() {
  revalidatePath("/", "layout");
  // Cached Supabase reads are shared between pages; expire them so every page sees the change.
  updateTag(PUBLIC_DATA_TAG);
}


// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------
export async function approveSubmission(id: string, as: "verified" | "estimated", note?: string) {
  return guard("moderator", async () => {
    z.uuid().parse(id);
    const db = await createSupabaseServerClient();
    const { error } = await db.rpc("approve_price_submission", { p_submission_id: id, p_as: as, p_note: note?.slice(0, 300) || null });
    fail(error);
    refreshPublic();
    return { ok: true, message: "Цена одобрена" };
  });
}

export async function rejectSubmission(id: string, reason: string) {
  return guard("moderator", async () => {
    z.uuid().parse(id);
    const r = z.string().trim().min(2).max(300).parse(reason);
    const db = await createSupabaseServerClient();
    const { error } = await db.rpc("reject_price_submission", { p_submission_id: id, p_reason: r });
    fail(error);
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Заявка отклонена" };
  });
}

export async function resolveReport(id: string, action: "resolve" | "dismiss", note?: string) {
  return guard("moderator", async () => {
    z.uuid().parse(id);
    const db = await createSupabaseServerClient();
    const { error } = await db.rpc("resolve_report", { p_report_id: id, p_action: action, p_note: note?.slice(0, 300) || null });
    fail(error);
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}

export async function removePrice(verifiedPriceId: string, reason: string) {
  return guard("moderator", async () => {
    z.uuid().parse(verifiedPriceId);
    const db = await createSupabaseServerClient();
    const { error } = await db.rpc("staff_remove_price", { p_verified_price_id: verifiedPriceId, p_reason: reason.slice(0, 300) });
    fail(error);
    refreshPublic();
    return { ok: true, message: "Цена снята с публикации" };
  });
}

// ---------------------------------------------------------------------------
// Prices: manual entry and CSV import
// ---------------------------------------------------------------------------
const priceItemSchema = z
  .object({
    product_id: z.uuid(),
    branch_id: z.uuid(),
    price: z.coerce.number().positive().max(10_000_000),
    status: z.enum(["verified", "estimated"]).default("verified"),
    source_type: z.enum(SOURCE_TYPES).default("admin_check"),
    source_note: z.string().trim().max(300).optional().nullable(),
    source_url: z.string().trim().regex(/^https:\/\//).max(500).optional().nullable(),
    observed_at: z.iso.datetime({ offset: true }).optional(),
    pack_quantity: z.coerce.number().positive().max(100000).optional().nullable(),
    pack_unit: z.enum(PACK_UNITS).optional().nullable(),
    brand_label: z.string().trim().max(80).optional().nullable(),
  })
  .refine((v) => v.status !== "estimated" || !!v.source_note || !!v.source_url, {
    message: "Для ориентировочной цены укажите источник (примечание или ссылку)",
  })
  .refine((v) => (v.pack_quantity == null) === (v.pack_unit == null), { message: "Фасовка: укажите и количество, и единицу" });

export type PriceItemInput = z.input<typeof priceItemSchema>;

export async function savePrices(items: PriceItemInput[]) {
  return guard<{ count: number }>("moderator", async (uid) => {
    if (!Array.isArray(items) || items.length === 0) return { ok: false, error: "Нет изменённых цен" };
    if (items.length > 2000) return { ok: false, error: "Не более 2000 строк за раз" };
    const parsed = items.map((i, idx) => ({ idx, r: priceItemSchema.safeParse(i) }));
    const bad = parsed.filter((p) => !p.r.success);
    if (bad.length) {
      return {
        ok: false,
        error: `Ошибки в строках: ${bad.slice(0, 10).map((b) => b.idx + 1).join(", ")}`,
        details: bad.map((b) => ({ row: b.idx + 1, issues: b.r.error!.issues.map((i) => i.message) })),
      };
    }
    const db = await createSupabaseServerClient();
    const { data, error } = await db.rpc("staff_upsert_prices", { p_items: parsed.map((p) => p.r.data) });
    fail(error);
    await audit(uid, "prices.save", "verified_prices", null, { count: data });
    refreshPublic();
    return { ok: true, data: { count: Number(data) }, message: `Сохранено цен: ${data}` };
  });
}

export type CsvPriceRow = Record<string, string | undefined>;

/**
 * CSV columns: product (slug or barcode), branch (branch slug), price, status (verified|estimated),
 * observed_at (YYYY-MM-DD or ISO), source_type, source_note, source_url, pack_quantity, pack_unit, brand_label.
 * Dry run returns per-row validation; apply writes everything in one transaction.
 */
export async function importPricesCsv(rows: CsvPriceRow[], apply: boolean) {
  return guard<{ valid: number; errors: { row: number; message: string }[] }>("moderator", async (uid) => {
    if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "Файл пуст" };
    if (rows.length > 2000) return { ok: false, error: "Не более 2000 строк за раз" };
    const db = await createSupabaseServerClient();
    const productKeys = [...new Set(rows.map((r) => (r.product ?? "").trim()).filter(Boolean))];
    const branchKeys = [...new Set(rows.map((r) => (r.branch ?? "").trim()).filter(Boolean))];
    const [{ data: bySlug }, { data: byBarcode }, { data: branches }] = await Promise.all([
      db.from("products").select("id, slug").in("slug", productKeys),
      db.from("product_barcodes").select("product_id, barcode").in("barcode", productKeys),
      db.from("store_branches").select("id, slug, stores(is_demo)").in("slug", branchKeys),
    ]);
    const productMap = new Map<string, string>();
    for (const p of bySlug ?? []) productMap.set(String(p.slug), String(p.id));
    for (const b of byBarcode ?? []) productMap.set(String(b.barcode), String(b.product_id));
    const branchMap = new Map<string, string>();
    for (const b of branches ?? []) {
      const store = (Array.isArray(b.stores) ? b.stores[0] : b.stores) as { is_demo: boolean } | null;
      if (!store?.is_demo) branchMap.set(String(b.slug), String(b.id));
    }

    const errors: { row: number; message: string }[] = [];
    const valid: unknown[] = [];
    rows.forEach((r, i) => {
      const row = i + 2; // header is line 1
      const productId = productMap.get((r.product ?? "").trim());
      const branchId = branchMap.get((r.branch ?? "").trim());
      if (!productId) return errors.push({ row, message: `Товар не найден: «${r.product ?? ""}»` });
      if (!branchId) return errors.push({ row, message: `Филиал не найден: «${r.branch ?? ""}»` });
      const observed = (r.observed_at ?? "").trim();
      const observedIso = observed ? (/^\d{4}-\d{2}-\d{2}$/.test(observed) ? `${observed}T12:00:00+05:00` : observed) : undefined;
      const parsed = priceItemSchema.safeParse({
        product_id: productId,
        branch_id: branchId,
        price: (r.price ?? "").replace(",", ".").replace(/\s/g, ""),
        status: r.status?.trim() || "verified",
        source_type: r.source_type?.trim() || "import",
        source_note: r.source_note?.trim() || null,
        source_url: r.source_url?.trim() || null,
        observed_at: observedIso ? new Date(observedIso).toISOString() : undefined,
        pack_quantity: r.pack_quantity?.trim() ? r.pack_quantity.replace(",", ".") : null,
        pack_unit: r.pack_unit?.trim() || null,
        brand_label: r.brand_label?.trim() || null,
      });
      if (!parsed.success) return errors.push({ row, message: parsed.error.issues.map((x) => x.message).join("; ") });
      if (parsed.data.observed_at && new Date(parsed.data.observed_at) > new Date()) {
        return errors.push({ row, message: "Дата наблюдения в будущем" });
      }
      valid.push(parsed.data);
    });

    if (!apply || errors.length > 0) {
      return { ok: true, data: { valid: valid.length, errors }, message: apply ? "Исправьте ошибки и повторите" : "Проверка завершена" };
    }
    const { data, error } = await db.rpc("staff_upsert_prices", { p_items: valid });
    fail(error);
    await audit(uid, "prices.import_csv", "verified_prices", null, { rows: rows.length, imported: data });
    refreshPublic();
    return { ok: true, data: { valid: Number(data), errors: [] }, message: `Импортировано цен: ${data}` };
  });
}

// ---------------------------------------------------------------------------
// Catalog CRUD (admin)
// ---------------------------------------------------------------------------
const slug = z.string().trim().regex(/^[a-z0-9-]{2,96}$/, "Слаг: латиница, цифры и дефис");
const optional = (s: z.ZodTypeAny) => z.preprocess((v) => (v === "" || v === undefined ? null : v), s.nullable());

const productSchema = z
  .object({
    id: z.uuid().optional(),
    slug,
    name_ru: z.string().trim().min(2).max(160),
    name_kk: optional(z.string().trim().min(2).max(160)),
    category_id: z.uuid(),
    brand_name: optional(z.string().trim().min(1).max(80)),
    manufacturer: optional(z.string().trim().max(120)),
    description_ru: optional(z.string().trim().max(2000)),
    description_kk: optional(z.string().trim().max(2000)),
    unit: z.enum(["kg", "l", "pcs"]),
    net_quantity: optional(z.coerce.number().positive().max(100000)),
    net_unit: optional(z.enum(PACK_UNITS)),
    comparison_mode: z.enum(["identical", "analog"]),
    is_weighted: z.coerce.boolean(),
    fat_percent: optional(z.coerce.number().min(0).max(100)),
    specs_verified: z.coerce.boolean(),
    is_active: z.coerce.boolean(),
    popularity: z.coerce.number().int().min(0).max(1_000_000).default(0),
    barcodes: z.string().default(""),
  })
  .refine((v) => (v.net_quantity === null) === (v.net_unit === null), { message: "Фасовка: укажите и количество, и единицу", path: ["net_quantity"] })
  .refine((v) => !v.is_weighted || v.net_quantity === null, { message: "У весового товара нет фиксированной фасовки", path: ["net_quantity"] });

async function ensureBrand(db: Awaited<ReturnType<typeof createSupabaseServerClient>>, name: string | null): Promise<string | null> {
  if (!name) return null;
  const { data: existing } = await db.from("brands").select("id").ilike("name", name).maybeSingle();
  if (existing) return String(existing.id);
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const brandSlug = `${base || "brand"}-${randomUUID().slice(0, 6)}`;
  const { data, error } = await db.from("brands").insert({ name, slug: brandSlug }).select("id").single();
  fail(error);
  return String(data!.id);
}

export async function saveProduct(formData: FormData) {
  return guard<{ id: string }>("admin", async (uid) => {
    const raw = Object.fromEntries(formData.entries());
    const parsed = productSchema.safeParse({
      ...raw,
      is_weighted: raw.is_weighted === "on",
      specs_verified: raw.specs_verified === "on",
      is_active: raw.is_active === "on",
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    const v = parsed.data;
    const barcodes = [...new Set(v.barcodes.split(/[\s,;]+/).map((b) => b.trim()).filter(Boolean))];
    if (barcodes.some((b) => !/^[0-9]{8,14}$/.test(b))) return { ok: false, error: "Штрихкод: 8–14 цифр" };

    const db = await createSupabaseServerClient();
    const brandId = await ensureBrand(db, v.brand_name as string | null);
    const row = {
      slug: v.slug,
      name_ru: v.name_ru,
      name_kk: v.name_kk,
      category_id: v.category_id,
      brand_id: brandId,
      manufacturer: v.manufacturer,
      description_ru: v.description_ru,
      description_kk: v.description_kk,
      unit: v.unit,
      net_quantity: v.net_quantity,
      net_unit: v.net_unit,
      comparison_mode: v.comparison_mode,
      is_weighted: v.is_weighted,
      fat_percent: v.fat_percent,
      specs_verified: v.specs_verified,
      is_active: v.is_active,
      popularity: v.popularity,
    };
    let id = v.id;
    if (id) {
      const { error } = await db.from("products").update(row).eq("id", id);
      fail(error);
    } else {
      const { data, error } = await db.from("products").insert(row).select("id").single();
      if (error?.code === "23505") return { ok: false, error: "Такой товар уже есть (совпадает слаг или название+бренд+фасовка)" };
      fail(error);
      id = String(data!.id);
    }

    // Replace barcodes.
    const { error: delErr } = await db.from("product_barcodes").delete().eq("product_id", id);
    fail(delErr);
    if (barcodes.length) {
      const { error: bcErr } = await db.from("product_barcodes").insert(barcodes.map((barcode) => ({ barcode, product_id: id })));
      if (bcErr?.code === "23505") return { ok: false, error: "Штрихкод уже привязан к другому товару" };
      fail(bcErr);
    }

    // Optional image.
    const image = formData.get("image");
    if (image instanceof File && image.size > 0) {
      if (image.size > 2 * 1024 * 1024) return { ok: false, error: "Фото больше 2 МБ" };
      const bytes = new Uint8Array(await image.arrayBuffer());
      const mime = sniffImageType(bytes);
      if (!mime) return { ok: false, error: "Фото: только JPEG, PNG или WEBP" };
      const path = `products/${id}/${randomUUID()}.${mime.split("/")[1].replace("jpeg", "jpg")}`;
      const { error: upErr } = await db.storage.from("product-images").upload(path, bytes, { contentType: mime, cacheControl: "31536000" });
      fail(upErr);
      const { error: imgErr } = await db.from("products").update({ image_path: path }).eq("id", id);
      fail(imgErr);
    }

    await audit(uid, v.id ? "product.update" : "product.create", "product", id!, { slug: v.slug });
    refreshPublic();
    return { ok: true, data: { id: id! }, message: "Товар сохранён" };
  });
}

export async function bulkProducts(ids: string[], action: "activate" | "deactivate" | "delete") {
  return guard("admin", async (uid) => {
    const clean = z.array(z.uuid()).min(1).max(500).parse(ids);
    const db = await createSupabaseServerClient();
    const { error } =
      action === "delete"
        ? await db.from("products").delete().in("id", clean)
        : await db.from("products").update({ is_active: action === "activate" }).in("id", clean);
    if (error?.code === "23503") return { ok: false, error: "Нельзя удалить товар с историей заявок — деактивируйте его" };
    fail(error);
    await audit(uid, `product.bulk_${action}`, "product", null, { ids: clean });
    refreshPublic();
    return { ok: true, message: `Готово: ${clean.length}` };
  });
}

const categorySchema = z.object({
  id: z.uuid().optional(),
  slug,
  name_ru: z.string().trim().min(2).max(80),
  name_kk: z.string().trim().min(2).max(80),
  icon: z.string().trim().regex(/^[a-z0-9-]{2,40}$/),
  sort_order: z.coerce.number().int().min(0).max(10000),
  is_active: z.coerce.boolean(),
});

export async function saveCategory(formData: FormData) {
  return guard("admin", async (uid) => {
    const raw = Object.fromEntries(formData.entries());
    const parsed = categorySchema.safeParse({ ...raw, id: raw.id || undefined, is_active: raw.is_active === "on" });
    if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    const { id, ...row } = parsed.data;
    const db = await createSupabaseServerClient();
    const { error } = id ? await db.from("product_categories").update(row).eq("id", id) : await db.from("product_categories").insert(row);
    fail(error);
    await audit(uid, id ? "category.update" : "category.create", "category", id ?? null, { slug: row.slug });
    refreshPublic();
    return { ok: true, message: "Категория сохранена" };
  });
}

const storeSchema = z.object({
  id: z.uuid().optional(),
  slug,
  name: z.string().trim().min(1).max(80),
  website: optional(z.string().trim().regex(/^https:\/\//, "Сайт должен начинаться с https://").max(300)),
  verification_status: z.enum(["unverified", "needs_check", "verified"]),
  is_active: z.coerce.boolean(),
  sort_order: z.coerce.number().int().min(0).max(10000),
});

export async function saveStore(formData: FormData) {
  return guard("admin", async (uid) => {
    const raw = Object.fromEntries(formData.entries());
    const parsed = storeSchema.safeParse({ ...raw, id: raw.id || undefined, is_active: raw.is_active === "on" });
    if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    const { id, ...row } = parsed.data;
    const db = await createSupabaseServerClient();
    const { error } = id ? await db.from("stores").update(row).eq("id", id) : await db.from("stores").insert(row);
    fail(error);
    await audit(uid, id ? "store.update" : "store.create", "store", id ?? null, { slug: row.slug });
    refreshPublic();
    return { ok: true, message: "Магазин сохранён" };
  });
}

const branchSchema = z
  .object({
    id: z.uuid().optional(),
    store_id: z.uuid(),
    city_id: z.uuid(),
    slug,
    name: z.string().trim().min(1).max(120),
    address: optional(z.string().trim().max(200)),
    latitude: optional(z.coerce.number().min(-90).max(90)),
    longitude: optional(z.coerce.number().min(-180).max(180)),
    opening_hours: optional(z.string().trim().max(200)),
    phone: optional(z.string().trim().regex(/^\+?[0-9 ()-]{6,24}$/, "Телефон в формате +7 ...")),
    verification_status: z.enum(["unverified", "needs_check", "verified"]),
    is_active: z.coerce.boolean(),
  })
  .refine((v) => (v.latitude === null) === (v.longitude === null), { message: "Укажите обе координаты или ни одной" });

export async function saveBranch(formData: FormData) {
  return guard("admin", async (uid) => {
    const raw = Object.fromEntries(formData.entries());
    const parsed = branchSchema.safeParse({ ...raw, id: raw.id || undefined, is_active: raw.is_active === "on" });
    if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    const { id, ...row } = parsed.data;
    const db = await createSupabaseServerClient();
    const payload = { ...row, last_verified_at: row.verification_status === "verified" ? new Date().toISOString() : null };
    const { error } = id ? await db.from("store_branches").update(payload).eq("id", id) : await db.from("store_branches").insert(payload);
    fail(error);
    await audit(uid, id ? "branch.update" : "branch.create", "store_branch", id ?? null, { slug: row.slug });
    refreshPublic();
    return { ok: true, message: "Филиал сохранён" };
  });
}

// ---------------------------------------------------------------------------
// Users, roles, settings
// ---------------------------------------------------------------------------
export async function setRole(userId: string, role: "moderator" | "admin", grant: boolean) {
  return guard("admin", async () => {
    z.uuid().parse(userId);
    const db = await createSupabaseServerClient();
    const { error } = await db.rpc("admin_set_role", { p_user_id: userId, p_role: role, p_grant: grant });
    fail(error);
    revalidatePath("/admin/users");
    return { ok: true, message: grant ? "Роль выдана" : "Роль снята" };
  });
}

const settingsSchema = z.object({
  price_stale_days: z.coerce.number().int().min(1).max(365),
  anomaly_threshold_pct: z.coerce.number().int().min(5).max(500),
  submission_limit_anon_hour: z.coerce.number().int().min(0).max(1000),
  submission_limit_user_hour: z.coerce.number().int().min(0).max(1000),
  demo_mode: z.coerce.boolean(),
});

export async function saveSettings(formData: FormData) {
  return guard("admin", async (uid) => {
    const raw = Object.fromEntries(formData.entries());
    const parsed = settingsSchema.safeParse({ ...raw, demo_mode: raw.demo_mode === "on" });
    if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    const db = await createSupabaseServerClient();
    for (const [key, value] of Object.entries(parsed.data)) {
      const { error } = await db.from("app_settings").update({ value, updated_by: uid }).eq("key", key);
      fail(error);
    }
    await audit(uid, "settings.update", "app_settings", null, parsed.data);
    refreshPublic();
    return { ok: true, message: "Настройки сохранены" };
  });
}

export async function evidenceUrls(submissionIds: string[]) {
  return guard<Record<string, { url: string; kind: string; redacted: boolean }[]>>("moderator", async () => {
    const ids = z.array(z.uuid()).max(200).parse(submissionIds);
    if (ids.length === 0) return { ok: true, data: {} };
    const db = await createSupabaseServerClient();
    const { data, error } = await db.from("price_evidence").select("submission_id, storage_path, kind, redacted_by_user").in("submission_id", ids);
    fail(error);
    const out: Record<string, { url: string; kind: string; redacted: boolean }[]> = {};
    for (const e of data ?? []) {
      const { data: signed } = await db.storage.from("price-evidence").createSignedUrl(String(e.storage_path), 600);
      if (!signed?.signedUrl) continue;
      (out[String(e.submission_id)] ??= []).push({ url: signed.signedUrl, kind: String(e.kind), redacted: Boolean(e.redacted_by_user) });
    }
    return { ok: true, data: out };
  });
}
