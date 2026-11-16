/**
 * ANSWERING A REQUEST TO JOIN, OUT LOUD (Rye, sheet A5, 2026-10-31).
 *
 *   POST /api/admin/join-requests/:id/accept    the yes, with the invitation
 *   POST /api/admin/join-requests/:id/decline   a short, kind no
 *
 * Accept on a `membership-request` used to change a label and tell nobody:
 * the person has no account for the bell to reach, so the founder made an
 * invitation link on their profile and emailed it by hand. These two doors
 * answer the person at the address they typed. The words are
 * shared/joinAnswers.ts.
 *
 * ── NEVER A SILENT SUCCESS ──────────────────────────────────────────────────
 *
 * Accept ALWAYS answers the desk with the invitation link and whether an email
 * went, and where. Email not set up yet, an address that is not one, a send
 * the provider refused: the request is still accepted, the link is right
 * there, and the sentence says to send it by hand. The link is the accepting
 * admin's own, the same one `POST /api/invites` would have shown them.
 *
 * ── THE INVITATION IS NAMED AFTER THE REQUEST ───────────────────────────────
 *
 * `joinInviteId(submissionId)`, so a second answer finds the first one's link
 * without a new column:
 *
 *   accepted twice      the link is open: refused, and nothing new is made
 *                       or sent. A request accepted before this door existed
 *                       has no link yet, so accepting it again makes one, and
 *                       a link withdrawn by a no, or run out, is given a new
 *                       token and goes again (`reissueInviteOn`).
 *   declined after a    the link is withdrawn if nobody used it, then the no
 *   yes                 goes out; if they already joined with it, the
 *                       decline is refused, because taking membership back
 *                       is its own act with its own name.
 *   two answers at      the second insert of the same id fails, and the
 *   once                second accept is refused as the first.
 *
 * Each email carries a stable idempotency key, so the post office refuses to
 * send the same answer twice whatever the desk does.
 *
 * ── WHAT IT DOES NOT DO ──────────────────────────────────────────────────────
 *
 *   - It does not admit anybody. The invitation makes an account, and its use
 *     is one arrival vouch from the admin who accepted, as any invitation is.
 *   - It does not count against the admin's own cap of open invitations
 *     (`OPEN_INVITES_CAP`): that cap bounds one member's vouches, and answering
 *     the village's queue is the queue's work. The link still counts in their
 *     open list, so it is theirs to withdraw.
 *   - An address that already has an account here gets no invitation and no
 *     email: they can already sign in. A request sent while signed in names
 *     its account, so it gets no invitation whatever address was typed, and
 *     the bell tells them, as a status move always did.
 *
 * Who may answer is the gate on `intake.moderate`, as `PUT
 * /api/admin/submissions/:id/status` asks it, and the answer needs a member
 * account to make the link from: the admin panel signs in as one.
 */
import type { Express } from "express";
import type { Pool } from "mysql2/promise";

import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import {
  acceptLetter,
  declineLetter,
  greetingName,
  JOIN_ANSWER_WORDS,
  JOIN_REQUEST_TYPE,
  joinInviteId,
  type NotSentWhy,
} from "../../shared/joinAnswers";
import type { AppDeps } from "../lib/appDeps";
import { post } from "../lib/comms/postOffice";
import { dressLetter } from "../lib/comms/villageLetter";
import { isExampleUser } from "../lib/examples";
import { hashInviteToken, INVITE_DAYS, invitePath, mintInviteToken } from "../lib/invites";
import { isTombstone } from "../lib/oauthAccounts";
import { singlePublicAddress } from "../lib/publicAddress";
import { submissionStatusNotice } from "../lib/submissionNotices";
import { whileSessionHolds } from "../lib/sessionHold";
import { createInviteOn, inviteById, reissueInviteOn, revokeInvite } from "../repos/memberInvites";

type Deps = Pick<AppDeps, "authedUser" | "getPool" | "members" | "guardCapability" | "submissionsRepo" | "commsPostOffice" | "deploymentOrigin" | "projectName" | "escapeHtml" | "notify"> & {
  /** The one mail door. A suite hands in a fake to watch what would go out. */
  postEmail?: (email: OutgoingEmail) => Promise<PostResult>;
};

/** A send the provider took, or one already taken under the same key. */
const WENT: ReadonlySet<PostResult["status"]> = new Set<PostResult["status"]>(["sending", "sent", "delivered", "duplicate"]);

/** Why an email did not go, from what the post office answered. */
function whyNotSent(r: PostResult): NotSentWhy {
  if (r.reason === "not_configured" || r.reason === "no_api_key") return "not_set_up";
  if (r.reason === "bad_address") return "bad_address";
  return "failed";
}

/**
 * Make the request's invitation, under the admin's row lock while their session
 * holds. A link that was withdrawn (a no after a yes) or ran out is given a new
 * token and goes again; one still open, or one somebody used, is left alone.
 */
