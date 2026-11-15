/**
 * `open_role_proposals` and `open_proposal_links` (0305). Every statement
 * open proposals run lives here, so the tables' readers and writers stay
 * enumerable: the route (server/routes/openProposals.ts) and its tidy job call
 * these and hold no SQL of their own. The contract is shared/openProposals.ts.
 *
 * Instants are written from Node's clock and read back with UNIX_TIMESTAMP,
 * as server/repos/roleProposals.ts does, so the database's own zone never
 * moves one. Raw SQL only, never `dbCollection`.
 *
 * THE DECISION RIDES IN THE BODY (part B). An adoption is recorded in words
 * that name a role, and under the authority it was made by (`org.seat@<role
 * id>`), and the account the invitation later makes carries that authority.
 * Both are written once, with the status, as two plain keys of `body_json`
 * (`decidedWords`, `decidedAuthority`), so part B needs no migration. The
 * body's reader (`openBodyOf`) never sees them, and they name nobody, so the
 * tidy job's anonymising leaves them as they are.
 */
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { openBodyOf, OPEN_PROPOSAL_STATUSES, type OpenProposalBody, type OpenProposalStatus } from "../../shared/openProposals";
import type { OpenDecision } from "../../shared/openProposalDecide";

type Db = Pool | PoolConnection;

export interface StoredOpenProposal {
  id: string;
  name: string | null;
  email: string | null;
  status: OpenProposalStatus;
  targetSeasonId: string | null;
  body: OpenProposalBody;
  linkId: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  decidedAt: Date | null;
  /** The decision in words and the authority it was made under, once decided (part B). */
  decision: OpenDecision;
  /** Kept although its confirmation email did not go: the address is not confirmed yet. Null for every other proposal. */
  addressUnconfirmed: AddressUnconfirmed | null;
}

/**
 * KEPT WHEN THE CONFIRMATION EMAIL DID NOT GO (Rye, 14 Nov 2026: "we still get
 * the application even if the email is broken"). The proposal is confirmed at
 * once, and this note rides in the body, beside the decision, so it needs no
 * migration: when it was kept and, once one has gone, when its confirmation
 * email went. No `sentAt` means one is still owed. Cleared when the address opens its link.
 */
export interface AddressUnconfirmed {
  since: Date;
  /** True until a confirmation email has gone to the address: no `sentAt` yet. */
  owed: boolean;
  /** When a confirmation email went, if one has. Absent from the body until then, never a JSON null. */
  sentAt: Date | null;
}

const dateOr = (v: unknown): Date | null => {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

function addressUnconfirmedOf(raw: unknown): AddressUnconfirmed | null {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>).addressUnconfirmed : null;
  if (!o || typeof o !== "object") return null;
  const n = o as Record<string, unknown>;
  const sentAt = dateOr(n.sentAt);
  return { since: dateOr(n.since) ?? new Date(0), owed: !sentAt, sentAt };
}

const COLUMNS =
  "id, name, email, status, target_season_id, body_json, link_id, " +
  "UNIX_TIMESTAMP(created_at) AS created_s, UNIX_TIMESTAMP(confirmed_at) AS confirmed_s, UNIX_TIMESTAMP(decided_at) AS decided_s";

const json = (v: unknown): unknown => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v;
};

const fromSeconds = (v: unknown): Date | null => (v === null || v === undefined ? null : new Date(Number(v) * 1000));

const textOr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** The decision kept in the body, whatever else the body holds. Never throws. */
function decisionOf(raw: unknown): OpenDecision {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return { words: textOr(o.decidedWords), authority: textOr(o.decidedAuthority) };
}

