/**
 * PAID ON WHAT WE TRULY ACCOMPLISH, AT THE END OF MOON (Rye, 14 Nov 2026).
 *
 * "At the end of every moon cycle our knowledge base system is tracking what
 * our goals were, how much progress I made towards my own set goals, but also
 * how many tasks we were actually doing, in tasks you're not even part of, so
 * all of that could be added together to inform your compensation at the end
 * if it's too far off what you originally agreed."
 *
 * Three parts, all facts and none of them a score:
 *
 *   1. `accomplishedComparison` sets what was agreed (each role's pay before
 *      any change, and the member's moon goals) beside what was delivered
 *      (goals done or partly done, and every task done this moon, per role and
 *      outside the member's roles), in one plain sentence.
 *   2. `farOffOf` raises a flag when the two are far apart, by a fixed rule and
 *      a village dial (`moon_review.far_off_pct`). The flag asks a person to
 *      look. It never moves money.
 *   3. A Treasurer may propose a different amount for a pay line, with a
 *      reason (`LineAdjust`). The member sees it, may reply, and re-sends;
 *      approval refuses until a Treasurer confirms (`adjustUnconfirmed`),
 *      the same confirm step as the split (#1239).
 *
 * No AI selects, ranks or scores anyone here. Every amount is typed by a
 * person. With no goals and no tasks there is nothing to compare: no flag, and
 * pay stays the terms. Counts only reach the Treasurer's queue: no percentage,
 * band or reading (Phase C decision 2 holds; the coordinator, 14 Nov 2026).
 */
import { moneyWords } from "./seatSettings";
import type { InvoiceLine, MoonGoal, RecapItem } from "./moonRecap";

/** The village dial, in whole percent. */
export const FAR_OFF_KEY = "moon_review.far_off_pct";
export const FAR_OFF_DEFAULT = 25;
export const FAR_OFF_MIN = 5;
export const FAR_OFF_MAX = 100;

// ── The Treasurer's proposed amount ─────────────────────────────────────────

/** A Treasurer's proposed amount on one pay line, the member's reply, and the confirmation. */
export interface LineAdjust {
  /** The amount the terms (and any split) gave, before the proposal. */
  baseMinor: number;
  /** The proposed amount. Equals the line's `amountMinor` once the member re-sends. */
  adjustedMinor: number;
  reason: string;
  proposedBy: string;
  proposedAt: string;
  /** What the member wrote back when they re-sent, or null. */
  reply: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
}

/** What carries from a voided revision to the next send, by application id. */
export type AdjustProposals = Readonly<Record<string, Pick<LineAdjust, "adjustedMinor" | "reason" | "proposedBy" | "proposedAt">>>;

export const ADJUST_REASON_MAX = 500;
export const ADJUST_REPLY_MAX = 500;

/** Can a Treasurer propose an amount on this line? A pay line that carries money in a currency. Allowances and listed lines never. */
export function adjustableLine(l: Pick<InvoiceLine, "kind" | "basis" | "currency" | "amountMinor">): boolean {
  return l.kind === "pay" && l.basis !== "listed" && !!l.currency && l.amountMinor !== null;
}

/**
 * Put the Treasurer's proposals on freshly drafted lines. The base is what the
 * line came to without it (terms, then split). A proposal for a line that is
 * gone, or no longer adjustable, is dropped, and pay is the terms.
 */
export function applyAdjusts(lines: readonly InvoiceLine[], proposals: AdjustProposals, reply: string | null = null): InvoiceLine[] {
  return lines.map((l) => {
    const p = Object.prototype.hasOwnProperty.call(proposals, l.applicationId) ? proposals[l.applicationId] : undefined;
    if (!p || !adjustableLine(l) || !Number.isInteger(p.adjustedMinor) || p.adjustedMinor < 0) return { ...l };
    const base = l.amountMinor as number;
    return {
      ...l,
      amountMinor: p.adjustedMinor,
      basisLine: `${l.basisLine}. ${ACCOMPLISHED_WORDS.adjustBasis(moneyWords(p.adjustedMinor, l.currency as string))}`,
      adjust: { baseMinor: base, adjustedMinor: p.adjustedMinor, reason: p.reason, proposedBy: p.proposedBy, proposedAt: p.proposedAt, reply, confirmedBy: null, confirmedAt: null },
    };
  });
}

/** The proposals a voided revision carries forward, read off its lines. */
export function adjustsFrom(lines: readonly InvoiceLine[]): Record<string, Pick<LineAdjust, "adjustedMinor" | "reason" | "proposedBy" | "proposedAt">> {
  const out: Record<string, Pick<LineAdjust, "adjustedMinor" | "reason" | "proposedBy" | "proposedAt">> = {};
  for (const l of lines) if (l.adjust) out[l.applicationId] = { adjustedMinor: l.adjust.adjustedMinor, reason: l.adjust.reason, proposedBy: l.adjust.proposedBy, proposedAt: l.adjust.proposedAt };
  return out;
}

