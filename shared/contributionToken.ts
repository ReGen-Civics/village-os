/**
 * THE CONTRIBUTION TOKEN (the lead, 19 Nov 2026): the non-cash share of pay is not called "equity" on any
 * member or applicant surface. It is the village's contribution token, and its display name is the village's
 * own, set in Admin, Tokens on the `earned-equity` row (the slug never moves, so ledger history keeps its key).
 * A fresh village reads the platform default, "Contribution tokens" (drizzle/0411). Amora names it "Amora".
 * The same goes for the credits share: its name follows the `credits` row.
 *
 * A pay shape is written by people ("Cash 40, Equity 55, Credits 5"), and End of Moon reads its labels to
 * decide what each share pays in (shared/rewardShare.ts). So a village that relabels a share with its token's
 * name ("Amora 55") must still be read as the same share, or the line pays all cash. `namedPart` is that
 * reading: a label that IS a token's configured name, with or without "token" or "tokens" after it.
 *
 * Pure and a leaf: no imports, so a module that moves value can read it.
 */

/** The ledger slug of the contribution token (server `EARNED_EQUITY`, seeded by drizzle/0266). */
export const CONTRIBUTION_TOKEN_SLUG = "earned-equity";
/** The ledger slug of the credits token (server `CREDITS`, seeded by drizzle/0007). */
export const CREDITS_TOKEN_SLUG = "credits";

/** What a village that named nothing reads, and what a surface shows while the names load. */
export const CONTRIBUTION_TOKEN_DEFAULT = "Contribution tokens";
export const CREDITS_TOKEN_DEFAULT = "Credits";

/** The two token shares' display names. */
export interface ShareNames {
  equity: string;
  credits: string;
}

export const DEFAULT_SHARE_NAMES: ShareNames = { equity: CONTRIBUTION_TOKEN_DEFAULT, credits: CREDITS_TOKEN_DEFAULT };

/** The names, each blank one at its default. */
export function shareNames(names: Partial<ShareNames> | null | undefined): ShareNames {
  return {
    equity: String(names?.equity ?? "").trim() || CONTRIBUTION_TOKEN_DEFAULT,
    credits: String(names?.credits ?? "").trim() || CREDITS_TOKEN_DEFAULT,
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

/**
 * Which token share a label names by the village's own token names, or null. Exact after `labelKey`, never a
 * substring, so "Amora" never reads "Amora Credits" as the contribution share. Two names that compare equal
 * name nothing, so a clash is refused rather than guessed.
 */
export function namedPart(label: string, names: Partial<ShareNames> | null | undefined): "equity" | "credits" | null {
  if (!names) return null;
  const key = labelKey(label);
  if (!key) return null;
  const eq = labelKey(names.equity ?? "");
  const cr = labelKey(names.credits ?? "");
  if (eq && cr && eq === cr) return null;
  if (eq && key === eq) return "equity";
  if (cr && key === cr) return "credits";
  return null;
}

/** "Amora tokens", "Contribution tokens": the name as a plural noun for a sentence, never doubling "tokens". */
export function tokensNoun(name: string): string {
  const n = String(name ?? "").trim() || CONTRIBUTION_TOKEN_DEFAULT;
  return /\btokens?$/i.test(n) ? n : `${n} tokens`;
}
