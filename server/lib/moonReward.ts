/**
 * END OF MOON PAYS THE TOTAL REWARD IN ITS PARTS (Rye, 15 Nov 2026, P1-6:
 * "Total reward"). The rule and its words are shared/rewardShare.ts.
 *
 * Two steps, both on an approved invoice's pay lines:
 *   - `shareLines` puts each pay line's split on it, when the member sends the
 *     invoice (so the member and the Treasurer read the parts before anything
 *     is approved) and again at approval for a line whose figure moved since.
 *   - `recordLineRewards` records the Earned Equity and Credits shares as owed
 *     postings inside the approval's transaction, and `settleLineRewards`
 *     posts them through the ledger after it commits. The key is the cycle,
 *     the line and the member, the same three the line's cash key names, so a
 *     retried or repeated approval issues nothing twice. Before the village's
 *     launch vote the rows stay owed and are paid later, as a quest's are.
 * The cash share alone becomes cash owed (`oweApprovedRoleCash`, `cashOfLine`).
 *
 * An allowance line stays cash: it is a cost the role carries, not its reward.
 * Erasure is unchanged: a member who has left is issued nothing, as an
 * accepted proposal's pay is (server/lib/departed.ts).
 */
import type { Pool, PoolConnection } from "mysql2/promise";
import type { InvoiceLine } from "../../shared/moonRecap";
import { shareLine } from "../../shared/rewardShare";
import { readVillagePayShape } from "../../shared/roleCardSections";
import { CREDITS, EARNED_EQUITY, decimalsFor, faucetFor, toLedgerUnits, type OwedPosting } from "./economy";
import { recordOwed, settleOwedForClaim, type SettleOutcome } from "../repos/questOwedPostings";
import { sectionsForMany } from "./roleCardSections";
import { earnedEquityMeaningWritten } from "./valuationStore";
import { stringVar } from "./variables";
import { departedById } from "./departed";

/** The ledger's `source` for a moon line's token shares. */
export const MOON_REWARD_SOURCE = "moon_invoice_reward";

/** One line's token share's occurrence key. */
export function lineRewardKey(cycleId: string, lineKey: string, userId: string, token: string): string {
  return `${MOON_REWARD_SOURCE}:${cycleId}:${lineKey}:${userId}:${token}`;
}

/**
 * Each pay line with money, shared out; every other line as it was. A line
 * already shared at its current amount keeps its split, so an approval reads
 * what the member was shown when they sent it.
 */
export async function shareLines<L extends InvoiceLine>(pool: Pool, lines: readonly L[]): Promise<L[]> {
  const pay = lines.filter((l) => l.kind === "pay" && l.amountMinor !== null && l.amountMinor > 0 && !(l.reward && l.reward.totalMinor === l.amountMinor));
  if (pay.length === 0) return lines.map((l) => ({ ...l }));
  const sections = await sectionsForMany(pool, Array.from(new Set(pay.flatMap((l) => l.roleIds))));
  const village = readVillagePayShape(stringVar("org.pay_shape"));
  const opts = { equityMeaningWritten: earnedEquityMeaningWritten(), tokens: { equity: EARNED_EQUITY, credits: CREDITS } };
  const out: L[] = [];
  for (const l of lines) {
    if (!pay.includes(l)) {
      out.push({ ...l });
      continue;
    }
    // The first of the line's roles whose card writes a shape: one agreement, one split.
    const card = l.roleIds.map((id) => sections.get(id)?.payShape ?? []).find((s) => s.length > 0) ?? [];
    out.push({ ...l, reward: shareLine(l.amountMinor, { card, village }, opts) });
  }
  return out;
}

/** The owed postings' claim id for one approved invoice: at the width of `quest_owed_postings.claim_id`. */
export const lineRewardClaimId = (invoiceId: string): string => `moon:${invoiceId}`.slice(0, 64);

/**
 * The Earned Equity and Credits shares an approved invoice owes, as owed
 * postings (drizzle/0210, the same rows a quest consent writes): recorded on
 * the approval's own connection, inside its transaction, so the obligation
 * exists exactly when the approval does. Earned Equity held for its unwritten
 * meaning is not owed here. A member who has left is owed nothing.
 */
export async function recordLineRewards(
  conn: PoolConnection,
  p: { invoiceId: string; cycleId: string; userId: string; invoiceTitle: string; lines: readonly InvoiceLine[] },
): Promise<string[]> {
  const owed: OwedPosting[] = [];
  for (const l of p.lines) {
    if (l.held || !l.reward) continue;
    const shares = [
      ...(l.reward.equityUnits > 0 && !l.reward.equityHeld ? [{ token: l.reward.tokens.equity, units: l.reward.equityUnits }] : []),
      ...(l.reward.creditsUnits > 0 ? [{ token: l.reward.tokens.credits, units: l.reward.creditsUnits }] : []),
    ];
    for (const s of shares) {
      const from = faucetFor(s.token);
      if (!from) {
        console.error(`[moon] no faucet issues ${s.token}: line ${l.key} (${p.cycleId}) owes ${s.units} of it and records none`);
        continue;
      }
      owed.push({
        toUserId: p.userId,
        tokenSlug: s.token,
        units: toLedgerUnits(s.token, s.units),
        decimals: decimalsFor(s.token),
        from,
        source: MOON_REWARD_SOURCE,
        sourceRef: l.key,
        description: `${l.roleNames.join(", ")}, ${p.invoiceTitle}`,
        idempotencyKey: lineRewardKey(p.cycleId, l.key, p.userId, s.token),
      });
    }
  }
  if (owed.length === 0 || (await departedById(conn, p.userId))) return [];
  await recordOwed(conn, lineRewardClaimId(p.invoiceId), owed);
  return owed.map((o) => o.idempotencyKey);
}

/**
 * Pay what an approved invoice's lines owe in tokens, one row at a time, after
 * the approval commits. A refusal that can change (the village has not started
 * its Game) leaves the row owed, to be paid by the owed-postings press; one no
 * retry can change is marked refused and says why. Settled rows and replays
 * move nothing (server/repos/questOwedPostings.ts says why, three ways).
 */
export async function settleLineRewards(pool: Pool, invoiceId: string): Promise<SettleOutcome[]> {
  const out = await settleOwedForClaim(pool, lineRewardClaimId(invoiceId));
  for (const o of out) if (o.outcome === "still_owed" || o.outcome === "refused") console.error(`[moon] ${o.key}: ${o.outcome}, ${o.message}`);
  return out;
}
