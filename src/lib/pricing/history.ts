import type { HistoryPoint, Product } from "@/lib/types";
import { offerUnitPrice } from "./units";
import { comparisonBasis } from "./compare";

export type HistoryPeriod = 7 | 30 | 90;
export const HISTORY_PERIODS: HistoryPeriod[] = [7, 30, 90];

export type HistorySeries = {
  branchId: string;
  label: string;
  points: { t: number; value: number }[];
};

export type HistoryStats = {
  series: HistorySeries[];
  min: { value: number; branchId: string; t: number } | null;
  max: { value: number; branchId: string; t: number } | null;
  count: number;
};

/**
 * Builds chart series from accepted history. Only verified points are used — estimates
 * never appear in the chart. Analog products are charted by price per base unit.
 * No interpolation and no invented points: a store appears only where data exists.
 */
export function buildHistory(
  product: Product,
  points: HistoryPoint[],
  labels: Map<string, string>,
  periodDays: HistoryPeriod,
  now: Date = new Date(),
): HistoryStats {
  const from = now.getTime() - periodDays * 86_400_000;
  const byUnit = comparisonBasis(product) === "unit_price";
  const series = new Map<string, HistorySeries>();
  let min: HistoryStats["min"] = null;
  let max: HistoryStats["max"] = null;
  let count = 0;

  for (const p of points) {
    if (p.productId !== product.id || p.status !== "verified") continue;
    const t = new Date(p.observedAt).getTime();
    if (!(t >= from) || t > now.getTime()) continue;
    const value = byUnit ? offerUnitPrice(product, p) : p.price;
    if (value === null) continue;
    let s = series.get(p.branchId);
    if (!s) {
      s = { branchId: p.branchId, label: labels.get(p.branchId) ?? "—", points: [] };
      series.set(p.branchId, s);
    }
    s.points.push({ t, value });
    count++;
    if (!min || value < min.value) min = { value, branchId: p.branchId, t };
    if (!max || value > max.value) max = { value, branchId: p.branchId, t };
  }

  const list = [...series.values()];
  for (const s of list) s.points.sort((a, b) => a.t - b.t);
  list.sort((a, b) => a.label.localeCompare(b.label));
  return { series: list, min, max, count };
}
