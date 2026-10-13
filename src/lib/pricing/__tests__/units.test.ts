import { describe, expect, it } from "vitest";
import { offerUnitPrice, packsEqual, toBaseQuantity, unitPrice } from "../units";
import { offer, product } from "./fixtures";

describe("unit conversion", () => {
  it("converts grams and millilitres to base units", () => {
    expect(toBaseQuantity({ quantity: 400, unit: "g" }, "kg")).toBe(0.4);
    expect(toBaseQuantity({ quantity: 1500, unit: "ml" }, "l")).toBe(1.5);
    expect(toBaseQuantity({ quantity: 10, unit: "pcs" }, "pcs")).toBe(10);
  });

  it("refuses incompatible units instead of guessing", () => {
    expect(toBaseQuantity({ quantity: 1, unit: "l" }, "kg")).toBeNull();
    expect(unitPrice(500, { quantity: 1, unit: "l" }, "kg")).toBeNull();
    expect(unitPrice(500, null, "kg")).toBeNull();
  });

  it("computes price per base unit", () => {
    expect(unitPrice(390, { quantity: 400, unit: "g" }, "kg")).toBe(975);
    expect(unitPrice(260, { quantity: 1.5, unit: "l" }, "l")).toBe(173.33);
    expect(unitPrice(900, { quantity: 10, unit: "pcs" }, "pcs")).toBe(90);
  });

  it("treats 1000 g and 1 kg as the same pack", () => {
    expect(packsEqual({ quantity: 1000, unit: "g" }, { quantity: 1, unit: "kg" })).toBe(true);
    expect(packsEqual({ quantity: 900, unit: "g" }, { quantity: 1, unit: "kg" })).toBe(false);
    expect(packsEqual({ quantity: 1, unit: "l" }, { quantity: 1, unit: "kg" })).toBe(false);
  });

  it("uses the product's own pack for identical products and the offer's pack for analogs", () => {
    const identical = product({ comparisonMode: "identical", netQuantity: 900, netUnit: "ml" });
    expect(offerUnitPrice(identical, offer({ price: 450 }))).toBe(500);
    const analog = product({ comparisonMode: "analog" });
    expect(offerUnitPrice(analog, offer({ price: 450 }))).toBeNull();
    expect(offerUnitPrice(analog, offer({ price: 450, pack: { quantity: 1, unit: "l" } }))).toBe(450);
  });

  it("prices weighted goods per kg as-is", () => {
    const potatoes = product({ unit: "kg", isWeighted: true, comparisonMode: "identical" });
    expect(offerUnitPrice(potatoes, offer({ price: 180 }))).toBe(180);
  });
});
