/**
 * THE TREASURER'S PAY BOARD, AND THE REVIEW OF A MOON LINE'S TOKEN SHARES.
 * The rule and its words are shared/moonRewardReview.ts.
 *
 *   payBoard        every member's cash lines and token lines approved in one month
 *   adjustReward    a Treasurer or founder changes a token line, with a reason the member reads
 *   approveRewards  approve token lines; after the launch vote they issue at once
 *   myRewards       a member's own token lines, with any change and its reason
 *   replyToReward   the member answers a change
 *
 * Who may review is `payChangeConfirmers`: every live holder of the cash
 * power and of approve-alone (the founders' and stewards' circles), never the
 * member, read from live seats (`keyHolders`) the way the End of Moon
 * approval reads them (server/lib/moonReview.ts). An admin who holds neither
 * through a seat is refused here, even where the one gate's admin pass opens
 * the review door (security lane, #1349 S3 8).
 *
 * Approving and changing decide on rows they hold locked, in the transaction
 * that writes them (`withRewardRows`, server/repos/moonRewardReviews.ts says
 * why that closes both races the review found).
 *
 * Nothing here moves cash. A cash line reads as the existing record writes
 * it (`cash_owed`); its "sent" is the transfer a holder of the cash power
 * records (`recordCashTransfer`, server/lib/cashOwed.ts).
 */
import type { Pool } from "mysql2/promise";
import {
  NO_APPROVER_WORDS, REWARD_NOTICE_WORDS, REWARD_REVIEW_LIMITS, REWARD_REVIEW_REFUSALS, cashLineStatus, cashTotals, monthBounds, readRewardAdjust, readRewardKeys,
  rewardAdjustRefusal, rewardApproveRefusal, rewardCeiling, tokenLineStatus, tokenTotals,
  type PayBoard, type PayBoardCashLine, type PayBoardMember, type PayBoardTokenLine,
} from "../../shared/moonRewardReview";
import { APPROVE_ALONE_CAPABILITY, INVOICE_APPROVE_CAPABILITY, payChangeConfirmers, type InvoiceLine } from "../../shared/moonRecap";
import {
  awaitingWithoutReview, recordRewardReviews, rewardLinesBetween, rewardLinesByKeys, rewardLinesFor, replyToRewardChange, withRewardRows, writeRewardApproval,
  writeRewardChange, type RewardLineRow,
} from "../repos/moonRewardReviews";
import { cashOwedRowsBetween } from "../repos/cashOwed";
import { invoicesByIds } from "../repos/moonRecaps";
import { rowToCashEntry } from "./cashOwed";
import { MOON_REWARD_SOURCE, settleNoCashInvoices, settleRewardKeys } from "./moonReward";
import { readGameStart } from "./gameStart";
import { fromLedgerUnits, toLedgerUnits } from "./economy";
import { departedById } from "./departed";
import type { KeyHolders, Notice } from "./moonReview";
import type { SettleOutcome } from "../repos/questOwedPostings";

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; error: string };
const refuse = (status: number, error: string) => ({ ok: false as const, status, error });

/** One board reads at most this many lines of each kind for a month, and says so when it is cut. */
export const PAY_BOARD_LIMIT = 2000;

export interface RewardReviewDeps {
  keyHolders: KeyHolders;
  notify(n: Notice): Promise<unknown>;
  nameOf(userId: string): Promise<string>;
  recordEvent(e: { kind: "audit"; text: string; actorUserId: string; entityType: string; entityRef: string; audience: "admin" }): Promise<unknown>;
}

/** Everyone who may review token pay through a live seat, before any member is taken out. */
export async function rewardReviewers(keyHolders: KeyHolders): Promise<string[]> {
  const [pay, alone] = await Promise.all([keyHolders(INVOICE_APPROVE_CAPABILITY), keyHolders(APPROVE_ALONE_CAPABILITY)]);
  return payChangeConfirmers({ pay, alone }, "");
}

const iso = (s: number | null): string | null => (s == null ? null : new Date(s * 1000).toISOString());
const whole = (token: string, units: number): number => fromLedgerUnits(token, units);

/**
 * A share recorded before reviews existed has no review row: the migration moved
 * it to `awaiting`, and this gives it one, read off its invoice line, so it is
 * reviewed like any other (security lane, #1349 S3 5). Idempotent.
 */
