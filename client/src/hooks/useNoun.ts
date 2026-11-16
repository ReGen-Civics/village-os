import { useMemo } from "react";
import { useGameConfig } from "@/lib/gameApi";
import { vocabularyOf, type Noun, type NounSlot, type Vocabulary } from "@shared/vocabulary";

/**
 * The village's own nouns (gap G4, shared/vocabulary.ts), from /api/game/config.
 * The platform's words while the config loads and for a village that set none.
 *
 *   const circle = useNoun("circle");   // { one: "ship", many: "ships", a: "a" }
 */
export function useVocabulary(): Vocabulary {
  const cfg = useGameConfig() as { vocabulary?: unknown } | null;
  return useMemo(() => vocabularyOf(cfg?.vocabulary), [cfg?.vocabulary]);
}

export function useNoun(slot: NounSlot): Noun {
  return useVocabulary()[slot];
}
