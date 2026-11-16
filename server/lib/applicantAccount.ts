/**
 * WHICH ACCOUNT HERE AN OPEN PROPOSAL IS TRUSTED TO BELONG TO (security sweep,
 * 14 Nov 2026). One rule for every place that links an application to a
 * member: the review's applicant, the circle's asks (the applicant is never
 * asked about their own), the account bell in the applicant's updates, the
 * adoption that places an account on its roles, and the village vote that
 * needs one.
 *
 *   - An agent's proposal (0374) belongs to the member who keeps it.
 *   - A proposal kept with its address not confirmed (server/lib/openProposalKept.ts)
 *     belongs to NOBODY here until the address answers. Anyone can type
 *     anyone's address into the public form, so a match on an unconfirmed
 *     address proves nothing: the account is not made the applicant, not
 *     left out of the asks, and not told in its bell.
 *   - Otherwise, the address's account, when it is a real, present person
 *     (never an example, never a tombstone) AND it has proved it reads the
 *     address (audit, 15 Nov 2026). Email sign-up makes an account at any
 *     address it is handed, with `emailVerifiedAt` null and a session at once,
 *     so an account that never proved the address is only somebody who typed
 *     it. Treated as no account at all: the adoption goes the invitation's way,
 *     the invitation is mailed to the address, and the person who reads it
 *     takes the unproved account over when they arrive (server/routes/register.ts).
 *
 * Kept in its own file so openProposalDecide, applicationReview and
 * applicantUpdates share it without importing one another.
 */
import { isExampleUser } from "./examples";
import { holdsUnprovenPassword, isTombstone } from "./oauthAccounts";

export interface AccountLookup {
  byEmail(email: string): Promise<unknown>;
}

/**
 * Whether this account row has shown it reads its own address: the proof is
 * recorded, and no password nobody proved stands on it.
 */
export function provedItsAddress(m: { emailVerifiedAt?: string | null; passwordHash?: string | null } | null | undefined): boolean {
  return !!m && !!m.emailVerifiedAt && !holdsUnprovenPassword({ passwordHash: m.passwordHash ?? "", emailVerifiedAt: m.emailVerifiedAt });
}

/**
 * The address's account here, when it is a real, present person who proved
 * the address; else null. An account that only typed the address is no account
 * for an application: see the header.
 */
export async function addressAccount(members: AccountLookup, email: string | null): Promise<string | null> {
  if (!email) return null;
  const m: any = await members.byEmail(email);
  if (!m || isExampleUser(m) || isTombstone({ email: String(m.email ?? "") })) return null;
  return provedItsAddress(m) ? String(m.id) : null;
}

/**
 * The address's account here whether or not it proved the address, for the
 * checks that must see it anyway (a former member is refused either way).
 * Never an example, never a tombstone. Never trusted as the applicant.
 */
export async function anyAddressAccount(members: AccountLookup, email: string | null): Promise<string | null> {
  if (!email) return null;
  const m: any = await members.byEmail(email);
  return m && !isExampleUser(m) && !isTombstone({ email: String(m.email ?? "") }) ? String(m.id) : null;
}

/**
 * WHOSE PROPOSAL IT IS, as an account here: the person behind the address, or,
 * for an agent (0374), the member who keeps it and proposed it. That account is
 * never asked about it and never adopts or declines it. Says nothing about
 * whether a kept proposal's address answered yet (`trustedAccountFor` does).
 */
export async function ownAccountOf(
  members: AccountLookup,
  p: { email: string | null; body?: { agent?: { keeperUserId: string } | null } },
): Promise<string | null> {
  if (p.body?.agent) return p.body.agent.keeperUserId;
  return addressAccount(members, p.email);
}

/** The account this proposal is trusted to be, or null: see the header. */
export async function trustedAccountFor(
  members: AccountLookup,
  p: { email: string | null; addressUnconfirmed?: unknown; body?: { agent?: { keeperUserId: string } | null } },
): Promise<string | null> {
  if (p.body?.agent) return p.body.agent.keeperUserId;
  if (p.addressUnconfirmed) return null;
  return addressAccount(members, p.email);
}
