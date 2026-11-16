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
 *     launch vote the rows stay owed and are paid later. An Earned Equity share
 *     is owed while the village's meaning for it is unwritten, and the ledger
 *     door refuses to issue it until the meaning is written (`owedPreflight`).
 *   - A share the hourly settlement already paid for one of the line's seats,
 *     this moon, in the same token, is not owed a second time (security
 *     audit, S1): one seat-moon is paid its tokens once, whichever door ran
 *     first. The settlement leaves these two tokens to the invoice for a seat
 *     held on an adopted application's money terms, so this guards a moon
 *     paid before that rule, or terms that changed.
 *   - Each share is recorded `awaiting`, its own state, and waits there for a
 *     Treasurer's or founder's review (Rye, 15 Nov 2026; the coordinator's
 *     ruling the same day; server/lib/moonRewardReview.ts). Approving it moves
 *     it to owed, and only then does anything pay it: the approval itself,
 *     the launch sweep or the hourly retry, which read owed rows only. A
 *     change moves it back to awaiting, under the same row lock settling
 *     takes, so a changed amount never pays without a second look.
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
import { CREDITS, EARNED_EQUITY, decimalsFor, faucetFor, keys, toLedgerUnits, villageId, type OwedPosting } from "./economy";
import { memberAccount } from "./ledger";
import { owedClaimIdsOfSource, recordOwed, settleOwedForClaim, settleOwedPosting, type SettleOutcome } from "../repos/questOwedPostings";
import { roleCycleLegsForApplication } from "../repos/tokenLedger";
import { recordRewardReviews, type RewardReviewInsert } from "../repos/moonRewardReviews";
import { sectionsForMany } from "./roleCardSections";
import { earnedEquityMeaningWritten } from "./valuationStore";
import { stringVar } from "./variables";
import { departedById } from "./departed";
import { readGameStart } from "./gameStart";

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
    out.push({ ...l, reward: shareLine(l.amountMinor, { contract: l.contractShape ?? [], card, village }, opts) });
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
 * meaning is owed here too, and waits at the ledger door until the meaning is
 * written (security audit, S3: it used to be dropped with no row). A share the
 * hourly settlement already paid for one of the line's seats is not owed again.
 * A member who has left is owed nothing.
 */
export async function recordLineRewards(
  conn: PoolConnection,
  p: { invoiceId: string; cycleId: string; userId: string; invoiceTitle: string; lines: readonly InvoiceLine[] },
): Promise<string[]> {
  const owed: OwedPosting[] = [];
  const reviews: RewardReviewInsert[] = [];
  for (const l of p.lines) {
    if (l.held || !l.reward) continue;
    const shares = [
      ...(l.reward.equityUnits > 0 ? [{ token: l.reward.tokens.equity, units: l.reward.equityUnits }] : []),
      ...(l.reward.creditsUnits > 0 ? [{ token: l.reward.tokens.credits, units: l.reward.creditsUnits }] : []),
    ];
    const bySettlement = shares.length > 0 ? await settledBySeat(conn, p.cycleId, l.applicationId, p.userId) : new Set<string>();
    for (const s of shares) {
      if (bySettlement.has(s.token)) {
        console.error(`[moon] line ${l.key} (${p.cycleId}): the moon's settlement already paid ${s.token} for this role this moon, so the invoice owes none of it`);
        continue;
      }
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
      reviews.push({
        idempotencyKey: lineRewardKey(p.cycleId, l.key, p.userId, s.token),
        invoiceId: p.invoiceId,
        userId: p.userId,
        tokenSlug: s.token,
        unitsShared: toLedgerUnits(s.token, s.units),
        lineKey: l.key,
        lineTotalMinor: l.reward.totalMinor,
        cashMinor: l.reward.cashMinor,
        currency: l.currency ?? "",
      });
    }
  }
  if (owed.length === 0 || (await departedById(conn, p.userId))) return [];
  // Each share waits, `awaiting`, for a Treasurer's or founder's review before anything may pay it (shared/moonRewardReview.ts).
  await recordOwed(conn, lineRewardClaimId(p.invoiceId), owed, "awaiting");
  await recordRewardReviews(conn, reviews);
  return owed.map((o) => o.idempotencyKey);
}

/**
 * The tokens the hourly settlement already paid one member for a seat held on
 * one application, in one cycle: the `role.cycle` keys it writes
 * (`keys.roleCycle`), compared byte for byte.
 */
async function settledBySeat(conn: PoolConnection, cycleId: string, applicationId: string, userId: string): Promise<Set<string>> {
  const out = new Set<string>();
  for (const r of await roleCycleLegsForApplication(conn, applicationId, memberAccount(userId))) {
    if (String(r.idempotency_key) === keys.roleCycle(villageId(), cycleId, String(r.seat_id), userId, String(r.token_type))) out.add(String(r.token_type));
  }
  return out;
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

/**
 * Pay these moon token lines, one row at a time, right after a review approved
 * them. A row still `awaiting` (a change landed first) is not owed, and moves nothing.
 */
export async function settleRewardKeys(pool: Pool, keys: readonly string[]): Promise<SettleOutcome[]> {
  const out: SettleOutcome[] = [];
  for (const key of keys) out.push(await settleOwedPosting(pool, key));
  for (const o of out) if (o.outcome === "still_owed" || o.outcome === "refused") console.error(`[moon] ${o.key}: ${o.outcome}, ${o.message}`);
  return out;
}

/**
 * Pay every moon line's token share still owed, when the launch vote carries.
 * An invoice approved before the vote records its Earned Equity and Credits as
 * owed (`recordLineRewards`), and nothing else ever comes back for them: the
 * steward's owed-postings press pays quest claims only, and answers 404 for a
 * moon claim. So the launch closer calls this once the Game has started.
 * Rows already posted move nothing, so calling it twice is safe.
 */
/**
 * The hourly retry of `settleOwedLineRewards`, once the Game has started (security lane review of
 * #1331). The launch closer's sweep runs once: a transient error at the close, a `still_owed`
 * outcome, or a share held until the village writes what Earned Equity means would otherwise
 * never be tried again. Answers the scheduler's one-line summary.
 */
export async function retryOwedLineRewards(pool: Pool): Promise<string> {
  if (!(await readGameStart(pool)).started) return "the Game has not started";
  const out = await settleOwedLineRewards(pool);
  const count = (o: SettleOutcome["outcome"]) => out.filter((x) => x.outcome === o).length;
  return `${count("posted")} posted, ${count("still_owed")} still owed, ${count("refused")} refused`;
}

export async function settleOwedLineRewards(pool: Pool): Promise<SettleOutcome[]> {
  const out: SettleOutcome[] = [];
  for (const claimId of await owedClaimIdsOfSource(pool, MOON_REWARD_SOURCE)) out.push(...(await settleOwedForClaim(pool, claimId)));
  for (const o of out) if (o.outcome === "still_owed" || o.outcome === "refused") console.error(`[moon] ${o.key}: ${o.outcome}, ${o.message}`);
  return out;
}