export async function reviewUnreviewed(pool: Pool): Promise<number> {
  const rows = await awaitingWithoutReview(pool, MOON_REWARD_SOURCE);
  if (rows.length === 0) return 0;
  const invoiceIdOf = (claimId: string) => (claimId.startsWith("moon:") ? claimId.slice(5) : claimId);
  const invoices = new Map((await invoicesByIds(pool, Array.from(new Set(rows.map((r) => invoiceIdOf(r.claimId)))))).map((i) => [i.id, i]));
  await recordRewardReviews(pool, rows.map((r) => {
    const inv = invoices.get(invoiceIdOf(r.claimId));
    let line: InvoiceLine | undefined;
    try {
      line = inv ? (JSON.parse(inv.linesJson) as InvoiceLine[]).find((l) => l.key === r.sourceRef) : undefined;
    } catch {
      line = undefined;
    }
    return {
      idempotencyKey: r.key, invoiceId: invoiceIdOf(r.claimId), userId: r.userId, tokenSlug: r.token, unitsShared: r.units, lineKey: r.sourceRef,
      // No line to read: 0 holds the share where it is (it can be approved, never raised).
      lineTotalMinor: line?.reward?.totalMinor ?? 0, cashMinor: line?.reward?.cashMinor ?? 0, currency: line?.currency ?? inv?.currency ?? "",
    };
  }));
  return rows.length;
}

/** The ceiling for one share, from its line's other share as it stands. Null when it has no review. */
function ceilingOf(r: RewardLineRow, mates: readonly RewardLineRow[]): number | null {
  if (!r.review) return null;
  const other = mates.filter((m) => m.key !== r.key && m.claimId === r.claimId && m.sourceRef === r.sourceRef && m.postingState !== "refused");
  return rewardCeiling({ lineTotalMinor: r.review.lineTotalMinor, cashMinor: r.review.cashMinor, otherUnits: other.reduce((n, m) => n + whole(m.token, m.units), 0) });
}

function tokenLine(r: RewardLineRow, all: readonly RewardLineRow[], launched: boolean, nameOf: (id: string) => string | null, noApprover: boolean): PayBoardTokenLine {
  const rv = r.review;
  return {
    key: r.key,
    title: r.description,
    token: r.token,
    sharedUnits: whole(r.token, rv ? rv.unitsShared : r.units),
    units: whole(r.token, r.units),
    ceiling: ceilingOf(r, all),
    status: tokenLineStatus({ postingState: r.postingState, launched }),
    review: rv?.state ?? null,
    change: rv && rv.unitsSet != null ? { by: rv.setBy ? nameOf(rv.setBy) : null, reason: rv.setReason ?? "", at: iso(rv.setAt) } : null,
    approvedBy: rv?.approvedBy ? nameOf(rv.approvedBy) : null,
    approvedAt: iso(rv?.approvedAt ?? null),
    approvedAlone: rv?.approvedAlone ?? false,
    memberReply: rv?.memberReply ? { text: rv.memberReply, at: iso(rv.memberReplyAt) } : null,
    refusal: r.postingState === "refused" || (r.postingState === "owed" && r.lastError) ? r.lastError : null,
    noApprover: noApprover && r.postingState === "awaiting",
    createdAt: iso(r.createdAt) as string,
  };
}

