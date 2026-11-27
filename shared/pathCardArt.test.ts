import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_ART_FOCUS, FOUNDING_CARD_ART, artFocusOr, parseArtFocus, pathArtFocus } from "./pathCardArt";
import { NATURE_ART_URL } from "./natureArt";

describe("parseArtFocus", () => {
  it("takes two percentages, across then down", () => {
    expect(parseArtFocus("50% 30%")).toBe("50% 30%");
    expect(parseArtFocus(" 0%   100% ")).toBe("0% 100%");
    expect(parseArtFocus("12.5% 40%")).toBe("12.5% 40%");
  });

  it("refuses anything else, because the value lands in a style attribute", () => {
    for (const bad of ["", "50%", "center top", "50% 30%; background:red", "101% 10%", "50px 30px", "-1% 5%", null, undefined, 50, {}]) {
      expect(parseArtFocus(bad)).toBeNull();
    }
  });

  it("falls back to the top-weighted centre", () => {
    expect(artFocusOr(undefined)).toBe(DEFAULT_ART_FOCUS);
    expect(artFocusOr("nonsense")).toBe(DEFAULT_ART_FOCUS);
    expect(artFocusOr("20% 80%")).toBe("20% 80%");
    const [, y] = DEFAULT_ART_FOCUS.split(" ").map((v) => Number.parseFloat(v));
    expect(y).toBeLessThan(50);
  });
});

describe("pathArtFocus", () => {
  it("names the four path pictures' focal points, well formed only, and nothing else", () => {
    expect(pathArtFocus({ investorHeroFocus: "50% 80%", residentHeroFocus: "bad", heroFocus: "1% 1%", stewardHero: "/x.webp" })).toEqual({
      investorHeroFocus: "50% 80%",
    });
    expect(pathArtFocus(undefined)).toEqual({});
  });
});

describe("FOUNDING_CARD_ART", () => {
  it("points at a painting the server ships, at both sizes", () => {
    expect(FOUNDING_CARD_ART.src.startsWith(`${NATURE_ART_URL}/`)).toBe(true);
    for (const entry of FOUNDING_CARD_ART.srcSet.split(",")) {
      const url = entry.trim().split(/\s+/)[0];
      expect(url.startsWith(`${NATURE_ART_URL}/`)).toBe(true);
      const file = path.join("server", "assets", "nature", url.slice(NATURE_ART_URL.length + 1));
      expect(fs.existsSync(file), file).toBe(true);
    }
    expect(parseArtFocus(FOUNDING_CARD_ART.focus)).toBe(FOUNDING_CARD_ART.focus);
  });
});
