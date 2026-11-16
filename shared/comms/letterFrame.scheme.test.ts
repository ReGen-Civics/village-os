/**
 * A VILLAGE IN THE DARK SCHEME SENDS DARK LETTERS (gap G1). Its letters draw
 * the night rules always, from the site's own page, card, inks and primary,
 * and keep the light day for mail apps that drop a <style> block. A village
 * that chose no scheme gets exactly the letter it got before.
 */
import { describe, expect, it } from "vitest";
import { deriveTheme } from "../brandTokens";
import { letterPalette, renderLetterFrame } from "./letterFrame";
import type { EmailVillage } from "./letterHtml";

const base: EmailVillage = { name: "Harbour", url: "https://harbour.example", logoUrl: null, seed: "#0b1a1e", character: "woven", postalAddress: "" };
const body = { html: "<p>Hello.</p>", text: "Hello." };

describe("letters and the scheme", () => {
  it("are unchanged for a village with no scheme", () => {
    expect(letterPalette("#16342a", "woven", null)).toEqual(letterPalette("#16342a", "woven"));
    const a = renderLetterFrame({ village: base, subject: "Hi", body });
    const b = renderLetterFrame({ village: { ...base, scheme: null }, subject: "Hi", body });
    expect(b.html).toBe(a.html);
    expect(a.html).toContain("@media (prefers-color-scheme: dark)");
  });

  it("draw the night always, in the site's own dark colours, for a dark village", () => {
    const scheme = { accent: "#e9b84a", mode: "dark", overrides: { primary: "#e9b84a", "primary-foreground": "#2a1a05", card: "#173a2a" } };
    const p = letterPalette("#0b1a1e", "woven", scheme);
    const v = deriveTheme("#0b1a1e", "woven", "#e9b84a", { mode: "dark", overrides: scheme.overrides })!.vars;
    expect(p.alwaysNight).toBe(true);
    expect(p.night.page).toBe(v["--background"]);
    expect(p.night.card).toBe("#173a2a");
    expect(p.night.accent).toBe("#e9b84a");
    expect(p.night.accentText).toBe("#2a1a05");
    // The light day stays for mail apps that drop the style block.
    expect(p.day).toEqual(letterPalette("#0b1a1e", "woven").day);
    const html = renderLetterFrame({ village: { ...base, scheme }, subject: "Hi", body }).html;
    expect(html).not.toContain("@media (prefers-color-scheme: dark)");
    expect(html).toContain(`.vl-page{background-color:${v["--background"]} !important;}`);
  });
});
