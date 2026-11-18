/**
 * Sign-up by email and password, and the invitation that opens it.
 *
 *   POST /api/auth/register
 *
 * ── WHY IT LEFT server/index.ts ─────────────────────────────────────────────
 *
 * The invitation had to sit beside the Google door, which already lived in a
 * route module, and `server/index.ts` is ratcheted on lines. Moving the route
 * put both sign-up doors on the same `InviteDoor` (`server/lib/inviteDoor.ts`)
 * and gave the ratchet back more lines than the invitation added.
 *
 * ── THE ORDER OF THE REFUSALS IS A PRIVACY DECISION ─────────────────────────
 *
 * The throttle first, as before, because it bounds everything below it,
 * including the address check. Then the invitation, BEFORE the address check:
 * "that address already has an account" is an answer about a member, and in a
 * village that joins by invitation a stranger with no link gets no answer about
 * anybody.
 *
 * ── A LINK IS TAKEN BEFORE THE ACCOUNT IS MADE ──────────────────────────────
 *
 * Two people racing one link leave exactly one account holding it: the take is
 * a conditional UPDATE, and the loser is refused before anything is written. If
 * the account write then fails, the link is given back.
 *
 * ── AN INVITATION COUNTS IN AN OPEN VILLAGE TOO ─────────────────────────────
 *
 * With `membership.invite_only` off, nobody needs a link. A good link that
 * arrives anyway is still used, because it is still somebody's vouch. A bad
 * one is ignored there, because refusing an account the village would have let
 * in without any link would be a refusal with no reason behind it.
 *
 * ── THE ADDRESS IS UNPROVED UNTIL ITS OWNER SAYS SO (R104) ──────────────────
 *
 * Nothing here can tell whether the person typing an address reads it, so the
 * account is made with `emailVerifiedAt` null and the address is mailed a link
 * that proves it (server/lib/emailVerification.ts). Signing in by password
 * never waits on that, so a village with no email provider loses nothing. What
 * waits is trust in this password as the mailbox owner's: until the address is
 * proved, a Google sign-in at it ends the password, and no founder grant or
 * bootstrap raises the row while the password stands.
 *
 * ── THE INVITED PERSON TAKES OVER AN ACCOUNT NOBODY PROVED (audit, 15 Nov 2026) ─
 *
 * An adopted application's invitation goes to the address the person applied
 * from. Somebody may have signed up at that address first, with a password the
 * address never proved, which used to answer the invited person "Email already
 * exists" and keep them out for good. An application never trusts such an
 * account (server/lib/applicantAccount.ts), so the adoption went the
 * invitation's way and the invitation has to be able to arrive.
 *
 * So when the link was MAILED to this very address (`InviteFor.mailed`) and the
 * account at it never proved the address, the person who opened the link from
 * that mailbox takes the row over, as a Google sign-in at the address already
 * does (R104, server/routes/authGoogle.ts): in one locked write their password
 * replaces the unproved one, the address is recorded as proved, and
 * tokenVersion moves so every session minted on the old password dies, with
 * the agent reach ended around the write. A PROVED account, and an ACCEPTED
 * MEMBER's account (admitted, admin or founder, or seated live:
 * `isAcceptedMember`, server/lib/applicantAccount.ts), is never taken over and
 * is answered as before. Such a member's application never goes the
 * invitation's way at all: it is placed on their account.
 */
import { randomBytes } from "node:crypto";
import type { Express, Request } from "express";

import { cleanName, passwordProblem } from "../../shared/accountRules";
import { claimPaths } from "../../shared/gameConfig";
import { describeInvite, type InviteDoor } from "../lib/inviteDoor";
import { INVITE_REFUSALS, readInviteToken } from "../lib/invites";
import { GAME_CONFIG } from "../../shared/gameConfig";
import { isAdmitted } from "../lib/admission";
import { isAcceptedMember, provedItsAddress } from "../lib/applicantAccount";
import { sameAddress } from "../lib/emailVerification";
import { isTombstone, isUnclaimable } from "../lib/oauthAccounts";
import { numberVar } from "../lib/variables";
// Village Comms: the one door to the email system (server/lib/commsSink.ts).
import { commsSink } from "../lib/commsSink";

