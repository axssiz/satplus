import type { Pack, PriceOffer, Product } from "@/lib/types";
import { comparisonBasis } from "./compare";
import { offerUnitPrice, packsEqual, productPack, roundTo } from "./units";

export type BasketItem = {
  productId: string;
  /**
   * Quantity:
   * - exact packaged product: number of packs;
   * - weighted product: kg;
   * - analog product with a chosen pack: number of packs of that size;
   * - analog product with "any pack": base units (kg / l / pcs), costed by price per unit.
   */
  quantity: number;
  /** Only for analog products: compare only offers with this exact pack. */
  pack?: Pack | null;
};

export type BasketLine = {
  productId: string;
  offerId: string;
  branchId: string;
  cost: number;
  /** True when the cost is derived from price per unit (packs on the shelf may differ). */
  approximate: boolean;
  observedAt: string;
};

export type StoreBasket = {
  branchId: string;
  branchSlug: string;
  branchName: string;
  storeName: string;
  isDemo: boolean;
  /** Sum of the items this store has a fresh verified price for. */
  total: number;
  complete: boolean;
  lines: BasketLine[];
  missing: string[];
  oldestObservedAt: string | null;
};

export type SplitPlan = {
  total: number;
  lines: BasketLine[];
  /** Items no store has a fresh verified price for. */
  missing: string[];
  complete: boolean;
  storeCount: number;
  branchIds: string[];
};

export type BasketStatus = "empty" | "no_data" | "partial" | "complete";

export type BasketComparison = {
  status: BasketStatus;
  stores: StoreBasket[];
  cheapestComplete: StoreBasket | null;
  mostExpensiveComplete: StoreBasket | null;
  /** Difference between the most and least expensive complete baskets. */
  spread: number | null;
  split: SplitPlan;
  /** How much the split plan saves compared with the cheapest single complete store. */
  savings: number | null;
  oldestObservedAt: string | null;
};

/** Cost of one basket item at one offer, or null if this offer cannot be used for the item. */
export function lineCost(product: Product, item: BasketItem, offer: PriceOffer): { cost: number; approximate: boolean } | null {
  if (offer.effectiveStatus !== "verified" || offer.productId !== product.id) return null;
  if (!(item.quantity > 0)) return null;

  if (product.isWeighted) {
    return { cost: roundTo(offer.price * item.quantity, 2), approximate: false };
  }
  if (comparisonBasis(product) === "price") {
    const own = productPack(product);
    if (own && offer.pack && !packsEqual(own, offer.pack)) return null;
    return { cost: roundTo(offer.price * item.quantity, 2), approximate: false };
  }
  // analog
  if (item.pack) {
    if (!packsEqual(item.pack, offer.pack)) return null;
    return { cost: roundTo(offer.price * item.quantity, 2), approximate: false };
  }
  const unit = offerUnitPrice(product, offer);
  if (unit === null) return null;
  return { cost: roundTo(unit * item.quantity, 2), approximate: true };
}

const minIso = (a: string | null, b: string) => (a === null || b < a ? b : a);

/**
 * Compares a shopping basket across store branches. Missing items are never treated as free:
 * a store is "complete" only when it has a fresh verified price for every item.
 */
export function compareBasket(items: BasketItem[], products: Product[], offers: PriceOffer[]): BasketComparison {
  const productById = new Map(products.map((p) => [p.id, p]));
  const validItems = items.filter((i) => i.quantity > 0 && productById.has(i.productId));
  const emptySplit: SplitPlan = { total: 0, lines: [], missing: [], complete: false, storeCount: 0, branchIds: [] };

  if (validItems.length === 0) {
    return {
      status: "empty",
      stores: [],
      cheapestComplete: null,
      mostExpensiveComplete: null,
      spread: null,
      split: emptySplit,
      savings: null,
      oldestObservedAt: null,
    };
  }

  // Group usable offers by branch.
  const branches = new Map<string, StoreBasket>();
  const bestPerItem = new Map<string, BasketLine>();

  for (const item of validItems) {
    const product = productById.get(item.productId)!;
    for (const offer of offers) {
      if (offer.productId !== item.productId) continue;
      const c = lineCost(product, item, offer);
      if (!c) continue;
      let store = branches.get(offer.branchId);
      if (!store) {
        store = {
          branchId: offer.branchId,
          branchSlug: offer.branchSlug,
          branchName: offer.branchName,
          storeName: offer.storeName,
          isDemo: offer.isDemo,
          total: 0,
          complete: false,
          lines: [],
          missing: [],
          oldestObservedAt: null,
        };
        branches.set(offer.branchId, store);
      }
      // One offer per product per branch exists, but guard against duplicates: keep the cheaper.
      const existing = store.lines.find((l) => l.productId === item.productId);
      const line: BasketLine = {
        productId: item.productId,
        offerId: offer.id,
        branchId: offer.branchId,
        cost: c.cost,
        approximate: c.approximate,
        observedAt: offer.observedAt,
      };
      if (!existing) store.lines.push(line);
      else if (line.cost < existing.cost) Object.assign(existing, line);

      const best = bestPerItem.get(item.productId);
      if (!best || line.cost < best.cost || (line.cost === best.cost && line.observedAt > best.observedAt)) {
        bestPerItem.set(item.productId, line);
      }
    }
  }

  const stores = [...branches.values()].map((s) => {
    const covered = new Set(s.lines.map((l) => l.productId));
    s.missing = validItems.filter((i) => !covered.has(i.productId)).map((i) => i.productId);
    s.complete = s.missing.length === 0;
    s.total = roundTo(s.lines.reduce((sum, l) => sum + l.cost, 0), 2);
    s.oldestObservedAt = s.lines.reduce<string | null>((acc, l) => minIso(acc, l.observedAt), null);
    return s;
  });

  stores.sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    if (!a.complete && a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
    return a.total - b.total || a.storeName.localeCompare(b.storeName);
  });

  const complete = stores.filter((s) => s.complete);
  const cheapestComplete = complete[0] ?? null;
  const mostExpensiveComplete = complete.length ? complete[complete.length - 1] : null;
  const spread =
    cheapestComplete && mostExpensiveComplete && complete.length > 1
      ? roundTo(mostExpensiveComplete.total - cheapestComplete.total, 2)
      : null;

  const splitLines = validItems.map((i) => bestPerItem.get(i.productId)).filter((l): l is BasketLine => !!l);
  const splitMissing = validItems.filter((i) => !bestPerItem.has(i.productId)).map((i) => i.productId);
  const branchIds = [...new Set(splitLines.map((l) => l.branchId))];
  const split: SplitPlan = {
    total: roundTo(splitLines.reduce((sum, l) => sum + l.cost, 0), 2),
    lines: splitLines,
    missing: splitMissing,
    complete: splitMissing.length === 0,
    storeCount: branchIds.length,
    branchIds,
  };

  const savings =
    cheapestComplete && split.complete ? Math.max(0, roundTo(cheapestComplete.total - split.total, 2)) : null;

  const status: BasketStatus =
    stores.length === 0 ? "no_data" : cheapestComplete || split.complete ? "complete" : "partial";

  const oldestObservedAt = splitLines.reduce<string | null>((acc, l) => minIso(acc, l.observedAt), null);

  return { status, stores, cheapestComplete, mostExpensiveComplete, spread, split, savings, oldestObservedAt };
}
