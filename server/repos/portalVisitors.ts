/**
 * THE SQL FOR A VISITOR'S PROFILE (migration 0434; the contract is shared/visitorProfile.ts).
 *
 * A visitor is a verified address on `portal_entries`; their profile reads across the entries made
 * at that address, the applications sent from it (`open_role_proposals`), the forms (`submissions`)
 * and the pages noted (`portal_views`). `portal_visitors` holds only the invitation request.
 */
import crypto from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { openBodyOf, OPEN_PROPOSAL_STATUSES, type OpenProposalStatus } from "../../shared/openProposals";
import { isInviteStatus, type InviteStatus } from "../../shared/visitorProfile";

export interface VisitorEntry {
  id: string;
  name: string;
  email: string;
  emailKey: string;
  whatsapp: string | null;
  link: string | null;
  interest: string | null;
  updates: "yes" | "no" | null;
  human: string;
  verifiedAt: Date;
  createdAt: Date;
}

const entryOf = (r: RowDataPacket): VisitorEntry => ({
  id: String(r.id),
  name: String(r.name),
  email: String(r.email),
  emailKey: String(r.email_key),
  whatsapp: r.whatsapp == null ? null : String(r.whatsapp),
  link: r.link == null ? null : String(r.link),
  interest: r.interest == null ? null : String(r.interest),
  updates: r.updates === "yes" || r.updates === "no" ? r.updates : null,
  human: String(r.human),
  verifiedAt: new Date(r.verified_at),
  createdAt: new Date(r.created_at),
});

const ENTRY_COLUMNS = "id, name, email, email_key, whatsapp, link, interest, updates, human, verified_at, created_at";