export interface RegisterDeps {
  overLimit(bucket: string, max: number, windowMs: number): Promise<boolean>;
  clientIp(req: Request): string;
  members: {
    existsByEmail(email: string): Promise<boolean>;
    add(member: any): Promise<unknown>;
    /** For the take-over of an account nobody proved (see the header). Absent: that door stays shut. */
    byEmail?(email: string): Promise<any>;
    update?(id: string, mutate: (m: any) => void): Promise<any>;
  };
  /** Whether this row is an accepted member's (`isAcceptedMember` with a live-seat read). Absent: the row's own records decide. */
  acceptedMember?(row: any): Promise<boolean>;
  /** Ends what an agent holds for this account on both sides of the change (`withAgentReachEnded`). Absent: no take-over. */
  endReachAround?<T>(userId: string, change: () => Promise<T>): Promise<T>;
  hashPassword(password: string): Promise<string>;
  makeHandle(name: string): Promise<string>;
  /** Every door in records the join and greets: `memberJoined` in server/lib/arrival.ts. */
  joined(member: { id: string; name: string; handle: string }): Promise<unknown>;
  encodeToken(userId: string, email: string, tokenVersion?: number): string;
  publicUser(member: any): any;
  invites: InviteDoor;
  /**
   * Mail the new account's address a link that proves it (R104,
   * `sendVerifyLetter` in server/lib/emailVerification.ts). Must never
   * reject: a village with no email provider still makes the account.
   */
  sendVerification(member: { id: string; email: string; name: string }): Promise<unknown>;
}

export function register(app: Express, deps: RegisterDeps): void {
  app.post("/api/auth/register", async (req, res) => {
    // FIRST statement, before the exists-by-email check, so the throttle also
    // bounds the account-enumeration oracle (409 vs 200 answers "is this
    // address a member?"). Per-IP and admin-tunable: a village onboarding
    // gathering behind one NAT shares a bucket, so the default is above
    // login's. overLimit fails open on DB trouble — an outage never blocks
    // registration.
    if (await deps.overLimit(`register:${deps.clientIp(req)}`, Math.max(1, numberVar("abuse.register_per_ip_hourly")), 60 * 60 * 1000)) {
      return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
    }
    const { name: rawName, email, password, paths } = req.body ?? {};
    if (!rawName || !email || !password || !paths || !Array.isArray(paths)) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    // The rules every door that makes or changes an account keeps (readiness R117,
    // shared/accountRules.ts): 8 characters at least, as set-password asks, and a
    // name trimmed and capped as the claim door caps it.
    const weak = passwordProblem(password);
    if (weak) return res.status(400).json({ error: weak.error, field: weak.field });
    const named = cleanName(rawName);
    if (!named.ok) return res.status(400).json({ error: named.refusal.error, field: named.refusal.field });
    const name = named.name;
    // The domain closed accounts are written at. An account here would read as
    // closed everywhere, and one at a departing member's tombstone address
    // used to block that member's erasure for good (round 2, finding 5). No
    // answer about anybody: the refusal is about the address alone.
    if (isTombstone({ email: String(email).trim() })) {
      return res.status(400).json({ error: "That address cannot hold an account. Sign up with the address you read your mail at." });
    }
    // The other door onto a member's paths, and the one a stranger can open.
    const chosen = claimPaths(paths);
    if (!chosen.ok) return res.status(400).json({ error: chosen.error });

    const token = readInviteToken(req.body?.invite);
    const required = deps.invites.required();
    let inviteId: string | null = null;
    // The address an adopted proposal's link was mailed to, when this account is made at that same address (audit P9).
    // Only a link that went by mail and to nobody else proves its address: one handed to the adopter proves nothing.
    let invitedAddress: string | null = null;
    if (token || required) {
      const found = await deps.invites.resolve(token);
      if (found.ok) {
        inviteId = found.id;
        const about = await describeInvite(found.id);
        invitedAddress = about?.mailed === true ? about.email?.trim().toLowerCase() || null : null;
      }
      else if (required) return res.status(403).json({ error: found.error, code: "invitation_required" });
    }
    const provesAddress = invitedAddress !== null && invitedAddress === String(email).trim().toLowerCase();

    if (await deps.members.existsByEmail(email)) {
      // The invited person at their own address, over an account that never proved it: theirs to take (header).
      if (provesAddress && inviteId) {
        const taken = await takeOverUnproved(deps, { inviteId, email: String(email), password });
        if (taken.ok) return res.json({ success: true, token: deps.encodeToken(taken.member.id, taken.member.email, Number(taken.member.tokenVersion ?? 0)), user: deps.publicUser(taken.member), tookOver: true });
        if (taken.reason === "used") return res.status(409).json({ error: INVITE_REFUSALS.used, code: "invitation_used" });
      }
      return res.status(409).json({ error: "Email already exists" });
    }
    // The suffix comes from crypto. This id is signed into the member's session token, and code
    // scanning holds every value that reaches a token to that standard (js/insecure-randomness).
    const userId = `user-${Date.now()}-${randomBytes(4).toString("hex")}`;
    const inviter = inviteId ? await deps.invites.claim(inviteId, userId) : null;
    if (inviteId && !inviter) {
      // Taken by somebody else between the check above and now.
      return res.status(409).json({ error: INVITE_REFUSALS.used, code: "invitation_used" });
    }
    const user = {
      id: userId,
      name,
      email,
      // Whoever typed this address has not shown they read it, so the account
      // starts unproved (R104). Until the letter below is redeemed, this
      // password is never trusted as the mailbox owner's: a Google sign-in at
      // this address ends it, and no founder grant lands on this row.
      // ONE EXCEPTION (audit P9): a link that was mailed to this very address
      // and opened by it has already proved the mailbox, so the account starts
      // proved and no second "confirm your address" letter goes out. A link
      // opened with some other address proves nothing about that one, and nor
      // does a link the email did not carry, which the adopter was handed.
      emailVerifiedAt: provesAddress ? new Date().toISOString() : null,
      passwordHash: await deps.hashPassword(password),
      handle: await deps.makeHandle(name),
      paths: chosen.paths ?? [],
      contributions: [],
      quests: [],
      recognitionBalance: 0,
      joinedAt: new Date().toISOString(),
      bio: "",
      avatar: null,
    };
    try {
      await deps.members.add(user);
    } catch (err) {
      if (inviteId) await deps.invites.release(inviteId, userId).catch(() => undefined);
      throw err;
    }
    await deps.joined({ id: userId, name, handle: user.handle });
    // Not awaited: a slow provider must not hold the sign-up, and the letter
    // carries the only copy of the link. It is never put in the response.
    if (user.emailVerifiedAt === null) void deps.sendVerification({ id: userId, email, name }).catch(() => undefined);
    for (const pathId of user.paths) commsSink.fire({ type: "path_joined", personKey: userId, userId, email, name, pathId, source: "signup" });
    if (inviter) await deps.invites.welcome(inviter, userId);
    res.json({ success: true, token: deps.encodeToken(userId, email), user: deps.publicUser(user) });
  });
}

