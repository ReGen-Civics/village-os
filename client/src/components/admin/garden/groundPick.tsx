/**
 * THE GROUND BEHIND THE GARDEN (the founder, 28 Nov 2026: "Let users pick
 * forest, valley, or terraced hills and also a beachside").
 *
 * Four painted grounds ship with the platform (shared/gardenArt.ts). Each
 * person picks the one behind their own garden, and the pick is kept in their
 * own browser, the way their lens and their place names are. Nothing here
 * reaches the server, and nobody else's screen changes.
 *
 * A village's own land art comes first where it has some: the Grounds then
 * draw that and no picker, because there is nothing to pick. Forest is the
 * ground for a person who has not picked, and for a kept value that is no
 * ground.
 *
 * ONLY THE PICKED GROUND IS EVER FETCHED. The picker is four names and no
 * pictures, so the other three paintings are never asked for.
 */
import { useCallback, useId, useSyncExternalStore } from "react";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react/macro";
import { GARDEN_GROUND_KEYS, readGardenGround, type GardenGroundKey } from "@shared/gardenArt";
import { useGardenSettings } from "./Garden";
import { personalKey, recall, remember, subscribe } from "./gardenMemory";
import { useGardenWords } from "./speaking";
import "./garden.css";

/** Where a person's pick is kept in their browser. */
export const GARDEN_GROUND_PICK_KEY = "garden.ground";

/** Each ground's name on the picker. Keyed by the union, so a ground added without a name does not compile. */
const GROUND_NAMES: Record<GardenGroundKey, MessageDescriptor> = {
  forest: msg({ message: "Forest", context: "garden ground" }),
  valley: msg({ message: "Valley", context: "garden ground" }),
  hills: msg({ message: "Terraced hills", context: "garden ground" }),
  beach: msg({ message: "Beachside", context: "garden ground" }),
};

export interface GardenGroundState {
  /** The ground behind this person's garden. Forest until they pick. */
  ground: GardenGroundKey;
  setGround: (ground: GardenGroundKey) => void;
}

/** The ground this person picked for their own screen, and the way to change it. Every caller on the page stays in step. */
export function useGardenGround(): GardenGroundState {
  const { personKey } = useGardenSettings();
  const key = personalKey(GARDEN_GROUND_PICK_KEY, personKey);
  const kept = useSyncExternalStore(
    subscribe,
    () => recall(key),
    () => null,
  );
  const setGround = useCallback((ground: GardenGroundKey) => remember(key, ground), [key]);
  return { ground: readGardenGround(kept), setGround };
}

export interface GroundPickerProps {
  /** The ground showing now. */
  ground: GardenGroundKey;
  /** Called with the ground a person picks. */
  onChange: (ground: GardenGroundKey) => void;
  className?: string;
}

const GROUND_BUTTON = "jw-btn inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold";

/**
 * The four grounds by name, with the one showing marked. Its line says what it does and whose screen it changes, in
 * the person's own speaking setting. The Grounds draw it above the land; where the places are rows, or the village
 * has land art of its own, the Grounds leave it out.
 */
export function GroundPicker({ ground, onChange, className = "" }: GroundPickerProps) {
  const { t, i18n } = useLingui();
  const words = useGardenWords();
  const lineId = useId();
  return (
    <div className={`gd-ground-picker ${className}`.trim()}>
      <p id={lineId} className="m-0 text-xs text-muted-foreground">
        {words.groundPicker}
      </p>
      <div role="group" aria-label={t({ message: "The ground behind your garden", context: "garden ground picker" })} aria-describedby={lineId} className="gd-lens flex w-fit max-w-full flex-wrap gap-1 rounded-xl p-1">
        {GARDEN_GROUND_KEYS.map((key) => (
          <button key={key} type="button" aria-pressed={ground === key} onClick={() => onChange(key)} className={GROUND_BUTTON}>
            {i18n._(GROUND_NAMES[key])}
          </button>
        ))}
      </div>
    </div>
  );
}
