import { describe, expect, it } from "vitest";
import { compareBasket, lineCost } from "../basket";
import { offer, product } from "./fixtures";

const milk = product({ id: "milk", comparisonMode: "identical", netQuantity: 1, netUnit: "l" });
const potatoes = product({ id: "pot", unit: "kg", isWeighted: true, comparisonMode: "identical" });
const sugar = product({ id: "sugar", unit: "kg", comparisonMode: "analog" });
const products = [milk, potatoes, sugar];

describe("basket comparison", () => {
  it("returns empty for an empty basket", () => {
    expect(compareBasket([], products, []).status).toBe("empty");
  });

  it("returns no_data when no store has prices", () => {
    const r = compareBasket([{ productId: "milk", quantity: 1 }], products, []);
    expect(r.status).toBe("no_data");
    expect(r.cheapestComplete).toBeNull();
    expect(r.split.missing).toEqual(["milk"]);
  });

  it("finds the cheapest complete basket and never treats missing items as free", () => {
    const offers = [
      offer({ productId: "milk", branchId: "A", price: 500 }),
      offer({ productId: "pot", branchId: "A", price: 200 }),
      offer({ productId: "milk", branchId: "B", price: 450 }),
      offer({ productId: "pot", branchId: "B", price: 220 }),
      // C is cheapest per line but misses potatoes: must not win as "complete".
      offer({ productId: "milk", branchId: "C", price: 300 }),
    ];
    const r = compareBasket(
      [
        { productId: "milk", quantity: 2 },
        { productId: "pot", quantity: 3 },
      ],
      products,
      offers,
    );
    expect(r.status).toBe("complete");
    // A: 1000 + 600 = 1600, B: 900 + 660 = 1560
    expect(r.cheapestComplete?.branchId).toBe("B");
    expect(r.cheapestComplete?.total).toBe(1560);
    expect(r.mostExpensiveComplete?.total).toBe(1600);
    expect(r.spread).toBe(40);
    const c = r.stores.find((s) => s.branchId === "C")!;
    expect(c.complete).toBe(false);
    expect(c.missing).toEqual(["pot"]);
    expect(c.total).toBe(600);
    // Split: milk at C (600) + potatoes at A (600) = 1200, 2 stores.
    expect(r.split.total).toBe(1200);
    expect(r.split.storeCount).toBe(2);
    expect(r.savings).toBe(360);
  });

  it("reports partial when no single store and no split covers everything", () => {
    const r = compareBasket(
      [
        { productId: "milk", quantity: 1 },
        { productId: "pot", quantity: 1 },
      ],
      products,
      [offer({ productId: "milk", branchId: "A", price: 500 })],
    );
    expect(r.status).toBe("partial");
    expect(r.savings).toBeNull();
    expect(r.split.complete).toBe(false);
    expect(r.split.missing).toEqual(["pot"]);
  });

  it("ignores estimated and stale prices", () => {
    const r = compareBasket([{ productId: "milk", quantity: 1 }], products, [
      offer({ productId: "milk", branchId: "A", price: 1, status: "estimated", effectiveStatus: "estimated" }),
      offer({ productId: "milk", branchId: "B", price: 1, effectiveStatus: "stale" }),
    ]);
    expect(r.status).toBe("no_data");
  });

  it("costs analog items by unit price, or by exact pack when one is chosen", () => {
    const offers = [
      offer({ productId: "sugar", branchId: "A", price: 2400, pack: { quantity: 5, unit: "kg" } }),
      offer({ productId: "sugar", branchId: "B", price: 520, pack: { quantity: 1, unit: "kg" } }),
    ];
    const any = compareBasket([{ productId: "sugar", quantity: 2 }], products, offers);
    expect(any.cheapestComplete?.branchId).toBe("A");
    expect(any.cheapestComplete?.total).toBe(960);
    expect(any.cheapestComplete?.lines[0].approximate).toBe(true);

    const exact = compareBasket(
      [{ productId: "sugar", quantity: 2, pack: { quantity: 1000, unit: "g" } }],
      products,
      offers,
    );
    expect(exact.stores).toHaveLength(1);
    expect(exact.cheapestComplete?.branchId).toBe("B");
    expect(exact.cheapestComplete?.total).toBe(1040);
    expect(exact.cheapestComplete?.lines[0].approximate).toBe(false);
  });

  it("skips analog offers without pack data", () => {
    expect(lineCost(sugar, { productId: "sugar", quantity: 1 }, offer({ productId: "sugar", price: 500 }))).toBeNull();
  });

  it("ignores zero quantities and unknown products", () => {
    const r = compareBasket(
      [
        { productId: "milk", quantity: 0 },
        { productId: "ghost", quantity: 1 },
      ],
      products,
      [offer({ productId: "milk", price: 1 })],
    );
    expect(r.status).toBe("empty");
  });
});
