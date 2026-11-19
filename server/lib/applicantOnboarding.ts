/**
 * TAKING AN APPLICANT TO A DECISION: shortlist, references, follow-up owners,
 * the final conversation and the gathered view. The rules are
 * shared/applicantOnboarding.ts, the SQL server/repos/applicantOnboarding.ts
 * and the doors server/routes/applicantOnboarding.ts.
 *
 * Everything here builds on the review pipeline (server/lib/applicationReview.ts):
 * the steps are `application_steps`, the final conversation is an
 * `application_interviews` row, the scorecards are read through `scorecardsFor`
 * and its rule, the letter goes through `tellApplicant`, and the decision is
 * the existing adopt or decline. NOTHING HERE ADOPTS, DECLINES OR SEATS.
 *
 * ── NO AI IN SELECTION ──────────────────────────────────────────────────────
 *
 * Nothing in this file calls a model, and no tool the guide or a companion
 * holds reads these tables (server/lib/applicationReview.refusal.test.ts).
 */
import type { Pool, PoolConnection } from "mysql2/promise";
import {
  FINAL_CALL_ROLE_VARIABLE,
  FOLLOWUP_NOTE_MAX,
  FOLLOWUP_ROLE_VARIABLE,
  mayAssignOwners,
  mayReadReference,
  ONBOARDING_NOTICES,
  ONBOARDING_WORDS,
  parseReferenceList,
  parseShortlistAnswer,
  shortlistOf,
  trackOf,
  type ReferenceError,
  type ShortlistAnswer,
  type Track,
} from "../../shared/applicantOnboarding";
import { kindOfRef, reviewStageOf } from "../../shared/applicationReview";
import * as review from "../repos/applicationReview";
import * as repo from "../repos/applicantOnboarding";
import * as proposals from "../repos/openProposals";
import { asksFor } from "../repos/roleProposals";
import { inTransaction } from "../repos/liveSessions";
import { finalCallHolders, isApplicant, scorecardHref, scorecardsFor, tellInterviewers, type ReviewDeps, type ScorecardView } from "./applicationReview";
import { stringVar } from "./variables";

type Db = Pool | PoolConnection;

const ADOPTING_POWER = "org.seat";

export type Refusal = { ok: false; status: number; error: string; code: string };

const refuse = (status: number, code: string, error: string): Refusal => ({ ok: false, status, error, code });

// ── Who the viewer is to this application ───────────────────────────────────

export interface Standing {
  isApplicant: boolean;
  recused: boolean;
  /** A live holder of the power to place people in roles, or a circle holder asked to consent. Never the applicant. */
  isReviewer: boolean;
  /** A live holder of the power to place people in roles: the one who answers the shortlist and asks for references. */
  holdsPower: boolean;
  /** Holds the role the village names for the final call. */
  isFinalCall: boolean;
  /** The roles the viewer holds now, to tell which references they own. */
  roles: Set<string>;
}

export async function standingOf(deps: ReviewDeps, ref: string, viewerId: string): Promise<Standing> {
  const pool = deps.getPool();
  const own = await isApplicant(deps, ref, viewerId);
  const recused = (await review.recusedUsers(pool, ref)).includes(viewerId);
  const holdsPower = !own && (await deps.liveHoldersOf(ADOPTING_POWER)).includes(viewerId);
  const asked = kindOfRef(ref) === "open" ? ((await asksFor(pool, [ref])).get(ref) ?? []).some((a) => a.userId === viewerId) : false;
  const isFinalCall = !own && (await finalCallHolders(pool)).includes(viewerId);
  return { isApplicant: own, recused, isReviewer: !own && (holdsPower || asked), holdsPower, isFinalCall, roles: new Set(await review.rolesHeldBy(pool, viewerId)) };
}

const ownsReference = (s: Standing, r: repo.StoredReference, viewerId: string): boolean => (r.ownerUserId ? r.ownerUserId === viewerId : !!r.ownerRoleId && s.roles.has(r.ownerRoleId));

async function openAndConfirmed(db: Db, ref: string): Promise<Refusal | null> {
  const steps = await review.stepsOf(db, ref);
  if (!steps.some((s) => s.kind === "confirmed")) return refuse(404, "not_found", ONBOARDING_WORDS.notFound);
  if (steps.some((s) => s.kind === "decided")) return refuse(409, "decided", ONBOARDING_WORDS.decided);
  return null;
}

