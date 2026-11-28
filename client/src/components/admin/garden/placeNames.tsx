/**
 * EACH PERSON MAY RENAME THE PLACES FOR THEMSELVES (Rye, 27 Nov 2026), and
 * their names are kept in their own browser. Nothing here reaches the server.
 *
 * The name shown for a place is the person's own, then the village's (when it
 * has set one), then the platform's from the GARDEN_PLACES table.
 */
import { useEffect, useId, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { BTN_PRIMARY, BTN_SECONDARY, FIELD, HINT, LABEL } from "@/components/journey/look";
import { useGardenSettings } from "./Garden";
import { personalKey, recall, remember, subscribe } from "./gardenMemory";
import { GARDEN_PLACES, GARDEN_PLACE_KEYS, PLACE_NAME_MAX, tidyPlaceName, type GardenPlaceKey } from "./places";

export const GARDEN_NAMES_KEY = "garden.placeNames";

type OwnNames = Partial<Record<GardenPlaceKey, string>>;

/** A person's own names, read from what the browser kept. Anything that is not a known place with a real name is dropped. */
export function readOwnPlaceNames(raw: string | null): OwnNames {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: OwnNames = {};
  for (const key of GARDEN_PLACE_KEYS) {
    const value = (parsed as Record<string, unknown>)[key];
    const name = typeof value === "string" ? tidyPlaceName(value) : "";
    if (name) out[key] = name;
  }
  return out;
}

export interface PlaceNames {
  /** The name to show: the person's own, then the village's, then the platform's. */
  nameOf: (place: GardenPlaceKey) => string;
  /** The name without the person's own: what "use the village's name again" goes back to. */
  villageNameOf: (place: GardenPlaceKey) => string;
  /** Whether this person has their own name for the place. */
  isRenamed: (place: GardenPlaceKey) => boolean;
  /** Keep this person's own name. An empty name, or the village's own, clears it. */
  rename: (place: GardenPlaceKey, name: string) => void;
  /** Use the village's name again. */
  reset: (place: GardenPlaceKey) => void;
}

/** Every place's name for the person looking, and the way to change one. Every caller on the page stays in step. */
export function usePlaceNames(): PlaceNames {
  const { i18n } = useLingui();
  const { personKey, villageNames } = useGardenSettings();
  const key = personalKey(GARDEN_NAMES_KEY, personKey);
  const kept = useSyncExternalStore(
    subscribe,
    () => recall(key),
    () => null,
  );
  const own = useMemo(() => readOwnPlaceNames(kept), [kept]);

  const villageNameOf = (place: GardenPlaceKey) => tidyPlaceName(villageNames?.[place] ?? "") || i18n._(GARDEN_PLACES[place].name);
  const keep = (next: OwnNames) => remember(key, Object.keys(next).length > 0 ? JSON.stringify(next) : null);

  return {
    nameOf: (place) => own[place] ?? villageNameOf(place),
    villageNameOf,
    isRenamed: (place) => own[place] !== undefined,
    rename: (place, name) => {
      const tidy = tidyPlaceName(name);
      const next = { ...readOwnPlaceNames(recall(key)) };
      if (tidy && tidy !== villageNameOf(place)) next[place] = tidy;
      else delete next[place];
      keep(next);
    },
    reset: (place) => {
      const next = { ...readOwnPlaceNames(recall(key)) };
      delete next[place];
      keep(next);
    },
  };
}

export interface RenamePlaceProps {
  /** The place being renamed. */
  place: GardenPlaceKey;
  className?: string;
}

export function RenamePlace({ place, className = "" }: RenamePlaceProps) {
  const names = usePlaceNames();
  const fieldId = useId();
  const hintId = useId();
  const shown = names.nameOf(place);
  const villageName = names.villageNameOf(place);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);

  const save = (e: FormEvent) => {
    e.preventDefault();
    names.rename(place, draft);
  };

  return (
    <form onSubmit={save} className={`flex flex-col gap-2 ${className}`.trim()}>
      <label htmlFor={fieldId} className={LABEL}>
        <Trans context="garden, rename a place">Your name for {villageName}</Trans>
      </label>
      <input id={fieldId} type="text" value={draft} maxLength={PLACE_NAME_MAX} autoComplete="off" aria-describedby={hintId} onChange={(e) => setDraft(e.target.value)} className={FIELD} />
      <p id={hintId} className={HINT}>
        <Trans context="garden, rename a place">Only you see this name. It is kept in this browser.</Trans>
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BTN_PRIMARY}>
          <Trans context="garden, rename a place">Keep this name</Trans>
        </button>
        {names.isRenamed(place) ? (
          <button type="button" onClick={() => names.reset(place)} className={BTN_SECONDARY}>
            <Trans context="garden, rename a place">Use the village's name again</Trans>
          </button>
        ) : null}
      </div>
    </form>
  );
}
