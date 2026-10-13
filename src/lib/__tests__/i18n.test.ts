import { describe, expect, it } from "vitest";
import kk from "../../../messages/kk.json";
import ru from "../../../messages/ru.json";
import { features } from "@/config/features";
import { futureSections } from "@/config/sections";

function keys(obj: unknown, prefix = ""): string[] {
  if (Array.isArray(obj) || typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
}

function leaf(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj);
}

describe("RU/KZ messages", () => {
  const ruKeys = keys(ru).sort();
  const kkKeys = keys(kk).sort();

  it("have exactly the same keys", () => {
    expect(kkKeys.filter((k) => !ruKeys.includes(k))).toEqual([]);
    expect(ruKeys.filter((k) => !kkKeys.includes(k))).toEqual([]);
  });

  it("use the same ICU placeholders", () => {
    for (const k of ruKeys) {
      const a = leaf(ru, k);
      const b = leaf(kk, k);
      if (typeof a === "string" && typeof b === "string") expect([k, placeholders(b)]).toEqual([k, placeholders(a)]);
    }
  });

  it("have no empty strings", () => {
    for (const k of kkKeys) {
      const v = leaf(kk, k);
      if (typeof v === "string") expect([k, v.trim().length > 0]).toEqual([k, true]);
    }
  });

  it("describe every Sat+ section in both languages", () => {
    for (const s of futureSections) {
      for (const m of [ru, kk]) {
        const sec = (m.sections as Record<string, { title?: string; features?: string[] }>)[s.key];
        expect(sec?.title, `${s.key}.title`).toBeTruthy();
        expect(sec?.features?.length, `${s.key}.features`).toBeGreaterThan(0);
      }
    }
  });
});

describe("feature flags", () => {
  it("cover every section in the registry", () => {
    for (const s of futureSections) expect(Object.keys(features)).toContain(s.key);
  });
  it("only sections with a module can be switched on", () => {
    for (const s of futureSections) if (features[s.key]) expect([s.key, s.hasModule]).toEqual([s.key, true]);
  });
});
