/**
 * MYCELIUM: threads between related things (LIVING MOTION, motion lane).
 *
 * Wrap a grid or list of cards (a <ul> or <ol> whose <li>s are the cards) and
 * the cards are stitched together across the gaps between them: a fine thread
 * from each card to its neighbour on the right and below, travelling a little
 * way along the gap with two fine branchlets, and a small gold knot where it
 * meets each card's edge. It says these belong to one village.
 *
 * A thread draws itself the first time it rises above the bottom quarter of the
 * screen (lib/inView.ts), by when the cards either side have finished
 * germinating, so a knot never floats beside a card that is still arriving. A
 * thread already on screen when the page arrives is simply there: nothing above
 * the fold animates. Once drawn, its knots glow three times and rest.
 *
 * Decorative and inert: aria-hidden, no pointer events, drawn over the gaps
 * and the outermost few pixels of each card, never over its words. With
 * "reduce motion" the threads are drawn and still. Without layout (no cards,
 * a single card, gaps wider than a thread can cross) it draws nothing.
 * Positions come from offsetLeft/offsetTop, which ignore the transforms
 * Germinate and Touch apply, so the threads hold the cards' resting places.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { observeOnce } from "@/lib/inView";
import "./motion.css";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Thread {
  /** The path, in the wrapper's pixel space. */
  d: string;
  /** The two knots, on each card's edge. */
  a: [number, number];
  b: [number, number];
}

/** The widest gap a thread will cross, in px. Wider than this, the cards are not neighbours. */
export const MAX_GAP = 64;
/** The narrowest column gap a thread crosses; below it the cards sit side by side unthreaded. */
export const MIN_SIDE_GAP = 24;
/** How far a knot sits inside its card's edge. */
const INSET = 3;

/** A stable wobble in [-1, 1] for the nth thread, so a page draws the same threads every visit. */
function wobble(n: number, salt: number): number {
  const s = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * The threads for a set of card boxes: each card to its nearest neighbour on
 * the right (same row) and below (same column), when the gap between them is
 * real and narrow enough to cross. Pure, so it is tested on its own.
 */
export function threadsFor(boxes: Box[]): Thread[] {
  const out: Thread[] = [];
  boxes.forEach((a) => {
    let right: Box | null = null;
    let below: Box | null = null;
    for (const b of boxes) {
      if (b === a) continue;
      const sameRow = Math.abs(b.y - a.y) < Math.min(a.h, b.h) / 2;
      const gapX = b.x - (a.x + a.w);
      // Not across a gap narrower than MIN_SIDE_GAP: there the S folds into a zig-zag that reads as a stray mark (QA, 25 Nov 2026).
      if (sameRow && gapX >= MIN_SIDE_GAP && gapX <= MAX_GAP && (!right || b.x < right.x)) right = b;
      const overlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const gapY = b.y - (a.y + a.h);
      if (overlap > Math.min(a.w, b.w) / 2 && gapY > 0 && gapY <= MAX_GAP && (!below || b.y < below.y)) below = b;
    }
    if (right) {
      // Across a column gap: an S that leaves card a, travels 36 to 64px down or up the gap, and meets card b,
      // with two fine branchlets. All of it inside the gap, so it never crosses a word.
      const n = out.length;
      const top = Math.max(a.y, right.y) + 14;
      const bottom = Math.min(a.y + a.h, right.y + right.h) - 14;
      if (bottom - top < 24) return;
      const travel = Math.min(bottom - top, 36 + ((wobble(n, 2) + 1) / 2) * 28) * (wobble(n, 3) < 0 ? -1 : 1);
      const span = bottom - top - Math.abs(travel);
      const ya = r1((travel < 0 ? top - travel : top) + span * (0.35 + ((wobble(n, 1) + 1) / 2) * 0.3));
      const yb = r1(ya + travel);
      const ax = r1(a.x + a.w - INSET);
      const bx = r1(right.x + INSET);
      const g = bx - ax;
      const mx = r1(ax + g / 2);
      const reach = r1(Math.max(3, g * 0.3));
      const y1 = r1(ya + travel * 0.4);
      const y2 = r1(ya + travel * 0.68);
      const dir = travel < 0 ? -1 : 1;
      out.push({
        d: `M${ax} ${ya}C${mx} ${ya} ${mx} ${yb} ${bx} ${yb}M${mx} ${y1}q${-reach / 2} ${dir * 3} ${-reach} ${dir * 7}M${mx} ${y2}q${reach / 2} ${dir * 3} ${reach} ${dir * 6}`,
        a: [ax, ya],
        b: [bx, yb],
      });
    }
    if (below) {
      // Down a row gap: the same S turned on its side, travelling 48 to 90px along the gap.
      const n = out.length;
      const left = Math.max(a.x, below.x) + 18;
      const rightEdge = Math.min(a.x + a.w, below.x + below.w) - 18;
      if (rightEdge - left < 32) return;
      const travel = Math.min(rightEdge - left, 48 + ((wobble(n, 5) + 1) / 2) * 42) * (wobble(n, 6) < 0 ? -1 : 1);
      const span = rightEdge - left - Math.abs(travel);
      const xa = r1((travel < 0 ? left - travel : left) + span * (0.2 + ((wobble(n, 4) + 1) / 2) * 0.6));
      const xb = r1(xa + travel);
      const ay = r1(a.y + a.h - INSET);
      const by = r1(below.y + INSET);
      const g = by - ay;
      const my = r1(ay + g / 2);
      const reach = r1(Math.max(3, g * 0.3));
      const x1 = r1(xa + travel * 0.4);
      const x2 = r1(xa + travel * 0.68);
      const dir = travel < 0 ? -1 : 1;
      out.push({
        d: `M${xa} ${ay}C${xa} ${my} ${xb} ${my} ${xb} ${by}M${x1} ${my}q${dir * 3} ${-reach / 2} ${dir * 7} ${-reach}M${x2} ${my}q${dir * 3} ${reach / 2} ${dir * 6} ${reach}`,
        a: [xa, ay],
        b: [xb, by],
      });
    }
  });
  return out;
}

/** An element's resting box relative to `root`, through the offset chain (transforms do not count). */
function boxIn(el: HTMLElement, root: HTMLElement): Box | null {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  if (node !== root) return null;
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

function Strand({ thread, n }: { thread: Thread; n: number }) {
  const ref = useRef<SVGGElement>(null);
  const [on, setOn] = useState<"still" | "grow" | undefined>(undefined);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return observeOnce(el, (already) => setOn(already ? "still" : "grow"), "0px 0px -25% 0px");
  }, []);
  return (
    <g ref={ref} className="m-link" data-on={on} style={{ ["--d" as string]: `${(n % 4) * 90}ms` }}>
      <path className="m-hypha" pathLength={1} d={thread.d} />
      <circle className="m-knot" cx={thread.a[0]} cy={thread.a[1]} r={2.6} />
      <circle className="m-knot" cx={thread.b[0]} cy={thread.b[1]} r={2.6} />
    </g>
  );
}