/** Every member's pay approved in one month: cash with where it stands, and token lines with their reviews. */
export async function payBoard(pool: Pool, viewerId: string, month: string, deps: Pick<RewardReviewDeps, "keyHolders" | "nameOf">): Promise<PayBoard> {
  await reviewUnreviewed(pool);
  const { from, to } = monthBounds(month);
  const [fromS, toS] = [Math.floor(from.getTime() / 1000), Math.floor(to.getTime() / 1000)];
  const [cashAll, tokenAll, start, reviewers] = await Promise.all([
    cashOwedRowsBetween(pool, fromS, toS, PAY_BOARD_LIMIT),
    rewardLinesBetween(pool, MOON_REWARD_SOURCE, fromS, toS, PAY_BOARD_LIMIT),
    readGameStart(pool),
    rewardReviewers(deps.keyHolders),
  ]);
  const truncated = cashAll.length > PAY_BOARD_LIMIT || tokenAll.length > PAY_BOARD_LIMIT;
  const cashRows = cashAll.slice(0, PAY_BOARD_LIMIT);
  const tokenRows = tokenAll.slice(0, PAY_BOARD_LIMIT);
  const ids = new Set<string>([...cashRows.map((r) => String(r.user_id)), ...tokenRows.map((r) => r.userId)]);
  for (const r of cashRows) if (r.paid_by) ids.add(String(r.paid_by));
  for (const r of tokenRows) for (const u of [r.review?.setBy, r.review?.approvedBy]) if (u) ids.add(u);
  const names = new Map<string, string>();
  await Promise.all(Array.from(ids).map(async (id) => names.set(id, await deps.nameOf(id).catch(() => ""))));
  const nameOf = (id: string) => names.get(id) || null;

  const byMember = new Map<string, PayBoardMember>();
  const member = (userId: string): PayBoardMember => {
    let m = byMember.get(userId);
    if (!m) {
      m = { userId, name: nameOf(userId) ?? "", cash: [], tokens: [], cashTotals: [], tokenTotals: [] };
      byMember.set(userId, m);
    }
    return m;
  };
  for (const r of cashRows) {
    const e = rowToCashEntry(r);
    const line: PayBoardCashLine = {
      id: e.id, title: e.workTitle, workKind: e.workKind, amountMinor: e.amountMinor, currency: e.currency,
      status: cashLineStatus(e.state), owedAt: e.owedAt, claimedAt: e.claimedAt, sentAt: e.paidAt,
      sentBy: r.paid_by ? nameOf(String(r.paid_by)) : null, reference: e.paidNote,
    };
    member(String(r.user_id)).cash.push(line);
  }
  for (const r of tokenRows) {
    const noApprover = reviewers.filter((u) => u !== r.userId).length === 0;
    member(r.userId).tokens.push(tokenLine(r, tokenRows, start.started, nameOf, noApprover));
  }
  const members = Array.from(byMember.values());
  for (const m of members) {
    m.cashTotals = cashTotals(m.cash);
    m.tokenTotals = tokenTotals(m.tokens);
  }
  members.sort((a, b) => a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId));
  return { month, launched: start.started, mayReview: reviewers.includes(viewerId), viewerId, members, truncated };
}

/** Whether this person may review token pay through a live seat (security lane, #1349 S3 8). */
export async function isLiveReviewer(keyHolders: KeyHolders, userId: string): Promise<boolean> {
  return (await rewardReviewers(keyHolders)).includes(userId);
}

/**
 * CHANGE A TOKEN LINE, up or down, with a reason. The member is told and can
 * answer. The line goes back to awaiting, so it is approved again, by a second
 * person while two or more may (`rewardApproveRefusal`).
 */
export async function adjustReward(pool: Pool, actorId: string, body: unknown, deps: RewardReviewDeps): Promise<Outcome<{ key: string; units: number }>> {
  const input = readRewardAdjust(body);
  if (!input.ok) return refuse(400, input.error);
  await reviewUnreviewed(pool);
  const reviewers = await rewardReviewers(deps.keyHolders);
  type Done = { ok: true; line: RewardLineRow; from: number } | { ok: false; status: number; error: string };
  const done = await withRewardRows<Done>(pool, MOON_REWARD_SOURCE, [input.key], async (conn, rows, mates) => {
    const line = rows[0];
    if (!line || !line.review) return refuse(404, REWARD_REVIEW_REFUSALS.notFound);
    const no = rewardAdjustRefusal({ actorId, memberId: line.userId, confirmers: reviewers.filter((u) => u !== line.userId) });
    if (no) return refuse(403, no);
    if (line.postingState !== "awaiting" && line.postingState !== "owed") return refuse(409, REWARD_REVIEW_REFUSALS.notOwed);
    if (await departedById(conn, line.userId)) return refuse(409, REWARD_REVIEW_REFUSALS.departed);
    const max = ceilingOf(line, mates) ?? 0;
    if (input.units > max) return refuse(400, REWARD_REVIEW_REFUSALS.ceiling(Math.max(0, max)));
    await writeRewardChange(conn, { key: line.key, units: toLedgerUnits(line.token, input.units), reason: input.reason, by: actorId });
    return { ok: true, line, from: whole(line.token, line.units) };
  });
  if (!done.ok) return done;
  const { line, from } = done;
  await deps.recordEvent({ kind: "audit", text: `moon_reward:set:${line.key}:${from}->${input.units}`.slice(0, 1000), actorUserId: actorId, entityType: "moon_reward", entityRef: line.key.slice(0, 191), audience: "admin" });
  await deps.notify({
    userId: line.userId,
    type: "moon_review",
    title: REWARD_NOTICE_WORDS.changedTitle,
    body: REWARD_NOTICE_WORDS.changedBody(line.description, from, input.units, input.reason),
    link: "/my-moon#token-pay",
    actorUserId: actorId,
    dedupeKey: `moon_reward:set:${line.key}:${input.units}:${Date.now()}`.slice(0, 191),
  }).catch(() => undefined);
  return { ok: true, value: { key: line.key, units: input.units } };
}

