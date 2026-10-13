import { describe, expect, it } from "vitest";
import { listingComplaintSchema, serviceListingSchema, staffServiceListingSchema } from "@/lib/validation";

const listing = {
  categoryId: "00000000-0000-4000-8000-000000000001",
  title: "Ремонт стиральных машин",
  providerName: "Ерлан",
  description: "Ремонтирую стиральные машины на дому, гарантия на работу.",
  phone: "+7 700 000 00 11",
  consent: "on",
};

describe("service listing schema (owner form)", () => {
  it("accepts a complete listing", () => {
    const r = serviceListingSchema.safeParse({ ...listing, hasWhatsapp: "on", priceNote: "от 5 000 ₸" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.hasWhatsapp).toBe(true);
  });
  it("requires a category, a phone and consent", () => {
    expect(serviceListingSchema.safeParse({ ...listing, categoryId: "" }).success).toBe(false);
    expect(serviceListingSchema.safeParse({ ...listing, phone: "" }).success).toBe(false);
    expect(serviceListingSchema.safeParse({ ...listing, consent: undefined }).success).toBe(false);
  });
  it("returns message keys for the form", () => {
    const r = serviceListingSchema.safeParse({ ...listing, description: "Коротко", linkUrl: "http://example.org" });
    expect(r.success).toBe(false);
    const codes = r.success ? [] : r.error.issues.map((i) => `${String(i.path[0])}:${i.message}`);
    expect(codes).toContain("description:description");
    expect(codes).toContain("linkUrl:url");
  });
});

describe("staff listing schema", () => {
  it("defaults to published and validates the slug", () => {
    const r = staffServiceListingSchema.safeParse({ ...listing, slug: "remont-stiralnyh-mashin" });
    expect(r.success && r.data.status).toBe("published");
    expect(staffServiceListingSchema.safeParse({ ...listing, slug: "Ремонт" }).success).toBe(false);
  });
});

describe("listing complaint schema", () => {
  it("accepts only known reasons", () => {
    expect(listingComplaintSchema.safeParse({ listingSlug: "santehnik", reason: "fraud" }).success).toBe(true);
    expect(listingComplaintSchema.safeParse({ listingSlug: "santehnik", reason: "dislike" }).success).toBe(false);
  });
});
