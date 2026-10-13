import { describe, expect, it } from "vitest";
import { jobListingSchema, staffJobListingSchema } from "@/lib/validation";

const job = {
  categoryId: "00000000-0000-4000-8000-000000000001",
  title: "Продавец-консультант",
  employerName: "ИП Тестовый магазин",
  description: "Работа с покупателями, выкладка товара, работа на кассе.",
  phone: "+7 700 000 00 22",
  consent: "on",
};

const codes = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => `${String(i.path[0])}:${i.message}`);

describe("job listing schema (employer form)", () => {
  it("accepts a vacancy without a salary and leaves it empty", () => {
    const r = jobListingSchema.safeParse({ ...job, salaryFrom: "", salaryTo: "" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.salaryFrom).toBeUndefined();
    expect(r.success && r.data.employmentType).toBe("full");
    expect(r.success && r.data.experience).toBe("any");
  });
  it("reads salaries typed with spaces and the tenge sign", () => {
    const r = jobListingSchema.safeParse({ ...job, salaryFrom: "150 000", salaryTo: "200 000 ₸" });
    expect(r.success && [r.data.salaryFrom, r.data.salaryTo]).toEqual([150000, 200000]);
  });
  it("rejects a reversed or non-numeric salary", () => {
    expect(codes(jobListingSchema.safeParse({ ...job, salaryFrom: "300000", salaryTo: "100000" }))).toContain("salaryTo:salaryOrder");
    expect(codes(jobListingSchema.safeParse({ ...job, salaryFrom: "договорная" }))).toContain("salaryFrom:salary");
    expect(codes(jobListingSchema.safeParse({ ...job, salaryTo: "0" }))).toContain("salaryTo:salary");
  });
  it("checks optional email, contact name and enums", () => {
    expect(codes(jobListingSchema.safeParse({ ...job, email: "не почта" }))).toContain("email:email");
    expect(codes(jobListingSchema.safeParse({ ...job, contactName: "А" }))).toContain("contactName:contactName");
    expect(jobListingSchema.safeParse({ ...job, employmentType: "remote" }).success).toBe(false);
    expect(jobListingSchema.safeParse({ ...job, experience: "3_plus", employmentType: "shift" }).success).toBe(true);
  });
  it("requires category, phone and consent", () => {
    expect(codes(jobListingSchema.safeParse({ ...job, categoryId: "" }))).toContain("categoryId:category");
    expect(codes(jobListingSchema.safeParse({ ...job, phone: "звоните" }))).toContain("phone:phone");
    expect(codes(jobListingSchema.safeParse({ ...job, consent: undefined }))).toContain("consent:consent");
  });
});

describe("staff job listing schema", () => {
  it("accepts a sourced vacancy with Russian messages on errors", () => {
    const base = { ...job, slug: "prodavec", sourceName: "Звонок работодателю", status: "published" };
    expect(staffJobListingSchema.safeParse(base).success).toBe(true);
    const r = staffJobListingSchema.safeParse({ ...base, slug: "Плохой слаг" });
    expect(codes(r)[0]).toMatch(/^slug:Слаг/);
  });
});
