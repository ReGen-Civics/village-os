/**
 * A CIVIL DAY IN WORDS, for a locale: "9 November 2026", "9 de noviembre de 2026". Pure, and imports nothing, so
 * anything may read it: the season plans (shared/seasonPlans.ts re-exports it), the bell, and the notice emails
 * (shared/noticeKeyMessages.ts), which must not reach the seat settings model (shared/seatSettings.boundary.test.ts).
 */

const CIVIL_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The date format for a locale. English keeps the day-month-year the village has always
 * read ("8 December 2026"); the pseudo-locales (en-XA, ar-XB) are test skins of English
 * and read the same; any other locale is the browser's own long form for it, so Spanish
 * reads "8 de diciembre de 2026".
 */
export function dateLocale(locale: string | null | undefined): string {
  const l = String(locale ?? "").trim();
  if (!l || /^en\b/i.test(l) || /-X[AB]$/i.test(l)) return "en-GB";
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([l]).length ? l : "en-GB";
  } catch {
    return "en-GB";
  }
}

/**
 * "9 November 2026" from "2026-11-09". The day is civil, so it is read in UTC. A page
 * that shows the date inside a translated sentence passes the active locale
 * (`i18n.locale`), so Spanish reads "9 de noviembre de 2026".
 */
export function civilDayWords(day: string, locale?: string | null): string {
  const m = CIVIL_DAY.exec(String(day ?? "").trim());
  if (!m) return String(day ?? "");
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString(dateLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