export interface ApprovedReward {
  key: string;
  outcome: "issued" | "issues_at_launch" | "still_owed" | "refused";
  message?: string;
}

/**
 * APPROVE TOKEN LINES, each checked alone, on rows held locked. Every line
 * must pass, or nothing is approved and the refusal names the line. After the
 * launch vote the approved lines issue at once, through the owed postings;
 * before it they issue at launch.
 */
export async function approveRewards(pool: Pool, actorId: string, body: unknown, deps: RewardReviewDeps): Promise<Outcome<{ approved: ApprovedReward[] }>> {
  const keys = readRewardKeys(body);
  if (!keys) return refuse(400, REWARD_REVIEW_REFUSALS.keys);
  await reviewUnreviewed(pool);
  const reviewers = await rewardReviewers(deps.keyHolders);
  type Done = { ok: true; lines: Array<{ line: RewardLineRow; alone: boolean }> } | { ok: false; status: number; error: string };
  const done = await withRewardRows<Done>(pool, MOON_REWARD_SOURCE, keys, async (conn, rows) => {
    if (rows.length !== keys.length || rows.some((l) => !l.review)) return refuse(404, REWARD_REVIEW_REFUSALS.notFound);
    const out: Array<{ line: RewardLineRow; alone: boolean }> = [];
    for (const l of rows) {
      const confirmers = reviewers.filter((u) => u !== l.userId);
      // Who changed it is read here, under the lock the approval writes under.
      const setBy = l.review!.unitsSet != null ? l.review!.setBy : null;
      const no = rewardApproveRefusal({ actorId, memberId: l.userId, setBy, confirmers });
      if (no) return refuse(403, `${l.description}: ${no}`);
      if (l.postingState !== "awaiting") return refuse(409, `${l.description}: ${l.postingState === "owed" ? REWARD_REVIEW_REFUSALS.approved : REWARD_REVIEW_REFUSALS.notOwed}`);
      if (await departedById(conn, l.userId)) return refuse(409, `${l.description}: ${REWARD_REVIEW_REFUSALS.departed}`);
      out.push({ line: l, alone: setBy === actorId });
    }
    for (const { line, alone } of out) await writeRewardApproval(conn, { key: line.key, by: actorId, alone });
    return { ok: true, lines: out };
  });
  if (!done.ok) return done;
  for (const { line, alone } of done.lines) {
    const units = whole(line.token, line.units);
    await deps.recordEvent({
      kind: "audit", text: `moon_reward:approved:${line.key}:${units}${alone ? ":alone" : ""}`.slice(0, 1000), actorUserId: actorId,
      entityType: "moon_reward", entityRef: line.key.slice(0, 191), audience: "admin",
    });
    if (alone) {
      // A lone approval is told to the circle that can seat a second person (security lane, #1349 S3 7).
      const who = await deps.nameOf(actorId).catch(() => "A Treasurer");
      for (const u of (await deps.keyHolders("steward.veto").catch(() => [] as string[])).filter((id) => id !== actorId)) {
        await deps.notify({
          userId: u, type: "moon_review", title: REWARD_NOTICE_WORDS.aloneTitle, body: REWARD_NOTICE_WORDS.aloneBody(who, line.description, units),
          link: "/cash-payouts#pay-board", actorUserId: actorId, dedupeKey: `moon_reward:alone:${line.key}:${units}:${u}`.slice(0, 191),
        }).catch(() => undefined);
      }
    }
  }
  const approvedKeys = done.lines.map((l) => l.line.key);
  const start = await readGameStart(pool);
  if (!start.started) return { ok: true, value: { approved: approvedKeys.map((key) => ({ key, outcome: "issues_at_launch" as const })) } };
  const settled = await settleRewardKeys(pool, approvedKeys);
  // An invoice whose pay was all tokens is Paid once every share it owes has posted (shared/moonRecap.ts, `noCashInvoicePaidFrom`).
  const invoiceIds = Array.from(new Set(done.lines.map((l) => l.line.review?.invoiceId).filter((x): x is string => !!x)));
  if (invoiceIds.length > 0) await settleNoCashInvoices(pool, invoiceIds, deps);
  const by = new Map<string, SettleOutcome>(settled.map((o) => [o.key, o]));
  return {
    ok: true,
    value: {
      approved: approvedKeys.map((key) => {
        const o = by.get(key);
        if (!o || o.outcome === "posted" || o.outcome === "duplicate") return { key, outcome: "issued" as const };
        // A change landed between the approval and the issue: it waits for approval again, and nothing issued.
        if (o.outcome === "not_owed") return { key, outcome: "still_owed" as const, message: REWARD_REVIEW_REFUSALS.changedFirst };
        return { key, outcome: o.outcome, message: o.message };
      }),
    },
  };
}

