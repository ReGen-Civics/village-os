/**
 * THE WORDS EVERY ROLE CARD SHARES (the lead, Anchor session of 19 Nov 2026).
 *
 * Text that was pasted into every card's own words now lives once, in four
 * village variables, and each card draws it beside its own:
 *
 *   org.role_card_shared         lines above each card's "What {village} needs from you"
 *   org.role_card_rhythm         the sessions everyone attends, first under Rhythm
 *   org.role_card_first_review   when the first review happens (read by the card projection)
 *   org.role_card_onboarding     "Once you're selected", where a card writes none of its own
 *   org.role_card_word_tips      the village's own words for a card's tooltips (shared/roleCardWordTips.ts)
 *
 * `GET /api/org/role-card/:id` sends the three line lists as `shared`.
 *
 * Pure: no pool, no clock, no Node builtins.
 */
import { readWordTipLines, WORD_TIPS_VARIABLE, type WordTipLine } from "./roleCardWordTips";

export interface RoleCardShared {
  lines: string[];
  rhythm: string[];
  onboarding: string[];
  /** The village's own tooltip words, "word: tip" (the lead, 20 Nov 2026). Sent only when the village wrote some. */
  tips?: WordTipLine[];
}

export const NO_SHARED: RoleCardShared = { lines: [], rhythm: [], onboarding: [] };

export const SHARED_VARIABLES = {
  lines: "org.role_card_shared",
  rhythm: "org.role_card_rhythm",
  onboarding: "org.role_card_onboarding",
} as const satisfies Record<Exclude<keyof RoleCardShared, "tips">, string>;

/** At most this many lines of each are drawn, so a long setting cannot crowd a card. */
export const SHARED_MAX_LINES = 12;

/** Text as lines: one per line, a leading "- " or "* " dropped, blanks skipped. */
export function textLines(v: unknown): string[] {
  if (typeof v !== "string") return [];
  return v
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d{1,2}[.)])\s+/, "").trim())
    .filter(Boolean)
    .slice(0, SHARED_MAX_LINES);
}

/** The shared words from the village's settings. */
export function roleCardSharedFrom(get: (key: string) => string): RoleCardShared {
  const tips = readWordTipLines(get(WORD_TIPS_VARIABLE));
  return { lines: textLines(get(SHARED_VARIABLES.lines)), rhythm: textLines(get(SHARED_VARIABLES.rhythm)), onboarding: textLines(get(SHARED_VARIABLES.onboarding)), ...(tips.length ? { tips } : {}) };
}

/** The shared words as the client reads them back, so a bad answer draws nothing. */
export function readRoleCardShared(v: unknown): RoleCardShared {
  if (!v || typeof v !== "object") return NO_SHARED;
  const o = v as Record<string, unknown>;
  const list = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim()).slice(0, SHARED_MAX_LINES) : []);
  const lines = Array.isArray(o.tips) ? o.tips.filter((x): x is WordTipLine => !!x && typeof x === "object" && typeof (x as WordTipLine).word === "string" && typeof (x as WordTipLine).tip === "string") : [];
  const tips = readWordTipLines(lines.map((x) => `${x.word.replace(/:/g, " ")}: ${x.tip}`).join("\n"));
  return { lines: list(o.lines), rhythm: list(o.rhythm), onboarding: list(o.onboarding), ...(tips.length ? { tips } : {}) };
}

/** A card's onboarding steps: its own where it wrote them, the village's otherwise. */
export function onboardingFor(own: readonly string[] | undefined, shared: RoleCardShared): string[] {
  return own && own.length ? [...own] : shared.onboarding;
}