function rowOf(r: any): StoredOpenProposal {
  const status = (OPEN_PROPOSAL_STATUSES as readonly string[]).includes(String(r.status)) ? (r.status as OpenProposalStatus) : "unconfirmed";
  return {
    id: String(r.id),
    name: r.name ?? null,
    email: r.email ?? null,
    status,
    targetSeasonId: r.target_season_id ?? null,
    body: openBodyOf(json(r.body_json)),
    linkId: r.link_id ?? null,
    createdAt: fromSeconds(r.created_s) as Date,
    confirmedAt: fromSeconds(r.confirmed_s),
    decidedAt: fromSeconds(r.decided_s),
    decision: decisionOf(json(r.body_json)),
    addressUnconfirmed: addressUnconfirmedOf(json(r.body_json)),
  };
}

export async function insertOpenProposal(
  db: Db,
  /** An agent's proposal (0374) has no address: its keeper is signed in, and is told in the bell. */
  p: { id: string; name: string; email: string | null; emailKey: string | null; targetSeasonId: string | null; body: OpenProposalBody; confirmHash: string; linkId: string | null; now: Date },
): Promise<void> {
  await db.query(
    "INSERT INTO open_role_proposals (id, name, email, email_key, status, target_season_id, body_json, confirm_hash, link_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [p.id, p.name, p.email, p.emailKey, "unconfirmed", p.targetSeasonId, JSON.stringify(p.body), p.confirmHash, p.linkId, p.now],
  );
}

/** One proposal, or null. Pass a transaction's connection and `lock` to hold its row until commit. */
export async function readOpenProposal(db: Db, id: string, lock = false): Promise<StoredOpenProposal | null> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${COLUMNS} FROM open_role_proposals WHERE id = ? LIMIT 1${lock ? " FOR UPDATE" : ""}`, [id]);
  return rows[0] ? rowOf(rows[0]) : null;
}

/** Several proposals by id, in one read. */
export async function openProposalsByIds(db: Db, ids: readonly string[]): Promise<StoredOpenProposal[]> {
  if (!ids.length) return [];
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${COLUMNS} FROM open_role_proposals WHERE id IN (?)`, [[...ids]]);
  return rows.map(rowOf);
}

/**
 * WHEN AN ADOPTED PROPOSAL'S INVITATION LAST WENT, and whether the email did:
 * kept in the body beside the decision, so no column is needed. Each send
 * (the adoption, then every "send again") replaces it.
 */
export async function noteInvitationSent(db: Db, id: string, at: Date, emailed: boolean): Promise<void> {
  await db.query(
    "UPDATE open_role_proposals SET body_json = JSON_SET(COALESCE(body_json, JSON_OBJECT()), '$.invitationSentAt', ?, '$.invitationEmailed', ?) WHERE id = ? AND status = 'adopted'",
    [at.toISOString(), emailed ? 1 : 0, id],
  );
}

export async function invitationSentOf(db: Db, id: string): Promise<{ at: Date; emailed: boolean } | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT JSON_UNQUOTE(JSON_EXTRACT(body_json, '$.invitationSentAt')) AS at, JSON_EXTRACT(body_json, '$.invitationEmailed') AS emailed FROM open_role_proposals WHERE id = ? LIMIT 1",
    [id],
  );
  const raw = rows[0]?.at;
  if (!raw || raw === "null") return null;
  const at = new Date(String(raw));
  return Number.isNaN(at.getTime()) ? null : { at, emailed: Number(rows[0]?.emailed) === 1 };
}

/**
 * DECIDE A CONFIRMED PROPOSAL, once (part B): adopted or declined, the moment
 * it was decided, and the decision kept in the body. Guarded on `confirmed`, so
 * of two deciders at once exactly one moves it. True when this call did.
 */
export async function decideOpenProposal(
  db: Db,
  id: string,
  to: "adopted" | "declined",
  decision: OpenDecision,
  now: Date,
  note: string | null = null,
): Promise<boolean> {
  // A decider's note for the applicant rides in the same write, so it is there the moment the status is.
  const [result] = await db.query<ResultSetHeader>(
    "UPDATE open_role_proposals SET status = ?, decided_at = ?, " +
      "body_json = JSON_SET(COALESCE(body_json, JSON_OBJECT()), '$.decidedWords', ?, '$.decidedAuthority', ?" + (note ? ", '$.note', ?" : "") + ") " +
      "WHERE id = ? AND status = 'confirmed'",
    note ? [to, now, decision.words ?? "", decision.authority ?? "", note, id] : [to, now, decision.words ?? "", decision.authority ?? "", id],
  );
  return Number(result.affectedRows ?? 0) === 1;
}