async function makeJoinInvite(pool: Pool, submissionId: string, inviterUserId: string, sessionVersion: number) {
  const token = mintInviteToken();
  const input = { id: joinInviteId(submissionId), tokenHash: hashInviteToken(token), inviterUserId, days: INVITE_DAYS };
  const held = await whileSessionHolds(pool, inviterUserId, sessionVersion, async (conn) => {
    try {
      await createInviteOn(conn, input);
      return "made" as const;
    } catch (e: any) {
      if (e?.code !== "ER_DUP_ENTRY") throw e;
    }
    return (await reissueInviteOn(conn, input)) ? ("made" as const) : ("exists" as const);
  });
  if (!held.ok) return { ok: false as const };
  return { ok: true as const, made: held.value === "made", token, tokenHash: input.tokenHash };
}

/** A request found and read, ready to answer. */
export interface JoinRequestFound {
  id: string;
  row: any;
  account: string | null;
  address: string | null;
  typed: string;
  firstName: string | null;
}

/** An answer to the desk or the member: the status and the body to send. */
export interface JoinAnswer {
  status: number;
  body: Record<string, unknown>;
}

export type JoinAnswerDeps = Omit<Deps, "authedUser" | "guardCapability">;

/**
 * THE TWO ANSWERS, for whoever may give them. The admin routes below ask the
 * gate on `intake.moderate`; a member answering a request made at their own
 * door code (server/routes/rites.ts) asks `member.vouch` and that the request
 * names them. Both answer through these, so a yes is the same yes and a no the
 * same no, whoever gave it. The invitation is always the answerer's own.
 */
