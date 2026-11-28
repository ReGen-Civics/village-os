/**
 * THE PAGE YIELDS HER ROOM: the one rule in ./dock.css, and the two pages it reads (GuideDock.tsx sets the word on
 * the root; GuideDock.test.tsx holds that half). A stylesheet is not compiled, so this reads it as text.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROOMY_WINDOW } from "./GuideDock";

const here = path.join(process.cwd(), "client", "src", "components", "admin", "dock");
const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8").replace(/\r\n/g, "\n");
const css = read("client", "src", "components", "admin", "dock", "dock.css").replace(/\/\*[\s\S]*?\*\//g, "");

describe("dock.css", () => {
  it("is one rule: at the side of a wide window, the page's main and the site's footer end where she begins", () => {
    const media = Array.from(css.matchAll(/@media\s*([^{]+)\{((?:[^{}]|\{[^{}]*\})*)\}/g));
    expect(media).toHaveLength(1);
    expect(media[0][1].trim()).toBe(ROOMY_WINDOW);
    const rules = Array.from(media[0][2].matchAll(/([^{}]+)\{([^{}]*)\}/g), (m) => ({ selector: m[1].trim(), body: m[2].trim() }));
    expect(rules).toEqual([{ selector: ':root[data-guide-dock="docked"] :is(main, main ~ footer)', body: "margin-right: 26rem;" }]);
    // Nothing outside the one media block: on a narrower window, or wide, or as a sheet, the page keeps its own width.
    expect(css.replace(media[0][0], "").trim()).toBe("");
  });

  it("draws nothing, so it names no colour", () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\(|color:|background/i);
  });

  it("agrees with her frame: the same 26rem she is wide at the side, and it is fetched with her", () => {
    const dock = read("client", "src", "components", "admin", "dock", "GuideDock.tsx");
    expect(dock).toContain('standing === "docked" ? "w-[26rem]" : "left-0 w-full"');
    expect(dock).toMatch(/^import "\.\/dock\.css";$/m);
    expect(fs.existsSync(path.join(here, "dock.css"))).toBe(true);
  });
});

describe("the two pages the rule reads", () => {
  it("Admin draws its content in exactly one <main>, beside its rail and after its header and the helper's host", () => {
    const admin = read("client", "src", "pages", "Admin.tsx");
    expect(admin.match(/<main[\s>]/g)).toHaveLength(1);
    expect(admin).toMatch(/<main className="admin-fit [^"]*">/);
    // No site footer follows it, so the footer half of the rule finds nothing there.
    expect(admin).not.toMatch(/<footer[\s>]/);
    expect(admin.indexOf("<AdminHeader")).toBeLessThan(admin.indexOf("<AdminHelperHost"));
    expect(admin.indexOf("<AdminHelperHost")).toBeLessThan(admin.search(/<main[\s>]/));
  });

  it("the site's layout, which the road to launch is drawn in, has one <main> and the footer after it as its sibling", () => {
    const layout = read("client", "src", "components", "Layout.tsx");
    expect(layout.match(/<main[\s>]/g)).toHaveLength(1);
    const main = layout.search(/<main[\s>]/);
    const closed = layout.indexOf("</main>");
    const footer = layout.search(/<footer[\s>]/);
    expect(main).toBeGreaterThan(-1);
    expect(closed).toBeGreaterThan(main);
    // The footer opens after the main closes, and the header before it: she starts under the header, which keeps its width.
    expect(footer).toBeGreaterThan(closed);
    expect(layout.search(/<header[\s>]/)).toBeLessThan(main);
    // Nothing but whitespace, comments and conditionals stands between them, so `main ~ footer` finds it.
    expect(layout.slice(closed + "</main>".length, footer)).not.toMatch(/<(?:div|section|aside|nav)[\s>]/);
    const road = read("client", "src", "pages", "JourneyToLaunch.tsx");
    expect(road).toMatch(/<Layout>/);
    expect(road).not.toMatch(/<main[\s>]/);
  });
});
