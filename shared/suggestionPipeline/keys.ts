/**
 * THE REVIEW ENGINE: what a suggestion is ABOUT (docs/REVIEW_INBOX_PLAN.md, gate 1).
 *
 * Two suggestions from two streams are about the same thing when they write the same thing. That question already
 * has one answer in this repository, `footprintOf` and `overlaps` in shared/proposalConflicts.ts, and this file
 * reuses it rather than keeping a second vocabulary that would drift from the review page's own conflict flags.
 *
 * What the footprint cannot see is a thing that does not exist yet: two suggestions that each create "the Water
 * Steward" write nothing in common, because neither role exists. Those get a CREATION KEY built from the name, and
 * the name is read through a lookalike skeleton (`skeleton`), so "Water Steward" typed with a Cyrillic "а" lands on
 * the same key as the real one and cannot slip past the conflict card or the discard window. A name that mixes
 * scripts is held (`mixedScript`) instead of guessed at.
 *
 * The person's words are never changed here. The skeleton is for the KEY only.
 *
 * Pure: no database, no Express, no React.
 */
import { footprintOf, overlaps, type Footprint } from "../proposalConflicts";
import { routeOf, type ProposalKind } from "../proposedChanges";

// ── The lookalike skeleton ──────────────────────────────────────────────────

/**
 * Letters that read as a Latin letter in another script, after lowercasing. A small, deliberate table: the Cyrillic
 * and Greek letters a name can be spoofed with, and the digits that pass for letters. Unicode's full confusables
 * list (UTS #39) is thousands of rows; this table covers the scripts a village name is spoofed in, and a name that
 * still mixes scripts after it is held by `mixedScript` rather than trusted.
 */
const LOOKALIKES: Readonly<Record<string, string>> = {
  // Cyrillic
  "а": "a", "в": "b", "е": "e", "ё": "e", "з": "3", "і": "i", "ї": "i", "ј": "j", "к": "k", "м": "m", "н": "h", "о": "o",
  "р": "p", "с": "c", "т": "t", "у": "y", "х": "x", "ѕ": "s", "ԁ": "d", "ԛ": "q", "ԝ": "w", "һ": "h", "ӏ": "l", "ь": "b",
  // Greek
  "α": "a", "β": "b", "ε": "e", "η": "n", "ι": "i", "κ": "k", "ν": "v", "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "χ": "x",
  "ϲ": "c", "ϳ": "j",
  // Digits and marks that pass for letters
  "0": "o", "1": "l", "|": "l",
};

/** Characters that take up no space and can split a word without anyone seeing it. */
const INVISIBLE = /[­͏؜ᅟᅠ឴឵᠋-᠏​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ]/g;

/**
 * The form two names are compared in: compatibility-normalised (NFKC, which also folds full-width letters), invisible
 * characters removed, lowercased, combining marks kept, lookalike letters mapped to the Latin letter they pass for,
 * and runs of space collapsed. Two names with the same skeleton are, for a key, the same name.
 */
export function skeleton(text: string): string {
  const folded = String(text ?? "").normalize("NFKC").replace(INVISIBLE, "").toLowerCase();
  let out = "";
  for (const ch of folded) out += LOOKALIKES[ch] ?? ch;
  return out.replace(/\s+/g, " ").trim();
}

// Built with the constructor: the compile target refuses the `u` flag in a literal, and every engine this runs in
// (Node 22, and every browser that runs the app's ES modules) reads Unicode script properties.
const SCRIPTS: ReadonlyArray<[string, RegExp]> = [
  ["latin", new RegExp("\\p{Script=Latin}", "u")],
  ["cyrillic", new RegExp("\\p{Script=Cyrillic}", "u")],
  ["greek", new RegExp("\\p{Script=Greek}", "u")],
];

/** Whether a name mixes Latin, Cyrillic and Greek letters within one word, the shape a spoofed name takes. */
export function mixedScript(text: string): boolean {
  for (const word of String(text ?? "").normalize("NFKC").split(/\s+/)) {
    const seen = new Set<string>();
    for (const ch of word) for (const [name, re] of SCRIPTS) if (re.test(ch)) seen.add(name);
    if (seen.size > 1) return true;
  }
  return false;
}

// ── Keys ────────────────────────────────────────────────────────────────────

