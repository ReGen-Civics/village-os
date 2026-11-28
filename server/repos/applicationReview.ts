/**
 * `application_steps`, `application_interviews`, `application_scores` and
 * `application_recusals`: the review of an application (role journey L5).
 * `application_references` (0412) has its own file, server/repos/applicantOnboarding.ts,
 * and is cleared here with the rest of the review.
 *
 * Every statement the review runs lives here, so the tables' readers and
 * writers stay enumerable. The rules are shared/applicationReview.ts and the
 * work is server/lib/applicationReview.ts. Raw SQL only.
 *
 * Instants are written from Node's clock and read back with UNIX_TIMESTAMP, so
 * the database's own zone never moves one.
 *
 * NOTHING HERE IS READ BY A COMPANION. The scores are private to the people the
 * rule names (`mayReadScorecards`), and no tool the guide or a companion holds
 * reads these tables: server/lib/applicationReview.refusal.test.ts scans for it.
 */
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { GUT_CRITERION, type GutCheck, type GutAnswer, type InterviewState, type ScoreEntry, type ScoreLevel, type StepKind } from "../../shared/applicationReview";
import { parseBookingUrl } from "../../shared/roleBooking";
import { memberBookingUrl } from "../../shared/interviewBooking";
import { holderFirstName } from "../../shared/roleHolderLabel";
import { anchorCircleId } from "../../shared/circlePicker";
import type { StageTimingFacts } from "../../shared/applicationStageTiming";
import { deleteReferencesOf, forgetMemberReferences } from "./applicantOnboarding";
import { deleteGuideNotesOf, forgetGuideNotesBy } from "./applicationGuide";
import { deleteConversationNotesOf, forgetConversationNotesBy } from "./applicationConversationNotes";

type Db = Pool | PoolConnection;

const fromSeconds = (v: unknown): Date | null => (v === null || v === undefined ? null : new Date(Number(v) * 1000));
const json = (v: unknown): any => {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return null;
  }
};

// ── Steps ───────────────────────────────────────────────────────────────────

export interface StoredStep {
  ref: string;
  kind: StepKind;
  subject: string;
  at: Date;
  actorUserId: string | null;
  detail: any;
}

/** Stamp a step once. `subject` is "" for a step with no subject, or the interview position. True when this call wrote it. */
export async function stampStep(db: Db, s: { ref: string; kind: StepKind; subject?: string; at: Date; actorUserId?: string | null; detail?: unknown }): Promise<boolean> {
  const [r] = await db.query<ResultSetHeader>(
    "INSERT IGNORE INTO application_steps (application_ref, kind, subject, stamped_at, actor_user_id, detail_json) VALUES (?,?,?,?,?,?)",
    [s.ref, s.kind, s.subject ?? "", s.at, s.actorUserId ?? null, s.detail === undefined ? null : JSON.stringify(s.detail)],
  );
  return Number(r.affectedRows ?? 0) === 1;
}

/** Replace one step's detail (a stage letter's attempt, once its post has answered). */
export async function setStepDetail(db: Db, ref: string, kind: StepKind, subject: string, detail: unknown): Promise<void> {
  await db.query("UPDATE application_steps SET detail_json = ? WHERE application_ref = ? AND kind = ? AND subject = ?", [JSON.stringify(detail), ref, kind, subject]);
}

/** Write the booking mode into the confirmed step's detail. True when it changed. */
export async function setMode(db: Db, ref: string, mode: "block" | "split"): Promise<boolean> {
  const [r] = await db.query<ResultSetHeader>(
    "UPDATE application_steps SET detail_json = JSON_SET(COALESCE(detail_json, JSON_OBJECT()), '$.mode', ?) WHERE application_ref = ? AND kind = 'confirmed' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(detail_json, '$.mode')), 'block') <> ?",
    [mode, ref, mode],
  );
  return Number(r.affectedRows ?? 0) === 1;
}

export async function stepsOf(db: Db, ref: string): Promise<StoredStep[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT application_ref, kind, subject, UNIX_TIMESTAMP(stamped_at) AS at_s, actor_user_id, detail_json FROM application_steps WHERE application_ref = ? ORDER BY stamped_at, id",
    [ref],
  );
  return rows.map((r: any) => ({ ref: String(r.application_ref), kind: r.kind, subject: String(r.subject ?? ""), at: fromSeconds(r.at_s) as Date, actorUserId: r.actor_user_id ?? null, detail: json(r.detail_json) }));
}

