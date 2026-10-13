import { describe, expect, it } from "vitest";
import { summarizeOffers } from "../compare";
import { offer, product } from "./fixtures";

describe("identical product comparison", () => {
  const milk = product({ id: "milk", comparisonMode: "identical", netQuantity: 1, netUnit: "l" });

  it("ranks only fresh verified prices, cheapest first, and marks ties as best", () => {
    const s = summarizeOffers(milk, [
      offer({ productId: "milk", price: 520 }),
      offer({ productId: "milk", price: 480 }),
      offer({ productId: "milk", price: 480 }),
      offer({ productId: "milk", price: 300, status: "estimated", effectiveStatus: "estimated" }),
      offer({ productId: "milk", price: 200, effectiveStatus: "stale" }),
    ]);
    expect(s.comparableBy).toBe("price");
    expect(s.ranked.map((r) => r.price)).toEqual([480, 480, 520]);
    expect(s.ranked.filter((r) => r.isBest)).toHaveLength(2);
    expect(s.min?.price).toBe(480);
    expect(s.max?.price).toBe(520);
    expect(s.spread).toBe(40);
    expect(s.spreadPercent).toBe(8.3);
    expect(s.estimated).toHaveLength(1);
    expect(s.stale).toHaveLength(1);
  });

  it("never mixes a different pack into an identical comparison", () => {
    const s = summarizeOffers(milk, [
      offer({ productId: "milk", price: 520 }),
      offer({ productId: "milk", price: 300, pack: { quantity: 500, unit: "ml" } }),
    ]);
    expect(s.ranked.map((r) => r.price)).toEqual([520]);
    expect(s.incomparable).toHaveLength(1);
  });

  it("reports no min/max and no spread without verified prices", () => {
    const s = summarizeOffers(milk, [
      offer({ productId: "milk", status: "estimated", effectiveStatus: "estimated", price: 1 }),
    ]);
    expect(s.min).toBeNull();
    expect(s.max).toBeNull();
    expect(s.spread).toBeNull();
    expect(s.lastVerifiedAt).toBeNull();
  });

  it("has no spread with a single store", () => {
    const s = summarizeOffers(milk, [offer({ productId: "milk", price: 500 })]);
    expect(s.spread).toBeNull();
    expect(s.min?.isBest).toBe(true);
  });

  it("ignores offers of other products", () => {
    const s = summarizeOffers(milk, [offer({ productId: "other", price: 1 })]);
    expect(s.ranked).toHaveLength(0);
  });
});

describe("analog comparison by price per unit", () => {
  const sugar = product({ id: "sugar", unit: "kg", comparisonMode: "analog" });

  it("ranks by price per kg, not by shelf price", () => {
    const s = summarizeOffers(sugar, [
      offer({ productId: "sugar", price: 520, pack: { quantity: 1, unit: "kg" } }),
      offer({ productId: "sugar", price: 2400, pack: { quantity: 5, unit: "kg" } }),
      offer({ productId: "sugar", price: 300, pack: { quantity: 500, unit: "g" } }),
    ]);
    expect(s.comparableBy).toBe("unit_price");
    expect(s.ranked.map((r) => r.unitPrice)).toEqual([480, 520, 600]);
    expect(s.min?.price).toBe(2400);
  });

  it("excludes analog offers without a known pack", () => {
    const s = summarizeOffers(sugar, [offer({ productId: "sugar", price: 500 })]);
    expect(s.ranked).toHaveLength(0);
    expect(s.incomparable).toHaveLength(1);
  });
});
