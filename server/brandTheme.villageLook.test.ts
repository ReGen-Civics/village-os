/**
 * THE VILLAGE'S DEFAULT MODE AND PAPER, WRITTEN INTO EVERY PAGE (server/routes/brandTheme.ts).
 *
 * The first-paint script in client/index.html runs before any request, so the server puts the
 * village's two dials on <html> as attributes: look.default_mode as data-village-mode and
 * look.light_paper as data-village-paper. These hold what gets written, that only known values are,
 * and that the script stays byte for byte the same, which is what keeps its CSP hash.
 */
import { describe, expect, it, vi } from "vitest";

const dials: Record<string, string> = {};
vi.mock("./lib/variables", async (load) => {
  const real = await load<typeof import("./lib/variables")>();
  return { ...real, stringVar: (key: string) => (key in dials ? dials[key] : real.stringVar(key)) };
});

const { shellWithTheme, withVillageLook } = await import("./routes/brandTheme");

const SHELL = '<!doctype html>\n<html lang="en">\n<head><script>(function(){var x=1;})();</script></head><body></body></html>';
const scriptOf = (html: string) => /<script>[\s\S]*?<\/script>/.exec(html)?.[0];
const htmlTag = (html: string) => /<html[^>]*>/.exec(html)?.[0];

describe("withVillageLook", () => {
  it("writes the village's mode and paper onto <html>", () => {
    const out = withVillageLook(SHELL, { mode: "dark", paper: "sea-chart" });
    expect(htmlTag(out)).toBe('<html lang="en" data-village-mode="dark" data-village-paper="sea-chart">');
  });

  it("writes only known values, so a stray dial leaves the platform default standing", () => {
    expect(htmlTag(withVillageLook(SHELL, { mode: "sepia", paper: "parchment" }))).toBe('<html lang="en">');
    expect(htmlTag(withVillageLook(SHELL, { mode: "light", paper: "" }))).toBe('<html lang="en" data-village-mode="light">');
  });

  it("never touches the script, so its CSP hash still matches", () => {
    expect(scriptOf(withVillageLook(SHELL, { mode: "dark", paper: "sea-chart" }))).toBe(scriptOf(SHELL));
  });

  it("writes once, even when a shell passes through twice", () => {
    const twice = withVillageLook(withVillageLook(SHELL, { mode: "dark", paper: "plain" }), { mode: "light", paper: "sea-chart" });
    expect(htmlTag(twice)).toBe('<html lang="en" data-village-mode="dark" data-village-paper="plain">');
  });
});

describe("shellWithTheme", () => {
  it("carries the platform defaults for a village that set nothing: light, on plain paper", () => {
    delete dials["look.default_mode"];
    delete dials["look.light_paper"];
    expect(htmlTag(shellWithTheme(SHELL, () => null))).toContain('data-village-mode="light" data-village-paper="plain"');
  });

  it("carries a village's own choice on the very next page", () => {
    dials["look.default_mode"] = "dark";
    dials["look.light_paper"] = "sea-chart";
    expect(htmlTag(shellWithTheme(SHELL, () => null))).toContain('data-village-mode="dark" data-village-paper="sea-chart"');
  });
});
