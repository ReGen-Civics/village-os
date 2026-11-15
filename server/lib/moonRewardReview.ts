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
 * member. The keys come from live seats (`keyHolders`), the same reading the
 * End of Moon approval uses (server/lib/moonReview.ts).
 *
 * Nothing here moves cash. A cash line reads as the existing record writes
 * it (`cash_owed`); its "sent" is the transfer a holder of the cash power
 * records (`recordCashTransfer`, server/lib/cashOwed.ts).
 */
import type { Pool } from "mysql2/promise";
import {
  REWARD_NOTICE_WORDS, REWARD_REVIEW_LIMITS, REWARD_REVIEW_REFUSALS, cashLineStatus, cashTotals, monthBounds, readRewardAdjust, readRewardKeys,
  rewardAdjustRefusal, rewardApproveRefusal, rewardCeiling, tokenLineStatus, tokenTotals,
  type PayBoard, type PayBoardCashLine, type PayBoardMember, type PayBoardTokenLine,
} from "../../shared/moonRewardReview";
import { APPROVE_ALONE_CAPABILITY, INVOICE_APPROVE_CAPABILITY, payChangeConfirmers } from "../../shared/moonRecap";
import { approveRewardReview, rewardLinesBetween, rewardLinesByKeys, rewardLinesFor, replyToRewardChange, setRewardUnits, type RewardLineRow } from "../repos/moonRewardReviews";
import { cashOwedRowsBetween } from "../repos/cashOwed";
import { rowToCashEntry } from "./cashOwed";
import { MOON_REWARD_SOURCE, settleRewardKeys } from "./moonReward";
import { readGameStart } from "./gameStart";
import { fromLedgerUnits, toLedgerUnits } from "./economy";
import type { KeyHolders, Notice } from "./moonReview";
import type { SettleOutcome } from "../repos/questOwedPostings";

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; error: string };
const refuse = (status: number, error: string) => ({ ok: false as const, status, error });

export interface RewardReviewDeps {
  keyHolders: KeyHolders;
  notify(n: Notice): Promise<unknown>;
  nameOf(userId: string): Promise<string>;
  recordEvent(e: { kind: "audit"; text: string; actorUserId: string; entityType: string; entityRef: string; audience: "admin" }): Promise<unknown>;
}

/** Everyone who may review token pay, before the member is taken out. */
export async function rewardReviewers(keyHolders: KeyHolders): Promise<string[]> {
  const [pay, alone] = await Promise.all([keyHolders(INVOICE_APPROVE_CAPABILITY), keyHolders(APPROVE_ALONE_CAPABILITY)]);
  return payChangeConfirmers({ pay, alone }, "");
}

const iso = (s: number | null): string | null => (s == null ? null : new Date(s * 1000).toISOString());
const whole = (token: string, units: number): number => fromLedgerUnits(token, units);

/** "Steward, November moon": the line's description reads as its title. */
function tokenLine(r: RewardLineRow, launched: boolean, nameOf: (id: string) => string | null): PayBoardTokenLine {
  const rv = r.review;
  return {
    key: r.key,
    title: r.description,
    token: r.token,
    sharedUnits: whole(r.token, rv ? rv.unitsShared : r.units),
    units: whole(r.token, r.units),
    ceiling: rv ? rewardCeiling(rv.lineTotalMinor) : null,
    status: tokenLineStatus({ postingState: r.postingState, review: rv?.state ?? null, launched }),
    review: rv?.state ?? null,
    change: rv && rv.unitsSet != null ? { by: rv.setBy ? nameOf(rv.setBy) : null, reason: rv.setReason ?? "", at: iso(rv.setAt) } : null,
    approvedBy: rv?.approvedBy ? nameOf(rv.approvedBy) : null,
    approvedAt: iso(rv?.approvedAt ?? null),
    approvedAlone: rv?.approvedAlone ?? false,
    memberReply: rv?.memberReply ? { text: rv.memberReply, at: iso(rv.memberReplyAt) } : null,
    refusal: r.postingState === "refused" || (r.postingState === "owed" && r.lastError) ? r.lastError : null,
    createdAt: iso(r.createdAt) as string,
  };
}

/** Every member's pay approved in one month: cash with where it stands, and token lines with their reviews. */
export async function payBoard(pool: Pool, viewerId: string, month: string, deps: Pick<RewardReviewDeps, "keyHolders" | "nameOf">): Promise<PayBoard> {
  const { from, to } = monthBounds(month);
  const [cashRows, tokenRows, start, reviewers] = await Promise.all([
    cashOwedRowsBetween(pool, from, to),
    rewardLinesBetween(pool, MOON_REWARD_SOURCE, from, to),
    readGameStart(pool),
    rewardReviewers(deps.keyHolders),
  ]);
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
  for (const r of tokenRows) member(r.userId).tokens.push(tokenLine(r, start.started, nameOf));
  const members = Array.from(byMember.values());
  for (const m of members) {
    m.cashTotals = cashTotals(m.cash);
    m.tokenTotals = tokenTotals(m.tokens);
  }
  members.sort((a, b) => a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId));
  return { month, launched: start.started, mayReview: reviewers.includes(viewerId), viewerId, members };
}

