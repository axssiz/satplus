import { roundTo } from "./units";

export type AnomalyCheck = {
  isAnomalous: boolean;
  reason: string | null;
  referencePrice: number | null;
  deviationPercent: number | null;
};

export const ABSOLUTE_MIN_PRICE = 5;
export const ABSOLUTE_MAX_PRICE = 1_000_000;

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : roundTo((v[mid - 1] + v[mid]) / 2, 2);
}

/**
 * Flags suspicious submissions for moderators. A flag never auto-rejects;
 * it only highlights the submission in the moderation queue.
 *
 * @param value          submitted comparable value (price, or price per unit for analog products)
 * @param sameBranch     current accepted value at the same branch, if any
 * @param otherBranches  current fresh verified values at other branches
 */
export function checkAnomaly(
  value: number,
  sameBranch: number | null,
  otherBranches: number[],
  thresholdPercent: number,
): AnomalyCheck {
  if (!(value >= ABSOLUTE_MIN_PRICE) || value > ABSOLUTE_MAX_PRICE) {
    return { isAnomalous: true, reason: "out_of_range", referencePrice: null, deviationPercent: null };
  }
  const reference = sameBranch ?? median(otherBranches);
  if (reference === null) {
    return { isAnomalous: false, reason: null, referencePrice: null, deviationPercent: null };
  }
  const deviation = roundTo(((value - reference) / reference) * 100, 1);
  const isAnomalous = Math.abs(deviation) > thresholdPercent;
  return {
    isAnomalous,
    reason: isAnomalous ? (sameBranch !== null ? "differs_from_current" : "differs_from_city_median") : null,
    referencePrice: reference,
    deviationPercent: deviation,
  };
}
