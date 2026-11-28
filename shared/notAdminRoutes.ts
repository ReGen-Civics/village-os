/**
 * THE ROUTES THAT ARE NOT ADMIN'S: the named families of server routes the Admin Garden does not answer for.
 *
 * The scoreboard's Endpoints count (shared/gardenScore.ts) asks every route the server registers one question: whose
 * is it? A route is an admin act's (the registry of acts names it), or it sits in a family below, or it is OPEN and
 * printed. This list is the one place a person's judgement enters that count, so it is kept short and held four ways:
 *
 *   - no family may match a route under /api/admin/;
 *   - no family may match a route the permission matrix shows is admin's;
 *   - every path a family names matches at least one real route, so no entry is dead;
 *   - a family is a path that means something. None is /api/ whole, and under /api/ each names at least the
 *     second segment.
 *
 * (server/notAdminRoutes.test.ts runs those against the real routes and the matrix.)
 *
 * AND WHAT THE HANDLER SAYS OVERRULES THIS LIST. The scoreboard reads what each route's own handler asks
 * (server/testkit/routeDoors.ts). A route whose handler asks the admin question, or names a power only a role gives,
 * is never counted as not admin's, whatever family its path falls in: it stays open until an act names it. So a
 * family may be a readable prefix without swallowing the one steward's route inside it.
 *
 * Three kinds:
 *
 *   public    a signed-out visitor may call it: sign-in, the forms a stranger sends, what a page loads first
 *   member    a signed-in member's own side of the village: their records, their profile, their play
 *   machine   no person calls it: health checks, webhooks, the connector's own protocol, the files a browser loads
 *
 * HOW A FAMILY GETS HERE. Its path has to say whose the routes are without reading a handler: `/api/me/` is the
 * caller's own by its name, and `/api/moon-review/` is not, because the treasurer's approvals live there beside a
 * member's own invoice. When a prefix holds both and the path cannot tell them apart, it has no family and its
 * routes stay open. That is the honest answer, and the scoreboard lists them.
 *
 * Pure: no I/O, no clock.
 */

export type NotAdminKind = "public" | "member" | "machine";

export interface NotAdminFamily {
  /** A short stable name for the family. */
  key: string;
  kind: NotAdminKind;
  /** The paths the family names, as written here: each a prefix, an exact path, or a segment. For reading and for the dead-entry test. */
  names: readonly string[];
  /** Whether a route is one of the family's: its method in capitals, and its path exactly as Express registers it. */
  test(method: string, path: string): boolean;
  /** Why these routes are not admin's, in a sentence. */
  why: string;
}

const ADMIN_PREFIX = "/api/admin/";

/** Whether a path is a prefix or sits under it: `/api/me` holds `/api/me` and `/api/me/moon`, never `/api/menu`. */
export function isUnder(prefix: string, path: string): boolean {
  const bare = prefix.replace(/\/$/, "");
  return path === bare || path.startsWith(`${bare}/`);
}

/** A family of routes under one or more prefixes. */
function under(key: string, kind: NotAdminKind, prefixes: readonly string[], why: string): NotAdminFamily {
  return { key, kind, names: prefixes, why, test: (_m, p) => prefixes.some((x) => isUnder(x, p)) };
}

/** A family of routes named one by one, each an exact path. */
function exactly(key: string, kind: NotAdminKind, paths: readonly string[], why: string): NotAdminFamily {
  return { key, kind, names: paths, why, test: (_m, p) => paths.includes(p) };
}

/** The segments that mean "the caller's own rows" wherever they appear in a path. */
export const OWN_SEGMENTS = ["me", "mine"] as const;
const ownSegment = (path: string): boolean => path.split("/").some((part) => (OWN_SEGMENTS as readonly string[]).includes(part));

export const NOT_ADMIN_ROUTES: readonly NotAdminFamily[] = [
  // ── A member's own side ──────────────────────────────────────────────────
  under("member-own-records", "member", ["/api/me"], "Everything under /api/me is the signed-in member's own: their pay, their moon, their companions, their privacy."),
  under("member-profile", "member", ["/api/profile"], "A member's own profile, preferences, agreements, data export and leaving."),
  under("member-journal", "member", ["/api/journal"], "A member's own journal, practices and the feedback they give and receive."),
  under("member-messages", "member", ["/api/messages"], "Private messages between members. Reports on a message reach Admin through its own queue."),
  under("member-wallet", "member", ["/api/wallet"], "A member linking and using their own wallet."),
  under("member-notices", "member", ["/api/notifications"], "A member's own notices, and marking them read."),
  under("member-game", "member", ["/api/game"], "The Game as a member plays it: gratitude, quests, progression, and proposing a change to a rule."),

  // ── Open to a signed-out visitor ─────────────────────────────────────────
  under("sign-in", "public", ["/api/auth"], "Signing in, registering, and setting or recovering a password."),
  under("portal-visitor", "public", ["/api/visitor"], "A portal visitor's own session and their own record."),
  under("portal-entrance", "public", ["/api/entrance"], "The portal's front door: entering, the code, asking for updates."),
  under("public-application", "public", ["/api/open-proposals", "/api/application-drafts", "/api/application-status"], "The public application: a stranger writes one, files it and follows it by its reference."),
  under("mail-links", "public", ["/api/comms/consent", "/api/comms/unsubscribe", "/api/comms/preferences", "/api/comms/action"], "A person's own mail choices, opened from a link in an email."),
  under("page-basics", "public", ["/api/i18n", "/api/brand"], "What every page loads before anyone signs in: the language catalogs, the theme, the sounds and the icons."),
  exactly("server-drawn-pages", "public", ["/quests", "/quests/:id", "/roles/:slug"], "Public pages the server itself draws, for readers and link previews."),

  // ── No person calls it ───────────────────────────────────────────────────
  exactly("health", "machine", ["/health"], "The host's health check."),
  under("webhooks", "machine", ["/api/webhooks", "/api/comms/webhooks"], "Providers calling back: payments, mail delivery, recordings. Each is checked by its signature."),
  under("connector-protocol", "machine", ["/api/agent/v1", "/.well-known"], "The connector's own protocol and the discovery documents beside it. An agent account calls these, and each call is judged by its own door."),
  exactly("crash-report", "machine", ["/api/client-crash"], "A browser reporting that a page crashed."),
  {
    key: "page-shell-and-files",
    kind: "machine",
    names: ["/assets", "/images", "/grounds", "/index.html", "/manifest.webmanifest", "/robots.txt", "/sitemap.xml", "/:file", "/{*splat}"],
    why: "The files a browser loads, and the page shell every address the server does not know falls back to.",
    test: (_m, p) => ["/assets", "/images", "/grounds"].some((x) => isUnder(x, p)) || ["/index.html", "/manifest.webmanifest", "/robots.txt", "/sitemap.xml", "/:file", "/{*splat}"].includes(p),
  },

  // ── The caller's own rows, wherever they sit. Last, so a family named by its prefix answers first. ──
  {
    key: "member-own-rows",
    kind: "member",
    names: OWN_SEGMENTS.map((s) => `/${s}`),
    why: "A path with a /me or /mine segment answers only with the caller's own rows, in whatever module it sits.",
    test: (_m, p) => !p.startsWith(ADMIN_PREFIX) && ownSegment(p),
  },
];

/** The family a route belongs to, or null when it has none. */
export function notAdminFamily(method: string, path: string, families: readonly NotAdminFamily[] = NOT_ADMIN_ROUTES): NotAdminFamily | null {
  return families.find((f) => f.test(method.toUpperCase(), path)) ?? null;
}
