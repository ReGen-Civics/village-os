/**
 * "THE ROLE IN ONE MINUTE" (the lead, 20 Nov 2026; the roles lane's idea 1): the top of every role card says
 * the goal, the next three deliverables, the commitment, the price and where, with the one act beside them.
 * The depth sits in the tabs below.
 *
 * Every word is the card's own. The goal is the role's own "Goal:" line from what the village needs from it
 * (`whyItMatters`), and the headlines are its dated deliverables (`sections.deliverables`). Nothing here
 * writes copy of its own.
 *
 * Pure: no pool, no clock, no Node builtins.
 */
import type { Deliverable } from "./roleDeliverables";

/** A "Goal: words" line, in any case, with or without a bullet. */
const GOAL = /^\s*(?:[-*•]\s+)?goal\s*:\s*(.+)$/i;

/**
 * The role's goal: the words after its first "Goal:" line, and its lines without that one, so the box below
 * the summary does not say it twice. No goal line: an empty goal and the lines as they were.
 */
export function goalOf(lines: readonly string[]): { goal: string; rest: string[] } {
  const at = lines.findIndex((l) => GOAL.test(l));
  if (at < 0) return { goal: "", rest: [...lines] };
  return { goal: (lines[at].match(GOAL)?.[1] ?? "").trim(), rest: lines.filter((_, i) => i !== at) };
}

/**
 * The next `n` deliverables by date: the ones still running or ahead of `today` (YYYY-MM-DD), soonest first.
 * When every one has passed, the last `n`, so a card read late still says what the role delivered.
 */
export function nextDeliverables(rows: readonly Deliverable[], today: string, n = 3): Deliverable[] {
  const byDate = [...rows].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
  const ahead = byDate.filter((d) => d.end >= today);
  return ahead.length ? ahead.slice(0, n) : byDate.slice(-n);
}
