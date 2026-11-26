/**
 * WHAT THE ADMIN LIVE VIEW NEVER READS (the coordinator's ruling on the design, 25 Nov 2026; server/lib/liveView.ts).
 *
 * The admin live view reads Admin as its holder's own admin access, for looking only. Three kinds of read are refused
 * outright, whoever holds the token:
 *
 *   - BULK EXPORTS AND DOWNLOADS. A crawl never needs a whole list of people, a database dump or a file a person
 *     attached. The list is explicit, because a pattern alone hides what was meant; and
 *     `server/lib/liveViewAdmin.test.ts` scans every GET path in the server for the words an export uses and fails on
 *     one that is neither listed here nor waived below with a written reason, because a list alone goes stale.
 *   - SECRETS, masked or not: the integrations page's secret statuses and the memory service's connection state.
 *   - TOKENS AND AGENT ACCOUNTS: the holder's own agent tokens and inbox, and the agent-account pages. Reads of who
 *     holds which power stay open.
 *
 * Paths are written the way the routes register them, `:param` included. A request is matched the way Express routes
 * it, so the list cannot be stepped round: case-insensitively, percent-decoded, with or without a trailing slash, and
 * a listed path refuses everything beneath it too (on a segment boundary). A second guard test finds the GET handlers
 * that read key state by what they CALL, not by their path's words, and fails on one neither listed nor waived.
 */

/** Every GET path the admin live view refuses, with why. */
export const LIVE_VIEW_ADMIN_REFUSED: Readonly<Record<string, string>> = {
  // Bulk exports and downloads.
  "/api/admin/backup/uploads-archive": "every uploaded file in one archive",
  "/api/admin/comms/people-export": "every person on the village's mailing lists",
  "/api/admin/entrance/entries.csv": "everyone who entered the portal",
  "/api/admin/export/database": "the whole database",
  "/api/admin/member-tasks/:userId/export": "one member's task board",
  "/api/admin/submission-attachments/:filename": "a file a person attached to a form",
  "/api/admin/submissions/export": "every form people sent",
  "/api/canvas/exports/latest": "the governance canvas export",
  "/api/cash-owed/export.csv": "what the village owes each person in cash",
  "/api/governance/village-export/:ballotId/download": "a village export a vote released",
  "/api/governance/village-export/:ballotId/standing": "the state of a village export vote",
  "/api/governance/village-export/stewards": "who may release a village export",
  "/api/hidden-map/exports": "the hidden map's exports",
  "/api/hidden-map/exports/:id/download": "one hidden map export",
  "/api/journal/export.md": "the holder's whole journal",
  "/api/me/cash-owed/export.csv": "the holder's own cash record",
  "/api/profile/export": "the holder's whole profile",
  "/api/visitor/me/export": "a visitor's own record",
  // Secrets and key state, masked or not.
  "/api/admin/integrations": "the village's secrets and their state",
  "/api/admin/identity/signing-key": "the village's signing key and its state",
  "/api/agent/key": "the holder's own model key, masked",
  "/api/admin/comms/settings": "the mail provider's key state and the village's mail settings",
  "/api/admin/comms/settings/domain": "the mail provider's sending domain and key state",
  "/api/saberra/status": "the memory service's key and connection",
  "/api/saberra/bridge": "the memory service's key and connection",
  // Tokens and agent accounts.
  "/api/agent/tokens": "the holder's agent tokens",
  "/api/agent/inbox": "the holder's agent inbox and its signing secret",
  "/api/admin/agent-accounts": "which accounts are agents",
  "/api/admin/agent-accounts/full-access": "what agent accounts may reach",
};

/**
 * GET paths a guard test flags that are NOT refused, each with its reason. A waiver says what the answer carries;
 * "it is fine" is not a reason.
 */
export const LIVE_VIEW_ADMIN_WAIVED: Readonly<Record<string, string>> = {
  "/api/platform/info": "the public handshake every page reads; its answer names the village, release and modules, and carries no key and no key state (a launch check later in the same file reads one)",
  "/api/platform/module-usage": "a usage report signed with the village key; the answer carries the signature, never the key",
  "/api/profile/alignments/:id/receipt": "the holder's own signed receipt and the village's PUBLIC key block, never the private key",
  "/api/public/org.json": "the village's public organisation document, signed with the village key; the answer carries the signature, never the key",
};

/** What a GET handler calls when it reads key state. Held by the second guard test. */
export const KEY_READS = /secretValue\(|secretView\(|secretStatus\(|allSecretStatuses\(|memberKeyView\(|signingKey\(|settingsPayload\(/;

/** The words an export path uses. Held by the guard test, so a new one is listed or waived the day it lands. */
export const EXPORT_WORDS = /export|csv|backup|archive|attachment|download|dump/i;

/**
 * A request path the way the router will see it: no query, percent-decoded, lower case, single slashes, no trailing
 * slash. Express routes case-insensitively by default, so a check that does not do the same can be stepped round.
 */
export function normalizePath(path: unknown): string {
  let p = String(path ?? "").split("?")[0];
  try {
    p = decodeURIComponent(p);
  } catch {
    /* a malformed escape: judge the raw text, which can only match less */
  }
  p = p.toLowerCase().replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return p || "/";
}

// Longest first, so a request names the most specific listed path it falls under.
const compiled = Object.keys(LIVE_VIEW_ADMIN_REFUSED).sort((a, b) => b.length - a.length).map((p) => ({
  path: p,
  // The listed path, or anything beneath it on a segment boundary; a :param is one segment.
  re: new RegExp(`^${p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:[a-z_]+/gi, "[^/]+")}(?:/.*)?$`),
}));

/** The listed path this request path falls under, or null when the admin live view may read it. */
export function refusedForAdminView(path: string): string | null {
  const bare = normalizePath(path);
  return compiled.find((c) => c.re.test(bare))?.path ?? null;
}
