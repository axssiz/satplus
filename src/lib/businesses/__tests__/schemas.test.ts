import { describe, expect, it } from "vitest";
import { businessSchema, businessSuggestionSchema } from "@/lib/validation";

describe("business schema (admin)", () => {
  const base = { slug: "apteka-test", name: "Аптека", sourceName: "Вывеска, проверено модератором" };
  it("accepts a minimal organisation and defaults to a draft", () => {
    const r = businessSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.success && r.data.status).toBe("draft");
    expect(r.success && r.data.verified).toBe(false);
  });
  it("requires a source", () => {
    expect(businessSchema.safeParse({ ...base, sourceName: "" }).success).toBe(false);
  });
  it("needs both coordinates or neither", () => {
    expect(businessSchema.safeParse({ ...base, latitude: "47.9", longitude: "" }).success).toBe(false);
    const r = businessSchema.safeParse({ ...base, latitude: "47.9", longitude: "67.53" });
    expect(r.success && [r.data.latitude, r.data.longitude]).toEqual([47.9, 67.53]);
    expect(businessSchema.safeParse({ ...base, latitude: "91", longitude: "67" }).success).toBe(false);
  });
  it("marks as verified only with a check date", () => {
    expect(businessSchema.safeParse({ ...base, verified: "on" }).success).toBe(false);
    expect(businessSchema.safeParse({ ...base, verified: "on", lastVerifiedAt: "2026-10-13" }).success).toBe(true);
  });
  it("validates phones and https links", () => {
    expect(businessSchema.safeParse({ ...base, phone: "+7 (71063) 7-00-00" }).success).toBe(true);
    expect(businessSchema.safeParse({ ...base, phone: "звонить" }).success).toBe(false);
    expect(businessSchema.safeParse({ ...base, website: "http://example.org" }).success).toBe(false);
  });
});

describe("business suggestion schema (public form)", () => {
  it("needs a name for a new organisation", () => {
    expect(businessSuggestionSchema.safeParse({ kind: "new", consent: "on" }).success).toBe(false);
    expect(businessSuggestionSchema.safeParse({ kind: "new", name: "Шиномонтаж", consent: "on" }).success).toBe(true);
  });
  it("needs the organisation and a description for a correction", () => {
    const c = { kind: "correction", consent: "on", details: "Сменился телефон" };
    expect(businessSuggestionSchema.safeParse(c).success).toBe(false);
    expect(businessSuggestionSchema.safeParse({ ...c, businessSlug: "apteka-test" }).success).toBe(true);
    expect(businessSuggestionSchema.safeParse({ ...c, businessSlug: "apteka-test", details: "" }).success).toBe(false);
  });
  it("requires consent", () => {
    expect(businessSuggestionSchema.safeParse({ kind: "new", name: "Шиномонтаж" }).success).toBe(false);
  });
});