/**
 * Rewrite a confirmed proposal's term to the moon running now (role journey L5,
 * "adopt for the moon running now"). Guarded on `confirmed`, so a decided
 * proposal is never changed under its decision. True when this call did.
 */
export async function rewriteTerm(db: Db, id: string, term: { startsOn: string; endsOn: string }): Promise<boolean> {
  const [result] = await db.query<ResultSetHeader>(
    "UPDATE open_role_proposals SET body_json = JSON_SET(COALESCE(body_json, JSON_OBJECT()), '$.term', JSON_OBJECT('kind', 'moon', 'startsOn', ?, 'endsOn', ?)) WHERE id = ? AND status = 'confirmed'",
    [term.startsOn, term.endsOn, id],
  );
  return Number(result.affectedRows ?? 0) === 1;
}

/**
 * Confirm the proposal a token's hash names: only an unconfirmed one made after
 * `notBefore`, and only once, because the hash is cleared as it is used. The
 * proposal it confirmed, or null.
 *
 * `addressUnconfirmed`: the server confirms it itself because its confirmation
 * email did not go, and the note that says so is written in the same UPDATE,
 * so the proposal is never confirmed without it.
 */
export async function confirmOpenProposal(db: Db, confirmHash: string, notBefore: Date, now: Date, opts: { addressUnconfirmed?: boolean } = {}): Promise<StoredOpenProposal | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM open_role_proposals WHERE confirm_hash = ? AND status = 'unconfirmed' AND created_at > ? LIMIT 1",
    [confirmHash, notBefore],
  );
  const id = rows[0]?.id ? String(rows[0].id) : null;
  if (!id) return null;
  const note = opts.addressUnconfirmed
    ? ", body_json = JSON_SET(COALESCE(body_json, JSON_OBJECT()), '$.addressUnconfirmed', JSON_OBJECT('since', ?))"
    : "";
  const [result] = await db.query<ResultSetHeader>(
    `UPDATE open_role_proposals SET status = 'confirmed', confirmed_at = ?, confirm_hash = NULL${note} WHERE id = ? AND status = 'unconfirmed' AND confirm_hash = ?`,
    opts.addressUnconfirmed ? [now, now.toISOString(), id, confirmHash] : [now, id, confirmHash],
  );
  if (Number(result.affectedRows ?? 0) !== 1) return null;
  return readOpenProposal(db, id);
}

/**
 * Put an adoption back, when the place it was to make could not be made: the
 * proposal waits on the village again, its decision cleared. Guarded on
 * `adopted`, and only ever called by the request that adopted it.
 */
export async function undoAdoption(db: Db, id: string): Promise<boolean> {
  const [result] = await db.query<ResultSetHeader>(
    "UPDATE open_role_proposals SET status = 'confirmed', decided_at = NULL, " +
      "body_json = JSON_REMOVE(COALESCE(body_json, JSON_OBJECT()), '$.decidedWords', '$.decidedAuthority', '$.note') WHERE id = ? AND status = 'adopted'",
    [id],
  );
  return Number(result.affectedRows ?? 0) === 1;
}

/** The proposals waiting with the village, or in any one status, oldest first. */
export async function listOpenProposals(db: Db, statuses: readonly OpenProposalStatus[], limit = 200): Promise<StoredOpenProposal[]> {
  if (statuses.length === 0) return [];
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${COLUMNS} FROM open_role_proposals WHERE status IN (${statuses.map(() => "?").join(",")}) ORDER BY created_at, id LIMIT ?`,
    [...statuses, Math.max(1, Math.trunc(limit))],
  );
  return rows.map(rowOf);
}

/** Every adopted proposal from one address (its folded key), oldest decision first. */
export async function adoptedForAddress(db: Db, emailKey: string): Promise<StoredOpenProposal[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${COLUMNS} FROM open_role_proposals WHERE status = 'adopted' AND email_key = ? ORDER BY decided_at, id`,
    [emailKey],
  );
  return rows.map(rowOf);
}

