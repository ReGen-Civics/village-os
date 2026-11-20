/**
 * THE REVIEW PAGE'S READING OF A CHANGE (the lead, 16 Nov 2026: "show more like
 * role cards in that design to make it easier for me to understand the
 * batching, what's changing, what's being proposed").
 *
 * Pure: no database, no Express, no React. The server serves what it computes
 * here beside each change, and /admin/proposals draws it:
 *
 *   faceOf      what a change is, in the reader's terms: "Page words",
 *               "Calendar event", "Season priorities". A `setting` that names
 *               the calendar's route is a calendar event, not an admin setting.
 *   flagsOf     plain warnings read off the route and the body: it replaces a
 *               whole document, it is on a public page, it touches money words,
 *               it creates a calendar event, it changes priorities and their
 *               links. A flag informs. Nothing here blocks an accept.
 *   fieldChanges  the fields a change touches, what is live beside what is
 *               proposed, changed ones marked, so the page can hide the rest.
 *   wordDiff    two texts, word by word: kept, taken out, put in.
 *   listDiff    two lists of lines (a season's goals), row by row: kept, moved,
 *               reworded, added, taken out.
 *
 * shared/proposedChanges.ts is the proposal itself; this file only reads one.
 */
import type { ProposalKind } from "./proposedChanges";

// ── What a change is ────────────────────────────────────────────────────────

export const CHANGE_FACES = [
  "page_words",
  "role_card",
  "faq",
  "village_setting",
  "module",
  "listed_roles",
  "season_priorities",
  "onboarding",
  "calendar_event",
  "meeting_agenda",
  "admin_setting",
] as const;
export type ChangeFace = (typeof CHANGE_FACES)[number];

export interface RouteRef {
  method: string;
  path: string;
}

/** The calendar's own write routes: a new gathering, and one gathering changed. */
const CALENDAR_ROUTE = /^\/api\/admin\/events(?:\/[^/]+)?$/;

export function faceOf(kind: ProposalKind, route: RouteRef): ChangeFace {
  switch (kind) {
    case "page_content":
      return "page_words";
    case "role_card":
    // A role's terms on offer, words only: read on the role's own card.
    case "seat_terms":
      return "role_card";
    case "faq_add":
    case "faq_edit":
    case "faq_remove":
      return "faq";
    case "variable":
      return "village_setting";
    case "module_lifecycle":
    case "module_config":
      return "module";
    case "role_listing":
      return "listed_roles";
    case "season_goals":
      return "season_priorities";
    case "onboarding_path":
      return "onboarding";
    case "session_agenda":
      return "meeting_agenda";
    case "setting":
      return CALENDAR_ROUTE.test(route.path) && route.path !== "/api/admin/events/calendars" ? "calendar_event" : "admin_setting";
  }
}

// ── Flags ───────────────────────────────────────────────────────────────────

export const CHANGE_FLAGS = ["whole_document", "public_page", "money_words", "calendar_event", "priorities_links"] as const;
export type ChangeFlag = (typeof CHANGE_FLAGS)[number];

/** Settings whose document a visitor reads verbatim on a public page. */
const PUBLIC_SETTINGS = /^\/api\/admin\/(?:investor-summary|brand|visit-config|work-with-us-config|brochure-pages|purpose|village-paths|land)$/;

/** Words about money: pay, rewards, dues, prices. Read on keys and paths, never on the prose itself. */
const MONEY = /pay|reward|dues|price|fee|stipend|compens|salary|wage|token|treasur|budget|econom|credit|cost|fund|invest/i;

/** Every key path in a body, flattened ("sections.payCeiling", "goals.0.text"). */
function keyPaths(value: unknown, prefix = "", out: string[] = []): string[] {
  if (value && typeof value === "object") {
    const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>);
    for (const [k, v] of entries) {
      const p = prefix ? `${prefix}.${k}` : k;
      out.push(p);
      keyPaths(v, p, out);
    }
  }
  return out;
}

/**
 * The plain flags on one change, in a fixed order. Read off the kind, the route, the target and the body
 * the person would accept (their edits included), so an edit that adds a pay line raises the flag.
 */
