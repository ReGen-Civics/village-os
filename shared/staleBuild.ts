/**
 * WHAT A PAGE THAT OUTLIVED A DEPLOY SAYS WHEN IT TRIPS (2026-11-24).
 *
 * Every release replaces the hashed chunks in dist/public/assets and the copy
 * parts in dist/i18n/parts/en (client/src/i18n/copySplit.ts clears and rewrites
 * them on every build, and each part is named by a hash of its words). A tab
 * opened before the deploy still runs the old entry, so the first lazy page it
 * opens asks for a chunk, or a part, the new server never had. The words below
 * are how each engine, Vite's preload helper and our own part fetch say so.
 *
 * Two readers, one list:
 *  - the browser (client/src/lib/staleChunk.ts) reloads once for any of these
 *    and does not report it as a crash;
 *  - the crash route (server/routes/clientCrash.ts) turns a report of one of
 *    these, from a bundle other than the one it serves, into a log line, so
 *    tabs that were open across a deploy send nobody an email.
 *
 * Kept tiny and import-free: the browser half runs on the first page.
 */

export const STALE_BUILD_MESSAGES: readonly RegExp[] = [
  /Failed to fetch dynamically imported module/i, // Chromium
  /Importing a module script failed/i, // Safari, iOS
  /error loading dynamically imported module/i, // Firefox
  /Unable to preload CSS/i, // Vite's own preload helper
  /Loading (?:CSS )?chunk [\w-]+ failed/i,
  // Our own: a lazy chunk's copy part that this server does not have
  // (`fetchPart`, client/src/i18n/i18n.ts). Only a 404 is the stale build; any
  // other status is something else and stays a crash.
  /\bcopy part [\w-]{6,32}: 404$/,
];

/** True when the message is a chunk or copy part that did not arrive. */
export function isStaleBuildMessage(message: unknown): boolean {
  const text = typeof message === "string" ? message : "";
  return text !== "" && STALE_BUILD_MESSAGES.some((re) => re.test(text));
}
