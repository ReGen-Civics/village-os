/**
 * More than one uploaded face (gap G2), and the village's art direction and
 * share-card colours (gap G9).
 */
import { describe, expect, it } from "vitest";
import { fontRoleOf, fontWeightOf, withUploadedFace } from "./brandFonts";
import { buildThemeCss, deriveOf } from "./themeCss";
import { QUEST_SCENES, sceneHexFor, sceneStopsFor } from "../../shared/questScenes";
import { artDirectionOf, artPromptClause } from "../../shared/artDirection";

describe("uploaded faces, one per role (G2)", () => {
  it("puts each face first in its role's stack, keeps one per role, and still writes the one-face fields for the heading", () => {
    let t: Record<string, any> = { fontDisplay: '"Raleway", system-ui, sans-serif' };
    t = withUploadedFace(t, { family: "Fell", url: "/api/uploads/a.woff2", role: "display", weight: "400" });
    t = withUploadedFace(t, { family: "Inter", url: "/api/uploads/b.woff2", role: "body", weight: "100 900" });
    t = withUploadedFace(t, { family: "Fell SC", url: "/api/uploads/c.woff2", role: "label", weight: "400" });
    t = withUploadedFace(t, { family: "Fell Two", url: "/api/uploads/d.woff2", role: "display", weight: "400" });
    expect(t.fontDisplay).toBe('"Fell Two", "Fell", "Raleway", system-ui, sans-serif');
    expect(t.fontBody).toBe('"Inter", system-ui, sans-serif');
    expect(t.tokens["font-label"]).toBe('"Fell SC", Georgia, serif');
    expect(t.fontFaces.map((f: any) => f.role).sort()).toEqual(["body", "display", "label"]);
    expect(t.fontFaceName).toBe("Fell Two");
    expect(t.fontFaceUrl).toBe("/api/uploads/d.woff2");
  });

  it("emits each face once, with its own weights, and drops a hostile one whole", () => {
    const css = buildThemeCss({
      fontFaceName: "Fell", fontFaceUrl: "/api/uploads/a.woff2",
      fontFaces: [
        { family: "Fell", url: "/api/uploads/a.woff2", role: "display", weight: "400" },
        { family: "Inter", url: "/api/uploads/b.woff2", role: "body", weight: "100 900" },
        { family: "Bad", url: "javascript:alert(1).woff2", role: "accent", weight: "400" },
      ],
    });
    expect(css.match(/font-family: "Fell"/g)).toHaveLength(1);
    expect(css).toContain('font-family: "Inter";\n  src: url("/api/uploads/b.woff2") format("woff2");\n  font-weight: 100 900;');
    expect(css).not.toContain("Bad");
  });

  it("reads a role and a weight range, and falls back safely", () => {
    expect(fontRoleOf("body")).toBe("body");
    expect(fontRoleOf("evil")).toBe("display");
    expect(fontWeightOf("700 300")).toBe("300 700");
    expect(fontWeightOf("400")).toBe("400");
    expect(fontWeightOf("bold")).toBe("100 900");
  });
});

describe("the share card's scene in the village's colours (G9)", () => {
  it("is exactly the fallbacks for a village with no theme", () => {
    for (const c of ["", "Governance", "kitchen", "seed bank"]) {
      const [a, b] = sceneStopsFor(c);
      expect(sceneHexFor(c, null)).toEqual([a.hex, b.hex]);
    }
  });

  it("reads the village's tones, and its lifted status inks in the dark scheme", () => {
    const vars = deriveOf({ seed: "#0b1a1e", character: "woven", mode: "dark" })!.vars;
    // Find a circle whose scene starts on the brand.
    const circle = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].find((c) => sceneStopsFor(c)[0].token === "--color-teal-deep")!;
    expect(sceneHexFor(circle, vars)[0]).toBe(vars["--tone-brand"]);
    const sage = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"].find((c) => sceneStopsFor(c)[0].token === "--color-sage");
    if (sage) expect(sceneHexFor(sage, vars)[0]).toBe(vars["--color-sage"]);
    expect(QUEST_SCENES.length).toBeGreaterThan(0);
  });
});

describe("the art direction (G9)", () => {
  it("builds a clause from what the village wrote, and nothing from blanks", () => {
    expect(artPromptClause(artDirectionOf({}))).toBe("");
    const d = artDirectionOf({ medium: " warm  hand-painted\nillustration ", subjects: "hands in soil", never: "skulls, weapons" });
    expect(artPromptClause(d, "deep teal, warm gold")).toBe(
      "Medium: warm hand-painted illustration\nPalette: deep teal, warm gold\nSubjects: hands in soil\nNever show: skulls, weapons",
    );
    expect(artPromptClause({ ...d, palette: "parchment and lantern gold" }, "ignored")).toContain("Palette: parchment and lantern gold");
    expect(artDirectionOf({ medium: "x".repeat(5000) }).medium).toHaveLength(600);
  });
});
