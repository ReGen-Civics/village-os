/**
 * IN VIEW: the one way LIVING MOTION asks "is this on screen?" (motion lane).
 *
 * One IntersectionObserver per root margin, shared by everything that asks with
 * that margin, so a page with forty threads runs one observer, never forty.
 *
 * Two forms:
 *   - observeInView(el, cb, margin): continuous. cb(true) when it enters,
 *     cb(false) when it leaves. For loops that must pause off screen.
 *   - observeOnce(el, cb, margin): fires once, the first time el is in view,
 *     then forgets it. cb receives `already`: true when el was ALREADY in view
 *     the moment it was observed, which is what lets a motion leave anything on
 *     screen at load as it is (the hero and above the fold are never animated)
 *     and grow only what the reader scrolls to.
 *
 * Without IntersectionObserver (old browsers, jsdom), everything counts as
 * already in view at once: the still frame, never a missing one.
 */
type Watch = (inView: boolean, first: boolean) => void;

interface Shared {
  io: IntersectionObserver;
  watches: Map<Element, { cb: Watch; seen: boolean }>;
}

const shared = new Map<string, Shared>();

function observerFor(rootMargin: string): Shared | null {
  if (typeof IntersectionObserver === "undefined") return null;
  let s = shared.get(rootMargin);
  if (!s) {
    const watches = new Map<Element, { cb: Watch; seen: boolean }>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const w = watches.get(e.target);
          if (!w) continue;
          const first = !w.seen;
          w.seen = true;
          w.cb(e.isIntersecting, first);
        }
      },
      { rootMargin },
    );
    s = { io, watches };
    shared.set(rootMargin, s);
  }
  return s;
}

/** Calls cb(true|false) as el enters and leaves the viewport (shrunk by rootMargin). Returns the unwatch. */
export function observeInView(el: Element, cb: (inView: boolean) => void, rootMargin = "0px"): () => void {
  const s = observerFor(rootMargin);
  if (!s) {
    cb(true);
    return () => {};
  }
  s.watches.set(el, { cb: (v) => cb(v), seen: false });
  s.io.observe(el);
  return () => {
    s.watches.delete(el);
    s.io.unobserve(el);
  };
}

/** Calls cb once, the first time el is in view; `already` is true when it was in view on arrival. */
export function observeOnce(el: Element, cb: (already: boolean) => void, rootMargin = "0px"): () => void {
  const s = observerFor(rootMargin);
  if (!s) {
    cb(true);
    return () => {};
  }
  const stop = () => {
    s.watches.delete(el);
    s.io.unobserve(el);
  };
  s.watches.set(el, {
    seen: false,
    cb: (inView, first) => {
      if (!inView) return;
      stop();
      cb(first);
    },
  });
  s.io.observe(el);
  return stop;
}

/** For tests: forget every shared observer. */
export function resetInViewForTests() {
  shared.forEach((s) => s.io.disconnect());
  shared.clear();
}
