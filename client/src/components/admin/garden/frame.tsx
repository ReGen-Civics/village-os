/**
 * THE GARDEN'S FRAME: the band, what you see, and the guide's dock, in ONE
 * layout, so the grounds and the road to launch do not each invent a place for
 * her.
 *
 * Rye, 27 Nov 2026: the guide sits in a side dock that expands into the full
 * view and contracts again, on the grounds and on the road to launch. And on
 * who meets what first: a new village's first evening opens with her expanded;
 * after that each person's last choice is remembered; a running admin opens on
 * the Grounds with her docked; on a phone she comes first.
 *
 * Three states, and the frame draws all three from one slot:
 *
 *   closed     what you see takes the whole width. The dock is not drawn.
 *   docked     what you see, with the dock in a column beside it.
 *   expanded   the conversation leads and what you see sits beside it. A
 *              Grounds there draws its compact map (garden.css), so on a
 *              laptop the land is still land, in two fifths of the width.
 *
 * The band carries the switch between the last two ("Guide first" and
 * "Dashboard", ./view.tsx), and the dock's own corner arrows are a second way:
 * both set the one `useGardenDock` value.
 *
 * On a narrow screen the dock is a block of its own ABOVE what you see, in
 * both open states: she comes first, and nothing scrolls sideways.
 *
 * THE DOCUMENT FOLLOWS WHAT IS DRAWN, so a keyboard and a screen reader meet
 * things in the order the eye does. Where she is drawn first (one column: a
 * phone, any narrow frame; and expanded, where the conversation leads) she is
 * first in the document. Where she is drawn after what you see (docked, with
 * room for two columns) she is after it in the document too. The frame
 * decides from its OWN measured width, never the window's, at the same 64rem
 * the stylesheet's container rule lays the two columns out from
 * (GARDEN_FRAME_TWO_COLUMNS_REM; gardenTokens.test.ts holds the two equal).
 * With nothing to measure by (no ResizeObserver) she stays first.
 *
 * SHE IS NEVER LIFTED OUT OF THE PAGE. To change the order the frame moves
 * what you see around her, and never her. Measured in Chromium, 28 Nov 2026:
 * a node that is lifted and set down again loses the scroll position inside
 * it and the focus inside it, and a keyed reorder by React lifts her in two
 * of the four moves (to docked from expanded, and to wide from narrow while
 * docked). So React's own order stays still (her slot, then what you see),
 * both keyed and neither ever remounted, and the frame sets what you see
 * down before or after her: her conversation, her draft, her scroll position
 * and the focus inside her all survive.
 *
 * THE SLOT HAS ITS SIZE AND ITS EDGE FROM THE FRAME (garden.css): it
 * fills the window under the band in two columns and is a block of a bounded
 * height in one, so what is passed as `dock` only has to fill it. A host whose
 * band is taller says so with `--gd-frame-above`.
 *
 * THE FRAME OWNS THE PLACE, NEVER THE DOCK. Pass any element as `dock`: the
 * guide's own component draws inside the slot and reads `useGardenDock` for
 * the state its expand and close buttons change. The frame fetches nothing.
 */