/** Refs that were confirmed and have not been decided, with their confirmation time and the latest step time. */
export async function openReviews(db: Db): Promise<Array<{ ref: string; confirmedAt: Date; lastAt: Date; firstReplyAt: Date | null }>> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT c.application_ref, UNIX_TIMESTAMP(c.stamped_at) AS confirmed_s, " +
      // A letter's attempt (stage_mail) is no act: it never makes a stalled application look moved.
      "(SELECT UNIX_TIMESTAMP(MAX(s.stamped_at)) FROM application_steps s WHERE s.application_ref = c.application_ref AND s.kind <> 'stage_mail') AS last_s, " +
      "(SELECT UNIX_TIMESTAMP(MIN(s.stamped_at)) FROM application_steps s WHERE s.application_ref = c.application_ref AND s.kind = 'first_reply') AS reply_s " +
      "FROM application_steps c LEFT JOIN open_role_proposals p ON p.id = c.application_ref WHERE c.kind = 'confirmed' " +
      "AND (p.id IS NULL OR p.status = 'confirmed') " +
      "AND NOT EXISTS (SELECT 1 FROM application_steps d WHERE d.application_ref = c.application_ref AND d.kind IN ('decided','cleared')) LIMIT 500",
  );
  return rows.map((r: any) => ({ ref: String(r.application_ref), confirmedAt: fromSeconds(r.confirmed_s) as Date, lastAt: fromSeconds(r.last_s) as Date, firstReplyAt: fromSeconds(r.reply_s) }));
}

// ── Interviews ──────────────────────────────────────────────────────────────

export interface StoredInterview {
  id: number;
  ref: string;
  position: number;
  roleId: string;
  minutes: number;
  final: boolean;
  state: InterviewState;
  scorerUserId: string | null;
  openedAt: Date | null;
  bookedAt: Date | null;
  heldAt: Date | null;
  scoredAt: Date | null;
}

const IV_COLUMNS =
  "id, application_ref, position, interviewer_role_id, minutes, is_final, state, scorer_user_id, UNIX_TIMESTAMP(opened_at) AS opened_s, UNIX_TIMESTAMP(booked_at) AS booked_s, UNIX_TIMESTAMP(held_at) AS held_s, UNIX_TIMESTAMP(scored_at) AS scored_s";

const ivOf = (r: any): StoredInterview => ({
  id: Number(r.id),
  ref: String(r.application_ref),
  position: Number(r.position),
  roleId: String(r.interviewer_role_id),
  minutes: Number(r.minutes),
  final: Number(r.is_final) === 1,
  state: r.state,
  scorerUserId: r.scorer_user_id ?? null,
  openedAt: fromSeconds(r.opened_s),
  bookedAt: fromSeconds(r.booked_s),
  heldAt: fromSeconds(r.held_s),
  scoredAt: fromSeconds(r.scored_s),
});

/** Write the ordered interviews; the first opens now, the rest wait. Idempotent on (ref, position). */
/** The role's conversations, copied in order. The first opens at once unless our review comes first (`openFirst` false): then every one waits for the invitation. */
export async function insertInterviews(db: Db, ref: string, given: ReadonlyArray<{ roleId: string; minutes: number; final: boolean }>, at: Date, openFirst = true): Promise<void> {
  // The final conversation always comes last, wherever a role's list put it, so nothing opens it by itself (QA round 2):
  // only the team's move to the final conversation does (server/lib/applicantOnboarding.ts `addFinalConversation`).
  const list = [...given.filter((x) => !x.final), ...given.filter((x) => x.final)];
  for (let i = 0; i < list.length; i++) {
    const open = i === 0 && openFirst && !list[i].final;
    await db.query(
      "INSERT IGNORE INTO application_interviews (application_ref, position, interviewer_role_id, minutes, is_final, state, opened_at) VALUES (?,?,?,?,?,?,?)",
      [ref, i + 1, list[i].roleId, list[i].minutes, list[i].final ? 1 : 0, open ? "open" : "waiting", open ? at : null],
    );
  }
}

/**
 * One more conversation at a given position (the final conversation the role that makes the final call
 * holds, shared/applicantOnboarding.ts). Open now when `openedAt` is given, else waiting. Idempotent on (ref, position).
 */
