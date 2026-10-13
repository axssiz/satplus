import type { PriceOffer, Product } from "@/lib/types";

export function product(over: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "p1",
    nameRu: "Товар",
    nameKk: null,
    categoryId: "c1",
    brandName: null,
    manufacturer: null,
    descriptionRu: null,
    descriptionKk: null,
    imagePath: null,
    unit: "l",
    netQuantity: null,
    netUnit: null,
    comparisonMode: "analog",
    isWeighted: false,
    fatPercent: null,
    specsVerified: false,
    popularity: 0,
    isActive: true,
    barcodes: [],
    ...over,
  };
}

let seq = 0;
export function offer(over: Partial<PriceOffer> = {}): PriceOffer {
  seq++;
  const branch = over.branchId ?? `b${seq}`;
  return {
    id: `o${seq}`,
    productId: "p1",
    branchId: branch,
    branchSlug: branch,
    branchName: `Branch ${branch}`,
    branchAddress: null,
    storeSlug: `s-${branch}`,
    storeName: `Store ${branch}`,
    storeLogoPath: null,
    isDemo: false,
    price: 100,
    status: "verified",
    effectiveStatus: "verified",
    pack: null,
    brandLabel: null,
    sourceType: "admin_check",
    sourceNote: null,
    sourceUrl: null,
    observedAt: "2026-10-10T10:00:00.000Z",
    ...over,
  };
}
