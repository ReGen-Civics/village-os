/**
 * A VISITOR'S PROFILE (the lead, 25 Nov 2026: "anyone who's a visitor still has a visitor account,
 * where we won't show them any of the member account stuff").
 *
 * A visitor is the person behind a verified address at the portal entrance (shared/entrance.ts):
 * the 6-digit code or Google proved it. They hold no member account, which keeps the village's
 * rule that membership is by invitation, and they appear in no member list, count or ladder. What
 * they do hold:
 *
 *   - a way back in: their email and a fresh code (`/visitor/sign-in`), or Google if they came by it;
 *   - a profile at `/visitor`, clearly a visitor's: what they gave us, their applications (with
 *     withdraw, and edit, which withdraws and reopens the form with their answers), the forms they
 *     sent, the pages we noted, their keep-in-touch answer, a download of all of it, and delete;
 *   - "Request an invitation to full membership", which lands in Admin, Portal visitors, where a
 *     steward who may admit members promotes one or many with a click. A promotion makes their
 *     member account (already verified), admits them through the super vouch, and emails them a
 *     link to set a password and fill out their profile.
 *
 * Deleting withdraws every application still waiting; the existing tidy job takes the name and
 * address off it 90 days after (server/routes/openProposals.ts), with the ones already decided.
 *
 * Pure: types and small helpers only.
 */

export const INVITE_STATUSES = ["requested", "declined", "promoted"] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export function isInviteStatus(v: unknown): v is InviteStatus {
  return typeof v === "string" && (INVITE_STATUSES as readonly string[]).includes(v);
}

/** Days after a declined request before the visitor may ask again. */
export const ASK_AGAIN_DAYS = 30;
/** The most characters a request's note may carry. */
export const INVITE_NOTE_MAX = 1000;
/** The word a visitor types to delete everything. */
export const DELETE_WORD = "DELETE";

/** One application as its sender reads it on their profile. */
export interface VisitorApplication {
  id: string;
  /** The roles it was for, by name. */
  roles: string[];
  status: "unconfirmed" | "confirmed" | "adopted" | "declined" | "withdrawn";
  sentAt: string;
  decidedAt: string | null;
  /** Still waiting on a decision, so it may be withdrawn or edited. */
  open: boolean;
}

export interface VisitorInvite {
  status: InviteStatus;
  requestedAt: string | null;
  note: string | null;
  decidedAt: string | null;
  /** What a declined request says to the visitor, when the steward wrote anything. */
  declineWords: string | null;
  /** When a declined visitor may ask again, or null. */
  askAgainFrom: string | null;
}

export interface VisitorProfile {
  name: string;
  email: string;
  whatsapp: string | null;
  link: string | null;
  interest: string | null;
  updates: "yes" | "no" | null;
  verifiedAt: string;
  firstSeen: string;
  /** Proved by Google, so they sign back in with Google too. */
  viaGoogle: boolean;
  applications: VisitorApplication[];
  forms: { type: string; at: string }[];
  pages: { path: string; at: string }[];
  invite: VisitorInvite | null;
}

/** When a declined request may be made again. */
export function askAgainFrom(decidedAt: Date | null, status: InviteStatus | null): Date | null {
  if (status !== "declined" || !decidedAt) return null;
  return new Date(decidedAt.getTime() + ASK_AGAIN_DAYS * 24 * 60 * 60 * 1000);
}

/** Whether a visitor may send a request now. */
export function mayRequestInvite(invite: Pick<VisitorInvite, "status" | "askAgainFrom"> | null, now: number): boolean {
  if (!invite) return true;
  if (invite.status === "declined") return !invite.askAgainFrom || Date.parse(invite.askAgainFrom) <= now;
  return false;
}

/** One request as Admin, Portal visitors reads it. */
export interface InviteRequest {
  visitorId: string;
  name: string;
  email: string;
  note: string | null;
  requestedAt: string;
  interest: string | null;
  applications: number;
  firstSeen: string;
  /** An account at this address already, which a promotion admits instead of making. */
  hasAccount: boolean;
}