/** Every adopted proposal decided before `before` that still carries a name or an address. */
export async function adoptedDecidedBefore(db: Db, before: Date): Promise<StoredOpenProposal[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${COLUMNS} FROM open_role_proposals WHERE status = 'adopted' AND decided_at < ? AND anonymised_at IS NULL ORDER BY decided_at, id`,
    [before],
  );
  return rows.map(rowOf);
}

/** Take the name and address off one proposal, once. True when this call did. */
export async function anonymiseOpenProposal(db: Db, id: string, now: Date): Promise<boolean> {
  const [result] = await db.query<ResultSetHeader>(
    "UPDATE open_role_proposals SET body_json = JSON_REMOVE(COALESCE(body_json, JSON_OBJECT()), '$.card.timeZone', '$.card.windows', '$.card.earliestStart', '$.links', '$.files', '$.references', '$.backgroundCheck', '$.about', '$.note', '$.pieceSuggestions', '$.voice'), name = NULL, email = NULL, email_key = NULL, anonymised_at = ? WHERE id = ? AND anonymised_at IS NULL",
    [now, id],
  );
  return Number(result.affectedRows ?? 0) === 1;
}

/** Delete one proposal nobody could confirm, because its confirmation never went. Only while it is unconfirmed. */
export async function deleteOpenProposal(db: Db, id: string): Promise<void> {
  await db.query("DELETE FROM open_role_proposals WHERE id = ? AND status = 'unconfirmed'", [id]);
}

/**
 * Delete every proposal still unconfirmed that was made before `before`. How many went.
 * A proposal kept because its confirmation email did not go is confirmed, so it is never
 * one of these; the note is checked here too, so no path that leaves one unconfirmed loses it.
 */
export async function deleteUnconfirmedBefore(db: Db, before: Date): Promise<number> {
  const [result] = await db.query<ResultSetHeader>(
    "DELETE FROM open_role_proposals WHERE status = 'unconfirmed' AND created_at < ? AND JSON_EXTRACT(COALESCE(body_json, JSON_OBJECT()), '$.addressUnconfirmed') IS NULL",
    [before],
  );
  return Number(result.affectedRows ?? 0);
}

/**
 * The kept proposals whose address is still owed a confirmation email: still
 * waiting on the village, made after `since`, not anonymised, an address still
 * on the row, oldest first. The tidy job tries each again every hour.
 */
export async function owedConfirmations(db: Db, since: Date, limit = 50): Promise<StoredOpenProposal[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${COLUMNS} FROM open_role_proposals WHERE status = 'confirmed' AND created_at > ? AND anonymised_at IS NULL AND email IS NOT NULL ` +
      "AND JSON_EXTRACT(body_json, '$.addressUnconfirmed') IS NOT NULL AND JSON_EXTRACT(body_json, '$.addressUnconfirmed.sentAt') IS NULL ORDER BY created_at, id LIMIT ?",
    [since, Math.max(1, Math.trunc(limit))],
  );
  return rows.map(rowOf);
}

/**
 * A new confirmation link for a kept proposal, before its email goes: only the
 * hash is kept, and it replaces any earlier one. True when written.
 */
export async function setKeptConfirmHash(db: Db, id: string, confirmHash: string): Promise<boolean> {
  const [result] = await db.query<ResultSetHeader>(
    "UPDATE open_role_proposals SET confirm_hash = ? WHERE id = ? AND anonymised_at IS NULL AND JSON_EXTRACT(body_json, '$.addressUnconfirmed') IS NOT NULL",
    [confirmHash, id],
  );
  return Number(result.affectedRows ?? 0) === 1;
}

