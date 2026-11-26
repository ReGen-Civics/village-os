/**
 * ADMIN'S LIGHT GROUND SURVIVES DARK MODE (admin live pass A2 and A3, 25 Nov 2026).
 *
 * Admin stays light by ruling, so in dark mode `.admin-root` takes its tokens
 * back from copies taken on the page root (`--light-background:
 * var(--background)` and the rest, client/src/index.css). That only works
 * while the ROOT keeps the light values. A `--mode-ground` night value on
 * `:root[data-mode="dark"]` made the root's --background the night, so Admin's
 * "light" ground became the night while its ink stayed dark: Needs and Setup
 * read 1.36:1 and the Search Admin trigger 1.69:1. The night reaches pages
 * through <body> instead. This pins both halves.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.join(__dirname, "../../index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Every declaration block whose selector list is exactly `sel`. */
function blocks(sel: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) if (m[1].trim() === sel) out.push(m[2]);
  return out;
}

describe("Admin's light ground in dark mode", () => {
  it("the dark root declares no night ground for the root's --background to read", () => {
    const dark = blocks(':root[data-mode="dark"]').join("\n");
    expect(dark).not.toMatch(/--mode-ground\s*:/);
    expect(dark).not.toMatch(/(^|[;\s])--background\s*:/);
  });

  it("the night still reaches the page through body", () => {
    expect(blocks(':root[data-mode="dark"] body').join("\n")).toMatch(/--background:\s*var\(--sheet-ground\)/);
  });

  it("Admin takes its ground back from the root's light copy", () => {
    expect(css).toMatch(/--light-background:\s*var\(--background\)/);
    expect(blocks(':root[data-mode="dark"]:not([data-scheme="dark"]) .admin-root:not(.sheet-night)').join("\n")).toMatch(/--background:\s*var\(--light-background\)/);
  });
});
