import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AppSettings = {
  priceStaleDays: number;
  anomalyThresholdPct: number;
  submissionLimitAnonHour: number;
  submissionLimitUserHour: number;
  demoMode: boolean;
};

const DEFAULTS: AppSettings = {
  priceStaleDays: 14,
  anomalyThresholdPct: 40,
  submissionLimitAnonHour: 5,
  submissionLimitUserHour: 30,
  demoMode: false,
};

export async function readSettings(db: SupabaseClient): Promise<AppSettings> {
  const { data, error } = await db.from("app_settings").select("key, value");
  if (error || !data) return DEFAULTS;
  const map = new Map(data.map((r) => [String(r.key), r.value as unknown]));
  const n = (k: string, d: number) => {
    const v = Number(map.get(k));
    return Number.isFinite(v) ? v : d;
  };
  return {
    priceStaleDays: n("price_stale_days", DEFAULTS.priceStaleDays),
    anomalyThresholdPct: n("anomaly_threshold_pct", DEFAULTS.anomalyThresholdPct),
    submissionLimitAnonHour: n("submission_limit_anon_hour", DEFAULTS.submissionLimitAnonHour),
    submissionLimitUserHour: n("submission_limit_user_hour", DEFAULTS.submissionLimitUserHour),
    demoMode: map.get("demo_mode") === true || map.get("demo_mode") === "true",
  };
}
