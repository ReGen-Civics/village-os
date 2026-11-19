/**
 * THE APPLICATION'S SAVED DRAFT (the lead, 11 Nov 2026: "Back keeps what was
 * entered, and progress is saved").
 *
 * A draft lives in this browser only, one per role and per link, so somebody
 * can leave and come back to the step they were on. What it keeps is the
 * applicant's own words. What it never keeps, by rule:
 *   - references (other people's names and contacts) and the background-check
 *     consent: third-party data stays on the screen until it is sent;
 *   - files, which a browser cannot store safely anyway;
 *   - the agreements and the membership alignment, which are asked fresh.
 * A draft older than DRAFT_DAYS is ignored, and a sent application clears it.
 *
 * Pure: the page reads and writes through lib/safeStorage, and a test reads
 * every rule here without drawing a page.
 */
import type { ProposalLink } from "@shared/proposalAttachments";
import type { ProposalGoal } from "@shared/proposalGoals";
import type { TermAnswers } from "@shared/termsWords";
import type { DraftMarks } from "@shared/seraDrafts";
import { pieceSuggestionsOf, type PieceSuggestion } from "@shared/pieceSuggestions";
import { payAskOf, type PayAsk } from "@shared/commitmentRange";
import type { ShapeShare } from "@shared/proposalSplit";

export const DRAFT_VERSION = 1;
export const DRAFT_DAYS = 30;

/** The key a draft is kept under: the role, and the personal link when there is one. */
export function draftKey(roleId: string, link: string): string {
  return `apply-draft:v${DRAFT_VERSION}:${link ? `link:${link.slice(0, 100)}` : "public"}:${roleId}`;
}

export interface ApplyDraft {
  savedAt: string;
  step: number;
  reached: number;
  knowUs: string[];
  why: string;
  name: string;
  email: string;
  about: { based: string; languages: string; story: string };
  selfKnowledge: string;
  links: ProposalLink[];
  aim: string;
  items: ProposalGoal[];
  marks: DraftMarks;
  /** `paySplit`: the split's percents as they left it (shared/proposalSplit.ts); the amounts are worked again on return. */
  terms: { answers: TermAnswers; commitmentPct: number | null; payAsk?: PayAsk | null; paySplit?: ShapeShare[] | null };
  rampUp: boolean;
  practical: { timeZone: string; windows: string[]; earliestStart: string };
  /** What they would make of the role card, piece by piece (shared/pieceSuggestions.ts). Their own words, so it waits here with the rest. */
  pieceSuggestions: PieceSuggestion[];
  /**
   * The roles added after the first, each with its own commitment, price ask and split percents (the lead, 17 Nov
   * 2026). Kept under the first role's key, so a reload comes back with every role. Absent on a draft saved before.
   */
  extras?: DraftExtra[];
}

/** One role added to the application, as the draft keeps it. */
export interface DraftExtra {
  roleId: string;
  terms: ApplyDraft["terms"];
}

/** The most roles one application adds after the first (shared/openProposals.ts OPEN_APPLY_ROLES, less the first). */
const EXTRAS_MAX = 2;

/** An id, a key or a date: held to its own short length. */
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");
/**
 * The applicant's own words, read back WHOLE (the lead, 19 Nov 2026: a draft is never cut). A draft typed when a
 * box held more, or under a cap since raised, comes back exactly as it was kept. The box shows its count and the
 * send says what is too long; reading a draft back never shortens it.
 */
const own = (v: unknown): string => (typeof v === "string" ? v : "");
const strs = (v: unknown, n: number, max = 300): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => x.slice(0, max)).slice(0, n) : []);

/**
 * What is written: exactly the fields above, whatever else the page holds.
 * References, consent, files and agreements cannot reach it, because the type
 * has no place for them and this copies field by field.
 */
export function toDraft(d: Omit<ApplyDraft, "savedAt">, now: Date): ApplyDraft {
  return {
    savedAt: now.toISOString(),
    step: d.step,
    reached: d.reached,
    knowUs: [...d.knowUs],
    why: d.why,
    name: d.name,
    email: d.email,
    about: { based: d.about.based, languages: d.about.languages, story: d.about.story },
    selfKnowledge: d.selfKnowledge,
    links: d.links.map((l) => ({ label: l.label, url: l.url })),
    aim: d.aim,
    items: d.items.map((g) => ({ ...g })),
    marks: { ...(d.marks.aim ? { aim: d.marks.aim } : {}), ...(d.marks.story ? { story: d.marks.story } : {}) },
    terms: termsToDraft(d.terms),
    rampUp: d.rampUp,
    practical: { timeZone: d.practical.timeZone, windows: [...d.practical.windows], earliestStart: d.practical.earliestStart },
    pieceSuggestions: d.pieceSuggestions.map((x) => ({ ...x })),
    ...(d.extras?.length ? { extras: d.extras.slice(0, EXTRAS_MAX).map((x) => ({ roleId: x.roleId, terms: termsToDraft(x.terms) })) } : {}),
  };
}

