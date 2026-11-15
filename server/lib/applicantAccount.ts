/**
 * WHICH ACCOUNT HERE AN OPEN PROPOSAL IS TRUSTED TO BELONG TO (security sweep,
 * 14 Nov 2026). One rule for every place that links an application to a
 * member: the review's applicant, the circle's asks (the applicant is never
 * asked about their own), and the account bell in the applicant's updates.
 *
 *   - An agent's proposal (0374) belongs to the member who keeps it.
 *   - A proposal kept with its address not confirmed (server/lib/openProposalKept.ts)
 *     belongs to NOBODY here until the address answers. Anyone can type
 *     anyone's address into the public form, so a match on an unconfirmed
 *     address proves nothing: the account is not made the applicant, not
 *     left out of the asks, and not told in its bell.
 *   - Otherwise, the address's account, when it is a real, present person:
 *     never an example, never a tombstone.
 *
 * Kept in its own file so openProposalDecide, applicationReview and
 * applicantUpdates share it without importing one another.
 */
import { isExampleUser } from "./examples";
import { isTombstone } from "./oauthAccounts";

export interface AccountLookup {
  byEmail(email: string): Promise<unknown>;
}

/** The address's account here, when it is a real, present person. Says nothing about whether the address was confirmed. */
export async function addressAccount(members: AccountLookup, email: string | null): Promise<string | null> {
  if (!email) return null;
  const m: any = await members.byEmail(email);
  return m && !isExampleUser(m) && !isTombstone({ email: String(m.email ?? "") }) ? String(m.id) : null;
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
