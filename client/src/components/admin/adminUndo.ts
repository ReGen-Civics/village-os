/**
 * A short wait before an admin action is sent, so Undo can stop it.
 *
 * Nothing is sent until the wait ends. Undo, or leaving the page, drops it.
 *
 * ONE ACTION WAITS AT A TIME, AND A NEW ONE NEVER DROPS THE ONE STILL WAITING.
 * A second action used to replace the first without a word: mark one request
 * done, mark the next one done inside ten seconds, and the first was never
 * sent while its row had already said it would be. Now the one still waiting
 * is SENT AT ONCE when a different action is held, and the new one takes the
 * wait and the bar. Undo then stops only the newest, which is the one the bar
 * names.
 *
 * The one exception is THE SAME SUBJECT PRESSED AGAIN (a double press, or Done
 * then Remove on one request): the caller names its subject with `key`, and a
 * hold with the key of the one waiting takes its place, so one subject is sent
 * once. A hold with no key is always a different action.
 */
const WAIT_MS = 10_000;
let waitMs = WAIT_MS;

/** Tests use a shorter wait. The product wait stays 10 seconds. */
export function setUndoWaitMs(ms: number): void {
  waitMs = ms;
}

type Pending = { label: string; timer: number; work: () => void; key: string | null };

let pending: Pending | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of Array.from(listeners)) fn();
}

export function undoWaitMs(): number {
  return WAIT_MS;
}

export function pendingUndoLabel(): string | null {
  return pending?.label ?? null;
}

export function subscribeUndo(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Undo: the action that is waiting is dropped, and nothing is sent. */
export function cancelUndo(): void {
  if (!pending) return;
  window.clearTimeout(pending.timer);
  pending = null;
  emit();
}

/**
 * Run `work` after 10 seconds unless Undo comes first.
 *
 * If another action is still waiting it is sent now, without the rest of its
 * wait, unless it has this same `key` (the same subject pressed again), in
 * which case this one takes its place.
 */
export function holdUndo(label: string, work: () => void, key?: string): void {
  const earlier = pending;
  if (earlier) window.clearTimeout(earlier.timer);
  const mine: Pending = {
    label,
    work,
    key: key ?? null,
    timer: window.setTimeout(() => {
      // A later hold may have taken the wait; only the one waiting is cleared.
      if (pending === mine) {
        pending = null;
        emit();
      }
      work();
    }, waitMs),
  };
  pending = mine;
  emit();
  // The new hold is in place before the earlier one is sent, so a send that
  // throws cannot lose the new one.
  if (earlier && (earlier.key === null || earlier.key !== mine.key)) earlier.work();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => cancelUndo());
}
