/**
 * WHICH STEPS OF A QUEST NEED THEIR OWN SUBMISSION (0439; the lead, 27 Nov
 * 2026), and which of them a claim still owes. Pure, so the server's submit
 * gate and the quest page ask the same question in the same words.
 *
 * `step_needs` is a list of booleans in the order of the quest's `steps`. A
 * quest with none, or with every entry false, behaves as it always did.
 */

/** A stored or sent value to a clean list as long as the steps, false where unreadable. */
export function readStepNeeds(v: unknown, stepCount: number): boolean[] {
  let parsed: unknown = v;
  if (typeof v === "string") {
    try {
      parsed = JSON.parse(v);
    } catch {
      parsed = [];
    }
  }
  const list = Array.isArray(parsed) ? parsed : [];
  return Array.from({ length: Math.max(0, stepCount) }, (_, i) => list[i] === true);
}

/**
 * Whether a save moved the steps out from under their ticks (the lead, 27 Nov
 * 2026: when an admin reorders the steps, the ticks are cleared and set again).
 * The ticks are kept by position, so they survive only a save that leaves every
 * existing step where it was: the old list must still open the new one. A
 * reorder, a removal or a step reworded in place moves them; steps added at the
 * end do not, and the new steps start unticked.
 */
export function stepsMoved(before: readonly string[] | null | undefined, after: readonly string[] | null | undefined): boolean {
  const a = (before ?? []).map((s) => String(s).trim());
  const b = (after ?? []).map((s) => String(s).trim());
  if (b.length < a.length) return true;
  return a.some((s, i) => s !== b[i]);
}

/** True when at least one step needs a submission. */
export function anyStepNeeds(needs: readonly boolean[] | null | undefined): boolean {
  return (needs ?? []).some(Boolean);
}

/** The zero-based steps marked as needing a submission that have none yet, in step order. */
export function missingSteps(needs: readonly boolean[] | null | undefined, submissions: ReadonlyArray<{ stepIndex: number }>): number[] {
  const filled = new Set(submissions.map((s) => s.stepIndex));
  const out: number[] = [];
  (needs ?? []).forEach((needed, i) => {
    if (needed && !filled.has(i)) out.push(i);
  });
  return out;
}
