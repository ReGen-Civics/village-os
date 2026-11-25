#!/usr/bin/env node
/**
 * BUTTONS ARE BUTTONS, in Admin (Admin evolution, PR 1). REPORT MODE.
 *
 * The lead's rule for Admin: every clickable thing is a real button or a real
 * link, with a visible affordance, and an act is never drawn as text. The
 * audit behind it found about forty real buttons drawn as underlined grey
 * text (a journey's Stop and a letter's Cancel among them), six icon-only
 * buttons with no name (four of them deletes), and links and buttons used for
 * each other's jobs. This script finds those shapes so they can be counted
 * down, the way the brand and voice guards count theirs.
 *
 * It parses every file with the TypeScript compiler and reads JSX elements,
 * never text, so a comment or a string cannot trip it. Four rules:
 *
 *   clickable-non-control  an onClick on an element that is not a button, a
 *                          link, a form control, a label or a summary. A div
 *                          that acts cannot be reached by keyboard and reads
 *                          as nothing to a screen reader.
 *   button-drawn-as-text   a <button> whose classes underline it, or draw it
 *                          with no edge and no fill, so it reads as words.
 *   link-used-as-action    an <a> or <Link> with an onClick and no real href
 *                          (missing, "#" or javascript:). An act wearing a
 *                          link's clothes; Enter and a middle click disagree.
 *   unnamed-icon-button    a <button> with no text of its own and no
 *                          aria-label or title. Read aloud as "button".
 *
 * A genuine exception takes `affordance-ok: <reason>` in a comment on the
 * element's first line or the line above it.
 *
 * REPORT MODE ONLY, for now. It prints what it finds and exits 0. Once the
 * count has come down, a baseline turns it into a ratchet that may only fall.
 *
 *   node scripts/check-admin-affordances.mjs [--report] [--json] [--root DIR] [--files a,b]
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const ROOT = path.resolve(opt("--root") ?? path.join(path.dirname(new URL(import.meta.url).pathname), ".."));
const SCOPE = ["client/src/components/admin", "client/src/pages/Admin.tsx"];

/** Intrinsic elements that may carry an onClick and still be a control. */
const CONTROLS = new Set(["button", "a", "input", "select", "textarea", "label", "summary", "option", "form"]);
/** Components that render a real link. */
const LINKS = new Set(["a", "Link"]);

function listFiles() {
  const only = opt("--files");
  if (only) return only.split(",").map((f) => f.trim()).filter(Boolean);
  const out = [];
  const walk = (rel) => {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return;
    const st = fs.statSync(abs);
    if (st.isFile()) {
      if (/\.tsx$/.test(rel) && !/\.test\.tsx$/.test(rel)) out.push(rel);
      return;
    }
    for (const name of fs.readdirSync(abs).sort()) walk(path.join(rel, name));
  };
  for (const s of SCOPE) walk(s);
  return out;
}

function tagName(node) {
  const t = node.tagName;
  if (ts.isIdentifier(t)) return t.text;
  if (ts.isPropertyAccessExpression(t)) return t.getText();
  return t.getText();
}

function attr(opening, name) {
  for (const a of opening.attributes.properties) {
    if (ts.isJsxAttribute(a) && a.name.getText() === name) return a;
  }
  return null;
}

/**
 * The literal text of a className, as far as it can be read, and whether any
 * part of it comes from code (a variable, a call), which this cannot see.
 */
function classOf(opening) {
  const a = attr(opening, "className");
  if (!a || !a.initializer) return { text: "", dynamic: false };
  const parts = [];
  let dynamic = false;
  const visit = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) parts.push(n.text);
    else if (ts.isTemplateExpression(n)) {
      parts.push(n.head.text);
      for (const s of n.templateSpans) {
        parts.push(s.literal.text);
        visit(s.expression);
      }
      return;
    } else if (ts.isIdentifier(n) || ts.isPropertyAccessExpression(n) || ts.isCallExpression(n)) {
      dynamic = true;
      if (ts.isCallExpression(n)) n.arguments.forEach(visit);
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(a.initializer);
  return { text: parts.join(" "), dynamic };
}

/**
 * True when the classes draw a button as words: underlined, or set in a text
 * colour with no edge, no fill and no ring. Classes that come partly from code
 * are judged only on an underline, because the rest is out of sight.
 */
export function drawnAsText(cls, dynamic = false) {
  const base = cls.split(/\s+/).filter((t) => t && !t.includes(":"));
  if (base.includes("underline")) return true;
  if (dynamic || !base.length) return false;
  const hasEdge = base.some((t) => /^border($|-)/.test(t) && !/^border-(transparent|none|0|collapse|separate|dashed|dotted|solid)$/.test(t));
  const hasFill = base.some((t) => /^bg-/.test(t) && !/^bg-(transparent|none)$/.test(t));
  const hasRing = base.some((t) => /^ring($|-\d)/.test(t) && t !== "ring-0");
  const textColour = base.some((t) => /^text-/.test(t) && !/^text-(xs|sm|base|lg|xl|\dxl|left|right|center|start|end)$/.test(t));
  return textColour && !hasEdge && !hasFill && !hasRing;
}

