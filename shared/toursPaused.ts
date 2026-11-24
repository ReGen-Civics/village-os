/**
 * LAND TOURS AND POTLUCKS, PAUSED (the lead, 24 Nov 2026: both are paused until 23 December).
 *
 * While the village setting `org.tours_resumed` is off (the default), the application's first step
 * ("Get to know us") and the steward page's first steps show only the webinar or community call: any
 * tick, act or step that names a land tour, a visit to the land, a potluck or a shared meal is hidden.
 * Turning the setting on brings every one back, unchanged. Nothing is deleted: the village's words stay
 * as written in Admin, and only what is shown is filtered.
 *
 * Pure: no pool, no clock, no Node builtins.
 */

/** The village setting, registered in shared/gameVariables.ts under "The founding team". */
export const TOURS_RESUMED_KEY = "org.tours_resumed";

/** Words that name a paused gathering, lower case, English and Spanish. */
export const PAUSED_GATHERING_WORDS = [
  "tour",
  "visit the land",
  "walk the land",
  "on the land with",
  "potluck",
  "share a meal",
  "shared meal",
  "recorrido",
  "visita",
  "comida compartida",
  "compartir una comida",
] as const;

/** Whether a line of the village's words names a land tour or a potluck. */
export function namesPausedGathering(text: string): boolean {
  const t = String(text ?? "").toLowerCase();
  return PAUSED_GATHERING_WORDS.some((w) => t.includes(w));
}

/** The setting as stored ("true" or "false"), read as on only for "true". */
export const toursResumedOf = (raw: unknown): boolean => raw === true || raw === "true";

/** Lines with the paused gatherings left out while tours are paused; every line once they resume. */
export function linesWhileToursPaused(lines: readonly string[], resumed: boolean): string[] {
  return resumed ? [...lines] : lines.filter((l) => !namesPausedGathering(l));
}

/** A first step as the steward page draws it: kept unless it names a paused gathering in its title or words. */
export function stepWhileToursPaused(step: Readonly<Record<string, string>>, resumed: boolean): boolean {
  if (resumed) return true;
  const said = [step.title, step.description, step.stage].filter((x) => typeof x === "string").join(" ");
  return !namesPausedGathering(said);
}
