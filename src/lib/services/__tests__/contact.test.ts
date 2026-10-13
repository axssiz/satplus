import { describe, expect, it } from "vitest";
import { telHref, whatsappHref } from "../contact";

describe("service contacts", () => {
  it("builds tel: links from formatted numbers", () => {
    expect(telHref("+7 (700) 000-00-11")).toBe("tel:+77000000011");
  });
  it("normalises Kazakhstan numbers for WhatsApp", () => {
    expect(whatsappHref("+7 700 000 00 11")).toBe("https://wa.me/77000000011");
    expect(whatsappHref("8 700 000 00 11")).toBe("https://wa.me/77000000011");
    expect(whatsappHref("700 000 00 11")).toBe("https://wa.me/77000000011");
  });
  it("gives up on numbers it cannot normalise", () => {
    expect(whatsappHref("7-00-11")).toBeNull();
  });
});