export function joinAnswerDoor(deps: JoinAnswerDeps) {
  const { getPool, members, submissionsRepo, deploymentOrigin, projectName, notify } = deps;
  const postEmail = deps.postEmail ?? ((email: OutgoingEmail) => post(deps.commsPostOffice, email));

  /** The request by id, or the refusal to send. */
  function find(id: string): { ok: true; found: JoinRequestFound } | { ok: false; answer: JoinAnswer } {
    const row = submissionsRepo.all().find((s: any) => String(s.id) === id);
    if (!row) return { ok: false, answer: { status: 404, body: { error: JOIN_ANSWER_WORDS.notFound } } };
    if (String(row.type ?? "") !== JOIN_REQUEST_TYPE) return { ok: false, answer: { status: 400, body: { error: JOIN_ANSWER_WORDS.notARequest } } };
    const data = (row.data ?? {}) as Record<string, unknown>;
    return { ok: true, found: { id, row, account: row.userId ? String(row.userId) : null, address: singlePublicAddress(data.email), typed: String(data.email ?? "").trim(), firstName: greetingName(data.name) } };
  }

  /** Move the request to `status`, through the one inbox (`submissionsRepo`), the whole list handed back. */
  async function setStatus(id: string, status: "accepted" | "declined") {
    const all = submissionsRepo.all();
    const i = all.findIndex((s: any) => String(s.id) === id);
    if (i === -1 || all[i].status === status) return;
    all[i] = { ...all[i], status };
    await submissionsRepo.replaceAll(all);
  }

  /**
   * The bell, for a request sent while signed in: it names the account, so the
   * person is told the way `PUT /api/admin/submissions/:id/status` told them,
   * under the same key, so a later status move never tells them twice.
   */
  async function ring(row: any, status: "accepted" | "declined") {
    const notice = submissionStatusNotice(String(row.type ?? ""), status, row.data);
    if (!row.userId || !notice) return false;
    await notify({ userId: String(row.userId), type: "submission_status", title: notice.headline, body: notice.line, link: "/profile", dedupeKey: `submission:${String(row.id)}:${status}` });
    return true;
  }

  /** An address that already has an account here: a real, present person. */
  async function isMember(address: string | null): Promise<boolean> {
    if (!address) return false;
    const m: any = await members.byEmail(address);
    return !!m && !isExampleUser(m) && !isTombstone({ email: String(m.email ?? "") });
  }

  /**
   * The letter as an essential email: the person asked for this answer. In the
   * village's letter frame (server/lib/comms/villageLetter.ts); the no carries
   * the come-and-play block, the open ways in for somebody with no account.
   */
  async function letter(key: string, answer: "accepted" | "declined", to: { email: string; name: string | null }, words: { subject: string; text: string }): Promise<OutgoingEmail> {
    const dressed = await dressLetter(getPool(), deploymentOrigin(), words, { comeAndPlay: answer === "declined" ? "public" : false, villageName: projectName() });
    return {
      idempotencyKey: key,
      kind: "essential",
      origin: `joining.${answer}`,
      to: { email: to.email, ...(to.name ? { name: to.name } : {}) },
      subject: words.subject,
      html: dressed.html,
      text: dressed.text,
      preheader: dressed.preheader,
    };
  }

  async function accept(user: any, got: JoinRequestFound): Promise<JoinAnswer> {
    const { id, row, account, address, typed, firstName } = got;
    const pool = getPool();

    // Sent while signed in: they have an account already, whatever address they typed. The bell tells them.
    if (account) {
      await setStatus(id, "accepted");
      await ring(row, "accepted");
      return { status: 200, body: { success: true, alreadyMember: true, emailed: false, emailedTo: null, link: null, message: JOIN_ANSWER_WORDS.acceptedAccount } };
    }
    if (await isMember(address)) {
      await setStatus(id, "accepted");
      return { status: 200, body: { success: true, alreadyMember: true, emailed: false, emailedTo: null, link: null, message: JOIN_ANSWER_WORDS.alreadyMember } };
    }

    const made = await makeJoinInvite(pool, id, String(user.id), Number(user.tokenVersion ?? 0));
    if (!made.ok) return { status: 401, body: { error: "auth_required" } };
    if (!made.made) {
      const used = !!(await inviteById(pool, joinInviteId(id)))?.usedByUserId;
      return { status: 409, body: { error: used ? JOIN_ANSWER_WORDS.alreadyJoined : JOIN_ANSWER_WORDS.alreadyAccepted } };
    }
    await setStatus(id, "accepted");

    const link = `${deploymentOrigin().replace(/\/+$/, "")}${invitePath(made.token)}`;
    let why: NotSentWhy | null = null;
    if (!address) why = typed ? "bad_address" : "no_address";
    else {
      // Keyed by the link, so a link given again after a no goes out again, and one link never goes twice.
      const key = `join-answer:${id}:accepted:${made.tokenHash.slice(0, 16)}`;
      const sent = await postEmail(await letter(key, "accepted", { email: address, name: firstName }, acceptLetter({ firstName, village: projectName(), link, days: INVITE_DAYS })));
      if (!WENT.has(sent.status)) why = whyNotSent(sent);
    }
    return {
      status: 200,
      body: {
        success: true,
        alreadyMember: false,
        emailed: why === null,
        emailedTo: why === null ? address : null,
        link,
        message: why === null ? JOIN_ANSWER_WORDS.acceptedEmailed(address as string, INVITE_DAYS) : JOIN_ANSWER_WORDS.acceptedNotEmailed(why),
      },
    };
  }

  async function decline(got: JoinRequestFound): Promise<JoinAnswer> {
    const { id, row, account, address, typed, firstName } = got;
    const pool = getPool();
    if (row.status === "declined") return { status: 200, body: { success: true, emailed: false, emailedTo: null, withdrawn: false, message: JOIN_ANSWER_WORDS.alreadyDeclined } };

    // A yes that came first: its link is withdrawn, unless it already made an account. The withdraw
    // matches only an unused row, so a link used at any moment before it is read back as used.
    const invite = await inviteById(pool, joinInviteId(id));
    const withdrawn = invite ? await revokeInvite(pool, invite.id, invite.inviterUserId) : false;
    if (invite && !withdrawn && (await inviteById(pool, invite.id))?.usedByUserId) return { status: 409, body: { error: JOIN_ANSWER_WORDS.alreadyJoined } };
    await setStatus(id, "declined");
    // Sent while signed in: the bell tells them too, as a status move always did.
    if (account) await ring(row, "declined");

    let why: NotSentWhy | null = null;
    if (!address) why = typed ? "bad_address" : "no_address";
    else {
      const sent = await postEmail(await letter(`join-answer:${id}:declined`, "declined", { email: address, name: firstName }, declineLetter({ firstName, village: projectName() })));
      if (!WENT.has(sent.status)) why = whyNotSent(sent);
    }
    const said = why === null ? JOIN_ANSWER_WORDS.declinedEmailed(address as string) : JOIN_ANSWER_WORDS.declinedNotEmailed(why);
    return {
      status: 200,
      body: {
        success: true,
        emailed: why === null,
        emailedTo: why === null ? address : null,
        withdrawn,
        message: withdrawn ? `${said} ${JOIN_ANSWER_WORDS.linkWithdrawn}` : said,
      },
    };
  }

  return { find, accept, decline };
}

export function register(app: Express, deps: Deps): void {
  const { authedUser, guardCapability } = deps;
  const door = joinAnswerDoor(deps);

  /** The request and the admin answering it, or null after answering the desk. */
  async function answering(req: any, res: any) {
    if (!(await guardCapability(req, res, "intake.moderate"))) return null;
    const user = await authedUser(req);
    if (!user) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    const got = door.find(String(req.params.id ?? ""));
    if (!got.ok) {
      res.status(got.answer.status).json(got.answer.body);
      return null;
    }
    return { user, found: got.found };
  }

  app.post("/api/admin/join-requests/:id/accept", async (req, res) => {
    const got = await answering(req, res);
    if (!got) return;
    const answer = await door.accept(got.user, got.found);
    res.status(answer.status).json(answer.body);
  });

  app.post("/api/admin/join-requests/:id/decline", async (req, res) => {
    const got = await answering(req, res);
    if (!got) return;
    const answer = await door.decline(got.found);
    res.status(answer.status).json(answer.body);
  });
}
