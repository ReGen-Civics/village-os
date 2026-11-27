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
  asksReferences,
  FINAL_CALL_ROLE_VARIABLE,
  FOLLOWUP_NOTE_MAX,
  FOLLOWUP_ROLE_VARIABLE,
  mayAssignOwners,
  mayReadReference,
  memberTrackOf,
  ONBOARDING_NOTICES,
  ONBOARDING_WORDS,
  parseReferenceList,
  parseShortlistAnswer,
  shortlistOf,
  trackOf,
  trackStates,
  readyForFinalOf,
  TRACK,
  type ReferenceError,
  type ShortlistAnswer,
  type Track,
  type TrackFacts,
  type TrackStage,
  type TrackState,
} from "../../shared/applicantOnboarding";
import { finalFreezes, mayRefine, PROPOSAL_VERSIONS_MAX, readRefined, readVersions, REFINE_ERRORS, type ProposalVersion, type RefineView } from "../../shared/proposalRefine";
import { kindOfRef, parseCriteria, reviewStageOf } from "../../shared/applicationReview";
import * as review from "../repos/applicationReview";
import * as repo from "../repos/applicantOnboarding";
import * as notesRepo from "../repos/applicationConversationNotes";
import {
  CONVERSATION_NOTE_KINDS,
  mayReadConversationNotes,
  mayRemoveNote,
  NOTES_NOTICES,
  NOTES_WORDS,
  readNoteBody,
  type ConversationNoteKind,
  type ConversationNotesView,
  type ServedNote,
} from "../../shared/conversationNotes";
import * as guideRepo from "../repos/applicationGuide";
import { guideItems, mayUseGuide, readGuideNote, GUIDE_WORDS, type GuideItem, type GuideView } from "../../shared/conversationGuide";
import { sectionsForMany } from "./roleCardSections";
import * as proposals from "../repos/openProposals";
import { asksFor } from "../repos/roleProposals";
import { inTransaction } from "../repos/liveSessions";
import { readApplication as readSeatApplication } from "../repos/seatApplications";
import { applicationHref } from "../../shared/seatApplications";
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

// ── A member's own application ──────────────────────────────────────────────

/** A member application as this stage reads it: who applied, whether it is still open, whether it is their first long-term role. */
export interface MemberApplicationFacts {
  candidateUserId: string;
  open: boolean;
  decided: "adopted" | "declined" | "withdrawn" | null;
  /** The candidate holds no live role seat now (shared/applicantOnboarding.ts `asksReferences`). */
  firstRole: boolean;
  roleIds: string[];
}

/** The facts of a member application (`sa-` ref), or null for an open proposal or an application that is not there. */
export async function memberApplicationFacts(db: Db, ref: string): Promise<MemberApplicationFacts | null> {
  if (kindOfRef(ref) !== "member") return null;
  const a = await readSeatApplication(db, ref);
  if (!a) return null;
  const open = a.status === "awaiting-holder" || a.status === "voting";
  const decided = open ? null : a.status === "adopted" ? "adopted" : a.status === "withdrawn" ? "withdrawn" : "declined";
  return { candidateUserId: a.candidateUserId, open, decided, firstRole: asksReferences("member", (await review.rolesHeldBy(db, a.candidateUserId)).length), roleIds: a.seatIds };
}

/** A member application outside the review: it has references here and nothing else (no shortlist, no final conversation). */
async function referencesOnly(db: Db, ref: string): Promise<boolean> {
  return kindOfRef(ref) === "member" && !(await review.stepsOf(db, ref)).some((s) => s.kind === "confirmed");
}

async function openAndConfirmed(db: Db, ref: string): Promise<Refusal | null> {
  const steps = await review.stepsOf(db, ref);
  if (kindOfRef(ref) === "member" && !steps.some((s) => s.kind === "confirmed")) {
    // A member application never enters the review: the application itself says whether it is there and still open.
    const m = await memberApplicationFacts(db, ref);
    if (!m) return refuse(404, "not_found", ONBOARDING_WORDS.notFound);
    return m.open ? null : refuse(409, "decided", ONBOARDING_WORDS.decided);
  }
  if (!steps.some((s) => s.kind === "confirmed")) return refuse(404, "not_found", ONBOARDING_WORDS.notFound);
  if (steps.some((s) => s.kind === "decided")) return refuse(409, "decided", ONBOARDING_WORDS.decided);
  return null;
}