/** A member's own token lines, newest first, with any change and its reason. */
export async function myRewards(pool: Pool, userId: string, deps: Pick<RewardReviewDeps, "nameOf" | "keyHolders">): Promise<{ launched: boolean; lines: PayBoardTokenLine[]; noApproverWords: string }> {
  await reviewUnreviewed(pool);
  const [rows, start, reviewers] = await Promise.all([rewardLinesFor(pool, MOON_REWARD_SOURCE, userId), readGameStart(pool), rewardReviewers(deps.keyHolders)]);
  const names = new Map<string, string>();
  for (const r of rows) for (const u of [r.review?.setBy, r.review?.approvedBy]) if (u && !names.has(u)) names.set(u, await deps.nameOf(u).catch(() => ""));
  const noApprover = reviewers.filter((u) => u !== userId).length === 0;
  return { launched: start.started, lines: rows.map((r) => tokenLine(r, rows, start.started, (id) => names.get(id) || null, noApprover)), noApproverWords: NO_APPROVER_WORDS };
}

/** The member answers a change to their own token line. Whoever changed it is told. */
export async function replyToReward(pool: Pool, userId: string, body: unknown, deps: Pick<RewardReviewDeps, "notify">): Promise<Outcome<{ key: string }>> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const key = typeof b.key === "string" ? b.key.trim() : "";
  const text = typeof b.text === "string" ? b.text.replace(/\s+/g, " ").trim() : "";
  if (!text || text.length > REWARD_REVIEW_LIMITS.reply) return refuse(400, REWARD_REVIEW_REFUSALS.reply);
  const [line] = key ? await rewardLinesByKeys(pool, MOON_REWARD_SOURCE, [key]) : [];
  // Somebody else's line reads exactly like a line that does not exist.
  if (!line || !line.review || line.userId !== userId) return refuse(404, REWARD_REVIEW_REFUSALS.notFound);
  if (line.review.unitsSet == null) return refuse(409, REWARD_REVIEW_REFUSALS.notChanged);
  if (!(await replyToRewardChange(pool, { key, userId, text }))) return refuse(409, REWARD_REVIEW_REFUSALS.notChanged);
  if (line.review.setBy) {
    await deps.notify({
      userId: line.review.setBy,
      type: "moon_review",
      title: REWARD_NOTICE_WORDS.replyTitle,
      body: `${line.description}: ${text}`.slice(0, 1000),
      link: "/cash-payouts#pay-board",
      actorUserId: userId,
      dedupeKey: `moon_reward:reply:${key}:${Date.now()}`.slice(0, 191),
    }).catch(() => undefined);
  }
  return { ok: true, value: { key } };
}
