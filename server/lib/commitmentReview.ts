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
  /** Held now plus this application's commitment. */
  withThisPct: number;
}

export interface CommitmentReview {
  pct: number | null;
  ask: PayAsk | null;
  /** How many changes they suggested to the role card (shared/pieceSuggestions.ts). A count, never a judgement. */
  suggestionCount: number;
  roles: CommitmentReviewRole[];
}

export async function commitmentReviewFor(
  pool: Pool,
  body: { roles: Array<{ roleId: string }>; card?: { commitmentPct?: number }; payAsk?: PayAsk; pieceSuggestions?: unknown[] },
  liveRoles: ReadonlyArray<{ id: string; commitmentTarget?: number | null }>,
): Promise<CommitmentReview> {
  const pct = typeof body.card?.commitmentPct === "number" ? body.card.commitmentPct : null;
  const ids = body.roles.map((r) => r.roleId);
  const roles = ids.map((id) => liveRoles.find((r) => r.id === id) ?? { id, commitmentTarget: null });
  const [fills, sections] = await Promise.all([roleFillsFor(pool, roles), sectionsForMany(pool, ids)]);
  return {
    pct,
    ask: body.payAsk ?? null,
    suggestionCount: Array.isArray(body.pieceSuggestions) ? body.pieceSuggestions.length : 0,
    roles: roles.map((r) => {
      const fill = fills.get(r.id);
      const full = sections.get(r.id)?.payCeiling ?? null;
      const held = fill?.heldPct ?? 0;
      return {
        roleId: r.id,
        full,
        atCommitment: full && pct ? ceilingAt(full.amount, pct) : null,
        heldPct: held,
        targetPct: fill?.targetPct ?? 100,
        withThisPct: held + (pct ?? 0),
      };
    }),
  };
}