async function roleNamesOfApplication(db: Db, ref: string): Promise<string[]> {
  const confirmed = (await review.stepsOf(db, ref)).find((s) => s.kind === "confirmed");
  const ids: string[] = Array.isArray(confirmed?.detail?.roleIds) ? confirmed!.detail.roleIds.map(String) : ((await memberApplicationFacts(db, ref))?.roleIds ?? []);
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
  if (await referencesOnly(pool, ref)) return refuse(404, "not_found", ONBOARDING_WORDS.notFound);
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
  // A member's own application asks only for a first long-term role (the lead, 19 Nov 2026), with no shortlist before.
  const member = kindOfRef(ref) === "member" ? await memberApplicationFacts(pool, ref) : null;
  if (kindOfRef(ref) === "member" && !member) return refuse(404, "not_found", ONBOARDING_WORDS.notFound);
  const closed = await openAndConfirmed(pool, ref);
  if (closed) return closed;
  const s = await standingOf(deps, ref, viewerId);
  if (s.isApplicant || s.recused || !s.holdsPower) return refuse(403, "not_allowed", ONBOARDING_WORDS.notAllowed);
  if (member && !member.firstRole) return refuse(409, "first_role_only", ONBOARDING_WORDS.referencesFirstRoleOnly);
  if (!member && shortlistOf(await review.stepsOf(pool, ref)) !== "yes") return refuse(409, "shortlist_first", ONBOARDING_WORDS.referencesNeedShortlist);
  if (!(await review.stampStep(pool, { ref, kind: "refs_asked", at: deps.now(), actorUserId: viewerId }))) return refuse(409, "done", ONBOARDING_WORDS.referencesAskedAlready);
  if (member) {
    // The member hears it on their bell, linked to the form on their own application's page. No name or contact rides on it.
    const names = await roleNamesOfApplication(pool, ref);
    await deps.notify({ userId: member.candidateUserId, type: "application_references_asked", title: ONBOARDING_NOTICES.memberAskedTitle(names), body: ONBOARDING_NOTICES.memberAskedBody, link: `${applicationHref(ref)}#your-references`, actorUserId: null, dedupeKey: `app:${ref}:refs-asked:${member.candidateUserId}` });
  } else await deps.tellApplicant?.(ref, "references");
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
  // A member application is decided on its own row, never by a step here.
  const member = kindOfRef(ref) === "member" ? await memberApplicationFacts(pool, ref) : null;
  if (member && !member.open) return { ok: false, status: 409, error: "decided", row: null };
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

/**
 * WHAT A MEMBER READS OF THEIR OWN REFERENCES, on their application's page: whether they were asked, how many they
 * gave (a count, never the details back), and whether the form is open. Null for anybody but the applicant, and for an
 * application whose references were never asked for.
 */
export async function ownReferencesFor(deps: ReviewDeps, ref: string, viewerId: string): Promise<{ asked: true; given: number | null; mayAdd: boolean } | null> {
  const pool = deps.getPool();
  if (kindOfRef(ref) !== "member" || !(await isApplicant(deps, ref, viewerId))) return null;
  const steps = await review.stepsOf(pool, ref);
  if (!steps.some((x) => x.kind === "refs_asked")) return null;
  const given = steps.some((x) => x.kind === "refs_given");
  const m = await memberApplicationFacts(pool, ref);
  return { asked: true, given: given ? (await repo.referencesOf(pool, ref)).length : null, mayAdd: !given && !!m?.open };
}

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
 * MOVE TO THE FINAL CONVERSATION (the lead, 27 Nov 2026: "once they have their proposal solid and they passed this
 * step they move to their final conversation"). A person's act, and the only way a final conversation opens: nothing
 * opens it by itself (server/lib/applicationReview.ts never opens a final). It opens the application's final
 * conversation, adding one for the role the village names for the final call when the role's own list named none,
 * and its holders hear it waits on them. Opening it is what fixes the applicant's proposal (shared/proposalRefine.ts).
 * Refused when the final conversation is already open or done, or when no role is named.
 */
export async function addFinalConversation(deps: ReviewDeps, ref: string, viewerId: string): Promise<{ ok: true; opened: boolean } | Refusal> {
  const pool = deps.getPool();
  if (await referencesOnly(pool, ref)) return refuse(404, "not_found", ONBOARDING_WORDS.notFound);
  const closed = await openAndConfirmed(pool, ref);
  if (closed) return closed;
  const s = await standingOf(deps, ref, viewerId);
  if (s.isApplicant || s.recused || !(s.holdsPower || s.isFinalCall)) return refuse(403, "not_allowed", ONBOARDING_WORDS.notAllowed);
  const steps = await review.stepsOf(pool, ref);
  // THE SAME READINESS THE PAGE USES (QA round 4): shortlisted, every conversation before the final written up, every
  // reference given and followed up. The page offers the move only then (`readyForFinalOf`, which sets the
  // "add_final" act), and the door now refuses anything earlier, on every path. Checked after an open final and
  // unfinished conversations, so those keep their own words.
  const facts = await trackFactsOf(deps, ref);
  const roleId = stringVar(FINAL_CALL_ROLE_VARIABLE).trim();
  const at = deps.now();
  let opened: { position: number; roleId: string; minutes: number } | null = null;
  const out = await inTransaction(pool, async (conn): Promise<Refusal | null> => {
    const list = await review.interviewsOf(conn, ref, true);
    const final = list.find((i) => i.final);
    if (final && final.state !== "waiting") return refuse(409, "exists", ONBOARDING_WORDS.finalExists);
    // Our review still waiting means nothing opens before the invitation.
    if (reviewStageOf(steps) === "review") return refuse(409, "review_first", ONBOARDING_WORDS.shortlistWaitsReview);
    // One conversation open at a time: the ones before the final are written up first (the lead: "they passed this step").
    if (list.some((i) => !i.final && i.state !== "scored" && i.state !== "skipped")) return refuse(409, "talks_first", ONBOARDING_WORDS.finalTalksFirst);
    if (!facts || !readyForFinalOf(facts.facts)) return refuse(409, "not_references", ONBOARDING_WORDS.finalAtReferences);
    if (final) {
      if (await review.openInterview(conn, final.id, at)) opened = { position: final.position, roleId: final.roleId, minutes: final.minutes };
      return null;
    }
    if (!roleId) return refuse(409, "no_role", ONBOARDING_WORDS.finalNoRole);
    const position = list.reduce((m, i) => Math.max(m, i.position), 0) + 1;
    await review.insertInterviewAt(conn, ref, { position, roleId, minutes: 30, final: true }, at);
    opened = { position, roleId, minutes: 30 };
    return null;
  });
  if (out) return out;
  const o = opened as { position: number; roleId: string; minutes: number } | null;
  if (o) {
    const name = kindOfRef(ref) === "open" ? ((await proposals.readOpenProposal(pool, ref))?.name ?? null) : null;
    await tellInterviewers(deps, ref, o.position, o.roleId, o.minutes, name ? (name.trim().split(/\s+/)[0] ?? null) : null);
  }
  return { ok: true, opened: !!o };
}

// ── The conversation guide ──────────────────────────────────────────────────

/** The guide's lines for one application: its snapshotted selection criteria, then its roles' qualities. Null when it has no review. */
async function guideItemsOf(deps: Pick<ReviewDeps, "getPool">, ref: string): Promise<GuideItem[] | null> {
  const pool = deps.getPool();
  const confirmed = (await review.stepsOf(pool, ref)).find((x) => x.kind === "confirmed");
  if (!confirmed) return null;
  const d = confirmed.detail ?? {};
  const roleIds: string[] = Array.isArray(d.roleIds) ? d.roleIds.map(String) : [];
  const sections = await sectionsForMany(pool, roleIds);
  const qualities: string[] = roleIds.flatMap((id: string) => sections.get(id)?.qualities ?? []);
  return guideItems(parseCriteria(d.criteria), qualities);
}

/** The guide and the notes the viewer may read, or null when they may not use it. Notes only: nothing is scored or ranked. */
async function guideFor(deps: ReviewDeps, ref: string, s: Standing, viewerId: string): Promise<GuideView | null> {
  if (kindOfRef(ref) !== "open" || !mayUseGuide(s)) return null;
  const items = await guideItemsOf(deps, ref);
  if (!items) return null;
  const stored = (await guideRepo.guideNotesOf(deps.getPool(), ref)).filter((n) => items.some((i) => i.key === n.key));
  const first = new Map<string, string>();
  for (const u of Array.from(new Set(stored.map((n) => n.authorUserId)))) {
    const m: any = await deps.members.byId(u);
    first.set(u, String(m?.name ?? "").trim().split(/\s+/)[0] || "A member");
  }
  return { items, notes: stored.map((n) => ({ key: n.key, by: first.get(n.authorUserId) ?? "A member", note: n.note, mine: n.authorUserId === viewerId })) };
}

/** One reviewer's note on one line of the guide. An empty note clears it. */
export async function saveGuideNote(deps: ReviewDeps, ref: string, viewerId: string, body: unknown): Promise<{ ok: true } | Refusal> {
  const pool = deps.getPool();
  if (kindOfRef(ref) !== "open") return refuse(404, "not_found", ONBOARDING_WORDS.notFound);
  const closed = await openAndConfirmed(pool, ref);
  if (closed) return closed;
  const s = await standingOf(deps, ref, viewerId);
  if (!mayUseGuide(s)) return refuse(403, "not_allowed", GUIDE_WORDS.notAllowed);
  const items = (await guideItemsOf(deps, ref)) ?? [];
  const read = readGuideNote(body, items);
  if (!read.ok) return refuse(400, "note", read.error);
  await guideRepo.saveGuideNote(pool, { ref, key: read.key, userId: viewerId, note: read.note, at: deps.now() });
  return { ok: true };
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
  /** The conversation guide: the role's criteria and qualities as prompts, with reviewers' notes. Null for anybody who may not use it. */
  guide: GuideView | null;
  /** Each conversation's private notes and files, only the conversations this viewer may read (shared/conversationNotes.ts). */
  conversations: ConversationNotesView[];
  /** The proposal's earlier versions, oldest first, when the applicant refined it (shared/proposalRefine.ts). */
  proposalVersions: ProposalVersion[];
  /** The proposal's words now, beside the earlier versions; null when there are none. */
  proposalNow: { why: string; aim: string } | null;
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
  // A member's own application walks only its references here, and only when it asks for them: a first long-term
  // role, or one whose references were already asked for (the lead, 19 Nov 2026). The rest stays on its own page.
  const member = !steps.some((x) => x.kind === "confirmed") ? await memberApplicationFacts(pool, ref) : null;
  if (!steps.some((x) => x.kind === "confirmed") && !(member && (member.firstRole || steps.some((x) => x.kind === "refs_asked")))) return null;
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
  const names = await review.roleNamesById(pool, [followRole, finalRole, welcomeRole, ...stored.map((r) => r.ownerRoleId), ...interviews.map((i) => i.roleId)].filter(Boolean));
  const shortlist = member ? null : shortlistOf(steps);
  const track = member
    ? memberTrackOf({ decided: member.decided, refsAsked: steps.some((x) => x.kind === "refs_asked"), refsGiven: steps.some((x) => x.kind === "refs_given"), references: stored.map((r) => ({ followedUp: !!r.followedUpAt })) })
    : trackOf(
    {
      decided: how === "adopted" || how === "declined" || how === "withdrawn" ? how : decidedStep ? "declined" : null,
      reviewStage: reviewStageOf(steps),
      firstReplied: steps.some((x) => x.kind === "first_reply"),
      shortlist,
      refsAsked: steps.some((x) => x.kind === "refs_asked"),
      refsGiven: steps.some((x) => x.kind === "refs_given"),
      references: stored.map((r) => ({ followedUp: !!r.followedUpAt })),
      interviews: interviews.map((i) => ({ state: i.state, final: i.final, role: names.get(i.roleId) ?? null })),
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
  const open = member ? member.open : !decidedStep;
  const mayAssign = mayAssignOwners(s) && open;
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
  return {
    track,
    shortlist,
    references: { asked: steps.some((x) => x.kind === "refs_asked"), given: steps.some((x) => x.kind === "refs_given"), list, total: stored.length, mayAssign },
    roles: mayAssign ? await review.activeRoles(pool) : [],
    members: mayAssign ? await review.membersHoldingRoles(pool) : [],
    scorecards: await scorecardsFor(deps, ref, viewerId),
    guide: await guideFor(deps, ref, s, viewerId),
    conversations: await conversationNotesFor(deps, ref, s, viewerId, interviews),
    ...(await versionsView(deps, ref, s.isReviewer || s.isFinalCall)),
    roleNames: { followup: followRole ? (names.get(followRole) ?? null) : null, finalCall: finalRole ? (names.get(finalRole) ?? null) : null },
    you: {
      mayShortlist: !member && open && s.holdsPower && !s.recused && shortlist === null && reviewStageOf(steps) !== "review" && reviewStageOf(steps) !== "not_invited",
      mayAskReferences: open && s.holdsPower && !s.recused && (member ? member.firstRole : shortlist === "yes" && kindOfRef(ref) === "open") && !steps.some((x) => x.kind === "refs_asked"),
      // The older path (QA round 2): a final the role's own list named, waiting, needs no final-call role or shortlist to move to.
      mayAddFinal:
        !member &&
        open &&
        (s.holdsPower || s.isFinalCall) &&
        !s.recused &&
        !interviews.some((i) => i.final && i.state !== "waiting") &&
        // Only when the page offers the move: the same readiness the door requires (QA round 4).
        track.primary === "add_final" &&
        (interviews.some((i) => i.final && i.state === "waiting") || (shortlist === "yes" && !!finalRole)),
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

// ── The conversations' notes (0444) ─────────────────────────────────────────

/** Whether this viewer may read, and add to, one conversation's notes. */
function readsConversation(s: Standing, roleId: string): boolean {
  return mayReadConversationNotes({ isApplicant: s.isApplicant, recused: s.recused, holdsPower: s.holdsPower, isFinalCall: s.isFinalCall, holdsConversationRole: s.roles.has(roleId) });
}

/** Where the notes bell lands: the notes section itself (QA round 1). */
export const notesHref = (ref: string): string => walkthroughHref(ref).replace(/#walkthrough$/, "#conversation-notes");

/** The file door for one note: it asks who the reader is again on every read. */
export const noteFileHref = (ref: string, id: number): string => `/api/governance/applications/${encodeURIComponent(ref)}/conversation-notes/${id}/file`;

/** Each conversation this viewer may read, with its notes, oldest first. Never for the applicant or anyone who stepped out. */
async function conversationNotesFor(deps: ReviewDeps, ref: string, s: Standing, viewerId: string, interviews: review.StoredInterview[]): Promise<ConversationNotesView[]> {
  if (s.isApplicant || s.recused) return [];
  const readable = interviews.filter((i) => readsConversation(s, i.roleId));
  if (!readable.length) return [];
  const pool = deps.getPool();
  const stored = await notesRepo.conversationNotesOf(pool, ref);
  const names = await review.roleNamesById(pool, readable.map((i) => i.roleId));
  const authors = new Map<string, string>();
  for (const u of Array.from(new Set(stored.map((n) => n.authorUserId)))) {
    const m: any = await deps.members.byId(u);
    authors.set(u, String(m?.name ?? "").trim().split(/\s+/)[0] || "A member");
  }
  return readable.map((i) => ({
    interviewId: i.id,
    label: NOTES_WORDS.conversation(names.get(i.roleId) ?? i.roleId, i.final),
    roleId: i.roleId,
    final: i.final,
    state: i.state,
    notes: stored
      .filter((n) => n.interviewId === i.id)
      .map(
        (n): ServedNote => ({
          id: n.id,
          kind: n.kind,
          body: n.kind === "text" ? n.body : null,
          fileName: n.kind === "text" ? null : n.originalName,
          fileHref: n.kind === "text" || !n.fileName ? null : noteFileHref(ref, n.id),
          author: authors.get(n.authorUserId) ?? "A member",
          on: n.createdAt.toISOString().slice(0, 10),
          mine: mayRemoveNote(n.authorUserId, viewerId),
        }),
      ),
  }));
}

/** The conversation a note is added to, when the viewer may write there. */
async function writableConversation(deps: ReviewDeps, ref: string, viewerId: string, interviewId: number): Promise<{ ok: true; interview: review.StoredInterview } | Refusal> {
  const pool = deps.getPool();
  const interview = await review.interviewById(pool, interviewId);
  if (!interview || interview.ref !== ref) return refuse(404, "not_found", NOTES_WORDS.notFound);
  const s = await standingOf(deps, ref, viewerId);
  // Anybody who may not read this conversation gets the same 404 as a stranger (QA round 1).
  if (!readsConversation(s, interview.roleId)) return refuse(404, "not_found", NOTES_WORDS.notFound);
  return { ok: true, interview };
}

/** A written note on one conversation. The other readers get a bell notice; the applicant never does. */
export async function addConversationText(deps: ReviewDeps, ref: string, viewerId: string, interviewId: number, raw: unknown): Promise<{ ok: true; id: number } | Refusal> {
  const at = await writableConversation(deps, ref, viewerId, interviewId);
  if (!at.ok) return at;
  const read = readNoteBody(raw);
  if (!read.ok) return refuse(400, read.error, read.error === "empty" ? NOTES_WORDS.empty : NOTES_WORDS.tooLong);
  const id = await notesRepo.addConversationNote(deps.getPool(), { ref, interviewId, authorUserId: viewerId, kind: "text", body: read.body, fileName: null, originalName: null, at: deps.now() });
  await tellNotesAdded(deps, ref, at.interview, viewerId, id);
  return { ok: true, id };
}

/** Whether the viewer may add a file to one conversation, checked before its bytes are stored. */
export async function mayAddConversationFile(deps: ReviewDeps, ref: string, viewerId: string, interviewId: number): Promise<{ ok: true } | Refusal> {
  const at = await writableConversation(deps, ref, viewerId, interviewId);
  return at.ok ? { ok: true } : at;
}

/** A file's row, once its bytes are stored in the private folder. The other readers get a bell notice. */
export async function addConversationFile(
  deps: ReviewDeps,
  ref: string,
  viewerId: string,
  interviewId: number,
  f: { kind: ConversationNoteKind; fileName: string; originalName: string },
): Promise<{ ok: true; id: number } | Refusal> {
  const at = await writableConversation(deps, ref, viewerId, interviewId);
  if (!at.ok) return at;
  if (f.kind === "text" || !CONVERSATION_NOTE_KINDS.includes(f.kind)) return refuse(400, "kind", NOTES_WORDS.wrongType);
  const id = await notesRepo.addConversationNote(deps.getPool(), { ref, interviewId, authorUserId: viewerId, kind: f.kind, body: null, fileName: f.fileName, originalName: f.originalName.slice(0, 255), at: deps.now() });
  await tellNotesAdded(deps, ref, at.interview, viewerId, id);
  return { ok: true, id };
}

/** The author takes their note or file off. */
export async function removeConversationNote(deps: ReviewDeps, ref: string, viewerId: string, id: number): Promise<{ ok: true } | Refusal> {
  const pool = deps.getPool();
  const note = await notesRepo.conversationNoteById(pool, ref, id);
  if (!note) return refuse(404, "not_found", NOTES_WORDS.notFound);
  // A non-reader learns nothing, not even that the note exists; a reader who did not write it is told why.
  const interview = await review.interviewById(pool, note.interviewId);
  if (!interview || !readsConversation(await standingOf(deps, ref, viewerId), interview.roleId)) return refuse(404, "not_found", NOTES_WORDS.notFound);
  if (!mayRemoveNote(note.authorUserId, viewerId)) return refuse(403, "not_yours", NOTES_WORDS.notYours);
  return (await notesRepo.removeConversationNote(pool, ref, id, viewerId)) ? { ok: true } : refuse(404, "not_found", NOTES_WORDS.notFound);
}

/** One note's file for a reader who may read its conversation, or null for anybody else (the same 404 as a stranger). */
export async function conversationFileFor(deps: ReviewDeps, ref: string, viewerId: string, id: number): Promise<{ fileName: string; originalName: string } | null> {
  const pool = deps.getPool();
  const note = await notesRepo.conversationNoteById(pool, ref, id);
  if (!note || !note.fileName) return null;
  const interview = await review.interviewById(pool, note.interviewId);
  if (!interview || interview.ref !== ref) return null;
  const s = await standingOf(deps, ref, viewerId);
  if (!readsConversation(s, interview.roleId)) return null;
  return { fileName: note.fileName, originalName: note.originalName ?? "file" };
}

/**
 * THE INTERVIEWERS ARE TOLD, NEVER THE APPLICANT: every other person who may read this conversation's notes (its
 * role's holders, the final-call role, the holders of the power to place people in roles) gets a bell notice with a
 * link to the notes. No applicant name, contact or note words ride on it. One notice per note per person.
 */
async function tellNotesAdded(deps: ReviewDeps, ref: string, interview: review.StoredInterview, authorId: string, noteId: number): Promise<void> {
  const pool = deps.getPool();
  const names = await roleNamesOfApplication(pool, ref);
  const recused = new Set(await review.recusedUsers(pool, ref));
  const people = [...(await review.liveHoldersOfRole(pool, interview.roleId)), ...(await finalCallHolders(pool)), ...(await deps.liveHoldersOf(ADOPTING_POWER))];
  const told = new Set<string>([authorId]);
  for (const userId of people) {
    if (told.has(userId) || recused.has(userId) || (await isApplicant(deps, ref, userId))) continue;
    told.add(userId);
    await deps.notify({ userId, type: "application_conversation_notes", title: NOTES_NOTICES.title(names), body: NOTES_NOTICES.body, link: notesHref(ref), actorUserId: authorId, dedupeKey: `app:${ref}:conv-note:${noteId}:${userId}` });
  }
}

// ── The applicant's own view of the six stages, and refining their proposal ─

/** The facts the track reads, for one application, from what is stored. Null for a ref with no confirmed step. */
async function trackFactsOf(deps: Pick<ReviewDeps, "getPool">, ref: string): Promise<{ facts: TrackFacts; finals: Array<{ state: string; booked: boolean }> } | null> {
  const pool = deps.getPool();
  const steps = await review.stepsOf(pool, ref);
  if (!steps.some((s) => s.kind === "confirmed")) return null;
  const decidedStep = steps.find((x) => x.kind === "decided");
  const how = decidedStep?.detail?.how;
  const interviews = await review.interviewsOf(pool, ref);
  const follow = await repo.followUpsOf(pool, [ref]);
  return {
    facts: {
      decided: how === "adopted" || how === "declined" || how === "withdrawn" ? how : decidedStep ? "declined" : null,
      reviewStage: reviewStageOf(steps),
      firstReplied: steps.some((x) => x.kind === "first_reply"),
      shortlist: shortlistOf(steps),
      refsAsked: steps.some((x) => x.kind === "refs_asked"),
      refsGiven: steps.some((x) => x.kind === "refs_given"),
      references: follow.get(ref) ?? [],
      interviews: interviews.map((i) => ({ state: i.state, final: i.final })),
    },
    finals: interviews.filter((i) => i.final).map((i) => ({ state: i.state, booked: !!i.bookedAt })),
  };
}

/**
 * WHAT THE APPLICANT'S OWN PAGE READS OF THE SIX STAGES: each stage's key and state, the stage they stand at,
 * whether they may refine their proposal, whether it was shortlisted, and, once their references are in, the role
 * that acts next. Never a note, a score, a reference or a person's name: a role's name at most.
 * Open proposals only; a member's own application keeps its own page. Null otherwise.
 */
export async function applicantStagesOf(deps: ReviewDeps, ref: string): Promise<{
  stages: Array<{ key: TrackStage; state: TrackState }>;
  now: TrackStage;
  refine: RefineView;
  shortlisted: boolean;
  next: { act: "follow_up" | "move"; role: string | null } | null;
} | null> {
  if (kindOfRef(ref) !== "open") return null;
  const read = await trackFactsOf(deps, ref);
  if (!read) return null;
  const { state, now } = trackStates(read.facts);
  const own = await proposals.readOpenProposal(deps.getPool(), ref);
  const finalFrozen = finalFreezes(read.finals);
  const decided = read.facts.decided !== null;
  const open = mayRefine({ stage: now, decided, finalFrozen });
  // Once the references are in at References and proposal, the ROLE that acts next (QA round 2): the follow-up role
  // while a reference waits on its follow-up, then the role named for the final call. Role names only, never a person.
  let next: { act: "follow_up" | "move"; role: string | null } | null = null;
  if (now === "references" && !decided && read.facts.refsGiven) {
    const act = read.facts.references.every((r) => r.followedUp) ? "move" : "follow_up";
    const roleId = stringVar(act === "follow_up" ? FOLLOWUP_ROLE_VARIABLE : FINAL_CALL_ROLE_VARIABLE).trim();
    const role = roleId ? ((await review.roleNamesById(deps.getPool(), [roleId])).get(roleId) ?? null) : null;
    next = { act, role };
  }
  return {
    stages: TRACK.map((key) => ({ key, state: state[key] })),
    now,
    shortlisted: read.facts.shortlist === "yes",
    next,
    refine: {
      open,
      // Frozen is said only once there was a time to refine: from References and proposal on.
      frozen: !decided && finalFrozen,
      why: open ? (own?.body.why ?? "") : "",
      aim: open ? (own?.body.aim ?? "") : "",
      versions: readVersions(await proposals.proposalVersionsOf(deps.getPool(), ref)).length,
    },
  };
}

export type RefineOutcome = { ok: true; versions: number } | { ok: false; status: number; error: keyof typeof REFINE_ERRORS };

/**
 * THE APPLICANT REFINES THEIR PROPOSAL, while at References and proposal and before the final conversation opens.
 * The words they replace are kept as an earlier version. The team reads what changed on the walkthrough.
 */
export async function refineProposal(deps: ReviewDeps, ref: string, raw: unknown): Promise<RefineOutcome> {
  if (kindOfRef(ref) !== "open") return { ok: false, status: 404, error: "not_found" };
  const read = await trackFactsOf(deps, ref);
  if (!read) return { ok: false, status: 404, error: "not_found" };
  const { now } = trackStates(read.facts);
  if (!mayRefine({ stage: now, decided: read.facts.decided !== null, finalFrozen: finalFreezes(read.finals) })) return { ok: false, status: 409, error: "closed" };
  const words = readRefined(raw);
  if (!words.ok) return { ok: false, status: 400, error: words.error };
  const pool = deps.getPool();
  const at = deps.now();
  return inTransaction(pool, async (conn) => {
    const p = await proposals.readOpenProposal(conn, ref, true);
    if (!p || p.status !== "confirmed") return { ok: false, status: 409, error: "closed" } as RefineOutcome;
    if (p.body.why === words.why && p.body.aim === words.aim) return { ok: false, status: 400, error: "unchanged" } as RefineOutcome;
    const versions = [...readVersions(await proposals.proposalVersionsOf(conn, ref)), { at: at.toISOString(), why: p.body.why, aim: p.body.aim }].slice(-PROPOSAL_VERSIONS_MAX);
    if (!(await proposals.refineOpenProposal(conn, ref, words.why, words.aim, versions))) return { ok: false, status: 409, error: "closed" } as RefineOutcome;
    return { ok: true, versions: versions.length } as RefineOutcome;
  });
}

/** The earlier versions and the words now, for the team's walkthrough: only for the reviewers and the final call. */
async function versionsView(deps: ReviewDeps, ref: string, reads: boolean): Promise<{ proposalVersions: ProposalVersion[]; proposalNow: { why: string; aim: string } | null }> {
  const proposalVersions = reads ? await proposalVersionsFor(deps, ref) : [];
  if (!proposalVersions.length) return { proposalVersions, proposalNow: null };
  const own = await proposals.readOpenProposal(deps.getPool(), ref);
  return { proposalVersions, proposalNow: own ? { why: own.body.why, aim: own.body.aim } : null };
}

/** The earlier versions of a proposal, for the team's walkthrough. Never the applicant's read of anybody else's. */
export async function proposalVersionsFor(deps: Pick<ReviewDeps, "getPool">, ref: string): Promise<ProposalVersion[]> {
  if (kindOfRef(ref) !== "open") return [];
  return readVersions(await proposals.proposalVersionsOf(deps.getPool(), ref));
}