/** The newest verified, real entry at an address: the visitor's current details. Null when the address never proved itself. */
export async function latestVerifiedEntry(db: Pool, emailKey: string): Promise<VisitorEntry | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${ENTRY_COLUMNS} FROM portal_entries WHERE email_key = ? AND verified_at IS NOT NULL AND is_test = 0 ORDER BY created_at DESC, id DESC LIMIT 1`,
    [emailKey],
  );
  return rows[0] ? entryOf(rows[0]) : null;
}

/** Every entry id at an address, and when the first one was made. */
export async function entriesAt(db: Pool, emailKey: string): Promise<{ ids: string[]; firstSeen: Date | null; viaGoogle: boolean }> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT id, created_at, human FROM portal_entries WHERE email_key = ? AND is_test = 0 ORDER BY created_at ASC", [emailKey]);
  return {
    ids: rows.map((r) => String(r.id)),
    firstSeen: rows[0] ? new Date(rows[0].created_at) : null,
    viaGoogle: rows.some((r) => String(r.human) === "google"),
  };
}

/** A visitor's own changes to what they gave us, written to every entry at their address so Admin reads one person. */
export async function updateVisitorDetails(db: Pool, emailKey: string, d: { name?: string; whatsapp?: string | null; link?: string | null; interest?: string | null }): Promise<void> {
  const sets: string[] = [];
  const args: unknown[] = [];
  if (d.name !== undefined) {
    sets.push("name = ?");
    args.push(d.name);
  }
  if (d.whatsapp !== undefined) {
    sets.push("whatsapp = ?");
    args.push(d.whatsapp);
  }
  if (d.link !== undefined) {
    sets.push("link = ?");
    args.push(d.link);
  }
  if (d.interest !== undefined) {
    sets.push("interest = ?");
    args.push(d.interest);
  }
  if (!sets.length) return;
  await db.query(`UPDATE portal_entries SET ${sets.join(", ")} WHERE email_key = ? AND is_test = 0`, [...args, emailKey]);
}

/** The keep-in-touch answer: the newest one given at this address, or null when none was. */
export async function latestUpdatesAnswer(db: Pool, emailKey: string): Promise<"yes" | "no" | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT updates FROM portal_entries WHERE email_key = ? AND updates IS NOT NULL AND is_test = 0 ORDER BY created_at DESC LIMIT 1",
    [emailKey],
  );
  const u = rows[0]?.updates;
  return u === "yes" || u === "no" ? u : null;
}

// ── Applications sent from the address ──────────────────────────────────────

export interface ApplicationRow {
  id: string;
  status: OpenProposalStatus;
  roleIds: string[];
  createdAt: Date;
  decidedAt: Date | null;
  body: unknown;
  linkId: string | null;
}

/** The applications sent from this address, newest first. Anonymised ones have no address and are gone from here. */
export async function applicationsAt(db: Pool, emailKey: string): Promise<ApplicationRow[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id, status, body_json, link_id, UNIX_TIMESTAMP(created_at) AS created_s, UNIX_TIMESTAMP(decided_at) AS decided_s FROM open_role_proposals WHERE email_key = ? ORDER BY created_at DESC",
    [emailKey],
  );
  return rows.map((r) => {
    const raw = typeof r.body_json === "string" ? safeJson(r.body_json) : r.body_json;
    const body = openBodyOf(raw);
    const status = (OPEN_PROPOSAL_STATUSES as readonly string[]).includes(String(r.status)) ? (r.status as OpenProposalStatus) : "unconfirmed";
    return {
      id: String(r.id),
      status,
      roleIds: body.roles.map((x) => x.roleId),
      createdAt: new Date(Number(r.created_s) * 1000),
      decidedAt: r.decided_s == null ? null : new Date(Number(r.decided_s) * 1000),
      body: raw,
      linkId: r.link_id == null ? null : String(r.link_id),
    };
  });
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * The sender withdraws their own application, while it still waits on a decision. Stamped as
 * decided now, so the tidy job takes the name and address off it 90 days later.
 */
export async function withdrawByApplicant(db: Pool, id: string, emailKey: string, now: Date): Promise<boolean> {
  const [r] = await db.query<ResultSetHeader>(
    "UPDATE open_role_proposals SET status = 'withdrawn', decided_at = ?, confirm_hash = NULL WHERE id = ? AND email_key = ? AND status IN ('unconfirmed', 'confirmed')",
    [now, id, emailKey],
  );
  return Number(r.affectedRows ?? 0) === 1;
}

/** Every application still waiting at an address, withdrawn at once (a visitor deleting their data). How many. */
export async function withdrawAllWaiting(db: Pool, emailKey: string, now: Date): Promise<number> {
  const [r] = await db.query<ResultSetHeader>(
    "UPDATE open_role_proposals SET status = 'withdrawn', decided_at = ?, confirm_hash = NULL WHERE email_key = ? AND status IN ('unconfirmed', 'confirmed')",
    [now, emailKey],
  );
  return Number(r.affectedRows ?? 0);
}

// ── The invitation request ──────────────────────────────────────────────────

export interface VisitorRow {
  id: string;
  emailKey: string;
  inviteStatus: InviteStatus | null;
  inviteNote: string | null;
  requestedAt: Date | null;
  decidedAt: Date | null;
  declineWords: string | null;
  promotedUserId: string | null;
}

const visitorOf = (r: RowDataPacket): VisitorRow => ({
  id: String(r.id),
  emailKey: String(r.email_key),
  inviteStatus: isInviteStatus(r.invite_status) ? r.invite_status : null,
  inviteNote: r.invite_note == null ? null : String(r.invite_note),
  requestedAt: r.requested_at == null ? null : new Date(r.requested_at),
  decidedAt: r.decided_at == null ? null : new Date(r.decided_at),
  declineWords: r.decline_words == null ? null : String(r.decline_words),
  promotedUserId: r.promoted_user_id == null ? null : String(r.promoted_user_id),
});

export async function visitorAt(db: Pool, emailKey: string): Promise<VisitorRow | null> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM portal_visitors WHERE email_key = ? LIMIT 1", [emailKey]);
  return rows[0] ? visitorOf(rows[0]) : null;
}

export async function visitorById(db: Pool, id: string): Promise<VisitorRow | null> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM portal_visitors WHERE id = ? LIMIT 1", [id]);
  return rows[0] ? visitorOf(rows[0]) : null;
}

/** A request for an invitation: written once per address, asked again after a decline. */
export async function requestInvite(db: Pool, emailKey: string, note: string | null, at: Date): Promise<void> {
  const id = `pvp-${crypto.randomBytes(10).toString("hex")}`;
  await db.query(
    "INSERT INTO portal_visitors (id, email_key, invite_status, invite_note, requested_at, created_at) VALUES (?, ?, 'requested', ?, ?, ?) " +
      "ON DUPLICATE KEY UPDATE invite_status = 'requested', invite_note = VALUES(invite_note), requested_at = VALUES(requested_at), decided_at = NULL, decided_by = NULL, decline_words = NULL",
    [id, emailKey, note, at, at],
  );
}

/** Answer one request. Only a request still waiting is answered, so two stewards cannot both act on one. */
export async function decideInvite(db: Pool, id: string, d: { status: "declined" | "promoted"; by: string; at: Date; words?: string | null; userId?: string | null }): Promise<boolean> {
  const [r] = await db.query<ResultSetHeader>(
    "UPDATE portal_visitors SET invite_status = ?, decided_at = ?, decided_by = ?, decline_words = ?, promoted_user_id = ? WHERE id = ? AND invite_status = 'requested'",
    [d.status, d.at, d.by, d.words ?? null, d.userId ?? null, id],
  );
  return Number(r.affectedRows ?? 0) === 1;
}

/** Requests still waiting, oldest first, with the visitor's current details. */
export async function waitingRequests(db: Pool): Promise<Array<VisitorRow & { entry: VisitorEntry | null; applications: number; firstSeen: Date | null }>> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT * FROM portal_visitors WHERE invite_status = 'requested' ORDER BY requested_at ASC LIMIT 500");
  const out = [];
  for (const r of rows) {
    const v = visitorOf(r);
    const entry = await latestVerifiedEntry(db, v.emailKey);
    const [apps] = await db.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM open_role_proposals WHERE email_key = ? AND status <> 'unconfirmed'", [v.emailKey]);
    const { firstSeen } = await entriesAt(db, v.emailKey);
    out.push({ ...v, entry, applications: Number(apps[0]?.n ?? 0), firstSeen });
  }
  return out;
}

/** The visitor's request row goes when they delete their data or are forgotten. */
export async function deleteVisitorAt(db: Pool, emailKey: string): Promise<void> {
  await db.query("DELETE FROM portal_visitors WHERE email_key = ?", [emailKey]);
}