function hasOwnText(el) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isJsxText(n) && n.text.trim()) found = true;
    else if (ts.isJsxExpression(n) && n.expression && !ts.isJsxElement(n.expression) && !ts.isJsxSelfClosingElement(n.expression)) found = true; // {label}, {t(...)}: text from code
    else if ((ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) && n !== el) {
      const opening = ts.isJsxElement(n) ? n.openingElement : n;
      const name = tagName(opening);
      // An icon carries only styling. A component given anything else (a label,
      // text, children) is taken to say something.
      const ICON_ATTRS = new Set(["className", "aria-hidden", "size", "strokeWidth", "style", "color", "focusable"]);
      const saysSomething = /^[A-Z]/.test(name) && (ts.isJsxElement(n) || opening.attributes.properties.some((a) => !ts.isJsxAttribute(a) || !ICON_ATTRS.has(a.name.getText())));
      if (name === "Trans" || saysSomething) found = true;
      else if (ts.isJsxElement(n)) n.children.forEach(visit);
      return;
    }
    else ts.forEachChild(n, visit);
  };
  if (ts.isJsxElement(el)) el.children.forEach(visit);
  return found;
}

function waived(sf, node) {
  const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
  const lines = sf.text.split("\n");
  return [lines[line] ?? "", lines[line - 1] ?? ""].some((l) => /affordance-ok:/.test(l));
}

export function scanSource(rel, text) {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];
  const add = (rule, node, detail) => {
    if (waived(sf, node)) return;
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    findings.push({ rule, file: rel, line: line + 1, detail });
  };
  const visit = (n) => {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const opening = ts.isJsxElement(n) ? n.openingElement : n;
      const name = tagName(opening);
      const intrinsic = /^[a-z]/.test(name);
      const onClick = attr(opening, "onClick");
      // An element that declares an interactive role (an option in a listbox, a
      // menu item, a tab) is a control by its role, the ARIA pattern for lists
      // a keyboard moves through; its keys live on the owning widget.
      const roleOf = attr(opening, "role");
      const declaredRole = roleOf?.initializer && ts.isStringLiteral(roleOf.initializer) ? roleOf.initializer.text : "";
      const interactiveRole = ["option", "menuitem", "menuitemradio", "menuitemcheckbox", "tab", "button", "link", "switch", "checkbox", "radio"].includes(declaredRole);
      if (onClick && intrinsic && !CONTROLS.has(name) && !interactiveRole) add("clickable-non-control", opening, `<${name} onClick>`);
      if (name === "button") {
        const cls = classOf(opening);
        const ownText = hasOwnText(n);
        const roleAttr = attr(opening, "role");
        const role = roleAttr?.initializer && ts.isStringLiteral(roleAttr.initializer) ? roleAttr.initializer.text : "";
        // A menu row, a tab or an option is drawn by its container; an icon-only
        // button is judged by its name, below.
        const drawnByContainer = ["menuitem", "menuitemradio", "menuitemcheckbox", "tab", "option", "switch"].includes(role);
        if (ownText && !drawnByContainer && drawnAsText(cls.text, cls.dynamic)) add("button-drawn-as-text", opening, cls.text.trim().slice(0, 100));
        if (!attr(opening, "aria-label") && !attr(opening, "title") && !attr(opening, "aria-labelledby") && !ownText) {
          add("unnamed-icon-button", opening, "no text, aria-label or title");
        }
      }
      if (LINKS.has(name) && onClick) {
        const href = attr(opening, "href") ?? attr(opening, "to");
        const lit = href?.initializer && ts.isStringLiteral(href.initializer) ? href.initializer.text : null;
        if (!href || lit === "#" || (lit && lit.startsWith("javascript:"))) add("link-used-as-action", opening, `<${name}> with onClick and no real address`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return findings;
}

function main() {
  const files = listFiles();
  const findings = [];
  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    findings.push(...scanSource(rel, fs.readFileSync(abs, "utf8")));
  }
  if (flag("--json")) {
    process.stdout.write(JSON.stringify({ files: files.length, findings }, null, 2) + "\n");
    return;
  }
  const byRule = new Map();
  for (const f of findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1);
  console.log(`check-admin-affordances (report): ${findings.length} finding(s) in ${files.length} file(s)`);
  for (const [rule, n] of [...byRule].sort((a, b) => b[1] - a[1])) console.log(`  ${rule}: ${n}`);
  for (const f of findings) console.log(`${f.file}:${f.line}  ${f.rule}  ${f.detail}`);
  // Report mode: it never fails the run. A baseline will make it a ratchet.
}

if (import.meta.url === `file://${process.argv[1]}`) main();
