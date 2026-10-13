import { describe, expect, it } from "vitest";
import { checkAnomaly, median } from "../anomaly";
import { buildHistory } from "../history";
import { product } from "./fixtures";

describe("anomaly detection", () => {
  it("computes a median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("flags large deviations from the current price at the same branch", () => {
    const r = checkAnomaly(900, 500, [], 40);
    expect(r.isAnomalous).toBe(true);
    expect(r.reason).toBe("differs_from_current");
    expect(r.deviationPercent).toBe(80);
  });

  it("falls back to the city median and accepts normal changes", () => {
    expect(checkAnomaly(520, null, [500, 480, 510], 40).isAnomalous).toBe(false);
    expect(checkAnomaly(100, null, [500, 480, 510], 40).reason).toBe("differs_from_city_median");
  });

  it("does not flag when there is nothing to compare with", () => {
    expect(checkAnomaly(500, null, [], 40).isAnomalous).toBe(false);
  });

  it("flags absurd values", () => {
    expect(checkAnomaly(1, null, [], 40).reason).toBe("out_of_range");
    expect(checkAnomaly(5_000_000, null, [], 40).reason).toBe("out_of_range");
  });
});

describe("price history", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
  const p = product({ id: "p", comparisonMode: "identical" });
  const labels = new Map([["A", "Store A"]]);

  it("uses only verified points inside the period and never invents data", () => {
    const h = buildHistory(
      p,
      [
        { productId: "p", branchId: "A", price: 100, status: "verified", pack: null, observedAt: daysAgo(40), isDemo: false },
        { productId: "p", branchId: "A", price: 110, status: "verified", pack: null, observedAt: daysAgo(20), isDemo: false },
        { productId: "p", branchId: "A", price: 90, status: "estimated", pack: null, observedAt: daysAgo(5), isDemo: false },
        { productId: "p", branchId: "A", price: 120, status: "verified", pack: null, observedAt: daysAgo(2), isDemo: false },
      ],
      labels,
      30,
      now,
    );
    expect(h.count).toBe(2);
    expect(h.series[0].points.map((x) => x.value)).toEqual([110, 120]);
    expect(h.min?.value).toBe(110);
    expect(h.max?.value).toBe(120);
  });

  it("charts analog products by unit price", () => {
    const analog = product({ id: "s", unit: "kg", comparisonMode: "analog" });
    const h = buildHistory(
      analog,
      [{ productId: "s", branchId: "A", price: 2400, status: "verified", pack: { quantity: 5, unit: "kg" }, observedAt: daysAgo(1), isDemo: false }],
      labels,
      7,
      now,
    );
    expect(h.series[0].points[0].value).toBe(480);
  });

  it("returns empty stats for no data", () => {
    const h = buildHistory(p, [], labels, 90, now);
    expect(h.count).toBe(0);
    expect(h.min).toBeNull();
  });
});
