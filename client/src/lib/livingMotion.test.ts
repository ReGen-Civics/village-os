import fs from "node:fs";
import path from "node:path";
import postcss, { type AtRule, type Container, type Declaration, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

/**
 * LIVING MOTION's promises, read from the stylesheet itself (client/src/index.css).
 *
 * The motion is pure CSS, so the only place a regression can hide is the
 * cascade: an animation moved out of its reduced-motion guard, a germinate that
 * starts at nothing, a keyframe that starts animating layout. Each is a rule
 * here, checked against the parsed stylesheet rather than against strings, so
 * reformatting the block cannot pass or fail it.
 */

const css = fs.readFileSync(path.resolve(__dirname, "../index.css"), "utf8");
const root = postcss.parse(css);

/** The at-rules wrapping a node, innermost first, as "name params". */
function guards(node: Rule | Declaration): string[] {
  const out: string[] = [];
  for (let p: Container | undefined = node.parent as Container | undefined; p && p.type !== "root"; p = p.parent as Container | undefined) {
    if (p.type === "atrule") out.push(`${(p as AtRule).name} ${(p as AtRule).params}`);
  }
  return out;
}

function rulesFor(selector: (s: string) => boolean): Rule[] {
  const found: Rule[] = [];
  root.walkRules((r) => {
    if (r.parent?.type === "atrule" && (r.parent as AtRule).name === "keyframes") return;
    if (r.selectors.some(selector)) found.push(r);
  });
  return found;
}

function keyframes(name: string): AtRule {
  let kf: AtRule | undefined;
  root.walkAtRules("keyframes", (a) => {
    if (a.params === name) kf = a;
  });
  if (!kf) throw new Error(`@keyframes ${name} is missing`);
  return kf;
}

const MOVES_ONLY = new Set(["opacity", "translate", "scale", "transform"]);
const NO_PREFERENCE = "media (prefers-reduced-motion: no-preference)";

describe("LIVING MOTION in index.css", () => {
  it("declares the motion tokens once, on :root", () => {
    const decls = new Map<string, string>();
    root.walkDecls(/^--m-/, (d) => {
      if ((d.parent as Rule).selector === ":root") decls.set(d.prop, d.value);
    });
    for (const t of ["--m-touch", "--m-settle", "--m-grow", "--m-bloom", "--m-breath", "--m-ease", "--m-ease-sprout", "--m-ease-sway", "--m-rise"]) {
      expect(decls.has(t), t).toBe(true);
    }
    expect(decls.get("--m-ease")).toBe("cubic-bezier(0.2, 0.7, 0.2, 1)");
  });

  it("germinates only behind view-timeline support and with no reduced-motion preference", () => {
    const animated = rulesFor((s) => s === ".m-germ").filter((r) => r.some((n) => n.type === "decl" && n.prop.startsWith("animation")));
    expect(animated.length).toBeGreaterThan(0);
    for (const r of animated) {
      const g = guards(r);
      expect(g).toContain(NO_PREFERENCE);
      expect(g).toContain("supports (animation-timeline: view())");
    }
  });

  it("ties germinate to scroll, with the timeline set after the shorthand that would reset it", () => {
    const r = rulesFor((s) => s === ".m-germ").find((x) => x.some((n) => n.type === "decl" && n.prop === "animation-timeline"));
    if (!r) throw new Error(".m-germ sets no animation-timeline");
    const props = (r.nodes ?? []).filter((n): n is Declaration => n.type === "decl").map((d) => d.prop);
    expect(props.indexOf("animation-timeline")).toBeGreaterThan(props.indexOf("animation"));
    expect(props.indexOf("animation-range")).toBeGreaterThan(props.indexOf("animation"));
  });

  it("never starts a germinating card hidden", () => {
    const from = (keyframes("m-germinate").nodes ?? []).find((n): n is Rule => n.type === "rule" && n.selector === "from");
    const opacity = (from?.nodes ?? []).find((n): n is Declaration => n.type === "decl" && n.prop === "opacity");
    expect(opacity, "the first frame sets an opacity").toBeDefined();
    expect(Number(opacity!.value)).toBeGreaterThanOrEqual(0.4);
  });

  it("moves only compositor properties in its keyframes", () => {
    for (const name of ["m-germinate", "m-touch-light", "m-touch-relight"]) {
      keyframes(name).walkDecls((d) => {
        expect(MOVES_ONLY.has(d.prop), `${name} animates ${d.prop}`).toBe(true);
      });
    }
  });

  it("keeps every touch transition and animation inside the reduced-motion guard", () => {
    for (const r of rulesFor((s) => s.startsWith(".m-touch"))) {
      const moves = r.nodes.some((n) => n.type === "decl" && /^(transition|animation)/.test(n.prop));
      if (moves) expect(guards(r), r.selector).toContain(NO_PREFERENCE);
    }
  });

  it("never touches a focus ring", () => {
    for (const r of rulesFor((s) => s.startsWith(".m-touch") || s.startsWith(".m-germ"))) {
      expect(r.selector).not.toMatch(/focus/);
      r.walkDecls((d) => expect(d.prop).not.toMatch(/^outline/));
    }
  });

  it("leaves ::after to the coarse-pointer tap target", () => {
    for (const r of rulesFor((s) => s.startsWith(".m-touch") || s.startsWith(".m-germ"))) {
      expect(r.selector).not.toMatch(/::?after/);
    }
  });
});