async function roleNamesOfApplication(db: Db, ref: string): Promise<string[]> {
  const confirmed = (await review.stepsOf(db, ref)).find((s) => s.kind === "confirmed");
  const ids: string[] = Array.isArray(confirmed?.detail?.roleIds) ? confirmed!.detail.roleIds.map(String) : [];
  const names = await review.roleNamesById(db, ids);
  return ids.map((id) => names.get(id) ?? id);
}

// ── The shortlist ───────────────────────────────────────────────────────────

/**
 * SHORTLIST, OR NOT. One `shortlist` step answers it (the unique key admits one
 * answer). A "no" records the answer and nothing more: the decline and its
 * letter stay with the people who decide, through the existing door. While our
 * review still waits, the review comes first.
 */
export async function answerShortlist(deps: ReviewDeps, ref: string, viewerId: string, raw: unknown): Promise<{ ok: true; answer: ShortlistAnswer } | Refusal> {
  const pool = deps.getPool();
  const answer = parseShortlistAnswer(raw);
  if (!answer) return refuse(400, "answer", "Say yes or no.");
  const closed = await openAndConfirmed(pool, ref);
  if (closed) return closed;
  const s = await standingOf(deps, ref, viewerId);
  if (s.isApplicant || s.recused || !s.holdsPower) return refuse(403, "not_allowed", ONBOARDING_WORDS.notAllowed);
  const steps = await review.stepsOf(pool, ref);
  if (reviewStageOf(steps) === "review") return refuse(409, "review_first", ONBOARDING_WORDS.shortlistWaitsReview);
  if (reviewStageOf(steps) === "not_invited") return refuse(409, "decided", ONBOARDING_WORDS.decided);
  if (!(await review.stampStep(pool, { ref, kind: "shortlist", at: deps.now(), actorUserId: viewerId, detail: { answer } }))) return refuse(409, "done", ONBOARDING_WORDS.shortlistDone);
  return { ok: true, answer };
}

// ── Asking for references ───────────────────────────────────────────────────

/**
 * ASK THE APPLICANT FOR REFERENCES. Only on a shortlisted open proposal (the
 * applicant answers from the status page their emailed link opens). Stamped
 * once; the letter goes once, in the applicant's language, through the
 * existing update door (`tellApplicant`, kind `references`), under a stable key.
 */
export async function askForReferences(deps: ReviewDeps, ref: string, viewerId: string): Promise<{ ok: true } | Refusal> {
  const pool = deps.getPool();
  if (kindOfRef(ref) !== "open") return refuse(409, "open_only", "References are asked from the applicant's status page, which an open proposal has.");
  const closed = await openAndConfirmed(pool, ref);
  if (closed) return closed;
  const s = await standingOf(deps, ref, viewerId);
  if (s.isApplicant || s.recused || !s.holdsPower) return refuse(403, "not_allowed", ONBOARDING_WORDS.notAllowed);
  if (shortlistOf(await review.stepsOf(pool, ref)) !== "yes") return refuse(409, "shortlist_first", ONBOARDING_WORDS.referencesNeedShortlist);
  if (!(await review.stampStep(pool, { ref, kind: "refs_asked", at: deps.now(), actorUserId: viewerId }))) return refuse(409, "done", ONBOARDING_WORDS.referencesAskedAlready);
  await deps.tellApplicant?.(ref, "references");
  return { ok: true };
}

// ── The applicant gives them ────────────────────────────────────────────────

export type GiveOutcome = { ok: true; given: number } | { ok: false; status: number; error: ReferenceError | "not_asked" | "given" | "decided"; row: number | null };

/**
 * THE APPLICANT'S LIST, from their status page. Only once references were asked
 * for, only once, and only while the application is open. Each reference is
 * given first to the village's follow-up role (`org.reference_followup_role`).
 * The reviewers and the follow-up role's holders hear the list arrived; no
 * name, contact or note rides on the notice.
 */
