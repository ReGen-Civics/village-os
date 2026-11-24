/**
 * THE ENTRANCE TO THE PORTAL (the lead, 24 Nov 2026, from a team member's feedback).
 *
 * "Before anyone can access the game and roles they have to give us their name and email",
 * with a WhatsApp number and a website or social link if they want, a box to tick for updates,
 * and a check that they are a person. The brochure stays open: the conservative public site that
 * shared links and search land on. The village's inner workings (roles and their pay, the game,
 * quests, circles, powers, the map, the calendar, members' first names) wait behind one calm
 * screen.
 *
 * ── ONE LIST, BOTH SIDES ────────────────────────────────────────────────────
 *
 * `ENTRANCE_PAGES` is what the client draws the entrance in front of; `ENTRANCE_APIS` is what the
 * server refuses a visitor without an entry (server/lib/entrance.ts, installed in front of every
 * route the way the people lock is). A page on the first list whose data is not on the second
 * would be a hide, and a hide is no gate; `shared/entrance.test.ts` holds the two lists to each
 * other for the pages the audit named.
 *
 * WHO PASSES: a signed-in member always, whatever the dial. A visitor with a live entry cookie
 * (signed by the server, `ENTRY_DAYS` long). Everybody, while the village's dial
 * `entrance.required` is off, which is the platform default: a fork turns its entrance on.
 *
 * WHAT IS KEPT, AND NOTHING ELSE: the name, the address, the two optional fields, the updates
 * answer and the words the visitor saw when they gave it, the page they were heading to, the
 * language and how the human check was passed. No address, no device fingerprint, no tracking.
 * The list is read only by whoever holds `intake.moderate` (Admin, Portal visitors), and no
 * email is ever sent to it by the platform.
 */

/** How long one entry is remembered on one device. */
export const ENTRY_DAYS = 90;
export const ENTRY_COOKIE = "vos_portal";

export const NAME_MAX = 120;
export const EMAIL_MAX = 320;
export const WHATSAPP_MAX = 40;
export const LINK_MAX = 500;
/** The fallback human check: a person takes at least this long to fill the form. */
export const MIN_FILL_MS = 2500;
/** Entries one connection may make in an hour before the door asks them to wait. */
export const ENTRIES_PER_HOUR = 8;

/**
 * The pages behind the entrance, as leading path segments. A path is behind the entrance when it
 * equals one of these or begins with one followed by `/`. Pages that already ask a visitor to
 * sign in are not listed: they need no second door.
 *
 * The audit's judgment calls went behind it on the lead's word (24 Nov 2026, "Sounds good!"):
 * `/governance`, `/gratitude`, `/network`, `/events`, `/seasonal-festivals` and the calendar feed.
 * `/team` stays open, its names hidden until entry (its read of `/api/org` is refused).
 */
export const ENTRANCE_PAGES: readonly string[] = [
  // Roles, pay and applying.
  "/roles",
  "/propose-a-role",
  "/role-path",
  "/circles",
  "/map",
  // The game.
  "/quests",
  "/game-mechanics",
  "/powers",
  "/badges",
  "/tools",
  "/modules",
  "/campaigns",
  "/campaign",
  "/first-walk",
  "/feed",
  "/forum",
  "/introductions",
  // How the village decides and thanks, its calendar and its festivals (the lead, 24 Nov 2026).
  "/governance",
  "/gratitude",
  "/network",
  "/events",
  "/seasonal-festivals",
];

/**
 * The read APIs behind the entrance, as path prefixes. A request path is gated when it equals one
 * of these or begins with one followed by `/`. Reads only: a write already asks who is writing.
 */
export const ENTRANCE_APIS: readonly string[] = [
  // Roles, their pay, and the people holding them.
  "/api/org",
  "/api/roles",
  "/api/circles",
  "/api/map",
  "/api/open-proposals/form",
  "/api/governance/role-discover",
  "/api/governance/role-path",
  "/api/governance/ballots",
  "/api/governance/objections",
  // The game.
  "/api/quests",
  "/api/game/mechanics",
  "/api/game/pulse",
  "/api/game/gratitude",
  "/api/game/cycle",
  "/api/game/rules",
  "/api/governance/voice-spread",
  "/api/village/powers",
  "/api/badges",
  "/api/economy",
  "/api/hypha",
  "/api/modules/catalog",
  "/api/modules/pool",
  "/api/tools",
  "/api/resources",
  "/api/archetypes",
  "/api/intents",
  "/api/crowdpool",
  "/api/forum",
  "/api/feed",
  // The calendar, the festivals' details and the network (the lead, 24 Nov 2026).
  "/api/events",
  "/api/network",
];

/** Inside a gated prefix, what stays open, and why. */
export const ENTRANCE_API_EXEMPT: readonly string[] = [
  // The village's vision, which the brochure reads.
  "/api/org/vision",
];

/**
 * Paths inside a gated prefix that stay open by shape. The join link in a gathering's emails
 * (`/api/events/<id>/join`) redirects an invited person into the room; it reads nothing.
 */
const EXEMPT_SHAPES: readonly RegExp[] = [/^\/api\/events\/[^/]+\/join$/];

