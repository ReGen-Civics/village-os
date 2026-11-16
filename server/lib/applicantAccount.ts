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
 *     (never an example, never a tombstone) AND it OWNS the address
 *     (audit, 15 Nov 2026). Email sign-up makes an account at any address it
 *     is handed, with `emailVerifiedAt` null and a session at once, so a bare
 *     account at an address is only somebody who typed it. An owner is one of:
 *       (a) an account that proved the address (`provedItsAddress`), or
 *       (b) an ACCEPTED MEMBER of this village (`isAcceptedMember`): admitted
 *           (`membershipGranted`, or a stage granted at Member or above, the
 *           platform's own admission record, server/lib/admission.ts), an
 *           admin or founder, or the holder of a live seat. 0304 added the
 *           proof with no backfill, so no member from before it has one, and
 *           every one of them is (b). Each of these is an act somebody did on
 *           the village's behalf; somebody who pre-registers victim@x is none.
 *     Anything else is treated as no account at all: the adoption goes the
 *     invitation's way, the invitation is mailed to the address, and the
 *     person who reads it takes the bare account over when they arrive
 *     (server/routes/register.ts). An accepted member is never taken over.
 *
 * Kept in its own file so openProposalDecide, applicationReview and
 * applicantUpdates share it without importing one another.
 */
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { GAME_CONFIG } from "../../shared/gameConfig";
import { isAdmitted } from "./admission";
import { isExampleUser } from "./examples";
import { holdsUnprovenPassword, isTombstone } from "./oauthAccounts";

export interface AccountLookup {
  byEmail(email: string): Promise<unknown>;
}

/** Where a live seat is read from. Absent, only the account row's own records count. */
export type SeatReader = Pool | PoolConnection | null | undefined;

/** Whether this person holds a live seat in this village, as a member (never a documented or agent holder). */
async function holdsALiveSeat(db: SeatReader, userId: string): Promise<boolean> {
  if (!db || !userId) return false;
  const [rows] = await db.query<RowDataPacket[]>( // module-review-ok: one indexed read (org_role_assignments_user_idx), no cache above it
    "SELECT 1 FROM org_role_assignments WHERE user_id = ? AND holder_kind = 'member' AND ended_at IS NULL LIMIT 1",
    [userId],
  );
  return rows.length > 0;
}

/**
 * Whether this account is an ACCEPTED member of the village (see the header):
 * admitted, an admin or founder, or seated live. A bare registered account, an
 * applicant's account and a visitor are not. The row's own records are read
 * first; the seat only when they say no and a reader is handed in.
 */
export async function isAcceptedMember(
  m: { id?: unknown; role?: unknown; membershipGranted?: unknown; stageGranted?: unknown } | null | undefined,
  db?: SeatReader,
): Promise<boolean> {
  if (!m) return false;
  if (isAdmitted(m, GAME_CONFIG.stages)) return true;
  if (m.role === "admin" || m.role === "founder") return true;
  return holdsALiveSeat(db, String(m.id ?? ""));
}

/** Whether this row owns its address for an application: proved it, or an accepted member (header). */
export async function ownsItsAddress(m: any, db?: SeatReader): Promise<boolean> {
  return provedItsAddress(m) || (await isAcceptedMember(m, db));
}

/**
 * Whether this account row has shown it reads its own address: the proof is
 * recorded, and no password nobody proved stands on it.
 */
export function provedItsAddress(m: { emailVerifiedAt?: string | null; passwordHash?: string | null } | null | undefined): boolean {
  return !!m && !!m.emailVerifiedAt && !holdsUnprovenPassword({ passwordHash: m.passwordHash ?? "", emailVerifiedAt: m.emailVerifiedAt });
}

/**
 * The address's account here, when it is a real, present person who owns the
 * address (proved it, or an accepted member); else null. A bare account that
 * only typed the address is no account for an application: see the header.
 * `db` reads a live seat; without it the account row's own records decide.
 */
export async function addressAccount(members: AccountLookup, email: string | null, db?: SeatReader): Promise<string | null> {
  if (!email) return null;
  const m: any = await members.byEmail(email);
  if (!m || isExampleUser(m) || isTombstone({ email: String(m.email ?? "") })) return null;
  return (await ownsItsAddress(m, db)) ? String(m.id) : null;
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
  db?: SeatReader,
): Promise<string | null> {
  if (p.body?.agent) return p.body.agent.keeperUserId;
  return addressAccount(members, p.email, db);
}

/** The account this proposal is trusted to be, or null: see the header. */
export async function trustedAccountFor(
  members: AccountLookup,
  p: { email: string | null; addressUnconfirmed?: unknown; body?: { agent?: { keeperUserId: string } | null } },
  db?: SeatReader,
): Promise<string | null> {
  if (p.body?.agent) return p.body.agent.keeperUserId;
  if (p.addressUnconfirmed) return null;
  return addressAccount(members, p.email, db);
}
