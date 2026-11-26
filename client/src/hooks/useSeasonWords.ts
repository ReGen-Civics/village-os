import { useMemo } from "react";
import { useVillageDocFields } from "@/hooks/useVillageDocTranslation";
import { overlayVillageDoc } from "@shared/villageDocTranslation";

/**
 * THE SEASON'S WORDS IN THE READER'S LANGUAGE (the lead's Spanish audit, 26 Nov 2026).
 *
 * A village names its seasons in Admin, Season; their translation is the village document "season"
 * (shared/villageDocTranslation.ts). `useSeason` lays the name, theme and focus over what /api/season serves.
 *
 * GOALS ARE LAID ONLY WHERE A PAGE ASKS FOR THEM. A member's season plan names the goals it serves by their
 * English text, and /my-season matches those against the live season's goals, so the shared read keeps every
 * goal in the words the village wrote. The goal list on /roles reads its goals by id and asks for them.
 */
const GOAL = /^[^.]+\.goals\.\d+$/;

export function seasonInLanguage<S>(season: S, fields: Readonly<Record<string, string>>, opts: { goals?: boolean } = {}): S {
  if (!season || !Object.keys(fields).length) return season;
  const chosen = opts.goals ? fields : Object.fromEntries(Object.entries(fields).filter(([f]) => !GOAL.test(f)));
  return Object.keys(chosen).length ? overlayVillageDoc("season", season, chosen) : season;
}

/** `season` (the /api/season shape, or any part of it with `current` or `seasons`) in the reader's language. */
export function useSeasonInLanguage<S>(season: S, opts: { goals?: boolean } = {}): S {
  const fields = useVillageDocFields("season");
  const goals = !!opts.goals;
  return useMemo(() => seasonInLanguage(season, fields, { goals }), [season, fields, goals]);
}
