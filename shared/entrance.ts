/**
 * THE ENTRANCE TO THE PORTAL (the lead, 24 Nov 2026, from a team member's feedback, and the gate design
 * the lead confirmed that evening).
 *
 * "Before anyone can access the game and roles they have to give us their name and email", with a
 * WhatsApp number and a website or social link if they want, and a check that they are a person.
 * The game site is the village's inner workings: roles and their pay, the game, quests, circles,
 * powers, the calendar, members' first names. While the village keeps an entrance, ALL of it waits
 * behind one calm screen, which offers an honest taste of what is inside. The village's public site
 * is elsewhere (the entrance links to it).
 *
 * ── AN ALLOW-LIST, BOTH SIDES ───────────────────────────────────────────────
 *
 * Everything is behind the entrance except what `OPEN_PAGES` and `OPEN_APIS` name: signing in and
 * its email links, an applicant's own status, the legal pages, and what link previews and the hub
 * read. The client draws the entrance in front of every other page; the server
 * (server/lib/entrance.ts, installed in front of every route the way the people lock is) refuses
 * every other read. An allow-list is the safe direction: a page added tomorrow is gated by default.
 *
 * WHO PASSES: a signed-in member, an agent token, our own automation by its pass header, a visitor
 * with a live entry cookie (signed by the server, `ENTRY_DAYS` long), and an invited guest for their
 * one gathering. Everybody, while the village's dial `entrance.required` is off, which is the
 * platform default: a fork turns its entrance on.
 *
 * WHAT IS KEPT: the name, the address, the optional fields, what draws them, the answer to the
 * keep-in-touch question (yes, no or unanswered) and the words they saw with each answer, the page
 * the entrance caught them on, the pages they open afterwards, the language and how the human check
 * was passed. No device fingerprint, no third-party tracking. The list is read only by whoever holds
 * `intake.moderate` (Admin, Portal visitors), and no email is ever sent to it by the platform.
 */

/**
 * A hint, not a pass: the server sets this readable cookie on every page it serves while the village
 * keeps an entrance, and clears it when the dial goes off. The client's gate reads it synchronously,
 * so a village without an entrance draws its pages with no extra round trip, and one with an
 * entrance asks `/api/entrance` before drawing a page behind it. The server's gate is the rule
 * either way.
 */
export const GATE_HINT_COOKIE = "vos_gate";

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
 * The pages that stay open while the village keeps an entrance, as leading path segments. A path
 * is open when it equals one of these or begins with one followed by `/`. Every other page draws
 * the entrance (which is itself the taste: it says what is inside before it asks).
 */
export const OPEN_PAGES: readonly string[] = [
  // Signing in, and the links signing in sends.
  "/login",
  "/register",
  "/forgot-password",
  "/set-password",
  "/verify-email",
  "/oauth",
  "/claim",
  "/reset",
  // Links in the village's emails: preferences, unsubscribing, one-click answers.
  "/email",
  // An applicant's own links: confirming an application, and its status.
  "/propose-a-role/confirm",
  "/application-status",
  // The legal pages.
  "/privacy",
  "/terms",
  "/404",
];

/**
 * The read APIs that stay open, as path prefixes. Every other GET under `/api` is refused to a
 * visitor who has not entered. Reads only: a write already asks who is writing.
 */
export const OPEN_APIS: readonly string[] = [
  // The entrance itself, and what every page needs to draw at all.
  "/api/entrance",
  "/api/game/config",
  "/api/settings",
  "/api/platform",
  "/api/i18n",
  "/api/brand",
  "/api/art",
  "/api/uploads",
  "/api/feedback/config",
  "/api/assistant/status",
  "/api/fx/rates",
  // Signing in, and its own token-checked doors.
  "/api/auth",
  "/api/invites",
  "/api/agent",
  "/api/admin/bootstrap",
  // Email links, an applicant's own status, and confirming an application.
  "/api/comms",
  "/api/application-status",
  "/api/governance/applications",
  "/api/open-proposals/confirm",
  // What link previews and the hub read.
  "/api/og",
  "/api/public",
];

/** Exactly these paths stay open, and nothing under them. `/api/modules` says which modules are on; the catalog under it is gated. */
const OPEN_EXACT: readonly string[] = ["/api/modules"];

/**
 * Paths that stay open by shape. The join link in a gathering's emails (`/api/events/<id>/join`)
 * redirects an invited person into the room; it reads nothing.
 */
const EXEMPT_SHAPES: readonly RegExp[] = [/^\/api\/events\/[^/]+\/join$/];

/** The header our own automation (release smoke, QA probes) carries to pass the entrance. */
export const ENTRANCE_PASS_HEADER = "x-entrance-pass";

/** A gathering's invite link carries this query parameter: a signed pass to that one gathering. */
export const EVENT_PASS_PARAM = "pass";
export const EVENT_PASS_COOKIE = "vos_event";
export const EVENT_PASS_DAYS = 120;

