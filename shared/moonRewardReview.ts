/**
 * THE TREASURER'S PAY BOARD, AND THE REVIEW OF A MOON LINE'S TOKEN SHARES
 * (Rye, 15 Nov 2026: "the treasurer sections shows all the USD pay and if it's
 * been sent out from escrow - but also the token pay and approving or adjusting
 * those numbers (so equity is a bonus on the pay and it can be adjusted up or
 * down by the treasurer and founders and sent to their accounts)").
 *
 * USD. Every cash line a member is owed (`cash_owed`, drizzle/0285) reads in
 * three steps: owed (the End of Moon approval, or the settlement, wrote it),
 * claimed (the member said they are ready), sent from escrow (a holder of the
 * cash power recorded the transfer, with its date and reference). The payer's
 * invoice bills the cash only (Rye, 15 Nov 2026); the tokens are separate.
 *
 * TOKENS. An approved End of Moon invoice records its Earned Equity and
 * Credits shares as owed postings (server/lib/moonReward.ts). Each one now
 * waits for a review before it issues:
 *   - a Treasurer or a founder (`payChangeConfirmers`: the cash power and
 *     approve-alone, never the member) approves it as shared, or changes it
 *     up or down, with a reason the member reads and can answer;
 *   - a changed amount is approved by someone other than whoever changed it
 *     when two or more people may approve (P1-4); with one, they approve it
 *     and it is marked;
 *   - approved before the launch vote, it reads "issues at launch" and the
 *     launch pays it; approved after, it issues at once.
 * A share waiting for its review is `awaiting`, a posting state no payer
 * reads; approving it makes it `owed`, and a change makes it `awaiting` again
 * (the coordinator's ruling, 15 Nov 2026). A changed amount stays at or above
 * one whole unit (a posting is never zero, drizzle/0210), and the WHOLE LINE,
 * cash and Earned Equity and Credits together, stays at or under the pay cap
 * of its reward (`ROLE_PAY_CAP_PCT`, Rye's cap ruling; security lane, #1349
 * S2 3). Nothing here proposes an amount: the number is a person's.
 *
 * Pure: no pool, no clock.
 */
import { ROLE_PAY_CAP_PCT } from "./rolePayMath";

export type RewardReviewState = "waiting" | "approved";

/** Where one token line stands, for the board and the member. */
/** `approved` is after the launch, waiting on the hourly retry (a refusal that can change, such as Earned Equity's unwritten meaning). */
export type TokenLineStatus = "waiting" | "issues_at_launch" | "approved" | "issued" | "refused";

/** Where one cash line stands. */
export type CashLineStatus = "owed" | "claimed" | "sent";

export const PAY_BOARD_ROUTES = {
  board: "/api/moon-review/pay-board",
  adjust: "/api/moon-review/rewards/adjust",
  approve: "/api/moon-review/rewards/approve",
  mine: "/api/me/moon/rewards",
  reply: "/api/me/moon/rewards/reply",
} as const;

export const REWARD_REVIEW_LIMITS = { reason: 500, reply: 1000, approveAtOnce: 100 } as const;

export const REWARD_REVIEW_REFUSALS = {
  noKey: "Only a Treasurer or a founder approves or changes token pay.",
  ownPay: "Someone else approves or changes your own token pay.",
  notFound: "No token pay with that key.",
  notOwed: "This token pay has already issued, or was refused, so it can no longer change.",
  approved: "This token pay is already approved.",
  units: "Give the new amount as a whole number of at least 1.",
  ceiling: (max: number) => `A changed amount is at most ${max.toLocaleString("en-US")}, the pay cap of this line's whole reward.`,
  reason: `Say why the amount changed, in at most ${REWARD_REVIEW_LIMITS.reason} characters.`,
  otherApproves: "Someone other than the person who changed this amount approves it.",
  keys: `Pick at least one line, each once, and at most ${REWARD_REVIEW_LIMITS.approveAtOnce}.`,
  reply: `Write your answer, in at most ${REWARD_REVIEW_LIMITS.reply} characters.`,
  notChanged: "You can answer a change to your token pay once someone has changed it.",
  departed: "This member has left the village, so their token pay no longer changes or issues.",
  personOnly: "Token pay is approved and changed by a person, never through the connector.",
  liveKey: "The pay board is for a Treasurer or a founder seated in a live role.",
  changedFirst: "It changed before it issued, so it waits for approval again.",
} as const;

