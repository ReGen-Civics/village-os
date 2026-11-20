/**
 * THE CONTRIBUTION TOKEN (the lead, 19 Nov 2026): the non-cash share of pay is never "equity" to a member or an
 * applicant. It is the village's contribution token, the same token a contributor earns and an investor buys with
 * cash (an investor is a cash contributor), and the same token as its Hypha mirror: it is destroyed on one side
 * when it moves to the other. Wherever its name is shown it carries an at-risk tip (client ContributionWord.tsx).
 *
 * WHERE THE NAME COMES FROM. Member and applicant surfaces read the village's own word from its vocabulary
 * (`contributionToken` in shared/vocabulary.ts: Admin, Make it yours, "Your words for things"), which
 * /api/game/config already serves. The token registry (Admin, Tokens) is left as it is, and admin pages keep
 * reading it. With no word of its own a village reads its registry name, unless that name says "equity", in
 * which case it reads the platform default, "Contribution tokens". The slug `earned-equity` never moves.
 *
 * THE SHORT FORM is derived, never typed: the village's plural with "tokens" said in lower case ("Amora Tokens"
 * reads "Amora tokens" on a share's label, a tile or a narrow cell). It used to drop the word altogether, and an
 * applicant read a bare "Amora" as the village's name, never as a token (the lead, 20 Nov 2026). A name with no
 * "token" in it ("Seeds") is its own short form. The platform default keeps its whole name.
 *
 * THE CREDITS TOKEN keeps its registry name ("Village Credits") and carries its own tip saying it is a usage token.
 *
 * LABELS MOVE MONEY. End of Moon reads each pay share's label to decide what it pays in (shared/rewardShare.ts).
 * A village that labels a share with its own word ("Amora 40") must still be read as the contribution share, or
 * the line pays all cash. `namedPart` is that reading: a label that IS one of the token's names, exactly.
 *
 * Pure. Imports only the vocabulary's types and defaults.
 */
import { NOUN_SLOTS, type Vocabulary } from "./vocabulary";

/** The ledger slug of the contribution token (server `EARNED_EQUITY`, seeded by drizzle/0266). */
export const CONTRIBUTION_TOKEN_SLUG = "earned-equity";
/** The ledger slug of its Hypha mirror: the same token, read from Base. */
export const CONTRIBUTION_MIRROR_SLUG = "equity";
/** The ledger slug of the credits token (server `CREDITS`, seeded by drizzle/0007). */
export const CREDITS_TOKEN_SLUG = "credits";

/** What a village that named nothing reads, and what a surface shows while the names load. */
export const CONTRIBUTION_TOKEN_DEFAULT = "Contribution tokens";
export const CREDITS_TOKEN_DEFAULT = "Credits";

/** The two token shares' names as a member reads them. */
export interface ShareNames {
  /** The contribution token in full, for a sentence ("Amora Tokens"). */
  equity: string;
  /** The same, short, for a label, a tile or a narrow cell ("Amora tokens"). */
  equityShort: string;
  /** The credits token ("Village Credits"). */
  credits: string;
}

export const DEFAULT_SHARE_NAMES: ShareNames = { equity: CONTRIBUTION_TOKEN_DEFAULT, equityShort: CONTRIBUTION_TOKEN_DEFAULT, credits: CREDITS_TOKEN_DEFAULT };

const trimmed = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/** The short form of a village's own name: a trailing "token" or "tokens" dropped, the whole name when nothing is left. */
export function shortName(full: string): string {
  const f = trimmed(full);
  return f.replace(/\s+tokens?$/i, "").trim() || f;
}

/** The label form of the village's own token name: "Amora Tokens" reads "Amora tokens"; a name without "token" stays whole. */
export function shortLabel(full: string): string {
  const f = trimmed(full);
  const base = shortName(f);
  return base !== f ? `${base} tokens` : f;
}

/**
 * The names a member reads, from the village's vocabulary and the registry's names by slug. Either may be absent
 * (loading, or an older server): every blank falls to its default.
 */
export function shareNamesFrom(vocabulary: Partial<Vocabulary> | null | undefined, registry: Record<string, string> | null | undefined): ShareNames {
  const own = vocabulary?.contributionToken;
  const typed = own && trimmed(own.many) && trimmed(own.many).toLowerCase() !== NOUN_SLOTS.contributionToken.many ? trimmed(own.many) : "";
  const registered = trimmed(registry?.[CONTRIBUTION_TOKEN_SLUG]);
  const equity = typed || (registered && !/equity/i.test(registered) ? registered : "") || CONTRIBUTION_TOKEN_DEFAULT;
  return {
    equity,
    equityShort: typed ? shortLabel(typed) : equity,
    credits: trimmed(registry?.[CREDITS_TOKEN_SLUG]) || CREDITS_TOKEN_DEFAULT,
  };
}

/** A label or a name, compared loosely: lower case, single spaces, and a trailing "token" or "tokens" dropped. */
export function labelKey(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ tokens?$/, "")
    .trim();
}

/** Names to read a label by: each share's names, any number of them (a display name and a registry name, say). */
export interface LabelNames {
  equity?: string | readonly string[];
  credits?: string | readonly string[];
}

const keysOf = (v: string | readonly string[] | undefined): string[] => (Array.isArray(v) ? v : v ? [v as string] : []).map(labelKey).filter(Boolean);

/**
 * Which token share a label names by the village's own token names, or null. Exact after `labelKey`, never a
 * substring, so "Amora" never reads "Amora Credits" as the contribution share. A name both shares claim names
 * nothing, so a clash is refused rather than guessed.
 */
export function namedPart(label: string, names: LabelNames | null | undefined): "equity" | "credits" | null {
  if (!names) return null;
  const key = labelKey(label);
  if (!key) return null;
  const eq = keysOf(names.equity).includes(key);
  const cr = keysOf(names.credits).includes(key);
  if (eq && cr) return null;
  return eq ? "equity" : cr ? "credits" : null;
}

/** "Amora Tokens", "Contribution tokens", "Harbour tokens": the name as a plural noun for a sentence, never doubling "tokens". */
export function tokensNoun(name: string): string {
  const n = trimmed(name) || CONTRIBUTION_TOKEN_DEFAULT;
  return /\btokens?$/i.test(n) ? n : `${n} tokens`;
}
