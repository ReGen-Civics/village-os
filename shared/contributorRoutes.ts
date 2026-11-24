/**
 * FOUR WAYS TO BUILD THE VILLAGE (the lead, 23 Nov 2026), largest commitment first:
 *
 *   1. Join the team: a role, from the roles page or the application.
 *   2. Start a venture: build and own a business on the land; the village shares through a lease or a profit share.
 *   3. Become a partner: you already run a project or business and want to work with the village; no role, no lease.
 *   4. Propose a quest: a one-off piece of value, rewarded when the work is accepted.
 *
 * The keys, their order and the two village variables they read. The words live in the client
 * (client/src/components/ContributorRoutes.tsx), translated. Pure: no Node builtins.
 */

export const CONTRIBUTOR_ROUTES = ["team", "venture", "partner", "quest"] as const;
export type ContributorRoute = (typeof CONTRIBUTOR_ROUTES)[number];

/**
 * THE OLD PROMISE IN DAYS, `org.applicant_reply_days` (default 7). Nobody is told days any more (the lead, 24 Nov
 * 2026); the number survives only as a floor under the moon cycles (`effectiveReplyMoons`, below).
 */
export const CONTRIBUTOR_REPLY_DAYS_VARIABLE = "org.applicant_reply_days";
export const CONTRIBUTOR_REPLY_DAYS_DEFAULT = 7;

/** A promise the page can keep: a whole number of days from 1 to 60, else the default. */
export function replyDaysOf(raw: unknown): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 60 ? n : CONTRIBUTOR_REPLY_DAYS_DEFAULT;
}

/**
 * WHEN A PROPOSER HEARS BACK, SAID ONLY ONCE THEY HAVE SENT (the lead, 24 Nov 2026): "remove that they'll hear within
 * 7 days! That's not true! Let's say for all proposals they'll hear within 1 moon cycle and only at submission". The
 * window is the village's own, in moons, `org.reply_window_moons` (default 1), served on /api/game/config as
 * `replyWindowMoons`. Nothing before submission promises a reply. The application's own steps, its letters and its
 * status page say the same window (server/lib/foundingFirst.ts replyMoonsFor).
 */
export const REPLY_WINDOW_MOONS_VARIABLE = "org.reply_window_moons";
export const REPLY_WINDOW_MOONS_DEFAULT = 1;

/** A window the page can say: a whole number of moons from 1 to 6, else one. */
export function replyMoonsOf(raw: unknown): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 6 ? n : REPLY_WINDOW_MOONS_DEFAULT;
}

/** One moon cycle, new moon to new moon, in days (the synodic month). */
export const MOON_CYCLE_DAYS = 29.53;

/**
 * THE WINDOW EVERY PROPOSER IS TOLD, application included (the lead, 24 Nov 2026: "for all proposals they'll hear
 * within 1 moon cycle"): the village's moons, `org.reply_window_moons`, and never fewer moons than the days a village
 * once set in `org.applicant_reply_days`, rounded up to whole cycles. That keeps a village that had promised a long
 * wait (45 days, say) from being made to promise a shorter one (two moons, never one). The default 7 days is inside
 * one cycle, so a village that never touched either says one moon cycle.
 */
export function effectiveReplyMoons(moonsRaw: unknown, daysRaw: unknown): number {
  const moons = replyMoonsOf(moonsRaw);
  const days = typeof daysRaw === "number" ? daysRaw : typeof daysRaw === "string" && daysRaw.trim() !== "" ? Number(daysRaw) : NaN;
  const fromDays = Number.isInteger(days) && days >= 1 && days <= 60 ? Math.ceil(days / MOON_CYCLE_DAYS) : 1;
  return Math.min(6, Math.max(moons, fromDays));
}

/** The routes in order, less any the caller leaves out ("the other three" beside a role). */
export function routesExcept(left: readonly ContributorRoute[] = []): ContributorRoute[] {
  return CONTRIBUTOR_ROUTES.filter((r) => !left.includes(r));
}

