import { describe, expect, it } from "vitest";
import { addDays, cityToday, daysBetween, isIsoDate, promotionState } from "../dates";

describe("cityToday", () => {
  it("uses Almaty time (UTC+5)", () => {
    expect(cityToday(new Date("2026-10-13T18:59:00Z"))).toBe("2026-10-13");
    expect(cityToday(new Date("2026-10-13T19:00:00Z"))).toBe("2026-10-14");
  });
});

describe("promotionState", () => {
  const today = "2026-10-13";
  it("is active within the dates, inclusive", () => {
    expect(promotionState(null, today, today)).toBe("active");
    expect(promotionState(today, "2026-10-20", today)).toBe("active");
    expect(promotionState("2026-10-01", "2026-10-13", today)).toBe("active");
  });
  it("is upcoming before the start", () => {
    expect(promotionState("2026-10-14", "2026-10-20", today)).toBe("upcoming");
  });
  it("is ended after the last day", () => {
    expect(promotionState("2026-10-01", "2026-10-12", today)).toBe("ended");
    expect(promotionState(null, "2026-10-12", today)).toBe("ended");
  });
});

describe("date arithmetic", () => {
  it("counts whole days", () => {
    expect(daysBetween("2026-10-13", "2026-10-13")).toBe(0);
    expect(daysBetween("2026-10-13", "2026-10-16")).toBe(3);
    expect(daysBetween("2026-10-13", "2026-10-10")).toBe(-3);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });
  it("adds days across months", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });
  it("validates ISO dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("13.10.2026")).toBe(false);
  });
});

import { promotionReportSchema, promotionSchema } from "@/lib/validation";

describe("promotion schemas", () => {
  const base = { slug: "magnit-moloko", storeId: "00000000-0000-4000-8000-000000000001", title: "Скидка на молоко", endsOn: "2026-10-20", sourceName: "Сайт сети" };
  it("accepts a minimal promotion", () => {
    const r = promotionSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.success && r.data.isSponsored).toBe(false);
  });
  it("requires an end date and a source", () => {
    expect(promotionSchema.safeParse({ ...base, endsOn: "" }).success).toBe(false);
    expect(promotionSchema.safeParse({ ...base, sourceName: "" }).success).toBe(false);
  });
  it("rejects a start after the end and non-https sources", () => {
    expect(promotionSchema.safeParse({ ...base, startsOn: "2026-10-21" }).success).toBe(false);
    expect(promotionSchema.safeParse({ ...base, sourceUrl: "http://example.org" }).success).toBe(false);
  });
  it("needs a store (chosen or typed) in a reader report", () => {
    const report = { title: "Скидка на молоко", consent: "on" };
    expect(promotionReportSchema.safeParse(report).success).toBe(false);
    expect(promotionReportSchema.safeParse({ ...report, storeText: "Ларёк у рынка" }).success).toBe(true);
    expect(promotionReportSchema.safeParse({ ...report, storeSlug: "magnit", consent: undefined }).success).toBe(false);
  });
});