export async function insertInterviewAt(db: Db, ref: string, iv: { position: number; roleId: string; minutes: number; final: boolean }, openedAt: Date | null): Promise<boolean> {
  const [r] = await db.query<ResultSetHeader>(
    "INSERT IGNORE INTO application_interviews (application_ref, position, interviewer_role_id, minutes, is_final, state, opened_at) VALUES (?,?,?,?,?,?,?)",
    [ref, iv.position, iv.roleId, iv.minutes, iv.final ? 1 : 0, openedAt ? "open" : "waiting", openedAt],
  );
  return Number(r.affectedRows ?? 0) === 1;
}

export async function interviewsOf(db: Db, ref: string, lock = false): Promise<StoredInterview[]> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${IV_COLUMNS} FROM application_interviews WHERE application_ref = ? ORDER BY position${lock ? " FOR UPDATE" : ""}`, [ref]);
  return rows.map(ivOf);
}

export async function interviewById(db: Db, id: number): Promise<StoredInterview | null> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${IV_COLUMNS} FROM application_interviews WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ? ivOf(rows[0]) : null;
}

/** Interviews that name one of these roles and are open now, across applications. */
export async function openInterviewsForRoles(db: Db, roleIds: readonly string[]): Promise<StoredInterview[]> {
  if (!roleIds.length) return [];
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${IV_COLUMNS} FROM application_interviews WHERE state = 'open' AND interviewer_role_id IN (?) ORDER BY opened_at, id`, [[...roleIds]]);
  return rows.map(ivOf);
}

/** Open the next interview, only if it is still waiting. True when this call did. */
export async function openInterview(db: Db, id: number, at: Date): Promise<boolean> {
  const [r] = await db.query<ResultSetHeader>("UPDATE application_interviews SET state = 'open', opened_at = ? WHERE id = ? AND state = 'waiting'", [at, id]);
  return Number(r.affectedRows ?? 0) === 1;
}

/** Close an interview as scored, only if it is open: of two scorers at once exactly one wins. */
export async function closeInterviewScored(db: Db, id: number, scorer: string, at: Date): Promise<boolean> {
  const [r] = await db.query<ResultSetHeader>("UPDATE application_interviews SET state = 'scored', scorer_user_id = ?, scored_at = ? WHERE id = ? AND state = 'open'", [scorer, at, id]);
  return Number(r.affectedRows ?? 0) === 1;
}

export async function skipInterview(db: Db, id: number): Promise<boolean> {
  const [r] = await db.query<ResultSetHeader>("UPDATE application_interviews SET state = 'skipped' WHERE id = ? AND state IN ('open','waiting')", [id]);
  return Number(r.affectedRows ?? 0) === 1;
}

/**
 * THE CALL'S OWN DATE AND TIME ("I've booked it", the lead, 27 Nov 2026; shared/callBooked.ts): said by the applicant
 * or set by the team. Only while the conversation is open, and a later save corrects it ("Change"). `booked_at` set
 * is what the walkthrough and the role measures read as booked.
 */
export async function markBooked(db: Db, id: number, at: Date): Promise<boolean> {
  const [r] = await db.query<ResultSetHeader>("UPDATE application_interviews SET booked_at = ? WHERE id = ? AND state = 'open'", [at, id]);
  return Number(r.affectedRows ?? 0) === 1;
}

export async function markHeld(db: Db, id: number, at: Date): Promise<void> {
  await db.query("UPDATE application_interviews SET held_at = COALESCE(held_at, ?) WHERE id = ?", [at, id]);
}

// ── Scores ──────────────────────────────────────────────────────────────────

export interface StoredScore {
  interviewId: number;
  scorerUserId: string;
  /** A criterion's id, or GUT_CRITERION for the gut check (shared/applicationReview.ts). */
  criterionId: string;
  /** A ScoreLevel, or a GutAnswer on the gut check's row. */
  level: ScoreLevel | GutAnswer;
  evidence: string;
  submittedAt: Date;
}

export async function insertScores(db: Db, ref: string, interviewId: number, scorer: string, entries: readonly ScoreEntry[], at: Date): Promise<void> {
  for (const e of entries) {
    await db.query(
      "INSERT INTO application_scores (application_ref, interview_id, scorer_user_id, criterion_id, level, evidence, submitted_at) VALUES (?,?,?,?,?,?,?)",
      [ref, interviewId, scorer, e.criterionId, e.level, e.evidence, at],
    );
  }
}