/** What a line says when nobody but its own member may approve it (security lane, #1349 S3 6). */
export const NO_APPROVER_WORDS =
  "Nobody but this member holds the power to approve it, so it waits. The stewards can seat another Treasurer, or the village can vote one in.";

/** What the member is told when their token pay changes. */
export const REWARD_NOTICE_WORDS = {
  changedTitle: "Your token pay for this moon changed",
  changedBody: (token: string, from: number, to: number, reason: string) =>
    `${token}: ${from.toLocaleString("en-US")} is now ${to.toLocaleString("en-US")}. ${reason}`,
  replyTitle: "A member answered a change to their token pay",
  aloneTitle: "Token pay was approved by the only person who could",
  aloneBody: (who: string, line: string, units: number) =>
    `${who} approved their own change to ${line}, ${units.toLocaleString("en-US")}, as the only Treasurer or founder who could.`,
} as const;

/** "2026-11": the month a board reads. Null for anything else. */
export function readMonth(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return null;
  return s;
}

/** The month as two instants: its first moment, and the first moment of the next, in UTC. */
export function monthBounds(month: string): { from: Date; to: Date } {
  const [y, m] = month.split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}

/** The month an instant falls in, in UTC. */
export const monthOf = (d: Date): string => d.toISOString().slice(0, 7);

/**
 * The most whole units one token share may be changed to: the pay cap of the
 * line's whole reward, less the line's cash share and less the line's other
 * token share as it stands. One unit per whole currency unit. Zero or below
 * means it cannot be changed up at all.
 */
export function rewardCeiling(f: { lineTotalMinor: number; cashMinor: number; otherUnits: number }): number {
  const capMinor = Math.floor((Math.max(0, f.lineTotalMinor) * ROLE_PAY_CAP_PCT) / 100);
  return Math.floor((capMinor - Math.max(0, f.cashMinor)) / 100) - Math.max(0, f.otherUnits);
}

export type RewardAdjustInput = { ok: true; key: string; units: number; reason: string } | { ok: false; error: string };

/** A change's body: the line's key, the new whole amount, and the reason. */
export function readRewardAdjust(body: unknown): RewardAdjustInput {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const key = typeof b.key === "string" ? b.key.trim() : "";
  if (!key || key.length > 191) return { ok: false, error: REWARD_REVIEW_REFUSALS.notFound };
  const units = typeof b.units === "number" ? b.units : typeof b.units === "string" && /^\d+$/.test(b.units.trim()) ? Number(b.units.trim()) : NaN;
  if (!Number.isSafeInteger(units) || units < 1) return { ok: false, error: REWARD_REVIEW_REFUSALS.units };
  const reason = typeof b.reason === "string" ? b.reason.replace(/\s+/g, " ").trim() : "";
  if (!reason || reason.length > REWARD_REVIEW_LIMITS.reason) return { ok: false, error: REWARD_REVIEW_REFUSALS.reason };
  return { ok: true, key, units, reason };
}

/** The keys an approval names: each once, at least one, at most `approveAtOnce`. Null when the list does not read. */
export function readRewardKeys(body: unknown): string[] | null {
  const raw = (body && typeof body === "object" ? (body as Record<string, unknown>).keys : null) as unknown;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > REWARD_REVIEW_LIMITS.approveAtOnce) return null;
  const keys = raw.map((k) => (typeof k === "string" ? k.trim() : ""));
  if (keys.some((k) => !k || k.length > 191) || new Set(keys).size !== keys.length) return null;
  return keys;
}

/**
 * Whether this person may approve this line, or why not. `confirmers` is
 * everyone who may approve it (never the member). A changed amount needs
 * someone other than whoever changed it, while two or more may approve.
 */
export function rewardApproveRefusal(f: { actorId: string; memberId: string; setBy: string | null; confirmers: readonly string[] }): string | null {
  if (f.actorId === f.memberId) return REWARD_REVIEW_REFUSALS.ownPay;
  if (!f.confirmers.includes(f.actorId)) return REWARD_REVIEW_REFUSALS.noKey;
  if (f.setBy && f.setBy === f.actorId && f.confirmers.length >= 2) return REWARD_REVIEW_REFUSALS.otherApproves;
  return null;
}

/** Whether this person may change this line, or why not. */
export function rewardAdjustRefusal(f: { actorId: string; memberId: string; confirmers: readonly string[] }): string | null {
  if (f.actorId === f.memberId) return REWARD_REVIEW_REFUSALS.ownPay;
  if (!f.confirmers.includes(f.actorId)) return REWARD_REVIEW_REFUSALS.noKey;
  return null;
}

