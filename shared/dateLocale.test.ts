import { describe, expect, it } from "vitest";
import { civilDayWords, dateLocale } from "./seasonPlans";

const dayWords = (day: string, locale: string) => civilDayWords(day, locale);

describe("a civil day in the page's language", () => {
  it("reads Spanish on a Spanish page, so the term line has no English month in it", () => {
    expect(dayWords("2026-12-08", "es")).toBe("8 de diciembre de 2026");
    expect(dayWords("2026-09-22", "es")).toBe("22 de septiembre de 2026");
  });

  it("keeps the village's day-month-year in English and in the English test skins", () => {
    expect(dayWords("2026-12-08", "en")).toBe("8 December 2026");
    expect(dayWords("2026-12-08", "en-US")).toBe("8 December 2026");
    expect(dateLocale("en-XA")).toBe("en-GB");
    expect(dateLocale("ar-XB")).toBe("en-GB");
  });

  it("falls back to English for no locale or one the browser cannot format", () => {
    expect(dateLocale("")).toBe("en-GB");
    expect(dateLocale(undefined)).toBe("en-GB");
    expect(dateLocale("not a locale!")).toBe("en-GB");
  });

  it("leaves a value that is not a civil day as it came", () => {
    expect(dayWords("soon", "es")).toBe("soon");
  });
});
