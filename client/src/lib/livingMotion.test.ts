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

// index.css holds the tokens and the always-loaded movements; components/motion/motion.css rides with its
// components. Both are held to the same promises, so they are read as one sheet.
const css = ["../index.css", "../components/motion/motion.css"].map((f) => fs.readFileSync(path.resolve(__dirname, f), "utf8")).join("\n");
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

/** An animation list split on its top-level commas (a var() fallback has commas of its own). */
function topLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  return [...parts, cur];
}

const MOVES_ONLY = new Set(["opacity", "translate", "scale", "transform", "stroke-dashoffset"]);
const NO_PREFERENCE = "media (prefers-reduced-motion: no-preference)";

describe("LIVING MOTION in index.css and motion.css", () => {
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
    for (const name of ["m-germinate", "m-touch-light", "m-touch-relight", "m-breathe", "m-breathe-ring", "m-seed-land", "m-draw", "m-unfurl-l", "m-unfurl-r", "m-knot-in", "m-knot-glow", "m-root", "m-reroot", "m-page-in", "m-dapple", "m-firefly", "m-spore"]) {
      keyframes(name).walkDecls((d) => {
        expect(MOVES_ONLY.has(d.prop), `${name} animates ${d.prop}`).toBe(true);
      });
    }
  });

  it("keeps every motion class's transitions and animations inside the reduced-motion guard", () => {
    const moving = rulesFor((s) => /(^|\s)\.m-/.test(s));
    expect(moving.length).toBeGreaterThan(5);
    for (const r of moving) {
      // animation-play-state only ever stops motion (the air pausing), so it may stand outside the guard.
      const moves = r.nodes.some((n) => n.type === "decl" && /^(transition|animation)/.test(n.prop) && n.prop !== "animation-play-state");
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

  it("lets ambient life rest: a breath runs a few times and stops, never forever", () => {
    const breaths = rulesFor((s) => s.startsWith(".m-breathe"));
    expect(breaths.length).toBe(2);
    for (const r of breaths) {
      const anim = r.nodes.find((n): n is Declaration => n.type === "decl" && n.prop === "animation");
      expect(anim?.value, r.selector).toBeDefined();
      expect(anim!.value).not.toMatch(/infinite/);
      const count = Number(anim!.value.trim().split(/\s+/).pop());
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(3);
    }
  });

  it("draws the sprout whole by default: every dash and growth lives behind the guard", () => {
    for (const r of rulesFor((s) => s.startsWith(".m-sprout"))) {
      const sets = r.nodes.some((n) => n.type === "decl" && /^(stroke-dash|animation)/.test(n.prop));
      if (sets) expect(guards(r), r.selector).toContain(NO_PREFERENCE);
    }
  });

  it("arrives only after the reader has moved, and never dims the page being left", () => {
    const rules = rulesFor((s) => s.includes("#main"));
    expect(rules).toHaveLength(1);
    expect(rules[0].selector).toBe(":root[data-m-arrived] #main:not([data-m-stay])");
    expect(guards(rules[0])).toContain(NO_PREFERENCE);
  });

  it("lets a thread's knots glow a few times and rest, never forever", () => {
    const knots = rulesFor((s) => s.includes(".m-knot")).flatMap((r) => r.nodes.filter((n): n is Declaration => n.type === "decl" && n.prop === "animation"));
    expect(knots.length).toBeGreaterThan(0);
    for (const d of knots) {
      expect(d.value).not.toMatch(/infinite/);
      const glow = topLevel(d.value).find((part) => part.includes("m-knot-glow"));
      expect(glow, "the glow is declared").toBeDefined();
      expect(Number(glow!.trim().split(/\s+/).pop())).toBeLessThanOrEqual(3);
    }
  });

  it("fades a new page in without holding anything on <main> once it ends", () => {
    const [r] = rulesFor((s) => s.includes("#main"));
    const anim = r.nodes.find((n): n is Declaration => n.type === "decl" && n.prop === "animation");
    expect(anim?.value).toMatch(/\bbackwards\b/);
    expect(anim?.value).not.toMatch(/\b(both|forwards)\b/);
    keyframes("m-page-in").walkDecls((d) => expect(d.prop, "only opacity on the page").toBe("opacity"));
    const from = (keyframes("m-page-in").nodes ?? []).find((n): n is Rule => n.type === "rule" && n.selector === "from");
    const op = (from?.nodes ?? []).find((n): n is Declaration => n.type === "decl" && n.prop === "opacity");
    expect(Number(op?.value)).toBeGreaterThanOrEqual(0.4);
  });

  it("lets the air pause: every looping air animation has a paused form", () => {
    const pause = rulesFor((s) => s.startsWith(".m-air[data-paused]"));
    expect(pause.length).toBeGreaterThan(0);
    expect(pause[0].toString()).toMatch(/animation-play-state:\s*paused/);
    const loops = rulesFor((s) => s.includes(".m-air")).filter((r) => r.nodes.some((n) => n.type === "decl" && n.prop === "animation" && /infinite/.test(n.value)));
    expect(loops.length).toBeGreaterThan(0);
    for (const r of loops) expect(guards(r), r.selector).toContain(NO_PREFERENCE);
  });
});
