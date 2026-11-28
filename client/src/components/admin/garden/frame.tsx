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
 *   expanded   the conversation leads and what you see sits beside it.
 *
 * On a narrow screen the dock is a block of its own ABOVE what you see, in
 * both open states: she comes first, and nothing scrolls sideways.
 *
 * THE FRAME OWNS THE PLACE, NEVER THE DOCK. Pass any element as `dock`: the
 * guide's own component draws inside the slot and reads `useGardenDock` for
 * the state its expand and close buttons change. The frame fetches nothing.
 */
import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { useGardenSettings } from "./Garden";
import { personalKey, recall, remember, subscribe } from "./gardenMemory";
import "./garden.css";

export type GardenDockState = "closed" | "docked" | "expanded";

export const GARDEN_DOCK_KEY = "garden.dock";

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
  return (
    <div className={`gd-frame ${className}`.trim()} data-dock={state}>
      {band}
      <div className="gd-frame-body">
        <div className="gd-frame-main">{children}</div>
        {state === "closed" ? null : (
          <aside className="gd-frame-dock" aria-label={dockLabel ?? t({ message: "Your guide", context: "garden frame, the guide's dock" })}>
            {dock}
          </aside>
        )}
      </div>
    </div>
  );
}