export default function Mycelium({ children, className = "" }: { children: ReactNode; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [threads, setThreads] = useState<Thread[]>([]);

  useEffect(() => {
    const root = wrap.current;
    if (!root) return;
    let frame = 0;
    let ro: ResizeObserver | null = null;
    const watched = new Set<Element>();
    const cardsNow = () => Array.from(root.querySelectorAll<HTMLElement>(":scope > ul > li, :scope > ol > li"));
    const measure = () => {
      frame = 0;
      const all = cardsNow();
      // Watch every card as well as the wrapper. Cards can change height while the wrapper keeps its own:
      // when the display face arrives, one row's title unwraps and the next row's wraps, the two rows swap
      // heights, the wrapper stays the same size, and a thread measured before would sit across the words
      // below it (the lead, /roles at 390px, 26 Nov 2026).
      for (const li of all) {
        if (!ro || watched.has(li)) continue;
        watched.add(li);
        ro.observe(li);
      }
      const cards = all.filter((li) => li.offsetWidth > 0 && li.offsetHeight > 0);
      const boxes = cards.map((li) => boxIn(li, root)).filter((b): b is Box => b !== null);
      const next = threadsFor(boxes);
      setThreads((prev) => (prev.length === next.length && prev.every((t, i) => t.d === next[i].d) ? prev : next));
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(soon);
      ro.observe(root);
    }
    measure();
    // And once the page's faces have loaded, which is when titles re-wrap.
    let live = true;
    document.fonts?.ready.then(() => live && soon(), () => undefined);
    return () => {
      live = false;
      ro?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={wrap} className={`m-myc relative ${className}`}>
      {children}
      {threads.length > 0 && (
        <svg className="m-myc-layer" aria-hidden="true" focusable="false" data-motion="mycelium">
          {threads.map((t, n) => (
            <Strand key={t.d} thread={t} n={n} />
          ))}
        </svg>
      )}
    </div>
  );
}
