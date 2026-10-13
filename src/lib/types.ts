export type BaseUnit = "kg" | "l" | "pcs";
export type PackUnit = "g" | "kg" | "ml" | "l" | "pcs";
export type ComparisonMode = "identical" | "analog";

/** Status of an accepted price in the catalog. */
export type AcceptedStatus = "verified" | "estimated";
/** Status shown to users: accepted prices can additionally be "stale". */
export type EffectiveStatus = AcceptedStatus | "stale";
/** Full lifecycle, including moderation states of submissions. */
export type PriceStatus = EffectiveStatus | "pending" | "rejected";

export type VerificationStatus = "unverified" | "needs_check" | "verified";

export type Category = {
  id: string;
  slug: string;
  nameRu: string;
  nameKk: string;
  icon: string;
  sortOrder: number;
};

export type Product = {
  id: string;
  slug: string;
  nameRu: string;
  nameKk: string | null;
  categoryId: string;
  brandName: string | null;
  manufacturer: string | null;
  descriptionRu: string | null;
  descriptionKk: string | null;
  imagePath: string | null;
  unit: BaseUnit;
  netQuantity: number | null;
  netUnit: PackUnit | null;
  comparisonMode: ComparisonMode;
  isWeighted: boolean;
  fatPercent: number | null;
  specsVerified: boolean;
  popularity: number;
  isActive: boolean;
  barcodes: string[];
};

export type Pack = { quantity: number; unit: PackUnit };

export type PriceOffer = {
  id: string;
  productId: string;
  branchId: string;
  branchSlug: string;
  branchName: string;
  branchAddress: string | null;
  storeSlug: string;
  storeName: string;
  storeLogoPath: string | null;
  isDemo: boolean;
  price: number;
  status: AcceptedStatus;
  effectiveStatus: EffectiveStatus;
  pack: Pack | null;
  brandLabel: string | null;
  sourceType: string;
  sourceNote: string | null;
  sourceUrl: string | null;
  observedAt: string;
};

export type HistoryPoint = {
  productId: string;
  branchId: string;
  price: number;
  status: AcceptedStatus;
  pack: Pack | null;
  observedAt: string;
  isDemo: boolean;
};

export type StoreBranch = {
  id: string;
  slug: string;
  name: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  storeLogoPath: string | null;
  storeIsDemo: boolean;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  openingHours: string | null;
  phone: string | null;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string | null;
};