// ── Become a partner ─────────────────────────────────────────────────────────

/**
 * THE INBOX TAG (for the review inbox lane): a proposal that came through one of the four ways carries
 * `source: "contributor_route"` and `route: "<route>"` in its submission data. Today the partner form sets it
 * (`route: "partner"`); a venture arrives as the existing `work-with-us` type carrying `kind: "venture"`
 * (VENTURE_KIND, below) and a quest as `quest-proposal`.
 */
export const CONTRIBUTOR_SOURCE = "contributor_route";

// ── Start a venture ─────────────────────────────────────────────────────────

/**
 * START A VENTURE LANDS ON A VENTURE (the lead, 24 Nov 2026). Every Start a venture link but the top tile of /roles
 * (which scrolls to the open ventures there) goes to `/work-with-us?kind=venture`. With that query the page says Start a
 * venture at the top, the guide opens on the business, and the form asks the venture's three questions first. The
 * proposal keeps its type, `work-with-us`, and carries `kind: "venture"` in its data, so the admin inbox can tell a
 * venture from any other offer. Without the query the page is the general proposal page it always was.
 */
export const VENTURE_KIND = "venture";
export const VENTURE_QUERY = `kind=${VENTURE_KIND}`;

/** Does this address's query (`location.search`, with or without its `?`) ask for the venture page? */
export function isVentureQuery(search: string | null | undefined): boolean {
  const params = new URLSearchParams(String(search ?? "").replace(/^\?/, ""));
  return params.get("kind") === VENTURE_KIND;
}

/** The submissions pipeline's type for a partner proposal (POST /api/forms/submit). */
export const PARTNER_FORM = "partner";

/** The role whose holders receive partner proposals, by id: a village variable, never a typed role name. */
export const PARTNERSHIPS_ROLE_VARIABLE = "org.partnerships_role";

/** What a partnership can serve. A proposal names one or more. */
export const PARTNER_SERVES = ["community", "village", "thriving"] as const;
export type PartnerServes = (typeof PARTNER_SERVES)[number];

export interface PartnerProposal {
  name: string;
  email: string;
  project: string;
  link: string;
  serves: PartnerServes[];
  offer: string;
  wish: string;
}

export const PARTNER_LIMITS = { name: 120, email: 254, project: 160, link: 500, prose: 4000 } as const;

export type PartnerProblem = "name" | "email" | "project" | "link" | "serves" | "offer" | "wish";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Every thing missing or wrong in a partner proposal, in the form's order; [] when it can be sent. The form lists them
 * all at once, each linked to its field (QA, 23 Nov 2026), so nobody fixes one and meets the next.
 */
export function partnerProblems(p: PartnerProposal): PartnerProblem[] {
  const out: PartnerProblem[] = [];
  if (!p.name.trim() || p.name.length > PARTNER_LIMITS.name) out.push("name");
  if (!EMAIL.test(p.email.trim()) || p.email.length > PARTNER_LIMITS.email) out.push("email");
  if (!p.project.trim() || p.project.length > PARTNER_LIMITS.project) out.push("project");
  if (p.link.trim() && (!/^https?:\/\/\S+$/i.test(p.link.trim()) || p.link.length > PARTNER_LIMITS.link)) out.push("link");
  if (p.serves.length === 0 || p.serves.some((s) => !PARTNER_SERVES.includes(s))) out.push("serves");
  if (!p.offer.trim() || p.offer.length > PARTNER_LIMITS.prose) out.push("offer");
  if (!p.wish.trim() || p.wish.length > PARTNER_LIMITS.prose) out.push("wish");
  return out;
}

/** The first thing missing or wrong in a partner proposal, or null when it can be sent. */
export function partnerProblem(p: PartnerProposal): PartnerProblem | null {
  return partnerProblems(p)[0] ?? null;
}
