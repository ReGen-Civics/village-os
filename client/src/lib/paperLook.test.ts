// @vitest-environment jsdom
/**
 * LIGHT MODE'S PAPER ON THE PAGE (lib/paperLook.ts). The village's answer goes on <html> and is kept
 * for the next first paint; the first-paint script in client/index.html, which cannot import, names
 * the same key and value and paints the chart's own ground. These run that script as it ships.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";
import { MODE_KEY } from "./colourMode";
import { PAPER_KEY, applyPaper, isPaper } from "./paperLook";

const shell = readFileSync(path.resolve(__dirname, "../../index.html"), "utf8");
const sheet = readFileSync(path.resolve(__dirname, "../seaChart.css"), "utf8");
const firstPaint = (() => {
  const doc = new DOMParser().parseFromString(shell, "text/html");
  const s = Array.from(doc.querySelectorAll("script:not([src])"), (el) => el.textContent ?? "").find((x) => x.includes(MODE_KEY));
  if (!s) throw new Error("client/index.html has no first-paint script");
  return s;
})();
const runFirstPaint = () => vm.runInNewContext(firstPaint, { localStorage: window.localStorage, matchMedia: () => ({ matches: false }), document });
const html = () => document.documentElement;

beforeEach(() => {
  localStorage.clear();
  html().removeAttribute("data-paper");
  html().removeAttribute("data-mode");
  html().removeAttribute("style");
});

describe("applyPaper", () => {
  it("puts the Sea chart on the page and keeps it for the next first paint", () => {
    expect(applyPaper("sea-chart")).toBe("sea-chart");
    expect(html().getAttribute("data-paper")).toBe("sea-chart");
    expect(localStorage.getItem(PAPER_KEY)).toBe("sea-chart");
  });

  it("takes it off again for a village back on plain", () => {
    applyPaper("sea-chart");
    expect(applyPaper("plain")).toBe("plain");
    expect(html().hasAttribute("data-paper")).toBe(false);
    expect(localStorage.getItem(PAPER_KEY)).toBeNull();
  });

  it("reads anything unknown as plain, so the look is only ever on where the village chose it", () => {
    applyPaper("sea-chart");
    for (const v of [undefined, null, "", "parchment", 1]) {
      expect(applyPaper(v)).toBe("plain");
      expect(html().hasAttribute("data-paper")).toBe(false);
    }
    expect(isPaper("sea-chart")).toBe(true);
    expect(isPaper("Sea chart")).toBe(false);
  });
});

describe("the first-paint script", () => {
  it("puts down the paper this device last saw, before the page draws, on the chart's own ground", () => {
    localStorage.setItem(MODE_KEY, "light");
    localStorage.setItem(PAPER_KEY, "sea-chart");
    runFirstPaint();
    expect(html().getAttribute("data-paper")).toBe("sea-chart");
    const ground = /--pal-day-ground:\s*(#[0-9a-f]{6})/i.exec(sheet)?.[1];
    expect(ground).toBeTruthy();
    expect(html().style.backgroundColor).toBe(hexToRgb(ground!));
  });

  it("paints plain for a device that has never seen the chart, and in dark mode keeps the night", () => {
    localStorage.setItem(MODE_KEY, "light");
    runFirstPaint();
    expect(html().hasAttribute("data-paper")).toBe(false);
    localStorage.setItem(MODE_KEY, "dark");
    localStorage.setItem(PAPER_KEY, "sea-chart");
    html().removeAttribute("style");
    runFirstPaint();
    expect(html().style.backgroundColor).not.toBe(hexToRgb("#e8d3a3"));
  });
});

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
