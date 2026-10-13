import type {
  AcceptedStatus,
  BaseUnit,
  Category,
  ComparisonMode,
  EffectiveStatus,
  HistoryPoint,
  Pack,
  PackUnit,
  PriceOffer,
  Product,
  StoreBranch,
  VerificationStatus,
} from "@/lib/types";

type Row = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v : String(v ?? ""));
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v));
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

function one<T extends Row>(v: unknown): T | null {
  if (Array.isArray(v)) return (v[0] as T) ?? null;
  return (v as T) ?? null;
}

export function packFrom(quantity: unknown, unit: unknown): Pack | null {
  const q = numOrNull(quantity);
  return q && typeof unit === "string" ? { quantity: q, unit: unit as PackUnit } : null;
}

export const PRODUCT_SELECT =
  "id, slug, name_ru, name_kk, category_id, manufacturer, description_ru, description_kk, image_path, unit, net_quantity, net_unit, comparison_mode, is_weighted, fat_percent, specs_verified, popularity, is_active, brands(name), product_barcodes(barcode)";

export function mapProduct(r: Row): Product {
  const brand = one<Row>(r.brands);
  const barcodes = Array.isArray(r.product_barcodes) ? (r.product_barcodes as Row[]).map((b) => str(b.barcode)) : [];
  return {
    id: str(r.id),
    slug: str(r.slug),
    nameRu: str(r.name_ru),
    nameKk: strOrNull(r.name_kk),
    categoryId: str(r.category_id),
    brandName: brand ? strOrNull(brand.name) : null,
    manufacturer: strOrNull(r.manufacturer),
    descriptionRu: strOrNull(r.description_ru),
    descriptionKk: strOrNull(r.description_kk),
    imagePath: strOrNull(r.image_path),
    unit: str(r.unit) as BaseUnit,
    netQuantity: numOrNull(r.net_quantity),
    netUnit: (strOrNull(r.net_unit) as PackUnit | null) ?? null,
    comparisonMode: str(r.comparison_mode) as ComparisonMode,
    isWeighted: Boolean(r.is_weighted),
    fatPercent: numOrNull(r.fat_percent),
    specsVerified: Boolean(r.specs_verified),
    popularity: num(r.popularity ?? 0),
    isActive: r.is_active !== false,
    barcodes,
  };
}

export const CATEGORY_SELECT = "id, slug, name_ru, name_kk, icon, sort_order";

export function mapCategory(r: Row): Category {
  return {
    id: str(r.id),
    slug: str(r.slug),
    nameRu: str(r.name_ru),
    nameKk: str(r.name_kk),
    icon: str(r.icon),
    sortOrder: num(r.sort_order ?? 0),
  };
}

export const OFFER_SELECT =
  "id, product_id, branch_id, branch_slug, branch_name, branch_address, store_slug, store_name, store_logo_path, is_demo, price, status, effective_status, pack_quantity, pack_unit, brand_label, source_type, source_note, source_url, observed_at";

export function mapOffer(r: Row): PriceOffer {
  return {
    id: str(r.id),
    productId: str(r.product_id),
    branchId: str(r.branch_id),
    branchSlug: str(r.branch_slug),
    branchName: str(r.branch_name),
    branchAddress: strOrNull(r.branch_address),
    storeSlug: str(r.store_slug),
    storeName: str(r.store_name),
    storeLogoPath: strOrNull(r.store_logo_path),
    isDemo: Boolean(r.is_demo),
    price: num(r.price),
    status: str(r.status) as AcceptedStatus,
    effectiveStatus: str(r.effective_status) as EffectiveStatus,
    pack: packFrom(r.pack_quantity, r.pack_unit),
    brandLabel: strOrNull(r.brand_label),
    sourceType: str(r.source_type),
    sourceNote: strOrNull(r.source_note),
    sourceUrl: strOrNull(r.source_url),
    observedAt: str(r.observed_at),
  };
}

export function mapHistory(r: Row): HistoryPoint {
  return {
    productId: str(r.product_id),
    branchId: str(r.branch_id),
    price: num(r.price),
    status: str(r.status) as AcceptedStatus,
    pack: packFrom(r.pack_quantity, r.pack_unit),
    observedAt: str(r.observed_at),
    isDemo: Boolean(r.is_demo),
  };
}

export const BRANCH_SELECT =
  "id, slug, name, store_id, address, latitude, longitude, opening_hours, phone, verification_status, last_verified_at, stores!inner(slug, name, logo_path, is_demo, sort_order)";

export function mapBranch(r: Row): StoreBranch {
  const store = one<Row>(r.stores) ?? {};
  return {
    id: str(r.id),
    slug: str(r.slug),
    name: str(r.name),
    storeId: str(r.store_id),
    storeSlug: str(store.slug),
    storeName: str(store.name),
    storeLogoPath: strOrNull(store.logo_path),
    storeIsDemo: Boolean(store.is_demo),
    address: strOrNull(r.address),
    latitude: numOrNull(r.latitude),
    longitude: numOrNull(r.longitude),
    openingHours: strOrNull(r.opening_hours),
    phone: strOrNull(r.phone),
    verificationStatus: str(r.verification_status) as VerificationStatus,
    lastVerifiedAt: strOrNull(r.last_verified_at),
  };
}