/** Does any line carry a proposal no Treasurer has confirmed, or one changed since? */
export function adjustUnconfirmed(lines: readonly InvoiceLine[]): boolean {
  return lines.some((l) => !!l.adjust && (!l.adjust.confirmedAt || l.adjust.adjustedMinor !== l.amountMinor));
}

/** Stamp a Treasurer's confirmation on every line carrying a proposal. */
export function confirmAdjustLines(lines: readonly InvoiceLine[], by: string, at: string): InvoiceLine[] {
  return lines.map((l) => (l.adjust ? { ...l, adjust: { ...l.adjust, confirmedBy: by, confirmedAt: at } } : { ...l }));
}

/** Read a Treasurer's proposal from a request. Null amount withdraws it. */
export function parseAdjustInput(body: unknown): { ok: true; applicationId: string; amountMinor: number | null; reason: string } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const applicationId = typeof b.applicationId === "string" ? b.applicationId : "";
  if (!applicationId) return { ok: false, error: ADJUST_REFUSALS.noLine };
  const reason = typeof b.reason === "string" ? b.reason.replace(/\s+/g, " ").trim() : "";
  if (!reason) return { ok: false, error: ADJUST_REFUSALS.reason };
  if (reason.length > ADJUST_REASON_MAX) return { ok: false, error: ADJUST_REFUSALS.reasonLong };
  if (b.amountMinor === null) return { ok: true, applicationId, amountMinor: null, reason };
  const amountMinor = Number(b.amountMinor);
  if (!Number.isInteger(amountMinor) || amountMinor < 0) return { ok: false, error: ADJUST_REFUSALS.amount };
  return { ok: true, applicationId, amountMinor, reason };
}

/** The member's reply when re-sending: one line of their own words, or null. */
export function parseAdjustReply(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const r = raw.replace(/\s+/g, " ").trim();
  return r ? r.slice(0, ADJUST_REPLY_MAX) : null;
}

export const ADJUST_REFUSALS = {
  noLine: "Choose the role's pay line to change.",
  notAdjustable: "Only a pay line with an amount can change. Allowances and listed lines stay as they are.",
  reason: "Give a reason. The member reads it.",
  reasonLong: `A reason is at most ${ADJUST_REASON_MAX} characters.`,
  amount: "An amount is a whole number of minor units, zero or more.",
  ownPay: "Nobody proposes a change to their own pay.",
  unconfirmed: "This invoice carries a proposed amount. Confirm it first, then approve.",
} as const;

// ── Agreed beside delivered ─────────────────────────────────────────────────

export interface AccomplishedView {
  agreed: {
    /** Each pay line as agreed: the amount before any proposal. */
    lines: Array<{ roleNames: string[]; amountMinor: number; currency: string }>;
    totals: Array<{ currency: string; minor: number }>;
    goals: number;
  };
  goals: { done: number; partly: number; carried: number; letGo: number; open: number; total: number };
  tasks: { done: number; byRole: Array<{ roleId: string; name: string; count: number }>; outside: number };
  sentence: string;
  /** Null when nothing is far off, or when there is nothing to compare. */
  farOff: FarOff | null;
}

export interface FarOff {
  under: boolean;
  over: boolean;
  pct: number;
  lines: string[];
}

/**
 * THE FLAG. With the dial at T percent:
 *   Under: goal progress (done, and half of partly, over the goals scored
 *          done, partly or carried) is below 100 - T percent.
 *   Over:  T percent or more of the tasks done sat outside the member's roles.
 * Exactly at the edge is not flagged under, and is flagged over. Nothing to
 * count on a side never flags that side. A dial outside 5 to 100 is read as
 * the default, so the flag never vanishes on a typo.
 */
export function farOffOf(input: { goals: AccomplishedView["goals"]; tasks: Pick<AccomplishedView["tasks"], "done" | "outside"> }, dialPct: number): FarOff | null {
  const pct = Number.isInteger(dialPct) && dialPct >= FAR_OFF_MIN && dialPct <= FAR_OFF_MAX ? dialPct : FAR_OFF_DEFAULT;
  const { done, partly, carried } = input.goals;
  const den = done + partly + carried;
  // done + partly/2 < (100 - pct)% of den, in half-points so nothing drifts.
  const under = den > 0 && (done * 2 + partly) * 100 < (100 - pct) * den * 2;
  const over = input.tasks.done > 0 && input.tasks.outside * 100 >= pct * input.tasks.done;
  if (!under && !over) return null;
  const lines: string[] = [];
  if (under) lines.push(ACCOMPLISHED_WORDS.under(100 - pct));
  if (over) lines.push(ACCOMPLISHED_WORDS.over(input.tasks.outside, input.tasks.done));
  return { under, over, pct, lines };
}