/** One role's terms as written: the answers, the commitment, the ask and the split's percents, copied field by field. */
function termsToDraft(t: ApplyDraft["terms"]): ApplyDraft["terms"] {
  return { answers: t.answers, commitmentPct: t.commitmentPct, payAsk: t.payAsk ?? null, ...(t.paySplit?.length ? { paySplit: t.paySplit.map((x) => ({ label: x.label, pct: x.pct })) } : {}) };
}

/** One role's terms read back, whatever was stored. */
function termsFromDraft(raw: any): ApplyDraft["terms"] {
  const pct = raw?.commitmentPct;
  return {
    answers: raw?.answers && typeof raw.answers === "object" && !Array.isArray(raw.answers) ? raw.answers : {},
    commitmentPct: typeof pct === "number" && Number.isInteger(pct) && pct >= 0 && pct <= 100 ? pct : null,
    payAsk: payAskOf(raw?.payAsk),
    ...(splitPercentsOf(raw?.paySplit) ? { paySplit: splitPercentsOf(raw?.paySplit) } : {}),
  };
}

/** The added roles read back: each with a role id, at most EXTRAS_MAX, none twice. */
function extrasOf(raw: unknown): DraftExtra[] {
  if (!Array.isArray(raw)) return [];
  const out: DraftExtra[] = [];
  for (const x of raw) {
    const roleId = x && typeof x === "object" ? str((x as any).roleId, 128).trim() : "";
    if (!roleId || out.some((o) => o.roleId === roleId)) continue;
    out.push({ roleId, terms: termsFromDraft((x as any).terms) });
    if (out.length >= EXTRAS_MAX) break;
  }
  return out;
}

/** A stored draft read back, or null when there is none, it is unreadable, or it is older than DRAFT_DAYS. Never throws. */
export function fromDraft(raw: unknown, now: Date, lastStep: number): ApplyDraft | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, any>;
  const at = Date.parse(str(o.savedAt, 40));
  if (!Number.isFinite(at) || now.getTime() - at > DRAFT_DAYS * 24 * 60 * 60_000) return null;
  const step = (n: unknown) => (typeof n === "number" && Number.isInteger(n) ? Math.max(0, Math.min(lastStep, n)) : 0);
  const items: ProposalGoal[] = Array.isArray(o.items)
    ? o.items
        .filter((g: unknown) => g && typeof g === "object")
        .slice(0, 8)
        .map((g: any) => ({ title: own(g.title), doneWhen: own(g.doneWhen), moves: "", serves: str(g.serves, 64), date: "", roleId: str(g.roleId, 128), ...(g.seraDraft === true ? { seraDraft: true } : {}) }))
    : [];
  const extras = extrasOf(o.extras);
  return {
    savedAt: new Date(at).toISOString(),
    step: step(o.step),
    reached: Math.max(step(o.step), step(o.reached)),
    knowUs: strs(o.knowUs, 8, 160),
    why: own(o.why),
    name: own(o.name),
    email: own(o.email),
    about: { based: own(o.about?.based), languages: own(o.about?.languages), story: own(o.about?.story) },
    selfKnowledge: own(o.selfKnowledge),
    links: Array.isArray(o.links) ? o.links.filter((l: any) => l && typeof l === "object").slice(0, 5).map((l: any) => ({ label: own(l.label), url: own(l.url) })) : [],
    aim: own(o.aim),
    items,
    marks: { ...(own(o.marks?.aim) ? { aim: own(o.marks.aim) } : {}), ...(own(o.marks?.story) ? { story: own(o.marks.story) } : {}) },
    terms: termsFromDraft(o.terms),
    rampUp: o.rampUp === true,
    practical: { timeZone: str(o.practical?.timeZone, 64), windows: strs(o.practical?.windows, 6, 40), earliestStart: str(o.practical?.earliestStart, 10) },
    pieceSuggestions: pieceSuggestionsOf(o.pieceSuggestions),
    ...(extras.length ? { extras } : {}),
  };
}

/** A saved split's percents, read back: a short list of labels with whole percents adding to 100, else none. */
function splitPercentsOf(raw: unknown): ShapeShare[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 12) return null;
  const out: ShapeShare[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object" || typeof (x as any).label !== "string" || !Number.isInteger((x as any).pct) || (x as any).pct < 0 || (x as any).pct > 100) return null;
    out.push({ label: String((x as any).label).slice(0, 40), pct: (x as any).pct });
  }
  return out.reduce((a, s) => a + s.pct, 0) === 100 ? out : null;
}