export async function giveReferences(deps: ReviewDeps, ref: string, raw: unknown): Promise<GiveOutcome> {
  const pool = deps.getPool();
  const steps = await review.stepsOf(pool, ref);
  if (!steps.some((s) => s.kind === "refs_asked")) return { ok: false, status: 409, error: "not_asked", row: null };
  if (steps.some((s) => s.kind === "decided")) return { ok: false, status: 409, error: "decided", row: null };
  if (steps.some((s) => s.kind === "refs_given")) return { ok: false, status: 409, error: "given", row: null };
  const parsed = parseReferenceList(raw);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error, row: parsed.row };
  const at = deps.now();
  const ownerRole = stringVar(FOLLOWUP_ROLE_VARIABLE).trim();
  const won = await inTransaction(pool, async (conn) => {
    // The step is the lock: of two sends at once exactly one stamps it, and only that one writes rows.
    if (!(await review.stampStep(conn, { ref, kind: "refs_given", at, detail: { count: parsed.value.length } }))) return false;
    await repo.insertReferences(conn, ref, parsed.value, ownerRole, at);
    return true;
  });
  if (!won) return { ok: false, status: 409, error: "given", row: null };
  await tellTeamReferencesIn(deps, ref, ownerRole);
  return { ok: true, given: parsed.value.length };
}

async function tellTeamReferencesIn(deps: ReviewDeps, ref: string, ownerRole: string): Promise<void> {
  const pool = deps.getPool();
  const names = await roleNamesOfApplication(pool, ref);
  const recused = new Set(await review.recusedUsers(pool, ref));
  const told = new Set<string>();
  const people = [...(await deps.liveHoldersOf(ADOPTING_POWER)), ...(await finalCallHolders(pool)), ...(ownerRole ? await review.liveHoldersOfRole(pool, ownerRole) : [])];
  for (const userId of people) {
    if (told.has(userId) || recused.has(userId) || (await isApplicant(deps, ref, userId))) continue;
    told.add(userId);
    await deps.notify({ userId, type: "application_references_in", title: ONBOARDING_NOTICES.referencesIn(names), link: walkthroughHref(ref), actorUserId: null, dedupeKey: `app:${ref}:refs-in:${userId}` });
  }
  if (!told.size) await deps.notifyAdmins("governance", ONBOARDING_NOTICES.referencesIn(names), `app:${ref}:refs-in`, walkthroughHref(ref));
}

