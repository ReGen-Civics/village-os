/**
 * WHAT A DECIDER READS ABOUT AN APPLICATION'S COMMITMENT (Rye, 14 Nov 2026): the commitment proposed,
 * what the role pays at it (straight proportional to the full band), their optional ask, and plain
 * arithmetic of how full each role would be: held now, and with this application.
 *
 * Plain facts beside each other. Nothing here ranks, scores or picks anyone, and nothing that pays reads
 * it: the contract sets the pay.
 */
import type { Pool } from "mysql2/promise";
import { ceilingAt, type PayAsk } from "../../shared/commitmentRange";
import { currentCommitment, type CounterOffer } from "../../shared/counterOffer";
import type { PayCeiling } from "../../shared/roleCardSections";
import { sectionsForMany } from "./roleCardSections";
import { roleFillsFor } from "./roleFill";

export interface CommitmentReviewRole {
  roleId: string;
  /** The full role's ceiling, when the card writes one. */
  full: PayCeiling | null;
  /** The most the role pays at the proposed commitment, in the full ceiling's currency and period. */
  atCommitment: number | null;
  heldPct: number;
  targetPct: number;
  /** What the others hold now plus this application's commitment: an applicant who holds the role already counts once (QA F7). */
  withThisPct: number;
}

export interface CommitmentReview {
  /** The commitment the applicant proposed. */
  pct: number | null;
  /**
   * The commitment as it stands after a counter-offer changed it, when it differs from `pct` (QA 15 Nov 2026,
   * Treasurer audit): the figure that would be signed, and the one `atCommitment` and `withThisPct` are worked at.
   */
  offeredPct?: number | null;
  ask: PayAsk | null;
  /** How many changes they suggested to the role card (shared/pieceSuggestions.ts). A count, never a judgement. */
  suggestionCount: number;
  roles: CommitmentReviewRole[];
}

export async function commitmentReviewFor(
  pool: Pool,
  body: { roles: Array<{ roleId: string }>; card?: { commitmentPct?: number }; payAsk?: PayAsk; pieceSuggestions?: unknown[]; counterOffer?: CounterOffer },
  liveRoles: ReadonlyArray<{ id: string; commitmentTarget?: number | null }>,
  /** The applicant's own account here, if their address has one. */
  applicantUserId: string | null = null,
): Promise<CommitmentReview> {
  const pct = typeof body.card?.commitmentPct === "number" ? body.card.commitmentPct : null;
  const atPct = commitmentInForce(body);
  const ids = body.roles.map((r) => r.roleId);
  const roles = ids.map((id) => liveRoles.find((r) => r.id === id) ?? { id, commitmentTarget: null });
  const [fills, others, sections] = await Promise.all([
    roleFillsFor(pool, roles),
    applicantUserId ? roleFillsFor(pool, roles, applicantUserId) : null,
    sectionsForMany(pool, ids),
  ]);
  return {
    pct,
    ...(atPct !== pct ? { offeredPct: atPct } : {}),
    ask: body.payAsk ?? null,
    suggestionCount: Array.isArray(body.pieceSuggestions) ? body.pieceSuggestions.length : 0,
    roles: roles.map((r) => {
      const fill = fills.get(r.id);
      const full = sections.get(r.id)?.payCeiling ?? null;
      const held = fill?.heldPct ?? 0;
      const heldByOthers = (others ?? fills).get(r.id)?.heldPct ?? 0;
      return {
        roleId: r.id,
        full,
        atCommitment: full && atPct ? ceilingAt(full.amount, atPct) : null,
        heldPct: held,
        targetPct: fill?.targetPct ?? 100,
        withThisPct: heldByOthers + (atPct ?? 0),
      };
    }),
  };
}

/**
 * The commitment that would be signed: the applicant's, with every counter-offer revision applied, the same reading
 * the adoption signs (`agreedTerms`, shared/openProposalDecide.ts). Before this, a decider who countered 50% with 30%
 * still read "at 50%, the role pays up to" and the coverage at 50%, while the contract recorded 30%.
 */
export function commitmentInForce(body: { card?: { commitmentPct?: number }; counterOffer?: CounterOffer }): number | null {
  const theirs = typeof body.card?.commitmentPct === "number" ? body.card.commitmentPct : null;
  const now = currentCommitment(theirs, body.counterOffer ?? null);
  return typeof now === "number" && Number.isFinite(now) ? now : null;
}