/** The interviewer's gut check, one more row of their scorecard (GUT_CRITERION). Written in the same transaction as the scorecard. */
export async function insertGut(db: Db, ref: string, interviewId: number, scorer: string, gut: GutCheck, at: Date): Promise<void> {
  await db.query(
    "INSERT INTO application_scores (application_ref, interview_id, scorer_user_id, criterion_id, level, evidence, submitted_at) VALUES (?,?,?,?,?,?,?)",
    [ref, interviewId, scorer, GUT_CRITERION, gut.answer, gut.note, at],
  );
}

export async function scoresOf(db: Db, ref: string): Promise<StoredScore[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT interview_id, scorer_user_id, criterion_id, level, evidence, UNIX_TIMESTAMP(submitted_at) AS at_s FROM application_scores WHERE application_ref = ? ORDER BY interview_id, id",
    [ref],
  );
  return rows.map((r: any) => ({ interviewId: Number(r.interview_id), scorerUserId: String(r.scorer_user_id), criterionId: String(r.criterion_id), level: r.level, evidence: String(r.evidence), submittedAt: fromSeconds(r.at_s) as Date }));
}

/** Whether this person has submitted any scorecard on the application. */
export async function hasScored(db: Db, ref: string, userId: string): Promise<boolean> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT 1 FROM application_scores WHERE application_ref = ? AND scorer_user_id = ? LIMIT 1", [ref, userId]);
  return rows.length > 0;
}

// ── Recusals ────────────────────────────────────────────────────────────────

export async function insertRecusal(db: Db, r: { ref: string; userId: string; interviewId: number | null; reason: string | null; at: Date }): Promise<boolean> {
  const [res] = await db.query<ResultSetHeader>(
    "INSERT IGNORE INTO application_recusals (application_ref, user_id, interview_id, reason, stepped_out_at) VALUES (?,?,?,?,?)",
    [r.ref, r.userId, r.interviewId, r.reason, r.at],
  );
  return Number(res.affectedRows ?? 0) === 1;
}

export async function recusedUsers(db: Db, ref: string): Promise<string[]> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT user_id FROM application_recusals WHERE application_ref = ?", [ref]);
  return rows.map((r: any) => String(r.user_id));
}

// ── Retention and erasure ───────────────────────────────────────────────────

/**
 * Scores and conversation notes follow the application's retention (brief v3
 * section 9): cleared when the application is anonymised and when a member who
 * wrote or received them is erased. What stays is the shape of the review (which
 * steps happened, which roles were asked) and nothing that scores or names a
 * person: no evidence line, no recusal reason, no scorer, no actor, no status
 * link hash, no applicant account id. Idempotent; stamps a `cleared` step once.
 */
export async function clearReviewOf(db: Db, refs: readonly string[], at: Date): Promise<number> {
  if (!refs.length) return 0;
  await db.query("DELETE FROM application_scores WHERE application_ref IN (?)", [[...refs]]);
  // The references a shortlisted applicant gave (0412) are third-party personal data: they go whole, notes and all.
  await deleteReferencesOf(db, refs);
  // The reviewers' conversation notes (0417) go with the scores: words about a person, kept only as long as the review.
  await deleteGuideNotesOf(db, refs);
  // Each conversation's private notes and files (0444) go with them, files off the disk too.
  await deleteConversationNotesOf(db, refs);
  await db.query("UPDATE application_recusals SET reason = NULL WHERE application_ref IN (?)", [[...refs]]);
  await db.query("UPDATE application_interviews SET scorer_user_id = NULL WHERE application_ref IN (?)", [[...refs]]);
  await db.query("UPDATE application_steps SET actor_user_id = NULL WHERE application_ref IN (?)", [[...refs]]);
  await db.query(
    "UPDATE application_steps SET detail_json = JSON_REMOVE(detail_json, '$.statusHash', '$.applicantUserId') WHERE application_ref IN (?) AND kind = 'confirmed' AND detail_json IS NOT NULL",
    [[...refs]],
  );
  for (const ref of refs) await stampStep(db, { ref, kind: "cleared", at });
  return refs.length;
}