/** The confirmation email to a kept proposal went: nothing more is owed, and when it went is kept. */
export async function noteKeptConfirmationSent(db: Db, id: string, at: Date): Promise<void> {
  await db.query(
    "UPDATE open_role_proposals SET body_json = JSON_SET(body_json, '$.addressUnconfirmed.sentAt', ?) " +
      "WHERE id = ? AND JSON_EXTRACT(body_json, '$.addressUnconfirmed') IS NOT NULL",
    [at.toISOString(), id],
  );
}

/** The kept proposal a confirmation link's hash names, whatever its status, or null. */
export async function keptByConfirmHash(db: Db, confirmHash: string): Promise<StoredOpenProposal | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${COLUMNS} FROM open_role_proposals WHERE confirm_hash = ? AND status <> 'unconfirmed' AND anonymised_at IS NULL ` +
      "AND JSON_EXTRACT(body_json, '$.addressUnconfirmed') IS NOT NULL LIMIT 1",
    [confirmHash],
  );
  return rows[0] ? rowOf(rows[0]) : null;
}

/** The address of a kept proposal opened its link: the note goes, and the hash with it, once. True when this call did. */
export async function confirmKeptAddress(db: Db, id: string, confirmHash: string): Promise<boolean> {
  const [result] = await db.query<ResultSetHeader>(
    "UPDATE open_role_proposals SET confirm_hash = NULL, body_json = JSON_REMOVE(body_json, '$.addressUnconfirmed') WHERE id = ? AND confirm_hash = ? AND JSON_EXTRACT(body_json, '$.addressUnconfirmed') IS NOT NULL",
    [id, confirmHash],
  );
  return Number(result.affectedRows ?? 0) === 1;
}

/** Take the name and address off every declined or withdrawn proposal decided before `before`. How many. */
export async function anonymiseDecidedBefore(db: Db, before: Date, now: Date): Promise<number> {
  const [result] = await db.query<ResultSetHeader>(
    "UPDATE open_role_proposals SET body_json = JSON_REMOVE(COALESCE(body_json, JSON_OBJECT()), '$.card.timeZone', '$.card.windows', '$.card.earliestStart', '$.links', '$.files', '$.references', '$.backgroundCheck', '$.about', '$.note', '$.pieceSuggestions', '$.voice'), name = NULL, email = NULL, email_key = NULL, anonymised_at = ? " +
      "WHERE status IN ('declined', 'withdrawn') AND decided_at < ? AND anonymised_at IS NULL",
    [now, before],
  );
  return Number(result.affectedRows ?? 0);
}

/**
 * Close every confirmed proposal nobody decided before `before`, as withdrawn,
 * and take its name and address off in the same write. The form promises the
 * name and address go 90 days on; a proposal left waiting that long is as
 * good as a no. How many.
 */
export async function expireUndecidedBefore(db: Db, before: Date, now: Date): Promise<number> {
  const [result] = await db.query<ResultSetHeader>(
    "UPDATE open_role_proposals SET body_json = JSON_REMOVE(COALESCE(body_json, JSON_OBJECT()), '$.card.timeZone', '$.card.windows', '$.card.earliestStart', '$.links', '$.files', '$.references', '$.backgroundCheck', '$.about', '$.note', '$.voice'), status = 'withdrawn', decided_at = ?, name = NULL, email = NULL, email_key = NULL, anonymised_at = ? " +
      "WHERE status = 'confirmed' AND confirmed_at < ? AND anonymised_at IS NULL",
    [now, now, before],
  );
  return Number(result.affectedRows ?? 0);
}

// ── Links made for one person ───────────────────────────────────────────────

export interface StoredOpenLink {
  id: string;
  label: string;
  createdBy: string;
  createdAt: Date;
  revokedAt: Date | null;
}

const LINK_COLUMNS = "id, label, created_by, UNIX_TIMESTAMP(created_at) AS created_s, UNIX_TIMESTAMP(revoked_at) AS revoked_s";

const linkOf = (r: any): StoredOpenLink => ({
  id: String(r.id),
  label: String(r.label ?? ""),
  createdBy: String(r.created_by ?? ""),
  createdAt: fromSeconds(r.created_s) as Date,
  revokedAt: fromSeconds(r.revoked_s),
});

export async function insertOpenLink(db: Db, l: { id: string; tokenHash: string; label: string; createdBy: string; now: Date }): Promise<void> {
  await db.query("INSERT INTO open_proposal_links (id, token_hash, label, created_by, created_at) VALUES (?,?,?,?,?)", [l.id, l.tokenHash, l.label, l.createdBy, l.now]);
}

/** The link a token's hash names, only while it is switched on. */
export async function openLinkByHash(db: Db, tokenHash: string): Promise<StoredOpenLink | null> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${LINK_COLUMNS} FROM open_proposal_links WHERE token_hash = ? AND revoked_at IS NULL LIMIT 1`, [tokenHash]);
  return rows[0] ? linkOf(rows[0]) : null;
}