/** What a staged suggestion writes, in the shape the engine compares. */
export interface Aim {
  /** What it writes in an existing thing, as the review page's own conflict flags read it. Null when it only creates. */
  footprint: Footprint | null;
  /** What it creates, by a lookalike-proof name, such as `new:faq:steward:how do i join`. */
  creates: string[];
  /** The names this suggestion brings in, for the mixed-script hold. */
  names: string[];
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const text = (v: unknown) => (typeof v === "string" ? v : "");

/** The field a creation is named by, in the order a route reads it. */
const NAME_FIELDS = ["name", "title", "question"] as const;

function nameOf(body: Record<string, unknown>): string {
  for (const f of NAME_FIELDS) if (text(body[f]).trim()) return text(body[f]);
  return "";
}

/** What one suggestion writes or creates. */
export function aimOf(kind: ProposalKind, target: Record<string, unknown>, body: Record<string, unknown>): Aim {
  const route = routeOf(kind, target);
  const b = obj(body) ?? {};
  if (kind === "faq_add") {
    const q = text(b.question);
    return { footprint: null, creates: [`new:faq:${skeleton(text(target.pathway))}:${skeleton(q)}`], names: [q] };
  }
  if (kind === "session_agenda") {
    const items = Array.isArray(b.items) ? b.items.map((i) => text(obj(i)?.title)) : [];
    return { footprint: null, creates: items.map((t) => `new:agenda:${skeleton(text(target.circleId))}:${skeleton(t)}`), names: items };
  }
  // A POST that names what it makes is a creation: two of them collide only when they make the same named thing.
  if (kind === "setting" && route.method === "POST") {
    const name = nameOf(b);
    if (name) return { footprint: null, creates: [`new:${route.path}:${skeleton(name)}`], names: [name] };
  }
  const names = kind === "role_card" ? [text(obj(b.words)?.name)].filter(Boolean) : [];
  return { footprint: footprintOf(kind, target, route, b), creates: [], names };
}

/** Whether two aims touch the same thing: they write the same field, or create the same named thing. */
export function aimsMeet(a: Aim, b: Aim): boolean {
  if (overlaps(a.footprint, b.footprint)) return true;
  return a.creates.some((k) => b.creates.includes(k));
}

/** An aim as plain strings, for records kept elsewhere (a vote's subject, a discard, a decision). */
export function keysOfAim(a: Aim): string[] {
  const out = [...a.creates];
  if (a.footprint) {
    if (a.footprint.whole) out.push(`${a.footprint.doc}#*`);
    else for (const f of a.footprint.fields) out.push(`${a.footprint.doc}#${f}`);
  }
  return out;
}

const inside = (a: string, b: string) => a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`);

function keyMeets(a: string, b: string): boolean {
  if (a.startsWith("new:") || b.startsWith("new:")) return a === b;
  const i = a.lastIndexOf("#");
  const j = b.lastIndexOf("#");
  if (i < 0 || j < 0 || a.slice(0, i) !== b.slice(0, j)) return false;
  const fa = a.slice(i + 1);
  const fb = b.slice(j + 1);
  return fa === "*" || fb === "*" || inside(fa, fb);
}

/**
 * Whether two sets of keys touch the same thing, by the same rule as `aimsMeet`: a record kept as strings (a vote's
 * subject, a discard, a decision) is compared without being read back into one footprint, so a record naming several
 * documents loses none of them.
 */
export function keysMeet(a: readonly string[], b: readonly string[]): boolean {
  return a.some((x) => b.some((y) => keyMeets(x, y)));
}

// ── What a suggestion needs to exist first ──────────────────────────────────

/**
 * The things a change needs to exist before it can land, as plain refs (`role:<id>`, `module:<id>`,
 * `season:<id>`). A ref that is live is met; one another waiting suggestion creates is an order to keep; one
 * nothing creates holds the change. A stream's adapter may add refs of its own.
 */
export function needsOf(kind: ProposalKind, target: Record<string, unknown>, body: Record<string, unknown>): string[] {
  switch (kind) {
    case "role_card":
    case "seat_terms":
      return target.roleId ? [`role:${String(target.roleId)}`] : [];
    case "role_listing": {
      const ids = Array.isArray(obj(body)?.ids) ? (obj(body)!.ids as unknown[]) : [];
      return ids.map((id) => `role:${String(id)}`);
    }
    case "module_config":
      return target.id ? [`module:${String(target.id)}`] : [];
    case "season_goals":
      return target.seasonId ? [`season:${String(target.seasonId)}`] : [];
    default:
      return [];
  }
}