/** The page the team walks an application through: the application's own page, at the walkthrough. */
export const walkthroughHref = (ref: string): string => scorecardHref(ref).replace(/#scorecards$/, "#walkthrough");

// ── Follow-up owners ────────────────────────────────────────────────────────

/**
 * GIVE A REFERENCE TO WHOEVER IS MOST ALIGNED with that person: a role (by id)
 * or a member (by id, who must hold a live role, so the owner is always
 * somebody in the village's structure). The reviewers and the final-call role
 * pick. The new owner hears it once per reference.
 */
export async function assignOwner(deps: ReviewDeps, ref: string, viewerId: string, referenceId: number, body: unknown): Promise<{ ok: true } | Refusal> {
  const pool = deps.getPool();
  const closed = await openAndConfirmed(pool, ref);
  if (closed) return closed;
  const s = await standingOf(deps, ref, viewerId);
  if (!mayAssignOwners(s)) return refuse(403, "not_allowed", ONBOARDING_WORDS.notAllowed);
  const r = await repo.referenceById(pool, ref, referenceId);
  if (!r) return refuse(404, "not_found", ONBOARDING_WORDS.notFound);
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const roleId = typeof o.roleId === "string" ? o.roleId.trim().slice(0, 64) : "";
  const userId = typeof o.userId === "string" ? o.userId.trim().slice(0, 64) : "";
  if (!roleId && !userId) return refuse(400, "owner", "Pick a role or a member.");
  if (roleId && !(await review.roleNamesById(pool, [roleId])).has(roleId)) return refuse(400, "owner", "That role is not on the org chart.");
  if (userId) {
    if ((await review.rolesHeldBy(pool, userId)).length === 0) return refuse(400, "owner", "Pick a member who holds a role now.");
    if (await isApplicant(deps, ref, userId)) return refuse(400, "owner", "The applicant cannot follow up with their own references.");
    if ((await review.recusedUsers(pool, ref)).includes(userId)) return refuse(400, "owner", "That member stepped out of this application.");
  }
  await repo.setOwner(pool, ref, referenceId, { roleId: roleId || r.ownerRoleId, userId: userId || null });
  const names = await roleNamesOfApplication(pool, ref);
  const recipients = userId ? [userId] : (await review.liveHoldersOfRole(pool, roleId)).filter((u) => u !== viewerId);
  for (const u of recipients) {
    await deps.notify({ userId: u, type: "application_reference_owner", title: ONBOARDING_NOTICES.ownerTitle(names), body: ONBOARDING_NOTICES.ownerBody, link: walkthroughHref(ref), actorUserId: null, dedupeKey: `app:${ref}:ref:${referenceId}:owner:${u}` });
  }
  return { ok: true };
}

/** THE OWNER'S NOTES, and whether the follow-up is done. Only the reference's own owner writes them. */
export async function saveFollowUp(deps: ReviewDeps, ref: string, viewerId: string, referenceId: number, body: unknown): Promise<{ ok: true } | Refusal> {
  const pool = deps.getPool();
  const closed = await openAndConfirmed(pool, ref);
  if (closed) return closed;
  const s = await standingOf(deps, ref, viewerId);
  const r = await repo.referenceById(pool, ref, referenceId);
  if (!r) return refuse(404, "not_found", ONBOARDING_WORDS.notFound);
  if (s.isApplicant || s.recused || !ownsReference(s, r, viewerId)) return refuse(403, "not_owner", ONBOARDING_WORDS.notYours);
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const notes = typeof o.notes === "string" ? o.notes.trim() : "";
  if (notes.length > FOLLOWUP_NOTE_MAX) return refuse(400, "notes", `Keep the notes to ${FOLLOWUP_NOTE_MAX} characters.`);
  await repo.saveNotes(pool, ref, referenceId, { notes, by: viewerId, followedUp: o.followedUp === true, at: deps.now() });
  return { ok: true };
}

// ── The final conversation ──────────────────────────────────────────────────

/**
 * ADD THE FINAL CONVERSATION: one more conversation in the existing model, held
 * by the role the village names for the final call, marked final, after every
 * other. It opens at once when the others are written up, and its holders hear
 * it waits on them; otherwise it opens in order. Nothing is added when the
 * application already has a final conversation (the role's own list may name
 * one), or when no role is named.
 */
export async function addFinalConversation(deps: ReviewDeps, ref: string, viewerId: string): Promise<{ ok: true; opened: boolean } | Refusal> {
  const pool = deps.getPool();
  const closed = await openAndConfirmed(pool, ref);
  if (closed) return closed;
  const s = await standingOf(deps, ref, viewerId);
  if (s.isApplicant || s.recused || !(s.holdsPower || s.isFinalCall)) return refuse(403, "not_allowed", ONBOARDING_WORDS.notAllowed);
  const steps = await review.stepsOf(pool, ref);
  if (shortlistOf(steps) !== "yes") return refuse(409, "shortlist_first", ONBOARDING_WORDS.referencesNeedShortlist);
  const roleId = stringVar(FINAL_CALL_ROLE_VARIABLE).trim();
  if (!roleId) return refuse(409, "no_role", ONBOARDING_WORDS.finalNoRole);
  const at = deps.now();
  const minutes = 30;
  let opened: { position: number } | null = null;
  const out = await inTransaction(pool, async (conn): Promise<Refusal | null> => {
    const list = await review.interviewsOf(conn, ref, true);
    if (list.some((i) => i.final)) return refuse(409, "exists", ONBOARDING_WORDS.finalExists);
    const position = list.reduce((m, i) => Math.max(m, i.position), 0) + 1;
    const othersDone = list.every((i) => i.state === "scored" || i.state === "skipped");
    // Our review still waiting means nothing opens before the invitation; the conversation waits like every other.
    const open = othersDone && reviewStageOf(steps) !== "review";
    await review.insertInterviewAt(conn, ref, { position, roleId, minutes, final: true }, open ? at : null);
    if (open) opened = { position };
    return null;
  });
  if (out) return out;
  const o = opened as { position: number } | null;
  if (o) {
    const name = kindOfRef(ref) === "open" ? ((await proposals.readOpenProposal(pool, ref))?.name ?? null) : null;
    await tellInterviewers(deps, ref, o.position, roleId, minutes, name ? (name.trim().split(/\s+/)[0] ?? null) : null);
  }
  return { ok: true, opened: !!o };
}

// ── The walkthrough ─────────────────────────────────────────────────────────

export interface ServedReference {
  id: number;
  position: number;
  name: string;
  contact: string;
  how: string;
  ally: string;
  owner: { roleId: string; roleName: string | null; userId: string | null; userName: string | null; isDefault: boolean };
  notes: string | null;
  notesOn: string | null;
  followedUp: boolean;
  /** The viewer is this reference's owner and may write its notes. */
  mine: boolean;
}

export interface Walkthrough {
  track: Track;
  shortlist: ShortlistAnswer | null;
  references: {
    asked: boolean;
    given: boolean;
    /** Only the references the viewer may read: all of them for a reviewer or the final-call role, their own for an owner. */
    list: ServedReference[];
    /** How many there are in all, so an owner reading their own sees the rest exist. */
    total: number;
    mayAssign: boolean;
  };
  /** The roles a reference can be given to, by name. Shown only to those who may assign. */
  roles: Array<{ id: string; name: string }>;
  /** Members holding a live role, by name, to give a reference to. Shown only to those who may assign. */
  members: Array<{ id: string; name: string }>;
  /** The scorecards, read through the review's own rule (`scorecardsFor`). */
  scorecards: ScorecardView | null;
  roleNames: { followup: string | null; finalCall: string | null };
  you: { mayShortlist: boolean; mayAskReferences: boolean; mayAddFinal: boolean; isFinalCall: boolean; holdsPower: boolean };
}

/**
 * WHAT ONE VIEWER READS OF THE WALKTHROUGH. Null for anybody who neither
 * reviews this application, holds the final call, owns a reference nor
 * interviews on it: they get the same 404 as a stranger. The applicant always
 * gets null.
 */
export async function walkthroughFor(deps: ReviewDeps, ref: string, viewerId: string): Promise<Walkthrough | null> {
  const pool = deps.getPool();
  const steps = await review.stepsOf(pool, ref);
  if (!steps.some((s) => s.kind === "confirmed")) return null;
  const s = await standingOf(deps, ref, viewerId);
  if (s.isApplicant) return null;
  const stored = await repo.referencesOf(pool, ref);
  const owned = stored.filter((r) => ownsReference(s, r, viewerId));
  const interviews = await review.interviewsOf(pool, ref);
  const interviewer = interviews.some((i) => s.roles.has(i.roleId));
  if (!s.isReviewer && !s.isFinalCall && !owned.length && !interviewer) return null;

  const decidedStep = steps.find((x) => x.kind === "decided");
  const how = decidedStep?.detail?.how;
  const followRole = stringVar(FOLLOWUP_ROLE_VARIABLE).trim();
  const finalRole = stringVar(FINAL_CALL_ROLE_VARIABLE).trim();
  const welcomeRole = stringVar("org.onboarding_role").trim();
  const names = await review.roleNamesById(pool, [followRole, finalRole, welcomeRole, ...stored.map((r) => r.ownerRoleId)].filter(Boolean));
  const shortlist = shortlistOf(steps);
  const track = trackOf(
    {
      decided: how === "adopted" || how === "declined" || how === "withdrawn" ? how : decidedStep ? "declined" : null,
      reviewStage: reviewStageOf(steps),
      firstReplied: steps.some((x) => x.kind === "first_reply"),
      shortlist,
      refsAsked: steps.some((x) => x.kind === "refs_asked"),
      refsGiven: steps.some((x) => x.kind === "refs_given"),
      references: stored.map((r) => ({ followedUp: !!r.followedUpAt })),
      interviews: interviews.map((i) => ({ state: i.state, final: i.final })),
    },
    { welcome: welcomeRole ? (names.get(welcomeRole) ?? null) : null, followup: followRole ? (names.get(followRole) ?? null) : null, finalCall: finalRole ? (names.get(finalRole) ?? null) : null },
  );

  const readsAll = mayReadReference({ isApplicant: false, recused: s.recused, isReviewer: s.isReviewer, isFinalCall: s.isFinalCall, isOwner: false });
  const visible = s.recused ? [] : readsAll ? stored : owned;
  const ownerIds = visible.map((r) => r.ownerUserId).filter((u): u is string => !!u);
  const ownerNames = new Map<string, string>();
  for (const u of ownerIds) {
    const m: any = await deps.members.byId(u);
    ownerNames.set(u, String(m?.name ?? "").trim().split(/\s+/)[0] || "A member");
  }
  const mayAssign = mayAssignOwners(s) && !decidedStep;
  const list: ServedReference[] = visible.map((r) => ({
    id: r.id,
    position: r.position,
    name: r.name,
    contact: r.contact,
    how: r.how,
    ally: r.ally,
    owner: { roleId: r.ownerRoleId, roleName: r.ownerRoleId ? (names.get(r.ownerRoleId) ?? null) : null, userId: r.ownerUserId, userName: r.ownerUserId ? (ownerNames.get(r.ownerUserId) ?? null) : null, isDefault: !r.ownerUserId && !!followRole && r.ownerRoleId === followRole },
    notes: r.notes,
    notesOn: r.notesAt ? r.notesAt.toISOString().slice(0, 10) : null,
    followedUp: !!r.followedUpAt,
    mine: !s.recused && ownsReference(s, r, viewerId),
  }));
  const open = !decidedStep;
  return {
    track,
    shortlist,
    references: { asked: steps.some((x) => x.kind === "refs_asked"), given: steps.some((x) => x.kind === "refs_given"), list, total: stored.length, mayAssign },
    roles: mayAssign ? await review.activeRoles(pool) : [],
    members: mayAssign ? await review.membersHoldingRoles(pool) : [],
    scorecards: await scorecardsFor(deps, ref, viewerId),
    roleNames: { followup: followRole ? (names.get(followRole) ?? null) : null, finalCall: finalRole ? (names.get(finalRole) ?? null) : null },
    you: {
      mayShortlist: open && s.holdsPower && !s.recused && shortlist === null && reviewStageOf(steps) !== "review" && reviewStageOf(steps) !== "not_invited",
      mayAskReferences: open && s.holdsPower && !s.recused && shortlist === "yes" && kindOfRef(ref) === "open" && !steps.some((x) => x.kind === "refs_asked"),
      mayAddFinal: open && (s.holdsPower || s.isFinalCall) && !s.recused && shortlist === "yes" && !!finalRole && !interviews.some((i) => i.final),
      isFinalCall: s.isFinalCall,
      holdsPower: s.holdsPower,
    },
  };
}

// ── The stage of every open application, for the admin list ─────────────────

/** Each application's stage and who acts next, by role. No name, contact, note or score: the desk already shows the applicant. */
export async function stagesOf(deps: Pick<ReviewDeps, "getPool">, refs: readonly string[]): Promise<Map<string, Pick<Track, "now" | "who" | "next">>> {
  const pool = deps.getPool();
  const out = new Map<string, Pick<Track, "now" | "who" | "next">>();
  const follow = await repo.followUpsOf(pool, refs);
  const followRole = stringVar(FOLLOWUP_ROLE_VARIABLE).trim();
  const finalRole = stringVar(FINAL_CALL_ROLE_VARIABLE).trim();
  const welcomeRole = stringVar("org.onboarding_role").trim();
  const names = await review.roleNamesById(pool, [followRole, finalRole, welcomeRole].filter(Boolean));
  const roles = { welcome: welcomeRole ? (names.get(welcomeRole) ?? null) : null, followup: followRole ? (names.get(followRole) ?? null) : null, finalCall: finalRole ? (names.get(finalRole) ?? null) : null };
  for (const ref of refs) {
    const steps = await review.stepsOf(pool, ref);
    if (!steps.some((s) => s.kind === "confirmed")) continue;
    const decidedStep = steps.find((x) => x.kind === "decided");
    const how = decidedStep?.detail?.how;
    const t = trackOf(
      {
        decided: how === "adopted" || how === "declined" || how === "withdrawn" ? how : decidedStep ? "declined" : null,
        reviewStage: reviewStageOf(steps),
        firstReplied: steps.some((x) => x.kind === "first_reply"),
        shortlist: shortlistOf(steps),
        refsAsked: steps.some((x) => x.kind === "refs_asked"),
        refsGiven: steps.some((x) => x.kind === "refs_given"),
        references: follow.get(ref) ?? [],
        interviews: (await review.interviewsOf(pool, ref)).map((i) => ({ state: i.state, final: i.final })),
      },
      roles,
    );
    out.set(ref, { now: t.now, who: t.who, next: t.next });
  }
  return out;
}
