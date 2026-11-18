/**
 * A PROPOSAL'S SPLIT AS STORED (the lead, 17 Nov 2026): the types and the tolerant reader, apart from the split's
 * arithmetic in shared/proposalSplit.ts. shared/openProposals.ts reads a stored body with this, and the client
 * imports that file on its key routes, so this file stays small and imports nothing: the arithmetic then loads
 * only with the controls that use it (scripts/route-first-view.json).
 *
 * Pure: no imports, no clock.
 */

/** One share of a split: its label, a whole percent and, when the split has a total, a whole amount. */
export interface SplitShare {
  label: string;
  pct: number;
  amount?: number;
}

/** A split at one total: the shares and the total they add up to (null when no price is readable). */
export interface Split {
  total: number | null;
  shares: SplitShare[];
}

/** What an application keeps: the village's offer at the person's commitment, and what they proposed. */
export interface ProposalSplit {
  commitmentPct: number | null;
  offered: Split;
  proposed: Split;
}

const whole = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

/** A split as stored, read tolerantly: anything unreadable is null. */
function splitOf(raw: unknown): Split | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.shares)) return null;
  const shares: SplitShare[] = [];
  for (const s of o.shares.slice(0, 12)) {
    if (!s || typeof s !== "object") return null;
    const x = s as Record<string, unknown>;
    if (typeof x.label !== "string" || !whole(x.pct)) return null;
    shares.push({ label: x.label.slice(0, 40), pct: x.pct, ...(whole(x.amount) ? { amount: x.amount } : {}) });
  }
  return { total: whole(o.total) ? o.total : null, shares };
}

/** The stored offered-and-proposed pair, read tolerantly. */
export function proposalSplitOf(raw: unknown): ProposalSplit | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const offered = splitOf(o.offered);
  const proposed = splitOf(o.proposed);
  if (!offered || !proposed || !proposed.shares.length) return null;
  return { commitmentPct: whole(o.commitmentPct) ? o.commitmentPct : null, offered, proposed };
}