/**
 * A gated read the entrance's taste also needs, answered to a visitor who has not entered with only
 * the keys listed: the founding team's open roles by name, and nothing else (no pay, no holders, no
 * sections).
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
  return !under(bare, OPEN_PAGES);
}

/**
 * Whether an API request path is behind the entrance. `query` matters for one path: a member's
 * own calendar feed (`/api/events/calendar.ics?token=`) is read by a calendar app that carries no
 * cookie, and the route checks its token strictly itself, so it passes; the tokenless public feed
 * does not.
 */
export function apiBehindEntrance(path: string, query: Record<string, unknown> = {}): boolean {
  if (!path.startsWith("/api/")) return false;
  if (Object.prototype.hasOwnProperty.call(ENTRANCE_BROCHURE_KEYS, path)) return true;
  if (OPEN_EXACT.includes(path)) return false;
  if (under(path, OPEN_APIS)) return false;
  if (EXEMPT_SHAPES.some((re) => re.test(path))) return false;
  if (path === "/api/events/calendar.ics" && typeof query.token === "string" && query.token !== "") return false;
  return true;
}

/** The keys a visitor who has not entered may read from this path, or null when the path is refused whole. */
export function brochureKeysFor(path: string): readonly string[] | null {
  return Object.prototype.hasOwnProperty.call(ENTRANCE_BROCHURE_KEYS, path) ? ENTRANCE_BROCHURE_KEYS[path] : null;
}

/**
 * A page to send the visitor on to: a same-site path, never another site. Refuses an absolute URL,
 * a protocol-relative `//host`, a backslash trick and control characters; the caller falls back to
 * `/` (shared/entrance.test.ts holds `/roles` landing on `/roles`).
 */
export function safeNext(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\") || s.length > LINK_MAX) return null;
  if (/[\u0000-\u001f]/.test(s)) return null;
  return s;
}

// ── What the visitor sends, and what the server reads back ─────────────────

/**
 * "What draws you here?" (ops, 24 Nov 2026: "so that we can build our CRM"). One optional answer,
 * so the village can follow up with a founding seeder differently from a future neighbour. Nobody
 * is ranked, scored or sorted by it; it is a label a person chose for themselves.
 */
export const INTERESTS = ["seeder", "home", "visit", "role", "curious"] as const;
export type Interest = (typeof INTERESTS)[number];

export function isInterest(v: unknown): v is Interest {
  return typeof v === "string" && (INTERESTS as readonly string[]).includes(v);
}

/** The keep-in-touch step's answer: its own step, two buttons, stored either way. Only `yes` reaches a list. */
export const UPDATES_ANSWERS = ["yes", "no"] as const;
export type UpdatesAnswer = (typeof UPDATES_ANSWERS)[number];

export function isUpdatesAnswer(v: unknown): v is UpdatesAnswer {
  return v === "yes" || v === "no";
}

export interface EntranceForm {
  name: string;
  email: string;
  interest?: Interest;
  whatsapp?: string;
  link?: string;
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
  /** True when this device passed by its entry alone (not a member, an agent or our automation): its page views are kept. */
  visitor?: boolean;
}

export interface PortalEntry {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  link: string | null;
  /** The keep-in-touch answer: yes, no, or null while unanswered. */
  updates: UpdatesAnswer | null;
  /** The page the entrance caught them on, the one they first asked for. */
  nextPath: string | null;
  locale: string | null;
  human: string;
  at: string;
  interest: Interest | null;
  /** When the entry reached the village's email list, or null while it has not (or was never meant to). */
  syncedAt: string | null;
  syncError: string | null;
  /** What this person has done since, matched by their address (Admin only). */
  journey?: VisitorJourney;
  /** The pages they opened after entering, newest first (Admin only). */
  views?: PortalView[];
}

/** One page an entered visitor opened. */
export interface PortalView {
  path: string;
  roleSlug: string | null;
  at: string;
}

/** The role a page shows, when it is a role's own page (`/roles/<slug>`), else null. */
export function roleSlugOf(path: string): string | null {
  const m = /^\/roles\/([^/?#]+)$/.exec(path.split(/[?#]/)[0]);
  if (!m || m[1] === "select" || m[1] === "draft") return null;
  return m[1].slice(0, 200);
}

/** A visitor's later steps, matched by email: what they applied for, whether they hold an account, what they sent. */
export interface VisitorJourney {
  applications: Array<{ status: string; at: string }>;
  /** The account at this address, and whether it holds membership (Make member shows only when it does not). */
  account: { id: string; joined: string; member: boolean } | null;
  forms: Array<{ type: string; at: string }>;
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
export function parseEntrance(body: unknown): { ok: true; value: { name: string; email: string; whatsapp: string | null; link: string | null; interest: Interest | null } } | { ok: false; problem: EntranceProblem } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > NAME_MAX) return { ok: false, problem: "name" };
  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (!email || email.length > EMAIL_MAX || !EMAIL_RE.test(email)) return { ok: false, problem: "email" };
  const whatsapp = cleanWhatsapp(b.whatsapp);
  if (whatsapp === false) return { ok: false, problem: "whatsapp" };
  const link = cleanLink(b.link);
  if (link === false) return { ok: false, problem: "link" };
  // An answer the form does not offer is no answer, never a refusal: the question is optional.
  return { ok: true, value: { name, email, whatsapp, link, interest: isInterest(b.interest) ? b.interest : null } };
}