import { useCallback, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { useLingui } from "@lingui/react/macro";
import { useGardenSettings } from "./Garden";
import { personalKey, recall, remember, subscribe } from "./gardenMemory";
import "./garden.css";

export type GardenDockState = "closed" | "docked" | "expanded";

export const GARDEN_DOCK_KEY = "garden.dock";

/**
 * The frame's own width, in rem, from which it has room for two columns. ONE number with two readers: garden.css lays
 * the columns out from it (`@container (min-width: 64rem)` on `.gd-frame`), and the frame puts the dock after what
 * you see from it. gardenTokens.test.ts holds the stylesheet to this constant.
 */
export const GARDEN_FRAME_TWO_COLUMNS_REM = 64;

/** Whether the dock is DRAWN after what you see: docked, in a frame with room for two columns. In every other case she is drawn first. PURE. */
export function dockDrawnAfter(state: GardenDockState, frameWidthPx: number | null, rootFontSizePx = 16): boolean {
  if (state !== "docked" || frameWidthPx === null || !Number.isFinite(frameWidthPx)) return false;
  return frameWidthPx >= GARDEN_FRAME_TWO_COLUMNS_REM * rootFontSizePx;
}

/** One rem in pixels, as the container rule reads it: the root's own font size. */
function rootFontSizePx(): number {
  try {
    const size = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
    return Number.isFinite(size) && size > 0 ? size : 16;
  } catch {
    return 16;
  }
}

/** Set a node down before another (or last, with null). Where the browser can move a node with everything in it kept (`moveBefore`), it does. */
function setDown(parent: Element, node: Element, before: Element | null): void {
  const keep = (parent as Element & { moveBefore?: (node: Node, before: Node | null) => void }).moveBefore;
  if (typeof keep === "function") {
    try {
      keep.call(parent, node, before);
      return;
    } catch {
      // An older shape of the call: move it the ordinary way.
    }
  }
  parent.insertBefore(node, before);
}

/**
 * Keep the document in the order the frame is drawn in, by moving what you see around the dock and never the dock
 * itself (see the header). Runs after every commit, so the dock arriving, leaving or changing state is followed at
 * once, and whenever the frame's own width changes.
 */
function useDocumentFollowsDrawing(frame: RefObject<HTMLElement | null>, body: RefObject<HTMLElement | null>, dock: RefObject<HTMLElement | null>, main: RefObject<HTMLElement | null>): void {
  /** The frame's own width when last measured. Null until then, and for good where there is nothing to measure by. */
  const width = useRef<number | null>(null);

  const arrange = useCallback(() => {
    const [frameEl, bodyEl, dockEl, mainEl] = [frame.current, body.current, dock.current, main.current];
    if (!frameEl || !bodyEl || !dockEl || !mainEl) return;
    // The frame's own attribute is the state on the page: read there, the order can never disagree with the layout.
    const state = frameEl.getAttribute("data-dock") as GardenDockState;
    const after = dockDrawnAfter(state, width.current, rootFontSizePx());
    const isAfter = mainEl.nextElementSibling === dockEl;
    if (after && !isAfter) setDown(bodyEl, mainEl, dockEl);
    else if (!after && isAfter) setDown(bodyEl, mainEl, null);
  }, [frame, body, dock, main]);

  // After every commit: two reads when nothing has changed.
  useLayoutEffect(() => {
    arrange();
  });

  useLayoutEffect(() => {
    const frameEl = frame.current;
    if (!frameEl || typeof ResizeObserver === "undefined") return;
    // The observer reports at once, before the first paint, and again whenever the frame's own width changes.
    const observer = new ResizeObserver((entries) => {
      const last = entries[entries.length - 1];
      if (!last) return;
      width.current = last.contentRect.width;
      arrange();
    });
    observer.observe(frameEl);
    return () => observer.disconnect();
  }, [frame, arrange]);
}

const isDockState = (v: unknown): v is GardenDockState => v === "closed" || v === "docked" || v === "expanded";

/** Where the dock stands for a person who has not chosen: expanded on a new village's first evening, docked otherwise. */
export function defaultGardenDock(firstEvening = false): GardenDockState {
  return firstEvening ? "expanded" : "docked";
}

export interface GardenDock {
  state: GardenDockState;
  setState: (next: GardenDockState) => void;
}

/**
 * Where this person left the guide's dock, and the way to move it. Kept in
 * their own browser, like the lens. Every caller on the page stays in step, so
 * the dock's own buttons and the frame around it never disagree.
 */
export function useGardenDock(opts: { firstEvening?: boolean } = {}): GardenDock {
  const { personKey } = useGardenSettings();
  const key = personalKey(GARDEN_DOCK_KEY, personKey);
  const kept = useSyncExternalStore(
    subscribe,
    () => recall(key),
    () => null,
  );
  const setState = useCallback((next: GardenDockState) => remember(key, next), [key]);
  return { state: isDockState(kept) ? kept : defaultGardenDock(opts.firstEvening === true), setState };
}

export interface GardenFrameProps {
  /** The status band, across the top. */
  band?: ReactNode;
  /** The guide's dock. Left out, or with `dockState` closed, what you see takes the whole width. */
  dock?: ReactNode;
  /** Where the dock stands. Read it from `useGardenDock` so the dock's own buttons move it. */
  dockState?: GardenDockState;
  /** The dock's name for a screen reader. Left out, "Your guide". */
  dockLabel?: string;
  /** What you see: the grounds, the desk, the road. */
  children: ReactNode;
  className?: string;
}

export function GardenFrame({ band, dock, dockState = "docked", dockLabel, children, className = "" }: GardenFrameProps) {
  const { t } = useLingui();
  const state: GardenDockState = dock ? dockState : "closed";
  const frameRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  useDocumentFollowsDrawing(frameRef, bodyRef, dockRef, mainRef);
  return (
    <div ref={frameRef} className={`gd-frame ${className}`.trim()} data-dock={state}>
      {band}
      <div ref={bodyRef} className="gd-frame-body">
        {/* React's own order never changes: her slot, then what you see, each keyed, neither ever remounted. Where she
            is drawn first that is the document's order too. Where she is drawn after what you see (docked, two
            columns) the frame sets what you see down before her: see useDocumentFollowsDrawing. */}
        {state === "closed" ? null : (
          <aside key="dock" ref={dockRef} className="gd-frame-dock" aria-label={dockLabel ?? t({ message: "Your guide", context: "garden frame, the guide's dock" })}>
            {dock}
          </aside>
        )}
        <div key="main" ref={mainRef} className="gd-frame-main">
          {children}
        </div>
      </div>
    </div>
  );
}
