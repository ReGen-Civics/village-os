/**
 * THE WAITLIST FOR COMING-SOON ROLES (the lead, Anchor session of 19 Nov 2026).
 *
 * A coming-soon role is not open yet. Its card on /roles offers "Notify me":
 * an email, an optional WhatsApp number and which coming-soon roles interest
 * the person. The sign-up is kept privately (`role_waitlist`, migration 0414),
 * read by admins only, erased with the member, and nothing is sent from it.
 * No one is selected from it, by a person or a machine: it is a list of who
 * asked to hear.
 *
 *   POST /api/roles/waitlist          anybody, rate limited    { email, whatsapp?, roleIds }
 *   GET  /api/admin/roles/waitlist    admins only
 *
 * A link to `/roles#waitlist-<roleId>` scrolls to that role's card
 * (`id="role-<roleId>"`) and opens its form, so the apply flow's picker can
 * send a person straight there.
 *
 * Pure: no pool, no clock, no Node builtins.
 */
import { addressProblem, emailKeyOf } from "./comms/address";

export const WAITLIST_LIMITS = {
  /** The most roles one sign-up names. */
  roles: 12,
  whatsappChars: 60,
  /** Sign-ups one address or one connection may make in the window. */
  perWindow: 5,
  windowMs: 60 * 60 * 1000,
} as const;

/** The hash that opens a role's waitlist form, and the card's own anchor. */
export const waitlistHash = (roleId: string) => `waitlist-${roleId}`;
export const roleAnchor = (roleId: string) => `role-${roleId}`;

export const WAITLIST_PROBLEMS = {
  email: "Write an email address, like name@example.org.",
  whatsapp: `Write the WhatsApp number with its country code, like +506 8888 8888, or leave it empty. Up to ${WAITLIST_LIMITS.whatsappChars} characters.`,
  roles: "Choose at least one role that is coming soon.",
  tooManyRoles: `Choose up to ${WAITLIST_LIMITS.roles} roles.`,
} as const;

export interface WaitlistSignUp {
  emailKey: string;
  whatsapp: string | null;
  roleIds: string[];
  /** The optional tick: "write to me". Unticked unless the request says `true` exactly. */
  consent: boolean;
}

export type WaitlistRead = { ok: true; value: WaitlistSignUp } | { ok: false; field: "email" | "whatsapp" | "roleIds"; problem: string };

/** A number with an optional + and spaces, dashes, dots or brackets; or a wa.me link. */
const PHONE = /^\+?[\d\s().-]{6,}$/;
const WA_LINK = /^https:\/\/wa\.me\/\d{6,20}(?:\?\S*)?$/i;

/**
 * One sign-up, read. `isComingSoon` says whether a role id is a live
 * coming-soon role, so a sign-up names only roles the page offers.
 */
export function readWaitlistSignUp(raw: unknown, isComingSoon: (roleId: string) => boolean): WaitlistRead {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const email = typeof o.email === "string" ? o.email.trim() : "";
  if (addressProblem(email)) return { ok: false, field: "email", problem: WAITLIST_PROBLEMS.email };
  const wa = typeof o.whatsapp === "string" ? o.whatsapp.trim() : "";
  if (wa && (wa.length > WAITLIST_LIMITS.whatsappChars || !(PHONE.test(wa) || WA_LINK.test(wa)))) return { ok: false, field: "whatsapp", problem: WAITLIST_PROBLEMS.whatsapp };
  const ids = Array.isArray(o.roleIds) ? Array.from(new Set(o.roleIds.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean))) : [];
  if (ids.length > WAITLIST_LIMITS.roles) return { ok: false, field: "roleIds", problem: WAITLIST_PROBLEMS.tooManyRoles };
  const roleIds = ids.filter(isComingSoon);
  if (!roleIds.length || roleIds.length !== ids.length) return { ok: false, field: "roleIds", problem: WAITLIST_PROBLEMS.roles };
  return { ok: true, value: { emailKey: emailKeyOf(email), whatsapp: wa || null, roleIds, consent: o.consent === true } };
}

/** One row as an admin reads it. */
export interface WaitlistRow {
  id: string;
  email: string;
  whatsapp: string | null;
  roles: Array<{ id: string; name: string }>;
  member: boolean;
  /** Said yes to letters on this sign-up. False for a sign-up without the tick and for one from before the tick existed. */
  consent: boolean;
  createdAt: string;
}
