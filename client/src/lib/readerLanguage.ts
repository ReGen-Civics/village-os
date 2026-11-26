/**
 * ASK A ROUTE FOR THE READER'S LANGUAGE (the lead's Spanish audit, 26 Nov 2026).
 *
 * Some routes lay the village's accepted translations over what they serve when a read names the reader's
 * language (X-Village-Locale): /api/org and /api/circles translate the circles they already chose to show
 * (server/lib/circleWords.ts). Only pages that READ ask. An editor never does, so it always holds the words the
 * village wrote and can never save a translation back over them. English asks nothing.
 */
export function readerLanguage(locale: string): RequestInit {
  return locale && locale !== "en" && !locale.startsWith("en-") ? { headers: { "X-Village-Locale": locale } } : {};
}
