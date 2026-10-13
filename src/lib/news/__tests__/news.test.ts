import { describe, expect, it } from "vitest";
import { almatyLocalToIso, isoToAlmatyLocal, newsArticleSchema, newsSuggestionSchema } from "@/lib/validation";
import { excerpt, readingMinutes, slugify, sourceHost, toParagraphs } from "../text";

describe("slugify", () => {
  it("transliterates Russian titles", () => {
    expect(slugify("Ремонт дороги на улице Сәтбаева")).toBe("remont-dorogi-na-ulitse-satbaeva");
  });
  it("transliterates Kazakh letters", () => {
    expect(slugify("Қала әкімдігі жаңа өтініш қабылдайды")).toBe("qala-akimdigi-zhana-otinish-qabyldaidy");
  });
  it("keeps digits, collapses punctuation and trims length", () => {
    expect(slugify("  2026: итоги — года!  ")).toBe("2026-itogi-goda");
    const long = slugify("а".repeat(200), 20);
    expect(long.length).toBeLessThanOrEqual(20);
    expect(long.endsWith("-")).toBe(false);
  });
  it("falls back when nothing usable is left", () => {
    expect(slugify("!!!")).toBe("novost");
  });
  it("produces slugs accepted by the database constraint", () => {
    for (const t of ["Новость", "Жаңалық", "A/B тест 100%", "ёлка"]) {
      expect(slugify(t)).toMatch(/^[a-z0-9-]{2,120}$/);
    }
  });
});

describe("body text", () => {
  it("splits paragraphs on blank lines and normalises line endings", () => {
    expect(toParagraphs("Первый абзац.\r\n\r\nВторой\nабзац.\n\n\n  \nТретий")).toEqual([
      "Первый абзац.",
      "Второй\nабзац.",
      "Третий",
    ]);
  });
  it("never interprets markup: tags stay literal text", () => {
    expect(toParagraphs("<script>alert(1)</script>")).toEqual(["<script>alert(1)</script>"]);
  });
  it("builds an excerpt from the summary or the first paragraph", () => {
    expect(excerpt("Кратко", "Длинный текст")).toBe("Кратко");
    expect(excerpt(null, "Первый абзац.\n\nВторой")).toBe("Первый абзац.");
    const e = excerpt(null, "слово ".repeat(100), 50);
    expect(e.length).toBeLessThanOrEqual(51);
    expect(e.endsWith("…")).toBe(true);
  });
  it("shows only https source hosts", () => {
    expect(sourceHost("https://www.gov.kz/memleket/entities")).toBe("gov.kz");
    expect(sourceHost("http://example.com")).toBeNull();
    expect(sourceHost("javascript:alert(1)")).toBeNull();
    expect(sourceHost(null)).toBeNull();
  });
  it("estimates reading time", () => {
    expect(readingMinutes("коротко")).toBe(1);
    expect(readingMinutes("слово ".repeat(900))).toBe(5);
  });
});

describe("news suggestion validation", () => {
  const valid = { title: "Ремонт дороги", body: "Жители сообщают о начале ремонта дороги.", consent: "on" };
  it("accepts a minimal suggestion", () => {
    const r = newsSuggestionSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sourceUrl).toBeUndefined();
  });
  it("requires consent and sensible lengths", () => {
    expect(newsSuggestionSchema.safeParse({ ...valid, consent: undefined }).success).toBe(false);
    expect(newsSuggestionSchema.safeParse({ ...valid, title: "abc" }).success).toBe(false);
    expect(newsSuggestionSchema.safeParse({ ...valid, body: "short" }).success).toBe(false);
  });
  it("accepts only https source links", () => {
    expect(newsSuggestionSchema.safeParse({ ...valid, sourceUrl: "https://satpaev.kz/news/1" }).success).toBe(true);
    expect(newsSuggestionSchema.safeParse({ ...valid, sourceUrl: "http://satpaev.kz" }).success).toBe(false);
    expect(newsSuggestionSchema.safeParse({ ...valid, sourceUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("news article validation (admin)", () => {
  const base = {
    slug: "remont-dorogi",
    title: "Начался ремонт дороги",
    body: "Подробный текст новости о ремонте.",
    sourceName: "Акимат города",
  };
  it("requires a source", () => {
    expect(newsArticleSchema.safeParse({ ...base, sourceName: "" }).success).toBe(false);
  });
  it("rejects invalid slugs", () => {
    expect(newsArticleSchema.safeParse({ ...base, slug: "Ремонт" }).success).toBe(false);
  });
  it("maps checkboxes to booleans and defaults to a draft", () => {
    const r = newsArticleSchema.parse({ ...base, isImportant: "on" });
    expect(r.isImportant).toBe(true);
    expect(r.isSponsored).toBe(false);
    expect(r.status).toBe("draft");
  });
});

describe("Almaty time conversion", () => {
  it("round-trips datetime-local values as UTC+5", () => {
    expect(almatyLocalToIso("2026-10-13T09:30")).toBe("2026-10-13T04:30:00.000Z");
    expect(isoToAlmatyLocal("2026-10-13T04:30:00.000Z")).toBe("2026-10-13T09:30");
  });
});
