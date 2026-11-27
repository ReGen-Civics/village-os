import { describe, expect, it } from "vitest";
import { parseAcceptLanguage, setShellLang, shellLocale } from "./i18nShell";

const SHELL = `<!doctype html>\n<html lang="en">\n  <head></head><body></body></html>`;

describe("the language of the first byte (spec i18n US1, §8 R16)", () => {
  it("parses Accept-Language by quality, dropping q=0 and *", () => {
    expect(parseAcceptLanguage("de-DE;q=0.4, es-CR, en;q=0.8, fr;q=0, *;q=0.1")).toEqual(["es-CR", "en", "de-DE"]);
    expect(parseAcceptLanguage("")).toEqual([]);
    expect(parseAcceptLanguage(undefined)).toEqual([]);
    expect(parseAcceptLanguage("garbage;;;q=x, ,")).toEqual(["garbage"]);
  });

  it("the saved cookie wins, then the browser's languages, then the village default, then English", () => {
    expect(shellLocale({ cookie: "a=1; vos_locale=es; b=2", acceptLanguage: "en", villageDefault: "en" })).toBe("es");
    expect(shellLocale({ cookie: "", acceptLanguage: "de, es-CR;q=0.9", villageDefault: "en" })).toBe("es");
    expect(shellLocale({ cookie: undefined, acceptLanguage: "de", villageDefault: "es" })).toBe("es");
    expect(shellLocale({ cookie: "vos_locale=xx", acceptLanguage: "de", villageDefault: "zz" })).toBe("en");
  });

  it("writes lang and dir into the html element and nothing else", () => {
    expect(setShellLang(SHELL, "es")).toBe(SHELL.replace('<html lang="en">', '<html lang="es" dir="ltr">'));
    expect(setShellLang(SHELL, "ar-XB")).toContain('<html lang="ar-XB" dir="rtl">');
    expect(setShellLang(SHELL, "en")).toContain('<html lang="en" dir="ltr">');
  });

  it("keeps the marks the other splices put on the html element", () => {
    const marked = SHELL.replace('<html lang="en">', '<html lang="en" data-scheme="dark" data-village-mode="dark" data-village-paper="sea-chart">');
    expect(setShellLang(marked, "es")).toContain('<html lang="es" dir="ltr" data-scheme="dark" data-village-mode="dark" data-village-paper="sea-chart">');
    expect(setShellLang(setShellLang(marked, "es"), "ar-XB")).toContain('<html lang="ar-XB" dir="rtl" data-scheme="dark" data-village-mode="dark" data-village-paper="sea-chart">');
  });
});
