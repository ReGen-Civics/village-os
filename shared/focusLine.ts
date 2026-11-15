/**
 * THE FOCUS LINE: ONE QUALITY THAT FOLLOWS THE COMMITMENT (Rye, 15 Nov 2026).
 *
 * A role card's "Who we hope for" may say how much of someone's working life the role takes. A village writes
 * the line once, as FOCUS_TOKEN on its own line in the qualities, and the platform draws the words for the
 * commitment shown: the applicant's chosen share while they apply, else the least the role can be held at (a
 * shared role's minimum), else its whole commitment.
 *
 * SIX BANDS (Rye, 15 Nov 2026: "10 30 50 60 80 and 100% that each comes with some wording"). Each band runs
 * from its number up to the next one; a share below 10% reads as the 10% band. FOCUS_BANDS is the one table of
 * the words, in English with {village} for the village's name: change a line here and the card follows. The
 * reader's language is client/src/components/roleCard/focusLine.ts, which says each band again as a message
 * (Lingui extracts client/src only) and is held to this table by its test.
 *
 * Pure: no pool, no clock, no Node builtins.
 */

/** The line a village writes in "Qualities we're looking for" to get the focus line. */
export const FOCUS_TOKEN = "{focus}";

/** Where each band starts, lowest first. */
export const FOCUS_BAND_STARTS = [10, 30, 50, 60, 80, 100] as const;
export type FocusBand = (typeof FOCUS_BAND_STARTS)[number];

/** The words of each band, {village} standing for the village's name. */
export const FOCUS_BANDS: Readonly<Record<FocusBand, string>> = {
  10: "On your mind: {village} gets a dedicated work block once a week",
  30: "Steady: {village} gets about a day and a half of your week",
  50: "Focused: {village} is a main part of your work, about half your week",
  60: "Fully focused: {village} is your main work",
  80: "Deeply committed: {village} is your main work, about four days a week",
  100: "All in: {village} is your full-time work",
};

/** A commitment nobody stated reads as the main-work band, the line these cards carried before the bands. */
export const FOCUS_UNSTATED: FocusBand = 60;

/** True for the token line, however it is spaced or cased. */
export function isFocusLine(line: string): boolean {
  return line.trim().toLowerCase() === FOCUS_TOKEN;
}

/** The band a share falls in: the highest start at or below it, and the 10% band below 10%. */
export function focusBand(pct: number | null | undefined): FocusBand {
  if (typeof pct !== "number" || !Number.isFinite(pct)) return FOCUS_UNSTATED;
  let band: FocusBand = FOCUS_BAND_STARTS[0];
  for (const start of FOCUS_BAND_STARTS) if (pct >= start) band = start;
  return band;
}

/** A band's English words with the village's name in place. */
export function focusEnglish(band: FocusBand, village: string): string {
  return FOCUS_BANDS[band].split("{village}").join(village);
}

/**
 * The commitment a card shows: the applicant's own choice when there is one, else a shared role's minimum
 * (the card reads "from N%"), else the role's whole commitment, else none.
 */
export function shownCommitment(chosen: number | null | undefined, min: number | null | undefined, whole: number | null | undefined): number | null {
  for (const v of [chosen, min, whole]) if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}
