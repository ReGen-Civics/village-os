/**
 * THE OLD GLOBAL ASSISTANT DAY, `assistant-day:<date>` (600 calls), read by
 * the call synthesis paths in server/index.ts: the Synthesize button and the
 * background batch tick.
 *
 * It FAILS CLOSED (security audit, 15 Nov 2026), like every bucket in
 * server/lib/assistant.ts: each one stands between a caller and money spent
 * upstream, so a limiter that cannot be read answers `unavailable`, and the
 * caller refuses with "try again shortly" (the button) or submits nothing
 * this tick (the batch). Before this it read `overLimit`, which fails open.
 *
 * Pure over the two limiter halves it is handed, so it is testable without a
 * database and server/index.ts keeps only the wiring.
 */
import type { LimitState } from "../repos/rateHits";

export const ASSISTANT_DAY_MS = 24 * 60 * 60 * 1000;

/** The bucket for the day `now` falls in (UTC date, as it always was). */
export function assistantDayBucket(now: Date = new Date()): string {
  return `assistant-day:${now.toISOString().slice(0, 10)}`;
}

/** Count and record one call, as one decision. `unavailable` when the limiter cannot be read. */
export async function assistantDayCapState(
  limitState: (bucket: string, max: number, windowMs: number) => Promise<LimitState>,
  max: number,
  now: Date = new Date(),
): Promise<LimitState> {
  return limitState(assistantDayBucket(now), max, ASSISTANT_DAY_MS);
}

/**
 * Count only, recording nothing, for the batch tick that asks every five
 * minutes (recording there would spend the day on ticks that submit nothing).
 * A count that could not be taken (`null`) is `unavailable`, never `under`.
 */
export async function assistantDayCapPeek(
  countInWindow: (bucket: string, windowMs: number) => Promise<number | null>,
  max: number,
  now: Date = new Date(),
): Promise<LimitState> {
  const n = await countInWindow(assistantDayBucket(now), ASSISTANT_DAY_MS);
  if (n === null) return "unavailable";
  return n >= max ? "over" : "under";
}

export const ASSISTANT_DAY_UNREADABLE = "The assistant cannot check its daily budget right now. Try again shortly.";
export const ASSISTANT_DAY_SPENT = "The assistant's daily budget is spent. Try tomorrow";

/** What the Synthesize button answers for a state that refuses; null lets it through. */
export function assistantDayRefusal(state: LimitState): { status: number; error: string } | null {
  if (state === "unavailable") return { status: 503, error: ASSISTANT_DAY_UNREADABLE };
  if (state === "over") return { status: 429, error: ASSISTANT_DAY_SPENT };
  return null;
}
