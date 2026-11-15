/**
 * THE FOCUS LINE: ONE QUALITY THAT FOLLOWS THE COMMITMENT (Rye, 15 Nov 2026).
 *
 * A role card's "Who we hope for" may ask how much of someone's working life the role takes. On a role
 * that opens from 30% or 50%, "Fully focused: the village is your main work" asks for more than the role
 * does. Rye's ruling: the full wording at 60% and above, "a main part of your work" below.
 *
 * So a village writes the line once, as the token FOCUS_TOKEN on its own line in the qualities, and the
 * platform draws whichever wording fits the commitment shown: the applicant's chosen share while they apply,
 * else the least the role can be held at (a shared role's minimum), else its whole commitment. The words
 * themselves live in client code (client/src/components/roleCard/focusLine.ts) so they translate.
 *
 * Pure: no pool, no clock, no Node builtins.
 */

/** The line a village writes in "Qualities we're looking for" to get the focus line. */
export const FOCUS_TOKEN = "{focus}";

/** From this share up, the role is someone's main work (Rye, 15 Nov 2026). */
export const FOCUS_MAIN_WORK_PCT = 60;

export type FocusLevel = "main" | "part";

/** True for the token line, however it is spaced or cased. */
export function isFocusLine(line: string): boolean {
  return line.trim().toLowerCase() === FOCUS_TOKEN;
}

/** "main" at 60% and above, "part" below. A commitment nobody stated reads as the whole role. */
export function focusLevel(pct: number | null | undefined): FocusLevel {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return "main";
  return pct >= FOCUS_MAIN_WORK_PCT ? "main" : "part";
}

/**
 * The commitment a card shows: the applicant's own choice when there is one, else a shared role's minimum
 * (the card reads "from N%"), else the role's whole commitment, else none.
 */
export function shownCommitment(chosen: number | null | undefined, min: number | null | undefined, whole: number | null | undefined): number | null {
  for (const v of [chosen, min, whole]) if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}
