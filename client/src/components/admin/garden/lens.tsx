/**
 * TWO LENSES, WITH A TOGGLE (Rye, 27 Nov 2026): the Grounds, where the map is
 * the dashboard, and the Desk, a dense working view. A person's last choice is
 * kept in their own browser; with none, a wide screen opens on the Grounds and
 * a narrow one on the Desk.
 */
import { useCallback, useSyncExternalStore } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { useGardenSettings } from "./Garden";
import { personalKey, recall, remember, subscribe } from "./gardenMemory";
import "./garden.css";

export type GardenLens = "grounds" | "desk";

export const GARDEN_LENS_KEY = "garden.lens";

/** Wide enough for the map. */
export const GARDEN_WIDE_QUERY = "(min-width: 1024px)";

const isLens = (v: unknown): v is GardenLens => v === "grounds" || v === "desk";

/** The lens for a person who has not chosen: the Grounds where there is room for the map. */
export function defaultGardenLens(): GardenLens {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "grounds";
  try {
    return window.matchMedia(GARDEN_WIDE_QUERY).matches ? "grounds" : "desk";
  } catch {
    return "grounds";
  }
}

export interface GardenLensState {
  lens: GardenLens;
  setLens: (lens: GardenLens) => void;
}

/** The lens this person sees the garden through, and the way to change it. Every caller on the page stays in step. */
export function useGardenLens(): GardenLensState {
  const { personKey } = useGardenSettings();
  const key = personalKey(GARDEN_LENS_KEY, personKey);
  const kept = useSyncExternalStore(
    subscribe,
    () => recall(key),
    () => null,
  );
  const setLens = useCallback((lens: GardenLens) => remember(key, lens), [key]);
  return { lens: isLens(kept) ? kept : defaultGardenLens(), setLens };
}

export interface LensToggleProps {
  /** The lens showing now. */
  lens: GardenLens;
  /** Called with the lens a person picks. */
  onChange: (lens: GardenLens) => void;
  className?: string;
}

const LENS_BUTTON = "jw-btn inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold";

export function LensToggle({ lens, onChange, className = "" }: LensToggleProps) {
  const { t } = useLingui();
  return (
    // Below the map's width (`lg`, the same 1024px as GARDEN_WIDE_QUERY) the Grounds draw as rows, so the two lenses
    // are the same list and the toggle steps back. The person's choice is kept for when they are on a wide screen.
    <div role="group" aria-label={t({ message: "How you see the garden", context: "garden lens toggle" })} className={`gd-lens hidden w-fit gap-1 rounded-xl p-1 lg:flex ${className}`.trim()}>
      <button type="button" aria-pressed={lens === "grounds"} onClick={() => onChange("grounds")} className={LENS_BUTTON}>
        <Trans context="garden lens">The Grounds</Trans>
      </button>
      <button type="button" aria-pressed={lens === "desk"} onClick={() => onChange("desk")} className={LENS_BUTTON}>
        <Trans context="garden lens">The Desk</Trans>
      </button>
    </div>
  );
}