export function flagsOf(kind: ProposalKind, route: RouteRef, target: Record<string, unknown>, body: Record<string, unknown>): ChangeFlag[] {
  const face = faceOf(kind, route);
  const method = String(route.method).toUpperCase();
  const out = new Set<ChangeFlag>();
  // A PUT on a setting saves the body it is given as the whole document. A gathering's PUT writes only the keys it names.
  if (kind === "setting" && method === "PUT" && face !== "calendar_event") out.add("whole_document");
  if (
    kind === "page_content" ||
    kind === "faq_add" ||
    kind === "faq_edit" ||
    kind === "faq_remove" ||
    kind === "role_card" ||
    kind === "seat_terms" ||
    kind === "role_listing" ||
    (kind === "module_lifecycle" && body.lifecycle === "public") ||
    (kind === "setting" && PUBLIC_SETTINGS.test(route.path))
  ) {
    out.add("public_page");
  }
  const keys = keyPaths(body).map((p) => p.split(".").filter((s) => !/^\d+$/.test(s)).pop() ?? "");
  if (MONEY.test(route.path.replace(/^\/api\/admin\//, "")) || (kind === "variable" && MONEY.test(String(target.key ?? ""))) || keys.some((k) => MONEY.test(k))) {
    out.add("money_words");
  }
  if (face === "calendar_event" && method === "POST") out.add("calendar_event");
  if (kind === "season_goals" || (kind === "role_card" && keys.some((k) => /goal/i.test(k)))) out.add("priorities_links");
  return CHANGE_FLAGS.filter((f) => out.has(f));
}

// ── Fields ──────────────────────────────────────────────────────────────────

const isWordList = (v: unknown) => Array.isArray(v) && v.every((x) => x === null || ["string", "number", "boolean"].includes(typeof x));

/** Leaf fields by dotted path. A list of plain values is one field; a list of objects is read row by row. */
function flatten(value: unknown, prefix: string, out: Map<string, unknown>): void {
  if (isWordList(value) || value === null || value === undefined || typeof value !== "object") {
    if (prefix) out.set(prefix, value === undefined ? null : value);
    return;
  }
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>);
  if (!entries.length) {
    if (prefix) out.set(prefix, value);
    return;
  }
  for (const [k, v] of entries) flatten(v, prefix ? `${prefix}.${k}` : k, out);
}

function at(value: unknown, path: string): unknown {
  let cur: unknown = value;
  for (const k of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

const blank = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
const same = (a: unknown, b: unknown) => (blank(a) && blank(b)) || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export interface FieldChange {
  path: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

/**
 * The fields a change touches, live beside proposed. Most kinds send only the fields they change, merged onto
 * what is live, so only those are read. A whole document (`whole`) is read on both sides: a field the proposal
 * leaves out of a document it replaces is a field it takes away, and the page shows that.
 */
export function fieldChanges(live: unknown, proposed: unknown, whole = false): FieldChange[] {
  const p = new Map<string, unknown>();
  flatten(proposed ?? {}, "", p);
  const paths = Array.from(p.keys());
  if (whole) {
    const l = new Map<string, unknown>();
    flatten(live ?? {}, "", l);
    for (const k of Array.from(l.keys())) if (!p.has(k)) paths.push(k);
  }
  return paths.map((path) => {
    const before = at(live, path);
    const after = p.has(path) ? p.get(path) : undefined;
    return { path, before: before === undefined ? null : before, after: after === undefined ? null : after, changed: !same(before, after) };
  });
}

// ── Words ───────────────────────────────────────────────────────────────────

export type DiffOp = "same" | "del" | "add";
export interface Seg {
  op: DiffOp;
  text: string;
}

/** Words and the spaces between them, each a token, so a diff keeps the text's own spacing. */
const tokens = (s: string) => s.split(/(\s+)/).filter((x) => x !== "");

/** Beyond this many cells the word grid is not worth building: the text reads as replaced whole. */
const MAX_CELLS = 400_000;

function pushSeg(out: Seg[], op: DiffOp, text: string) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.op === op) last.text += text;
  else out.push({ op, text });
}

/** Two texts, word by word: what stays, what is taken out, what is put in. */
export function wordDiff(before: string, after: string): Seg[] {
  const a = tokens(before ?? "");
  const b = tokens(after ?? "");
  const out: Seg[] = [];
  if (before === after) {
    pushSeg(out, "same", before ?? "");
    return out;
  }
  // Common head and tail first: most rewordings change the middle of a sentence.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const am = a.slice(head, a.length - tail);
  const bm = b.slice(head, b.length - tail);
  pushSeg(out, "same", a.slice(0, head).join(""));
  if (am.length * bm.length > MAX_CELLS) {
    pushSeg(out, "del", am.join(""));
    pushSeg(out, "add", bm.join(""));
  } else {
    // Longest common subsequence over the middle, then walked forward.
    const n = am.length;
    const m = bm.length;
    const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = am[i] === bm[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (am[i] === bm[j]) {
        pushSeg(out, "same", am[i]);
        i++;
        j++;
      } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
        pushSeg(out, "del", am[i++]);
      } else {
        pushSeg(out, "add", bm[j++]);
      }
    }
    while (i < n) pushSeg(out, "del", am[i++]);
    while (j < m) pushSeg(out, "add", bm[j++]);
  }
  pushSeg(out, "same", a.slice(a.length - tail).join(""));
  return tidy(out);
}

/**
 * A run of changes with only spaces kept between them reads as one change: all its old words struck together,
 * then all its new words, so "Keep the books" to "Hold the money" never reads as a tangle of single words.
 */
function tidy(segs: Seg[]): Seg[] {
  const out: Seg[] = [];
  let del = "";
  let add = "";
  const flush = () => {
    // A side that is only spaces carries no words: the spaces already sit on the other side too.
    if (!del.trim() && !add.trim()) pushSeg(out, "same", del || add);
    else {
      if (del.trim()) pushSeg(out, "del", del);
      if (add.trim()) pushSeg(out, "add", add);
    }
    del = "";
    add = "";
  };
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k];
    if (s.op === "del") del += s.text;
    else if (s.op === "add") add += s.text;
    else if (/^\s*\S{1,3}\s*$|^\s+$/.test(s.text) && !/[.!?;:]/.test(s.text) && (del || add) && segs[k + 1] && segs[k + 1].op !== "same") {
      // Spaces, or one short word such as "the", kept between two changes: the phrase reads as one change.
      del += s.text;
      add += s.text;
    } else {
      flush();
      pushSeg(out, "same", s.text);
    }
  }
  flush();
  return out;
}