/** Agreed beside delivered, for one member's moon. */
export function accomplishedComparison(input: {
  lines: readonly InvoiceLine[];
  goals: readonly Pick<MoonGoal, "status">[];
  items: readonly Pick<RecapItem, "state" | "taskStatus" | "roleId">[];
  roles: readonly { roleId: string; name: string }[];
  farOffPct: number;
}): AccomplishedView {
  const agreedLines: AccomplishedView["agreed"]["lines"] = [];
  for (const l of input.lines) {
    if (l.kind !== "pay" || !l.currency) continue;
    const amount = l.adjust ? l.adjust.baseMinor : l.amountMinor;
    if (amount === null || amount === undefined) continue;
    agreedLines.push({ roleNames: [...l.roleNames], amountMinor: amount, currency: l.currency });
  }
  const by = new Map<string, number>();
  for (const l of agreedLines) by.set(l.currency, (by.get(l.currency) ?? 0) + l.amountMinor);
  const totals = Array.from(by, ([currency, minor]) => ({ currency, minor })).sort((a, b) => a.currency.localeCompare(b.currency));

  const n = (s: MoonGoal["status"]) => input.goals.filter((g) => g.status === s).length;
  const goals = { done: n("done"), partly: n("partly"), carried: n("carried"), letGo: n("let_go"), open: n("open"), total: input.goals.length };

  const held = new Set(input.roles.map((r) => r.roleId));
  // A task done: a kept item marked Done, or a kept item with no status, which is work the member wrote down as
  // done (a hand-added item). Partly, Carry, Let go and Redirect are not done; dropped and suggested items are not kept.
  const doneItems = input.items.filter((i) => i.state === "kept" && (i.taskStatus === "done" || i.taskStatus === null));
  const byRole = input.roles.map((r) => ({ roleId: r.roleId, name: r.name, count: doneItems.filter((i) => i.roleId === r.roleId).length }));
  const outside = doneItems.filter((i) => !i.roleId || !held.has(i.roleId)).length;
  const tasks = { done: doneItems.length, byRole, outside };

  return {
    agreed: { lines: agreedLines, totals, goals: goals.total },
    goals,
    tasks,
    sentence: comparisonSentence(totals, goals, tasks),
    farOff: farOffOf({ goals, tasks }, input.farOffPct),
  };
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Agreed: $1,200.00 for 4 goals. Delivered: 2 of 4 goals done, 1 partly, plus 7 other tasks (3 outside your roles)." */
export function comparisonSentence(totals: AccomplishedView["agreed"]["totals"], goals: AccomplishedView["goals"], tasks: Pick<AccomplishedView["tasks"], "done" | "outside">): string {
  const money = totals.map((t) => moneyWords(t.minor, t.currency)).join(" and ");
  const agreed = money ? `Agreed: ${money} for ${plural(goals.total, "goal", "goals")}.` : `Agreed: ${plural(goals.total, "goal", "goals")}.`;
  const parts: string[] = [];
  if (goals.total > 0) parts.push(`${goals.done} of ${goals.total} goals done`);
  if (goals.partly > 0) parts.push(`${goals.partly} partly`);
  const other = `${plural(tasks.done, "other task", "other tasks")}${tasks.outside > 0 ? ` (${tasks.outside} outside your roles)` : ""}`;
  const delivered = parts.length ? `${parts.join(", ")}, plus ${other}` : other;
  return `${agreed} Delivered: ${delivered}.`;
}

export const ACCOMPLISHED_WORDS = {
  heading: "Agreed and delivered",
  agreed: "Agreed",
  goals: "Goals",
  tasksDone: "Tasks done",
  outside: "outside your roles",
  goalCounts: (g: AccomplishedView["goals"]) =>
    [`${g.done} done`, `${g.partly} partly`, `${g.carried} carried`, g.letGo ? `${g.letGo} let go` : "", g.open ? `${g.open} still open` : ""].filter(Boolean).join(" · "),
  noGoals: "No moon goals were set.",
  farOff: "Far from the agreement. Worth a look before paying.",
  under: (pct: number) => `Goal progress is under ${pct}%.`,
  over: (outside: number, done: number) => `${outside} of ${done} tasks done sat outside your roles.`,
  dialNote: (pct: number) => `"Far off" is ${pct}% either way, a village setting.`,
  facts: "These are counts of your own goals and tasks. People decide any change to pay.",
  // The proposal.
  propose: "Propose a different amount",
  withdraw: "Withdraw the proposal",
  amount: "Amount",
  reason: "Reason the member reads",
  send: "Send the proposal to the member",
  adjustBasis: (amount: string) => `The Treasurer proposes ${amount}`,
  base: "As agreed",
  proposed: "Proposed",
  reasonLabel: "Why",
  replyLabel: "Your reply",
  replyShown: "The member's reply",
  replyHint: "Optional. The Treasurer reads it before confirming.",
  waiting: "A Treasurer confirms this amount before it is paid.",
  confirmed: "The Treasurer confirmed this amount.",
  confirm: "Confirm the amount",
  confirmHint: "These lines carry a proposed amount. Read the member's reply, then confirm before you approve.",
  withdrawn: (role: string) => `The Treasurer withdrew the proposed amount for ${role}, so pay is as agreed. Send your invoice again`,
  returned: (role: string, amount: string, reason: string) => `The Treasurer proposes ${amount} for ${role}: ${reason}. Read it, reply if you want, and send your invoice again.`,
} as const;
