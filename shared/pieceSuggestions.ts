/**
 * WHAT THE APPLICANT WOULD MAKE OF THE ROLE (Rye, 14 Nov 2026: "places for them to suggest (as part of
 * their proposal) what pieces they would change, see missing, etc, so they have a way to interact and
 * edit/change what the card SHOULD be, as a way of also seeing how they think and what they would
 * deliver"; approved mockup B, https://claude.ai/artifact/NaavCsufyAEHKowgEdKFAX).
 *
 * On each piece of the role card (client/src/components/roleCard/FoundingRoleCard.tsx) the applicant
 * may say "I'd change this", "Something's missing" or "I'd deliver this as…". The suggestions ride in
 * the open proposal's body as `pieceSuggestions` (coordinator, 14 Nov: additive, no table, no
 * migration), and the people who decide read each one beside the piece it is about, read-only.
 *
 * The applicant's own words: never summarised, scored or ranked, and never handed to an AI.
 *
 * Pure: no React, no pool.
 */
import { APPLY_COUNTS, APPLY_TEXT } from "./applyLimits";

export const PIECE_KEYS = ["purpose", "domain", "accountabilities", "authorities", "responsibilities", "who", "rewards", "chosen", "holding"] as const;
export type PieceKey = (typeof PIECE_KEYS)[number];

export const SUGGESTION_KINDS = ["change", "missing", "deliver"] as const;
export type SuggestionKind = (typeof SUGGESTION_KINDS)[number];

export interface PieceSuggestion {
  roleId: string;
  piece: PieceKey;
  kind: SuggestionKind;
  text: string;
}

export const SUGGESTION_LIMITS = {
  /** Characters in one suggestion. */
  text: APPLY_TEXT.suggestion,
  /** Suggestions in one application, across its roles. */
  total: APPLY_COUNTS.suggestions,
} as const;

/** Each piece by its short name, as the card's rail says it (FoundingRoleCard.tsx). */
export const PIECE_NAMES: Record<PieceKey, string> = {
  purpose: "Purpose",
  domain: "Looks after",
  accountabilities: "Delivers",
  authorities: "Decides",
  responsibilities: "Rhythm",
  who: "Who we hope for",
  rewards: "Rewards",
  chosen: "How you're chosen",
  holding: "Holding it well",
};

export const SUGGESTION_WORDS = {
  kind: {
    change: "I'd change this",
    missing: "Something's missing",
    deliver: "I'd deliver this as…",
  } satisfies Record<SuggestionKind, string>,
  tooLong: `A suggestion can be up to ${SUGGESTION_LIMITS.text} characters.`,
  tooMany: `An application can carry up to ${SUGGESTION_LIMITS.total} suggestions.`,
} as const;

const isPiece = (v: unknown): v is PieceKey => typeof v === "string" && (PIECE_KEYS as readonly string[]).includes(v);
const isKind = (v: unknown): v is SuggestionKind => typeof v === "string" && (SUGGESTION_KINDS as readonly string[]).includes(v);

/**
 * The suggestions as the form sent them, for the roles this application picks. A suggestion on a role
 * the applicant no longer picks, an unknown piece or kind, or an empty one is dropped, never refused:
 * none of those is something the applicant can fix. Too long or too many is refused, with the words.
 */
export function parsePieceSuggestions(raw: unknown, roleIds: ReadonlySet<string>): { ok: true; value: PieceSuggestion[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: true, value: [] };
  const out: PieceSuggestion[] = [];
  for (const s of raw) {
    const o = s && typeof s === "object" ? (s as Record<string, unknown>) : {};
    const roleId = typeof o.roleId === "string" ? o.roleId.trim() : "";
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (!roleIds.has(roleId) || !isPiece(o.piece) || !isKind(o.kind) || !text) continue;
    if (text.length > SUGGESTION_LIMITS.text) return { ok: false, error: SUGGESTION_WORDS.tooLong };
    out.push({ roleId, piece: o.piece, kind: o.kind, text });
  }
  if (out.length > SUGGESTION_LIMITS.total) return { ok: false, error: SUGGESTION_WORDS.tooMany };
  return { ok: true, value: out };
}

/** What a stored body's suggestions read as, whatever was stored. Never throws. */
export function pieceSuggestionsOf(raw: unknown): PieceSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: PieceSuggestion[] = [];
  for (const s of raw) {
    const o = s && typeof s === "object" ? (s as Record<string, unknown>) : {};
    const roleId = typeof o.roleId === "string" ? o.roleId.trim() : "";
    const text = typeof o.text === "string" ? o.text.trim().slice(0, SUGGESTION_LIMITS.text) : "";
    if (!roleId || !isPiece(o.piece) || !isKind(o.kind) || !text) continue;
    out.push({ roleId, piece: o.piece, kind: o.kind, text });
    if (out.length >= SUGGESTION_LIMITS.total) break;
  }
  return out;
}
