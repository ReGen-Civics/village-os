import { setupI18n } from "@lingui/core";
import { describe, expect, it } from "vitest";
import { ACCOUNT_MENU, NAV, isGroup, type NavLink } from "./nav";
import { NAV_WORDS, navWord } from "./navWords";

/** Every word the menu config would draw: group names, labels, subtitles. */
function menuWords(): string[] {
  const out = new Set<string>();
  const link = (l: NavLink) => {
    out.add(l.label);
    if (l.subtitle) out.add(l.subtitle);
  };
  for (const e of NAV) {
    if (isGroup(e)) {
      out.add(e.label);
      e.items.forEach(link);
    } else link(e);
  }
  ACCOUNT_MENU.forEach(link);
  return [...out];
}

describe("the menu speaks the reader's language (the lead, 26 Nov 2026)", () => {
  it("every label, group name and subtitle in the menu config has a translatable word", () => {
    const missing = menuWords().filter((w) => !NAV_WORDS[w]);
    expect(missing, "add these to client/src/config/navWords.ts").toEqual([]);
  });

  it("each word's English is its own key, so a menu without a translation still reads as written", () => {
    for (const [key, d] of Object.entries(NAV_WORDS)) expect(d.message ?? d.id, key).toBeTruthy();
    const en = setupI18n({ locale: "en", messages: { en: {} } });
    expect(navWord("Community", en)).toBe("Community");
    expect(navWord("A word the village wrote", en)).toBe("A word the village wrote");
  });

  it("a catalog that has the word draws it in that language", () => {
    const d = NAV_WORDS["Guides"];
    const es = setupI18n({ locale: "es", messages: { es: { [d.id]: "Guías" } } });
    expect(navWord("Guides", es)).toBe("Guías");
  });
});

describe("a dropdown's id survives the reader's language", () => {
  it("drops spaces and accents", async () => {
    const { navMenuId } = await import("./navWords");
    expect(navMenuId("Acerca de")).toBe("nav-menu-acerca-de");
    expect(navMenuId("Guías")).toBe("nav-menu-guias");
    expect(navMenuId("Community")).toBe("nav-menu-community");
  });
});