/**
 * The take-over (header): the link is taken for the existing row, then one
 * locked write replaces the unproved password, records the proof and moves
 * tokenVersion, asked again under the lock. The link is given back if the row
 * turned out not to be one to take. `used` when somebody took the link first.
 */
async function takeOverUnproved(
  deps: RegisterDeps,
  a: { inviteId: string; email: string; password: string },
): Promise<{ ok: true; member: any } | { ok: false; reason: "used" | "not_takeable" }> {
  const { byEmail, update } = deps.members;
  const endReachAround = deps.endReachAround;
  if (!byEmail || !update || !endReachAround) return { ok: false, reason: "not_takeable" };
  // A bare account only: never one that proved the address, never an accepted member's.
  const takeable = (u: any): boolean => !!u && !isUnclaimable(u) && sameAddress(u.email, a.email) && !provedItsAddress(u) && !isAdmitted(u, GAME_CONFIG.stages) && u.role !== "admin" && u.role !== "founder";
  const row = await byEmail(a.email);
  if (!takeable(row)) return { ok: false, reason: "not_takeable" };
  if (await (deps.acceptedMember ?? ((r: any) => isAcceptedMember(r)))(row)) return { ok: false, reason: "not_takeable" };
  const userId = String(row.id);
  const inviter = await deps.invites.claim(a.inviteId, userId);
  if (!inviter) return { ok: false, reason: "used" };
  const passwordHash = await deps.hashPassword(a.password);
  let refused = false;
  let saved: any = null;
  try {
    saved = await endReachAround(userId, () =>
      update(userId, (u: any) => {
        if ((refused = !takeable(u))) return;
        u.passwordHash = passwordHash;
        u.emailVerifiedAt = new Date().toISOString();
        u.tokenVersion = (Number(u.tokenVersion) || 0) + 1;
      }),
    );
  } catch (err) {
    await deps.invites.release(a.inviteId, userId).catch(() => undefined);
    throw err;
  }
  if (!saved || refused) {
    await deps.invites.release(a.inviteId, userId).catch(() => undefined);
    return { ok: false, reason: "not_takeable" };
  }
  console.warn(`[register] an invitation mailed to the address took over ${userId}, whose password the address never proved`);
  // The arrival runs for the link this account took: the vouch, and the place the village decided on.
  await deps.invites.welcome(inviter, userId);
  return { ok: true, member: saved };
}
