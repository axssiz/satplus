"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, formatTenge, unitLabel, type AppLocale } from "@/lib/format";
import { buildHistory, HISTORY_PERIODS, type HistoryPeriod } from "@/lib/pricing/history";
import type { HistoryPoint, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLORS = ["var(--primary)", "#2563eb", "#d97706", "#c026d3", "#0891b2", "#dc2626", "#4f46e5", "#65a30d"];

export function PriceHistoryChart({
  product,
  points,
  labels,
}: {
  product: Product;
  points: HistoryPoint[];
  labels: [string, string][];
}) {
  const t = useTranslations("product");
  const locale = useLocale() as AppLocale;
  const [period, setPeriod] = useState<HistoryPeriod>(30);
  const labelMap = useMemo(() => new Map(labels), [labels]);
  // `now` is fixed per render of this component instance to keep the chart stable.
  const [now] = useState(() => new Date());
  const stats = useMemo(() => buildHistory(product, points, labelMap, period, now), [product, points, labelMap, period, now]);
  const unitSuffix = product.comparisonMode === "analog" && !product.isWeighted ? ` / ${unitLabel(product.unit, locale)}` : "";

  // Merge series into rows keyed by timestamp; missing values stay undefined (no invented points).
  const rows = useMemo(() => {
    const map = new Map<number, Record<string, number>>();
    for (const s of stats.series)
      for (const p of s.points) {
        const row = map.get(p.t) ?? { t: p.t };
        row[s.branchId] = p.value;
        map.set(p.t, row);
      }
    return [...map.values()].sort((a, b) => a.t - b.t);
  }, [stats]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={t("historyTitle")} className="inline-flex rounded-xl bg-surface-2 p-1">
          {HISTORY_PERIODS.map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={p === period}
              onClick={() => setPeriod(p)}
              className={cn(
                "h-8 rounded-lg px-3 text-sm font-medium transition",
                p === period ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
              )}
            >
              {t("historyPeriod", { days: p })}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{t("historyPoints", { count: stats.count })}</span>
      </div>

      {stats.count === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface/60 p-6 text-center text-sm text-muted-foreground">
          {t("historyEmpty")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-surface p-3">
              <p className="text-xs text-muted-foreground">{t("historyMin")}</p>
              <p className="tabular font-semibold">
                {formatTenge(stats.min!.value, locale)}
                {unitSuffix}
              </p>
              <p className="truncate text-xs text-muted-foreground">{labelMap.get(stats.min!.branchId)}</p>
            </div>
            <div className="rounded-xl bg-surface p-3">
              <p className="text-xs text-muted-foreground">{t("historyMax")}</p>
              <p className="tabular font-semibold">
                {formatTenge(stats.max!.value, locale)}
                {unitSuffix}
              </p>
              <p className="truncate text-xs text-muted-foreground">{labelMap.get(stats.max!.branchId)}</p>
            </div>
          </div>
          <div className="h-64 w-full" role="img" aria-label={t("historyTitle")}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v: number) =>
                    new Intl.DateTimeFormat(locale === "kk" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "short" }).format(v)
                  }
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                  width={56}
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number) => String(Math.round(v))}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => formatDate(new Date(Number(v)).toISOString(), locale)}
                  formatter={(value, name) => [formatTenge(Number(value), locale) + unitSuffix, labelMap.get(String(name)) ?? String(name)]}
                />
                {stats.series.map((s, i) => (
                  <Line
                    key={s.branchId}
                    dataKey={s.branchId}
                    name={s.branchId}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {stats.series.map((s, i) => (
              <li key={s.branchId} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                {s.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
