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

/** The days each route promises an answer within, as a village variable (default 14). */
export const CONTRIBUTOR_REPLY_DAYS_VARIABLE = "org.contributor_reply_days";
export const CONTRIBUTOR_REPLY_DAYS_DEFAULT = 14;

/** A promise the page can keep: a whole number of days from 1 to 60, else the default. */
export function replyDaysOf(raw: unknown): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 60 ? n : CONTRIBUTOR_REPLY_DAYS_DEFAULT;
}

/** The routes in order, less any the caller leaves out ("the other three" beside a role). */
export function routesExcept(left: readonly ContributorRoute[] = []): ContributorRoute[] {
  return CONTRIBUTOR_ROUTES.filter((r) => !left.includes(r));
}

// ── Become a partner ─────────────────────────────────────────────────────────

/**
 * THE INBOX TAG (for the review inbox lane): a proposal that came through one of the four ways carries
 * `source: "contributor_route"` and `route: "<route>"` in its submission data. Today the partner form sets it
 * (`route: "partner"`); a venture arrives as the existing `work-with-us` type and a quest as `quest-proposal`.
 */
export const CONTRIBUTOR_SOURCE = "contributor_route";

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

/** The first thing missing or wrong in a partner proposal, or null when it can be sent. */
export function partnerProblem(p: PartnerProposal): PartnerProblem | null {
  if (!p.name.trim() || p.name.length > PARTNER_LIMITS.name) return "name";
  if (!EMAIL.test(p.email.trim()) || p.email.length > PARTNER_LIMITS.email) return "email";
  if (!p.project.trim() || p.project.length > PARTNER_LIMITS.project) return "project";
  if (p.link.trim() && (!/^https?:\/\/\S+$/i.test(p.link.trim()) || p.link.length > PARTNER_LIMITS.link)) return "link";
  if (p.serves.length === 0 || p.serves.some((s) => !PARTNER_SERVES.includes(s))) return "serves";
  if (!p.offer.trim() || p.offer.length > PARTNER_LIMITS.prose) return "offer";
  if (!p.wish.trim() || p.wish.length > PARTNER_LIMITS.prose) return "wish";
  return null;
}