/** The header our own automation (release smoke, QA probes) carries to pass the entrance. */
export const ENTRANCE_PASS_HEADER = "x-entrance-pass";

/** A gathering's invite link carries this query parameter: a signed pass to that one gathering. */
export const EVENT_PASS_PARAM = "pass";
export const EVENT_PASS_COOKIE = "vos_event";
export const EVENT_PASS_DAYS = 120;

/**
 * A gated read a brochure page also needs, answered to a visitor who has not entered with only
 * the keys listed. The landing page and the steward path name the founding team's open roles and
 * link to them, so a visitor reads which roles are open and nothing else: no pay, no holders, no
 * sections. The link they follow leads to the entrance.
 */
export const ENTRANCE_BROCHURE_KEYS: Readonly<Record<string, readonly string[]>> = {
  "/api/org/founding-team": ["on", "roleIds", "names"],
};

function under(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "."));
}

/** Whether a page path is behind the entrance. Query and hash are ignored. */
export function pageBehindEntrance(path: string): boolean {
  const bare = path.split(/[?#]/)[0] || "/";
  return under(bare, ENTRANCE_PAGES);
}

/**
 * Whether an API request path is behind the entrance. `query` matters for one path: a member's
 * own calendar feed (`/api/events/calendar.ics?token=`) is read by a calendar app that carries no
 * cookie, and the route checks its token strictly itself, so it passes; the tokenless public
 * feed does not.
 */
export function apiBehindEntrance(path: string, query: Record<string, unknown> = {}): boolean {
  if (Object.prototype.hasOwnProperty.call(ENTRANCE_BROCHURE_KEYS, path)) return true;
  if (under(path, ENTRANCE_API_EXEMPT)) return false;
  if (EXEMPT_SHAPES.some((re) => re.test(path))) return false;
  if (path === "/api/events/calendar.ics" && typeof query.token === "string" && query.token !== "") return false;
  return under(path, ENTRANCE_APIS);
}

/** The keys a visitor who has not entered may read from this path, or null when the path is refused whole. */
export function brochureKeysFor(path: string): readonly string[] | null {
  return Object.prototype.hasOwnProperty.call(ENTRANCE_BROCHURE_KEYS, path) ? ENTRANCE_BROCHURE_KEYS[path] : null;
}

/** A page to send the visitor on to: a same-site path, never another site. */
export function safeNext(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\") || s.length > LINK_MAX) return null;
  if (/[\u0000-\u001f]/.test(s)) return null;
  return s;
}

// ── What the visitor sends, and what the server reads back ─────────────────

export interface EntranceForm {
  name: string;
  email: string;
  whatsapp?: string;
  link?: string;
  updates?: boolean;
  next?: string;
  locale?: string;
  /** The Turnstile answer, when the village has the check set up. */
  turnstileToken?: string;
  /** The fallback check: a field no person sees, and when the form was drawn. */
  website?: string;
  shownAt?: number;
  /** The words of the privacy line the visitor saw, as they saw them. */
  consentWords?: string;
}

export interface EntranceStatus {
  /** Whether this village keeps an entrance at all. */
  required: boolean;
  /** Whether this device has passed it (or is signed in). */
  entered: boolean;
  /** The Turnstile site key, when the village has set the check up; null means the fallback check. */
  siteKey: string | null;
  /** The one gathering an invite's pass opens on this device, or null. */
  eventPass?: string | null;
}

export interface PortalEntry {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  link: string | null;
  updates: boolean;
  nextPath: string | null;
  locale: string | null;
  human: string;
  at: string;
}

export type EntranceProblem = "name" | "email" | "whatsapp" | "link";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A WhatsApp number as a person types one: digits, spaces, dashes, dots, brackets, a leading plus. */
export function cleanWhatsapp(v: unknown): string | null | false {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (s.length > WHATSAPP_MAX || !/^\+?[0-9 ().-]+$/.test(s)) return false;
  const digits = s.replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 15 ? s : false;
}

/** A website or social link: http(s), or a bare domain or @handle that we keep as typed. */
export function cleanLink(v: unknown): string | null | false {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (s.length > LINK_MAX || /\s/.test(s)) return false;
  if (/^https?:\/\//i.test(s)) {
    try {
      new URL(s);
      return s;
    } catch {
      return false;
    }
  }
  if (/^(javascript|data|vbscript|file):/i.test(s)) return false;
  return /^@?[\w.-]+(\/[\w./%?=&#@+-]*)?$/.test(s) ? s : false;
}

/** The form, checked. Answers the clean fields or the first field that is wrong. */
export function parseEntrance(body: unknown): { ok: true; value: { name: string; email: string; whatsapp: string | null; link: string | null; updates: boolean } } | { ok: false; problem: EntranceProblem } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > NAME_MAX) return { ok: false, problem: "name" };
  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (!email || email.length > EMAIL_MAX || !EMAIL_RE.test(email)) return { ok: false, problem: "email" };
  const whatsapp = cleanWhatsapp(b.whatsapp);
  if (whatsapp === false) return { ok: false, problem: "whatsapp" };
  const link = cleanLink(b.link);
  if (link === false) return { ok: false, problem: "link" };
  return { ok: true, value: { name, email, whatsapp, link, updates: b.updates === true } };
}
