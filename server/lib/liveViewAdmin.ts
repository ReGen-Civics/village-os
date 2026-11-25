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
 * Paths are written the way the routes register them, `:param` included.
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
  // Secrets, masked or not.
  "/api/admin/integrations": "the village's secrets and their state",
  "/api/saberra/status": "the memory service's key and connection",
  "/api/saberra/bridge": "the memory service's key and connection",
  // Tokens and agent accounts.
  "/api/agent/tokens": "the holder's agent tokens",
  "/api/agent/inbox": "the holder's agent inbox and its signing secret",
  "/api/admin/agent-accounts": "which accounts are agents",
  "/api/admin/agent-accounts/full-access": "what agent accounts may reach",
};

/**
 * GET paths whose words look like an export but which are not one, each with its reason. Empty today: every match
 * the guard test found is refused above.
 */
export const LIVE_VIEW_ADMIN_WAIVED: Readonly<Record<string, string>> = {};

/** The words an export path uses. Held by the guard test, so a new one is listed or waived the day it lands. */
export const EXPORT_WORDS = /export|csv|backup|archive|attachment|download|dump/i;

const compiled = Object.keys(LIVE_VIEW_ADMIN_REFUSED).map((p) => ({
  path: p,
  re: new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\:/g, ":").replace(/:[A-Za-z_]+/g, "[^/]+")}/?$`),
}));

/** The listed path this request path falls under, or null when the admin live view may read it. */
export function refusedForAdminView(path: string): string | null {
  const bare = String(path ?? "").split("?")[0];
  return compiled.find((c) => c.re.test(bare))?.path ?? null;
}
