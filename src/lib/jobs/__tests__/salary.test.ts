import { describe, expect, it } from "vitest";
import { formatSalary } from "../salary";

const clean = (s: string | null) => s?.replace(/[  ]/g, " ") ?? null;

describe("formatSalary", () => {
  it("returns null when the employer did not state a salary", () => {
    expect(formatSalary(null, null, "ru")).toBeNull();
    expect(formatSalary(undefined, undefined, "kk")).toBeNull();
  });
  it("formats a range", () => {
    expect(clean(formatSalary(150000, 200000, "ru"))).toBe("150 000 – 200 000 ₸");
  });
  it("collapses equal bounds", () => {
    expect(clean(formatSalary(180000, 180000, "ru"))).toBe("180 000 ₸");
  });
  it("formats open bounds in both languages", () => {
    expect(clean(formatSalary(150000, null, "ru"))).toBe("от 150 000 ₸");
    expect(clean(formatSalary(null, 90000, "ru"))).toBe("до 90 000 ₸");
    expect(clean(formatSalary(150000, null, "kk"))).toBe("150 000 ₸ бастап");
    expect(clean(formatSalary(null, 90000, "kk"))).toBe("90 000 ₸ дейін");
  });
});
