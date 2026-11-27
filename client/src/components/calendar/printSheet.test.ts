/**
 * THE PRINT SHEET'S HIDE RULE MUST WEIGH NOTHING (fold QA rounds 1 and 2, 27 Nov 2026).
 *
 * calendar/print.css hides the page around a print sheet (the calendar's month grid and year wheel, the rites
 * packet) and shows the sheet again with `.calendar-print *` and, in rites.css, `.rites .packtable *`. It hid
 * `body *` on EVERY page, so every other page printed blank. Scoping it to `body:has(.calendar-print) *` fixed
 * that and broke the sheets: the scope's class made the hide outrank the show, and the calendar and the packet
 * printed blank instead. Inside `:where()` the scope adds no weight, so the show rules win as they always did.
 *
 * jsdom applies no print media and no `:has()`, so this reads the stylesheets and holds the rule's shape, with a
 * specificity count small enough to check by eye. The rendered proof is a print of /events and /rights in
 * Chromium (the fold-rights QA evidence).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const here = join(process.cwd(), "client/src/components");
const PRINT = readFileSync(join(here, "calendar/print.css"), "utf8");
const RITES = readFileSync(join(here, "rites/rites.css"), "utf8");

/** A selector list split on its top-level commas only: `:where(a, b) x` is one selector. */
function splitSelectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
}

/** Every rule inside the `@media print` blocks of a stylesheet, as [selectors, body]. */
function printRules(css: string): Array<[string[], string]> {
  const out: Array<[string[], string]> = [];
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const block of bare.matchAll(/@media print\s*\{([\s\S]*?)\n\}/g)) {
    for (const rule of block[1].matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      out.push([splitSelectors(rule[1]), rule[2]]);
    }
  }
  return out;
}

/**
 * Specificity as [ids, classes, elements], for the selector shapes these two sheets use. `:where()` counts
 * nothing; `:has()` and `:is()` count their argument's; `*` counts nothing.
 */
function specificity(selector: string): [number, number, number] {
  let s = selector.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, " ");
  const inner: string[] = [];
  s = s.replace(/:(?:has|is)\(((?:[^()]|\([^()]*\))*)\)/g, (_m, arg: string) => {
    inner.push(arg);
    return " ";
  });
  const count: [number, number, number] = [(s.match(/#[\w-]+/g) ?? []).length, (s.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g) ?? []).length, (s.match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length];
  for (const arg of inner) {
    const add = specificity(arg);
    for (let i = 0; i < 3; i++) count[i] += add[i];
  }
  return count;
}
const outranks = (a: [number, number, number], b: [number, number, number]) => a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];

const hides = printRules(PRINT).filter(([, body]) => /visibility:\s*hidden/.test(body)).flatMap(([sel]) => sel);
const shows = [...printRules(PRINT), ...printRules(RITES)].filter(([, body]) => /visibility:\s*visible/.test(body)).flatMap(([sel]) => sel);

describe("the print sheet's hide rule", () => {
  it("applies only on a page holding a calendar sheet or a rites packet", () => {
    expect(hides.length).toBeGreaterThan(0);
    for (const sel of hides) expect(sel).toMatch(/^:where\(body:has\((\.calendar-print|\.rites \.packtable)\)\) \*$/);
  });

  it("weighs less than the rules that show the calendar sheet and the rites packet again", () => {
    expect(shows).toEqual(expect.arrayContaining([".calendar-print *", ".rites .packtable *"]));
    for (const hide of hides) {
      for (const show of shows) expect(outranks(specificity(show), specificity(hide)), `${show} must outrank ${hide}`).toBe(true);
    }
  });

  it("counts specificity the way the browser does for these shapes", () => {
    expect(specificity(":where(body:has(.calendar-print)) *")).toEqual([0, 0, 0]);
    expect(specificity("body:has(.calendar-print) *")).toEqual([0, 1, 1]);
    expect(specificity(".calendar-print *")).toEqual([0, 1, 0]);
    expect(specificity(".rites .packtable *")).toEqual([0, 2, 0]);
  });

  it("takes headers and footers off paper only around a sheet, so a page's own header still prints", () => {
    const removed = printRules(PRINT).filter(([, body]) => /display:\s*none/.test(body)).flatMap(([sel]) => sel);
    expect(removed).not.toContain("header");
    expect(removed).not.toContain("footer");
    expect(removed.filter((s) => /\b(header|footer)$/.test(s)).every((s) => s.startsWith(":where(body:has("))).toBe(true);
  });
});