/**
 * The applications whose review is due to be cleared: an open proposal that was
 * anonymised, a member application not adopted and decided 90 days ago, and a
 * proposal that no longer exists. Not the ones already cleared.
 */
export async function refsDueForClearing(db: Db, before: Date): Promise<string[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT DISTINCT s.application_ref FROM application_steps s " +
      "LEFT JOIN open_role_proposals p ON p.id = s.application_ref " +
      "LEFT JOIN seat_applications a ON a.id = s.application_ref " +
      "WHERE s.kind = 'confirmed' " +
      "AND NOT EXISTS (SELECT 1 FROM application_steps c WHERE c.application_ref = s.application_ref AND c.kind = 'cleared') " +
      "AND ((p.id IS NOT NULL AND p.anonymised_at IS NOT NULL) " +
      "  OR (a.id IS NOT NULL AND a.status IN ('not-adopted','withdrawn') AND a.decided_at < ?) " +
      "  OR (p.id IS NULL AND a.id IS NULL)) LIMIT 500",
    [before],
  );
  return rows.map((r: any) => String(r.application_ref));
}

/**
 * A member is erased: the scorecards they wrote go, their recusals go, their
 * name leaves every interview and step, and the review of any application they
 * made is cleared. How many applications were cleared.
 */
export async function forgetMemberReview(db: Db, userId: string, at: Date): Promise<number> {
  await db.query("DELETE FROM application_scores WHERE scorer_user_id = ?", [userId]);
  await forgetGuideNotesBy(db, userId);
  // The conversation notes and files they added (0444).
  await forgetConversationNotesBy(db, userId);
  await db.query("DELETE FROM application_recusals WHERE user_id = ?", [userId]);
  // The follow-up notes they wrote on a reference go, and their name leaves every reference they owned (0412).
  await forgetMemberReferences(db, userId);
  await db.query("UPDATE application_interviews SET scorer_user_id = NULL WHERE scorer_user_id = ?", [userId]);
  await db.query("UPDATE application_steps SET actor_user_id = NULL WHERE actor_user_id = ?", [userId]);
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT application_ref FROM application_steps WHERE kind = 'confirmed' AND JSON_UNQUOTE(JSON_EXTRACT(detail_json, '$.applicantUserId')) = ?",
    [userId],
  );
  // A member's own application (`sa-` refs) has no confirmed step: its references, asked for a first long-term role
  // (shared/applicantOnboarding.ts `asksReferences`), are found through the application's candidate and go too.
  const [own] = await db.query<RowDataPacket[]>(
    "SELECT DISTINCT r.application_ref FROM application_references r JOIN seat_applications a ON a.id = r.application_ref WHERE a.candidate_user_id = ?",
    [userId],
  );
  const refs = new Set([...rows, ...own].map((r: any) => String(r.application_ref)));
  return clearReviewOf(db, Array.from(refs), at);
}

// ── Holders of a role, live ─────────────────────────────────────────────────

/** The members holding a role now. Examples and documented holders left out. */
export async function liveHoldersOfRole(db: Db, roleId: string): Promise<string[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT DISTINCT user_id FROM org_role_assignments WHERE org_role_id = ? AND ended_at IS NULL AND holder_kind = 'member' AND is_example = 0 AND user_id IS NOT NULL",
    [roleId],
  );
  return rows.map((r: any) => String(r.user_id));
}

/** The role ids a person holds now. */
export async function rolesHeldBy(db: Db, userId: string): Promise<string[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT DISTINCT org_role_id FROM org_role_assignments WHERE user_id = ? AND ended_at IS NULL AND holder_kind = 'member' AND is_example = 0",
    [userId],
  );
  return rows.map((r: any) => String(r.org_role_id));
}

