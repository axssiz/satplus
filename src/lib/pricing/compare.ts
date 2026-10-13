import type { PriceOffer, Product } from "@/lib/types";
import { offerUnitPrice, packsEqual, productPack, roundTo } from "./units";

export type ComparableBy = "price" | "unit_price";

export type RankedOffer = PriceOffer & {
  /** Value used for ranking: the price itself, or price per base unit. */
  comparableValue: number;
  unitPrice: number | null;
  isBest: boolean;
};

export type OfferSummary = {
  comparableBy: ComparableBy;
  /** Fresh verified offers only, cheapest first. The only offers used for "where is it cheaper". */
  ranked: RankedOffer[];
  /** Estimated prices: shown with a label, never ranked. */
  estimated: PriceOffer[];
  /** Prices older than the stale threshold: shown as outdated, never ranked. */
  stale: PriceOffer[];
  /** Verified offers that cannot be compared (unknown or mismatched pack). */
  incomparable: PriceOffer[];
  min: RankedOffer | null;
  max: RankedOffer | null;
  spread: number | null;
  spreadPercent: number | null;
  lastVerifiedAt: string | null;
};

/**
 * How offers for one product are compared:
 * - identical, packaged: by price, but only offers for the very same pack;
 * - weighted (per kg): by price per kg;
 * - analog (different brands/packs): by price per base unit, offers without a known pack are excluded.
 */
export function comparisonBasis(product: Product): ComparableBy {
  if (product.isWeighted) return "price";
  return product.comparisonMode === "identical" ? "price" : "unit_price";
}

export function summarizeOffers(product: Product, offers: PriceOffer[]): OfferSummary {
  const comparableBy = comparisonBasis(product);
  const own = offers.filter((o) => o.productId === product.id);
  const estimated = own.filter((o) => o.effectiveStatus === "estimated");
  const stale = own.filter((o) => o.effectiveStatus === "stale");
  const fresh = own.filter((o) => o.effectiveStatus === "verified");

  const ranked: RankedOffer[] = [];
  const incomparable: PriceOffer[] = [];
  const ownPack = productPack(product);

  for (const offer of fresh) {
    const unit = offerUnitPrice(product, offer);
    if (comparableBy === "price") {
      // For an exact SKU an offer that names a different pack is a different product.
      if (!product.isWeighted && ownPack && offer.pack && !packsEqual(ownPack, offer.pack)) {
        incomparable.push(offer);
        continue;
      }
      ranked.push({ ...offer, comparableValue: offer.price, unitPrice: unit, isBest: false });
    } else if (unit === null) {
      incomparable.push(offer);
    } else {
      ranked.push({ ...offer, comparableValue: unit, unitPrice: unit, isBest: false });
    }
  }

  ranked.sort(
    (a, b) =>
      a.comparableValue - b.comparableValue ||
      b.observedAt.localeCompare(a.observedAt) ||
      a.storeName.localeCompare(b.storeName),
  );

  const min = ranked[0] ?? null;
  const max = ranked.length ? ranked[ranked.length - 1] : null;
  if (min) for (const r of ranked) r.isBest = r.comparableValue === min.comparableValue;

  const spread = min && max && ranked.length > 1 ? roundTo(max.comparableValue - min.comparableValue, 2) : null;
  const spreadPercent =
    spread !== null && min && min.comparableValue > 0 ? roundTo((spread / min.comparableValue) * 100, 1) : null;

  const lastVerifiedAt = fresh.reduce<string | null>(
    (acc, o) => (acc === null || o.observedAt > acc ? o.observedAt : acc),
    null,
  );

  return { comparableBy, ranked, estimated, stale, incomparable, min, max, spread, spreadPercent, lastVerifiedAt };
}

/** Cheapest fresh verified offer per product, for catalog cards. */
export function bestOffersByProduct(products: Product[], offers: PriceOffer[]) {
  const byProduct = new Map<string, PriceOffer[]>();
  for (const o of offers) {
    const list = byProduct.get(o.productId);
    if (list) list.push(o);
    else byProduct.set(o.productId, [o]);
  }
  const result = new Map<string, OfferSummary>();
  for (const p of products) result.set(p.id, summarizeOffers(p, byProduct.get(p.id) ?? []));
  return result;
}