export async function listOpenLinks(db: Db, limit = 200): Promise<StoredOpenLink[]> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT ${LINK_COLUMNS} FROM open_proposal_links ORDER BY created_at DESC, id LIMIT ?`, [Math.max(1, Math.trunc(limit))]);
  return rows.map(linkOf);
}

/** Switch a link off. True when it was on. */
export async function revokeOpenLink(db: Db, id: string, now: Date): Promise<boolean> {
  const [result] = await db.query<ResultSetHeader>("UPDATE open_proposal_links SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL", [now, id]);
  return Number(result.affectedRows ?? 0) === 1;
}

/**
 * The proposals decided before `before` that still hold a voice note (shared/voiceNotes.ts). A voice
 * note goes 90 days after the decision whatever the decision was, even where the written application
 * is kept because its applicant joined.
 */
export async function voiceDecidedBefore(db: Db, before: Date): Promise<string[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM open_role_proposals WHERE decided_at < ? AND JSON_EXTRACT(body_json, '$.voice') IS NOT NULL ORDER BY decided_at, id",
    [before],
  );
  return rows.map((r) => String(r.id));
}

/** Take the voice note's record off these proposals. Call after their recordings are removed from disk. How many. */
export async function clearVoiceOf(db: Db, ids: readonly string[]): Promise<number> {
  if (!ids.length) return 0;
  const [result] = await db.query<ResultSetHeader>("UPDATE open_role_proposals SET body_json = JSON_REMOVE(body_json, '$.voice') WHERE id IN (?) AND JSON_EXTRACT(body_json, '$.voice') IS NOT NULL", [ids]);
  return Number(result.affectedRows ?? 0);
}

/** Which of these proposals still keep their links and files: rows that exist and are not anonymised (Rye, 10 Nov 2026). */
export async function proposalsKeepingFiles(db: Db, ids: readonly string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const [rows] = await db.query<RowDataPacket[]>("SELECT id FROM open_role_proposals WHERE id IN (?) AND anonymised_at IS NULL", [ids]);
  return new Set(rows.map((r) => String(r.id)));
}

/**
 * Write a proposal's counter-offer (shared/counterOffer.ts), whole. Guarded on `confirmed`, so a
 * decided proposal's terms never change under its decision. The caller holds the row lock
 * (`readOpenProposal(conn, id, true)`) and has checked the revision it read. True when written.
 */
export async function setCounterOffer(db: Db, id: string, counterOffer: unknown): Promise<boolean> {
  const [result] = await db.query<ResultSetHeader>(
    "UPDATE open_role_proposals SET body_json = JSON_SET(COALESCE(body_json, JSON_OBJECT()), '$.counterOffer', CAST(? AS JSON)) WHERE id = ? AND status = 'confirmed'",
    [JSON.stringify(counterOffer), id],
  );
  return Number(result.affectedRows ?? 0) === 1;
}