/** A role's review setup from `org_roles`, when the columns exist (they arrive with the listing lane's migration). */
export async function roleSetup(db: Db, roleId: string): Promise<{ interviewerRoles: unknown; criteria: unknown; mode: unknown }> {
  // The list is `conversations` (brief v3), or `interviewer_roles` while the rename is in flight. Either, whichever exists.
  const [cols] = await db.query<RowDataPacket[]>(
    "SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'org_roles' AND COLUMN_NAME IN ('conversations','interviewer_roles','selection_criteria','conversation_mode')",
  );
  const have = new Set(cols.map((c: any) => String(c.c)));
  const list = have.has("conversations") ? "conversations" : have.has("interviewer_roles") ? "interviewer_roles" : null;
  const pick = [
    list ? `${list} AS conv_list` : "NULL AS conv_list",
    have.has("selection_criteria") ? "selection_criteria" : "NULL AS selection_criteria",
    have.has("conversation_mode") ? "conversation_mode" : "NULL AS conversation_mode",
  ];
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${pick.join(", ")} FROM org_roles WHERE id = ? LIMIT 1`, [roleId]);
  return { interviewerRoles: rows[0]?.conv_list ?? null, criteria: rows[0]?.selection_criteria ?? null, mode: rows[0]?.conversation_mode ?? null };
}

/** The names of roles in these circles that an AI agent holds now. Consent is a human act (D31): they are never asked, and the round says so. */
export async function agentRoleNamesInCircles(db: Db, circleIds: readonly string[]): Promise<string[]> {
  if (!circleIds.length) return [];
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT DISTINCT r.name FROM org_role_assignments a JOIN org_roles r ON r.id = a.org_role_id " +
      "WHERE a.ended_at IS NULL AND a.is_agent = 1 AND a.is_example = 0 AND r.is_example = 0 AND r.active = 1 AND r.circle_id IN (?) ORDER BY r.name",
    [[...circleIds]],
  );
  return rows.map((r: any) => String(r.name));
}

/**
 * Each role's booking link (`org_roles.booking_url`, 0362), read as `parseBookingUrl` allows it: an https
 * link or nothing. The applicant books a conversation through the link of the role that holds it.
 */
/**
 * EVERY APPLICATION'S STAGE STAMPS, the facts `stageHours` (shared/applicationStageTiming.ts) times: confirmed, the
 * shortlist's yes, references asked, each conversation's opening and write-up in order, and decided. From what is
 * already kept; the last year only. The caller turns them into averages and never shows one application's times.
 */
export async function stageTimes(db: Db, since: Date): Promise<StageTimingFacts[]> {
  const [apps] = await db.query<RowDataPacket[]>(
    "SELECT c.application_ref AS ref, UNIX_TIMESTAMP(c.stamped_at) AS confirmed_s, " +
      "(SELECT UNIX_TIMESTAMP(MIN(s.stamped_at)) FROM application_steps s WHERE s.application_ref = c.application_ref AND s.kind = 'shortlist' AND JSON_UNQUOTE(JSON_EXTRACT(s.detail_json, '$.answer')) = 'yes') AS yes_s, " +
      "(SELECT UNIX_TIMESTAMP(MIN(s.stamped_at)) FROM application_steps s WHERE s.application_ref = c.application_ref AND s.kind = 'refs_asked') AS asked_s, " +
      "(SELECT UNIX_TIMESTAMP(MIN(s.stamped_at)) FROM application_steps s WHERE s.application_ref = c.application_ref AND s.kind = 'decided') AS decided_s, " +
      "(SELECT JSON_UNQUOTE(JSON_EXTRACT(s.detail_json, '$.how')) FROM application_steps s WHERE s.application_ref = c.application_ref AND s.kind = 'decided' LIMIT 1) AS how, " +
      // Sent to the anchor circle (ruling 7), or, in flight before it, the consent round the last write-up opened.
      "(SELECT UNIX_TIMESTAMP(MIN(s.stamped_at)) FROM application_steps s WHERE s.application_ref = c.application_ref AND s.kind = 'to_circle') AS sent_s, " +
      "(SELECT UNIX_TIMESTAMP(MIN(s.stamped_at)) FROM application_steps s WHERE s.application_ref = c.application_ref AND s.kind = 'consent') AS consent_s, " +
      "(SELECT UNIX_TIMESTAMP(MIN(s.stamped_at)) FROM application_steps s WHERE s.application_ref = c.application_ref AND s.kind = 'scores_in') AS scores_s " +
      "FROM application_steps c WHERE c.kind = 'confirmed' AND c.stamped_at >= ? LIMIT 2000",
    [since],
  );
  if (!apps.length) return [];
  const [ivs] = await db.query<RowDataPacket[]>(
    "SELECT application_ref AS ref, is_final, state, UNIX_TIMESTAMP(opened_at) AS opened_s, UNIX_TIMESTAMP(scored_at) AS scored_s FROM application_interviews WHERE application_ref IN (?) ORDER BY application_ref, position",
    [apps.map((a: any) => String(a.ref))],
  );
  const ms = (v: unknown): number | null => (v === null || v === undefined ? null : Math.round(Number(v) * 1000));
  // The same facts the role progress page reads (server/repos/roleMeasures.ts), so both share one calculation:
  // a skipped conversation is done, a waiting final has not opened, and only an adoption ends Agreement.
  const byRef = new Map<string, Array<{ final: boolean; openedAt: number | null; scoredAt: number | null; skipped: boolean; waiting: boolean }>>();
  for (const r of ivs as any[]) {
    const list = byRef.get(String(r.ref)) ?? [];
    list.push({ final: Number(r.is_final) === 1, openedAt: ms(r.opened_s), scoredAt: ms(r.scored_s), skipped: String(r.state) === "skipped", waiting: String(r.state) === "waiting" });
    byRef.set(String(r.ref), list);
  }
  const [followed] = await db.query<RowDataPacket[]>(
    "SELECT application_ref AS ref, COUNT(*) AS n, SUM(followed_up_at IS NULL) AS open_n, UNIX_TIMESTAMP(MAX(followed_up_at)) AS last_s FROM application_references WHERE application_ref IN (?) GROUP BY application_ref",
    [apps.map((a: any) => String(a.ref))],
  );
  const allFollowed = new Map<string, number | null>((followed as any[]).map((r) => [String(r.ref), Number(r.n) > 0 && Number(r.open_n) === 0 ? ms(r.last_s) : null]));
  return (apps as any[]).map((a) => ({
    confirmedAt: ms(a.confirmed_s) ?? 0,
    shortlistYesAt: ms(a.yes_s),
    refsAskedAt: ms(a.asked_s),
    interviews: byRef.get(String(a.ref)) ?? [],
    decidedAt: ms(a.decided_s),
    door: String(a.ref).startsWith("op-") ? ("open" as const) : ("member" as const),
    refsAllFollowedUpAt: allFollowed.get(String(a.ref)) ?? null,
    adopted: a.how === "adopted",
    toCircleAt: ms(a.sent_s) ?? (a.consent_s != null && a.scores_s != null && Number(a.consent_s) >= Number(a.scores_s) ? ms(a.consent_s) : null),
  }));
}

/**
 * The village's anchor circle, by name (shared/circlePicker.ts `anchorCircleId`: the one marked, else the one that
 * coordinates the rest), or null when it has none. The applicant reads it at Agreement: "Your proposal is with ...".
 */
/** The village's anchor circle's id, or null when it marks none. */
export async function anchorCircleIdOf(db: Db): Promise<string | null> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT id, name, status, is_anchor, parent_circle_id, is_example FROM circles");
  const circles = rows.map((r: any) => ({ id: String(r.id), name: String(r.name ?? ""), status: r.status ?? null, isAnchor: !!r.is_anchor, parentCircleId: r.parent_circle_id ?? null, isExample: !!r.is_example }));
  return anchorCircleId(circles) ?? null;
}

export async function anchorCircleName(db: Db): Promise<string | null> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT id, name, status, is_anchor, parent_circle_id, is_example FROM circles");
  const circles = rows.map((r: any) => ({ id: String(r.id), name: String(r.name ?? ""), status: r.status ?? null, isAnchor: !!r.is_anchor, parentCircleId: r.parent_circle_id ?? null, isExample: !!r.is_example }));
  const id = anchorCircleId(circles);
  const name = id ? circles.find((c) => c.id === id)?.name.trim() : "";
  return name || null;
}

/**
 * WHEN AN APPLICATION'S ROLES STOP TAKING APPLICATIONS (the lead, 27 Nov 2026: "we review 1-2 weeks after the
 * application deadline"): the latest of its roles' card dates, YYYY-MM-DD, stamped at arrival; null when none set one.
 */
export async function applicationDeadline(db: Db, ref: string): Promise<string | null> {
  // The day stamped on the application at arrival (`beginReview`, from the role card's `sections.applyBy`): one source,
  // and a deadline changed or cleared later never re-times an application that already arrived (QA round 5).
  const [steps] = await db.query<RowDataPacket[]>("SELECT detail_json FROM application_steps WHERE application_ref = ? AND kind = 'confirmed' LIMIT 1", [ref]);
  const detail = steps[0]?.detail_json;
  const parsed = typeof detail === "string" ? (() => { try { return JSON.parse(detail); } catch { return null; } })() : detail;
  const d = typeof parsed?.applyBy === "string" ? parsed.applyBy : null;
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/** The review window opens a week after the deadline (the lead: "1-2 weeks after"); before that nothing is stalled. */
export const REVIEW_WINDOW_DAYS = 7;
/** When the review window opens: a week after the roles' deadline, or null when no role sets one. */
export function reviewWindowOpensAt(deadline: string | null): Date | null {
  return deadline ? new Date(new Date(`${deadline}T00:00:00Z`).getTime() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000) : null;
}
export function reviewWindowOpen(deadline: string | null, now: Date): boolean {
  const opens = reviewWindowOpensAt(deadline);
  return !opens || now.getTime() >= opens.getTime();
}

/**
 * WHEN THE 90-DAY CLOCK STARTS (the lead, 27 Nov 2026, asked whether the close waits for the review window: "Yes"):
 * at arrival, or, when a role it applies for sets "Applications close", when the review window opens (the deadline
 * plus `REVIEW_WINDOW_DAYS`, the nudges' own start), whichever is later. The close, its day-75 warning and the
 * status link's lifetime all count from here.
 */
export function closeClockStartOf(arrivedAt: Date, deadline: string | null): Date {
  const opens = reviewWindowOpensAt(deadline);
  return opens && opens.getTime() > arrivedAt.getTime() ? opens : arrivedAt;
}
export async function closeClockStart(db: Db, ref: string, arrivedAt: Date): Promise<Date> {
  return closeClockStartOf(arrivedAt, await applicationDeadline(db, ref).catch(() => null));
}

export async function bookingUrlsById(db: Db, ids: readonly string[]): Promise<Map<string, string | null>> {
  if (!ids.length) return new Map();
  const [rows] = await db.query<RowDataPacket[]>("SELECT id, booking_url FROM org_roles WHERE id IN (?)", [[...ids]]);
  return new Map(rows.map((r: any) => [String(r.id), parseBookingUrl(r.booking_url)]));
}

/**
 * The first name and saved booking link (`prefs.bookingUrl`) of each of these members. The link
 * comes back as stored; `stepBookingLinks` (shared/interviewBooking.ts) checks it. Nothing else of
 * the member leaves here, never an email address.
 */
export async function bookingLinksOfMembers(db: Db, userIds: readonly string[]): Promise<Array<{ userId: string; firstName: string | null; bookingUrl: unknown }>> {
  if (!userIds.length) return [];
  const [rows] = await db.query<RowDataPacket[]>("SELECT id, name, prefs FROM users WHERE id IN (?)", [[...userIds]]);
  return rows.map((r: any) => ({
    userId: String(r.id),
    firstName: holderFirstName(r.name) || null,
    bookingUrl: memberBookingUrl(json(r.prefs)),
  }));
}

/** The live roles on the org chart, by name: what a reference can be given to. Examples left out. */
export async function activeRoles(db: Db): Promise<Array<{ id: string; name: string }>> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT id, name FROM org_roles WHERE active = 1 AND is_example = 0 ORDER BY name, id LIMIT 300");
  return rows.map((r: any) => ({ id: String(r.id), name: String(r.name ?? r.id) }));
}

/** The members holding a live role now, by first name only: who a reference can be given to. Never an address. */
export async function membersHoldingRoles(db: Db): Promise<Array<{ id: string; name: string }>> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT DISTINCT u.id, u.name FROM org_role_assignments a JOIN users u ON u.id = a.user_id " +
      "WHERE a.ended_at IS NULL AND a.holder_kind = 'member' AND a.is_example = 0 AND a.user_id IS NOT NULL ORDER BY u.name, u.id LIMIT 300",
  );
  return rows.map((r: any) => ({ id: String(r.id), name: holderFirstName(r.name) || "A member" }));
}

export async function roleNamesById(db: Db, ids: readonly string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const [rows] = await db.query<RowDataPacket[]>("SELECT id, name FROM org_roles WHERE id IN (?)", [[...ids]]);
  return new Map(rows.map((r: any) => [String(r.id), String(r.name ?? r.id)]));
}
