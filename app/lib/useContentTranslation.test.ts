import { describe, it, expect } from "vitest";
import { isRtlLanguage } from "./useContentTranslation";

describe("isRtlLanguage", () => {
  it("identifies the RTL languages offered in the language picker", () => {
    for (const code of ["ar", "he", "fa", "ur", "ps", "sd", "ckb", "dv", "yi"]) {
      expect(isRtlLanguage(code)).toBe(true);
    }
  });

  it("is case-insensitive and matches on the base subtag for region-qualified codes", () => {
    expect(isRtlLanguage("AR")).toBe(true);
    expect(isRtlLanguage("ar-EG")).toBe(true);
    expect(isRtlLanguage("he-IL")).toBe(true);
  });

  it("returns false for LTR languages", () => {
    for (const code of ["en", "fr", "de", "es", "hi", "ja", "ko", "zh", "ru"]) {
      expect(isRtlLanguage(code)).toBe(false);
    }
  });
});