/**
 * CHANGE A TOKEN LINE, up or down, with a reason. The member is told and can
 * answer. The line goes back to waiting, so a second person approves it while
 * two or more may (`rewardApproveRefusal`).
 */
export async function adjustReward(pool: Pool, actorId: string, body: unknown, deps: RewardReviewDeps): Promise<Outcome<{ key: string; units: number }>> {
  const input = readRewardAdjust(body);
  if (!input.ok) return refuse(400, input.error);
  const [line] = await rewardLinesByKeys(pool, MOON_REWARD_SOURCE, [input.key]);
  if (!line || !line.review) return refuse(404, REWARD_REVIEW_REFUSALS.notFound);
  const no = rewardAdjustRefusal({ actorId, memberId: line.userId, confirmers: (await rewardReviewers(deps.keyHolders)).filter((u) => u !== line.userId) });
  if (no) return refuse(403, no);
  if (line.postingState !== "owed") return refuse(409, REWARD_REVIEW_REFUSALS.notOwed);
  const max = rewardCeiling(line.review.lineTotalMinor);
  if (input.units > max) return refuse(400, REWARD_REVIEW_REFUSALS.ceiling(max));
  const from = whole(line.token, line.units);
  if (!(await setRewardUnits(pool, { key: line.key, units: toLedgerUnits(line.token, input.units), reason: input.reason, by: actorId }))) {
    return refuse(409, REWARD_REVIEW_REFUSALS.notOwed);
  }
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
 * APPROVE TOKEN LINES, each checked alone. Every line must pass, or nothing is
 * approved and the refusal names the line. After the launch vote the approved
 * lines issue at once, through the owed postings; before it they issue at launch.
 */
export async function approveRewards(pool: Pool, actorId: string, body: unknown, deps: RewardReviewDeps): Promise<Outcome<{ approved: ApprovedReward[] }>> {
  const keys = readRewardKeys(body);
  if (!keys) return refuse(400, REWARD_REVIEW_REFUSALS.keys);
  const lines = await rewardLinesByKeys(pool, MOON_REWARD_SOURCE, keys);
  if (lines.length !== keys.length || lines.some((l) => !l.review)) return refuse(404, REWARD_REVIEW_REFUSALS.notFound);
  const reviewers = await rewardReviewers(deps.keyHolders);
  for (const l of lines) {
    const confirmers = reviewers.filter((u) => u !== l.userId);
    const no = rewardApproveRefusal({ actorId, memberId: l.userId, setBy: l.review!.unitsSet != null ? l.review!.setBy : null, confirmers });
    if (no) return refuse(403, `${l.description}: ${no}`);
    if (l.postingState !== "owed") return refuse(409, `${l.description}: ${REWARD_REVIEW_REFUSALS.notOwed}`);
    if (l.review!.state === "approved") return refuse(409, `${l.description}: ${REWARD_REVIEW_REFUSALS.approved}`);
  }
  const done: string[] = [];
  for (const l of lines) {
    const confirmers = reviewers.filter((u) => u !== l.userId);
    const alone = l.review!.unitsSet != null && l.review!.setBy === actorId && confirmers.length < 2;
    if (await approveRewardReview(pool, { key: l.key, by: actorId, alone })) done.push(l.key);
  }
  for (const key of done) {
    await deps.recordEvent({ kind: "audit", text: `moon_reward:approved:${key}`.slice(0, 1000), actorUserId: actorId, entityType: "moon_reward", entityRef: key.slice(0, 191), audience: "admin" });
  }
  const start = await readGameStart(pool);
  if (!start.started) return { ok: true, value: { approved: done.map((key) => ({ key, outcome: "issues_at_launch" as const })) } };
  const settled = await settleRewardKeys(pool, done);
  const by = new Map<string, SettleOutcome>(settled.map((o) => [o.key, o]));
  return {
    ok: true,
    value: {
      approved: done.map((key) => {
        const o = by.get(key);
        if (!o || o.outcome === "posted" || o.outcome === "duplicate" || o.outcome === "not_owed") return { key, outcome: "issued" as const };
        return { key, outcome: o.outcome, message: o.message };
      }),
    },
  };
}

/** A member's own token lines, newest first, with any change and its reason. */
export async function myRewards(pool: Pool, userId: string, deps: Pick<RewardReviewDeps, "nameOf">): Promise<{ launched: boolean; lines: PayBoardTokenLine[] }> {
  const [rows, start] = await Promise.all([rewardLinesFor(pool, MOON_REWARD_SOURCE, userId), readGameStart(pool)]);
  const names = new Map<string, string>();
  for (const r of rows) for (const u of [r.review?.setBy, r.review?.approvedBy]) if (u && !names.has(u)) names.set(u, await deps.nameOf(u).catch(() => ""));
  return { launched: start.started, lines: rows.map((r) => tokenLine(r, start.started, (id) => names.get(id) || null)) };
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