// ── Lists ───────────────────────────────────────────────────────────────────

export type RowOp = "same" | "moved" | "reworded" | "added" | "removed";
export interface RowDiff {
  op: RowOp;
  /** The row as it would read; for a removed row, as it reads now. */
  text: string;
  /** A reworded row's words now. */
  before?: string;
  /** Where the row stands now and would stand, counted from 1. */
  from?: number;
  to?: number;
}

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9\u00c0-\u024f']+/g) ?? []);
function likeness(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let both = 0;
  x.forEach((w) => {
    if (y.has(w)) both++;
  });
  return both / (x.size + y.size - both);
}

/**
 * Two lists of lines, row by row, in the proposed order with taken-out rows last. A row kept word for word is
 * `same` while it keeps its place among the kept rows and `moved` when it does not; a new row close enough in
 * words to a row that goes is `reworded` (the page shows the words that changed); anything else is added or
 * taken out.
 */
export function listDiff(before: readonly string[], after: readonly string[]): RowDiff[] {
  const b = before.map((s) => String(s ?? "").trim());
  const a = after.map((s) => String(s ?? "").trim());
  // Kept word for word: the longest run that keeps its order is `same`, other exact matches are `moved`.
  const n = b.length;
  const m = a.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = b[i] === a[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const stay = new Map<number, number>();
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (b[i] === a[j]) {
      stay.set(j, i);
      i++;
      j++;
      // On a tie the proposed row is the one that moved: a row lifted to the top reads as lifted.
    } else if (lcs[i + 1][j] > lcs[i][j + 1]) i++;
    else j++;
  }
  const usedB = new Set(stay.values());
  const rows: Array<RowDiff | null> = new Array(m).fill(null);
  stay.forEach((i, j) => (rows[j] = { op: "same", text: a[j], from: i + 1, to: j + 1 }));
  for (let j = 0; j < m; j++) {
    if (rows[j]) continue;
    const i = b.findIndex((x, k) => !usedB.has(k) && x === a[j]);
    if (i >= 0) {
      usedB.add(i);
      rows[j] = { op: "moved", text: a[j], from: i + 1, to: j + 1 };
    }
  }
  // Reworded: the closest unmatched old row by shared words, when they share enough.
  for (let j = 0; j < m; j++) {
    if (rows[j]) continue;
    let best = -1;
    let score = 0;
    for (let i = 0; i < n; i++) {
      if (usedB.has(i)) continue;
      const s = likeness(b[i], a[j]) + (i === j ? 0.05 : 0);
      if (s > score) {
        score = s;
        best = i;
      }
    }
    if (best >= 0 && score >= 0.3) {
      usedB.add(best);
      rows[j] = { op: "reworded", text: a[j], before: b[best], from: best + 1, to: j + 1 };
    } else {
      rows[j] = { op: "added", text: a[j], to: j + 1 };
    }
  }
  const out = rows.filter((r): r is RowDiff => r !== null);
  for (let i = 0; i < n; i++) if (!usedB.has(i)) out.push({ op: "removed", text: b[i], from: i + 1 });
  return out;
}

/** The lines of a season's goals as a body or a live value holds them. */
export function goalLines(value: unknown): Array<{ text: string; done: boolean }> {
  const goals = value && typeof value === "object" ? (value as Record<string, unknown>).goals : null;
  if (!Array.isArray(goals)) return [];
  return goals.map((g) => (g && typeof g === "object" ? { text: String((g as Record<string, unknown>).text ?? ""), done: !!(g as Record<string, unknown>).done } : { text: String(g ?? ""), done: false }));
}

// ── A meeting's agenda ──────────────────────────────────────────────────────

/** One proposed agenda item as the review card lists it. */
export interface AgendaLine {
  title: string;
  kind: string;
  detail: string;
  ownerRole: string;
}

/**
 * The items a `session_agenda` proposal would add, in order, read leniently from the body the person would accept
 * (their edits included), so the card shows what they are about to accept even before it passes the check.
 */
export function agendaLines(body: unknown): AgendaLine[] {
  const items = body && typeof body === "object" ? (body as Record<string, unknown>).items : null;
  if (!Array.isArray(items)) return [];
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return items.map((it) => {
    const o = it && typeof it === "object" ? (it as Record<string, unknown>) : {};
    return { title: s(o.title), kind: s(o.kind), detail: s(o.detail), ownerRole: s(o.ownerRole) };
  });
}
