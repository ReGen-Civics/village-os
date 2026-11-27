/**
 * EDITING AN OPEN ORG DRAFT (the draft page, PR D; 0437).
 *
 * The lead, 26 Nov 2026: the draft page shows the draft "with a clear before and after changes ... and ability
 * to edit". An edit changes the WORDS one change proposes for a role, as a new revision of the draft with a short
 * note. It never touches the live card: only a publish writes the card, through the door it always used.
 *
 * ── THE SAME RULES AS THE ROLE EDITOR ──────────────────────────────────────
 *
 * The words go through `parseRoleWords`, the parser the role editor and every proposal use, against the card as
 * it stands: the same fields, limits and refusals (payment details in words included). A word that now matches the
 * live card is no longer a change and leaves the draft. Pay, terms and who holds a role are not edited here.
 *
 * ── AN EDIT GIVES THE CHANGE A NEW ID ──────────────────────────────────────
 *
 * A publish sends back the change ids its reader was shown (`expectedChanges`). The revision rewrites the change
 * under a new id, so anybody who opened the draft before the edit is refused with "This draft changed since you
 * opened it" and reads it again. Nobody publishes words they did not read.
 *
 * ── CONSENT ────────────────────────────────────────────────────────────────
 *
 * Org drafts carry no consent today, so an edit has none to clear. When the Governance consent rounds hold a draft
 * (brief step 11), an edit clears its consents and tells each person; the hook for that is this function.
 */
import type { Pool } from "mysql2/promise";
import { ORG_DRAFT } from "../../shared/ballotSubjects";
import { normalWord, parseRoleWords } from "../../shared/roleProposals";
import { openBallotFor } from "./ballots";
import { draftUnderAVote, newOrgDraftId } from "./orgDrafts";
import { listOrgRoles } from "./orgChart";
import { ROLE_WORD_FIELDS } from "./roleProposals";
import { lockDraftRow } from "../repos/orgDrafts";
import { changeCount, changeForRevision, leaveOutInTransaction, reviseInTransaction } from "../repos/orgDraftRevisions";

export const NOTE_MAX = 280;

export const REVISE_WORDS = {
  noChange: "That change is not in this draft.",
  notOpen: (status: string) => `This draft is ${status} and can no longer be edited.`,
  notWords: "Only the words a change proposes for a role can be edited here.",
  nothing: "Nothing changed, so there is nothing to save.",
  noteLong: `Keep the note to ${NOTE_MAX} characters.`,
  emptied: "This would leave the change proposing nothing. Withdraw the draft instead.",
  lastOne: "This is the only change left in the draft. Withdraw the draft instead.",
} as const;

export type ReviseOutcome =
  | { ok: true; changeId: string; revision: number }
  | { ok: false; status: number; error: string; field?: string };

/** The ops whose words can be edited: an edit of a role, and a new role. */
const EDITABLE = new Set(["update_seat", "create_seat"]);

export async function reviseChange(pool: Pool, draftId: string, changeId: string, body: { words?: unknown; note?: unknown; leaveOut?: unknown }, userId: string): Promise<ReviseOutcome> {
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > NOTE_MAX) return { ok: false, status: 400, error: REVISE_WORDS.noteLong, field: "note" };
  const leaveOut = body.leaveOut === true;
  if (!leaveOut && (!body.words || typeof body.words !== "object" || Array.isArray(body.words))) return { ok: false, status: 400, error: "A role's words arrive as a set of fields.", field: "words" };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const fail = async (status: number, error: string, field?: string): Promise<ReviseOutcome> => {
      await conn.rollback();
      return { ok: false, status, error, ...(field ? { field } : {}) };
    };
    // The draft row first, the order publish and addChange lock in.
    await lockDraftRow(conn, draftId);
    const [[d]] = await conn.query<any[]>("SELECT status FROM org_drafts WHERE id = ?", [draftId]); // module-review-ok: the status read under this transaction's own lock, beside addChange's
    if (!d) return fail(404, "There is no draft by that id.");
    if (d.status !== "open") return fail(409, REVISE_WORDS.notOpen(String(d.status)));
    if (await openBallotFor(conn, ORG_DRAFT, draftId)) return fail(409, draftUnderAVote());
    const change = await changeForRevision(conn, draftId, changeId);
    if (!change) return fail(404, REVISE_WORDS.noChange);
    // LEAVE THIS ONE OUT: any change may be taken out, so one line that cannot be applied (a role id already used,
    // a circle not made yet) no longer holds back the rest. The rest publish; the one left out is kept in the
    // revision, words and all, so nothing is lost. The change ids move, so a stale publish is refused.
    if (leaveOut) {
      if ((await changeCount(conn, draftId)) <= 1) return fail(409, REVISE_WORDS.lastOne);
      const revision = await leaveOutInTransaction(conn, { id: newOrgDraftId("drev"), draftId, changeId, payloadBefore: { op: change.op, orgRoleId: change.orgRoleId, ...change.payload }, note: note || null, revisedBy: userId });
      await conn.commit();
      return { ok: true, changeId: "", revision };
    }
    if (!EDITABLE.has(change.op)) return fail(409, REVISE_WORDS.notWords);

    // Judged against the card as it stands, so a word equal to the live card is no longer a change.
    const live = change.op === "update_seat" ? ((await listOrgRoles(pool)).find((r) => r.id === change.orgRoleId) ?? null) : null;
    if (change.op === "update_seat" && !live) return fail(409, "The role this change edits is no longer on the chart.");
    const read = parseRoleWords(body.words, "words", ROLE_WORD_FIELDS, live as unknown as Record<string, unknown> | null);
    if (!read.ok) return fail(400, read.error, read.field);

    const next: Record<string, unknown> = { ...change.payload };
    for (const key of Object.keys(body.words as Record<string, unknown>)) {
      if (key in read.value) {
        const v = (read.value as Record<string, unknown>)[key];
        next[key] = v === null && ROLE_WORD_FIELDS.lists.has(key) ? [] : v;
      } else delete next[key];
    }
    const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    const touched = Object.keys(body.words as Record<string, unknown>).filter((k) => !same(normalWord(next[k] as any, ROLE_WORD_FIELDS.lists.has(k)), normalWord(change.payload[k] as any, ROLE_WORD_FIELDS.lists.has(k))) || (k in next) !== (k in change.payload));
    if (!touched.length) return fail(409, REVISE_WORDS.nothing);
    if (!Object.keys(next).length) return fail(409, REVISE_WORDS.emptied);

    const changeIdAfter = newOrgDraftId("dch");
    const revision = await reviseInTransaction(conn, {
      id: newOrgDraftId("drev"),
      draftId,
      changeIdBefore: changeId,
      changeIdAfter,
      payloadBefore: change.payload,
      payloadAfter: next,
      note: note || null,
      revisedBy: userId,
    });
    await conn.commit();
    return { ok: true, changeId: changeIdAfter, revision };
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}
