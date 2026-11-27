/**
 * LAND ON A PLACE IN THE PAGE, AND STAY LANDED WHILE THE PAGE SETTLES (QA round 2).
 *
 * The season page brings an arrival to its place once: the agreement for
 * #confidentiality, the role for ?renew=, everyone's plans for #everyone,
 * otherwise the tab's panel. Two things moved that landing off its mark:
 *
 * - the scroll was smooth (the page's scroll-behavior), so its destination was
 *   computed once, on the page as it stood when the scroll began;
 * - something above the target folded while the scroll ran (the root strip's
 *   placeholder above the page folds about 150ms after it, when the member's
 *   next step points at /season), so the target ended up under the sticky bars.
 *
 * So the scroll is instant, and for a short while after it the body is watched:
 * when the target drifts more than a few pixels from where it landed, it is
 * landed again. The first wheel, touch, pointer press or key from the reader ends the watch,
 * because from then on the reader is choosing where to be.
 */
export const LAND_HOLD_MS = 2500;
export const LAND_DRIFT_PX = 4;
/** The reader taking over: any of these ends the watch. */
const USER_MOVES = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

/** Where the target's top sits once landed: its own scroll margin (scroll-mt-40 is 160px). */
function landedTop(target: Element): number {
  const m = parseFloat(getComputedStyle(target).scrollMarginTop || "0");
  return Number.isFinite(m) ? m : 0;
}

/** Land on `target` now, re-land on drift for `holdMs`. Returns a stop function. */
export function landOn(target: Element, holdMs = LAND_HOLD_MS): () => void {
  const land = () =>
    target.scrollIntoView?.({
      block: "start",
      behavior: "instant" as ScrollBehavior,
    });
  land();
  if (typeof ResizeObserver === "undefined") return () => {};
  const want = landedTop(target);
  let stopped = false;
  const observer = new ResizeObserver(() => {
    if (stopped || !target.isConnected) return;
    if (Math.abs(target.getBoundingClientRect().top - want) > LAND_DRIFT_PX)
      land();
  });
  const stop = () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    clearTimeout(timer);
    for (const e of USER_MOVES) window.removeEventListener(e, stop, true);
  };
  const timer = setTimeout(stop, holdMs);
  observer.observe(document.body);
  for (const e of USER_MOVES)
    window.addEventListener(e, stop, { capture: true, passive: true });
  return stop;
}
