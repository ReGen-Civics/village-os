/**
 * ONE ACCOUNT, MORE THAN ONE ADDRESS (the lead, 24 Nov 2026).
 *
 * "This will be common for people who sign up or sign in with their personal
 * email, but later get a village email and would want both of them attached to
 * their one account." A member attaches a second address from their profile;
 * a six-digit code is mailed to THAT address, and it is attached only once the
 * code comes back. Signing in works with any attached address, and the member
 * chooses where the village's mail goes.
 *
 * `users.email` stays the MAIN address, so every reader that knows only that
 * column keeps working. The extra addresses live in `member_emails` (0430).
 * The SQL is server/repos/memberEmails.ts, the rules a route asks are
 * server/lib/memberEmails.ts, the routes are server/routes/memberEmails.ts, and
 * the one place the delivery choice applies is `post()` in
 * server/lib/comms/postOffice.ts.
 *
 * This file holds only what the browser and the server both need: the shapes,
 * the limits and the one pure rule for where mail goes.
 */

/** Where a member's mail goes. `main` (or nothing chosen) is how every account behaved before 0430. */
export const EMAIL_DELIVERIES = ["main", "other", "both"] as const;
export type EmailDelivery = (typeof EMAIL_DELIVERIES)[number];

export function isEmailDelivery(v: unknown): v is EmailDelivery {
  return typeof v === "string" && (EMAIL_DELIVERIES as readonly string[]).includes(v);
}

/** Extra addresses one account may hold, beside its main one. Enough for a personal, a work and a village address. */
export const MAX_EXTRA_ADDRESSES = 4;

/** How long a mailed code works. Long enough to switch to another inbox and back. */
export const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;

/** Wrong codes allowed against one mailed code before it is spent and a new one must be asked for. */
export const EMAIL_CODE_TRIES = 5;

/** Six digits, the length every sign-in code a member has met elsewhere uses. */
export const EMAIL_CODE_LENGTH = 6;

/** One extra address as the account's owner and an admin read it. */
export interface ExtraAddress {
  email: string;
  verifiedAt: string;
  /** The extra address mail goes to when the choice is `other` or `both`. */
  getsMail: boolean;
}

/** `GET /api/me/emails`, and the same shape for `GET /api/admin/members/:id/emails`. */
export interface AccountEmails {
  main: string;
  /** Whether the main address was ever proved. An account must prove it before attaching another. */
  mainVerified: boolean;
  extras: ExtraAddress[];
  delivery: EmailDelivery;
  /** Where mail goes today, worked out from the choice: what the page shows as the answer. */
  deliversTo: string[];
  /** A code mailed and not yet entered. The owner's read only; an admin never sees a pending address. */
  pending?: { email: string; expiresAt: string } | null;
}

/** An address as it is stored and compared: trimmed and lower-cased. */
export function normalizeAddress(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

/**
 * The extra address that receives mail under `other` and `both`: the one marked,
 * or the earliest when none is (a member with one extra address never has to
 * pick it). Null when the account holds no extra address.
 */
export function deliveryExtra(extras: readonly Pick<ExtraAddress, "email" | "getsMail">[]): string | null {
  return (extras.find((e) => e.getsMail) ?? extras[0])?.email ?? null;
}

/**
 * WHERE THE MAIL GOES. The one rule, used by the post office when it sends and
 * by the page when it shows the answer, so the two cannot disagree.
 *
 * Nothing chosen is `main`. `other` with no extra address left falls back to
 * the main one, so removing an address can never leave an account with mail
 * going nowhere.
 */
export function deliveryAddresses(account: {
  main: string;
  delivery: unknown;
  extras: readonly Pick<ExtraAddress, "email" | "getsMail">[];
}): string[] {
  const main = normalizeAddress(account.main);
  const choice: EmailDelivery = isEmailDelivery(account.delivery) ? account.delivery : "main";
  const other = deliveryExtra(account.extras);
  if (choice === "main" || !other || other === main) return [main];
  if (choice === "other") return [other];
  return [main, other];
}