/** Where a token line stands, read off the posting: `awaiting` waits for its review, `owed` is approved. */
export function tokenLineStatus(f: { postingState: "awaiting" | "owed" | "posted" | "refused"; launched: boolean }): TokenLineStatus {
  if (f.postingState === "posted") return "issued";
  if (f.postingState === "refused") return "refused";
  if (f.postingState === "awaiting") return "waiting";
  return f.launched ? "approved" : "issues_at_launch";
}

export function cashLineStatus(state: "owed" | "claimed" | "paid"): CashLineStatus {
  return state === "paid" ? "sent" : state;
}

/** One USD (or other currency) line on the board. */
export interface PayBoardCashLine {
  id: string;
  title: string;
  workKind: string;
  amountMinor: number;
  currency: string;
  status: CashLineStatus;
  owedAt: string;
  claimedAt: string | null;
  sentAt: string | null;
  /** Who recorded the transfer, by name. */
  sentBy: string | null;
  /** The transfer's date and reference, as recorded. */
  reference: string | null;
}

/** One Earned Equity or Credits line on the board. */
export interface PayBoardTokenLine {
  key: string;
  title: string;
  token: string;
  /** Whole units, as the split gave them. */
  sharedUnits: number;
  /** Whole units as they stand: changed, or as shared. */
  units: number;
  /** The most a change may set. Null for a line from before reviews. */
  ceiling: number | null;
  status: TokenLineStatus;
  review: RewardReviewState | null;
  change: { by: string | null; reason: string; at: string | null } | null;
  approvedBy: string | null;
  approvedAt: string | null;
  /** Approved by the person who changed it, the only one who could. */
  approvedAlone: boolean;
  memberReply: { text: string; at: string | null } | null;
  refusal: string | null;
  /** Nobody but the member may approve it: it waits until someone is seated (`NO_APPROVER_WORDS`). */
  noApprover: boolean;
  createdAt: string;
}

export interface PayBoardMoneyTotal {
  currency: string;
  owedMinor: number;
  sentMinor: number;
}

export interface PayBoardTokenTotal {
  token: string;
  waiting: number;
  approved: number;
  issued: number;
}

export interface PayBoardMember {
  userId: string;
  name: string;
  cash: PayBoardCashLine[];
  tokens: PayBoardTokenLine[];
  cashTotals: PayBoardMoneyTotal[];
  tokenTotals: PayBoardTokenTotal[];
}

export interface PayBoard {
  month: string;
  /** Whether the village has launched: before it, an approved token line issues at launch. */
  launched: boolean;
  /** Whether the viewer may approve and change token lines. */
  mayReview: boolean;
  viewerId: string;
  members: PayBoardMember[];
  /** The month held more lines than one board reads; the list is cut. */
  truncated: boolean;
}

/** Totals by currency: unpaid lines are owed, sent ones are sent. */
export function cashTotals(lines: readonly Pick<PayBoardCashLine, "amountMinor" | "currency" | "status">[]): PayBoardMoneyTotal[] {
  const by = new Map<string, PayBoardMoneyTotal>();
  for (const l of lines) {
    const t = by.get(l.currency) ?? { currency: l.currency, owedMinor: 0, sentMinor: 0 };
    if (l.status === "sent") t.sentMinor += l.amountMinor;
    else t.owedMinor += l.amountMinor;
    by.set(l.currency, t);
  }
  return Array.from(by.values()).sort((a, b) => a.currency.localeCompare(b.currency));
}

/** Totals by token: waiting for a review, approved and not yet issued, issued. A refused line counts in none. */
export function tokenTotals(lines: readonly Pick<PayBoardTokenLine, "token" | "units" | "status">[]): PayBoardTokenTotal[] {
  const by = new Map<string, PayBoardTokenTotal>();
  for (const l of lines) {
    const t = by.get(l.token) ?? { token: l.token, waiting: 0, approved: 0, issued: 0 };
    if (l.status === "waiting") t.waiting += l.units;
    else if (l.status === "issues_at_launch" || l.status === "approved") t.approved += l.units;
    else if (l.status === "issued") t.issued += l.units;
    by.set(l.token, t);
  }
  return Array.from(by.values()).sort((a, b) => a.token.localeCompare(b.token));
}
