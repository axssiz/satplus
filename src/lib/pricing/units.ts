import type { BaseUnit, Pack, PackUnit, PriceOffer, Product } from "@/lib/types";

const FACTORS: Record<PackUnit, { base: BaseUnit; factor: number }> = {
  g: { base: "kg", factor: 0.001 },
  kg: { base: "kg", factor: 1 },
  ml: { base: "l", factor: 0.001 },
  l: { base: "l", factor: 1 },
  pcs: { base: "pcs", factor: 1 },
};

export function baseUnitOf(unit: PackUnit): BaseUnit {
  return FACTORS[unit].base;
}

/** Converts a pack to its base unit amount, or null if it cannot be expressed in `base`. */
export function toBaseQuantity(pack: Pack, base: BaseUnit): number | null {
  const f = FACTORS[pack.unit];
  if (!f || f.base !== base || !(pack.quantity > 0)) return null;
  return roundTo(pack.quantity * f.factor, 6);
}

export function packsEqual(a: Pack | null, b: Pack | null): boolean {
  if (!a || !b) return false;
  const base = baseUnitOf(a.unit);
  if (baseUnitOf(b.unit) !== base) return false;
  return toBaseQuantity(a, base) === toBaseQuantity(b, base);
}

/** Price per 1 base unit (kg / l / piece), or null when the pack is unknown or incompatible. */
export function unitPrice(price: number, pack: Pack | null, base: BaseUnit): number | null {
  if (!pack || !(price > 0)) return null;
  const qty = toBaseQuantity(pack, base);
  if (!qty) return null;
  return roundTo(price / qty, 2);
}

export function productPack(product: Pick<Product, "netQuantity" | "netUnit">): Pack | null {
  return product.netQuantity && product.netUnit
    ? { quantity: product.netQuantity, unit: product.netUnit }
    : null;
}

/** The pack a given offer refers to. Identical products use their own pack. */
export function offerPack(product: Product, offer: Pick<PriceOffer, "pack">): Pack | null {
  if (product.isWeighted) return null;
  if (product.comparisonMode === "identical") return productPack(product) ?? offer.pack;
  return offer.pack;
}

/** Price per base unit for an offer: weighted goods are already priced per unit. */
export function offerUnitPrice(product: Product, offer: Pick<PriceOffer, "price" | "pack">): number | null {
  if (product.isWeighted) return roundTo(offer.price, 2);
  return unitPrice(offer.price, offerPack(product, offer), product.unit);
}

export function roundTo(value: number, digits: number): number {
  const m = 10 ** digits;
  return Math.round((value + Number.EPSILON) * m) / m;
}
