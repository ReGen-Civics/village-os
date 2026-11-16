import { useVillageContent } from "@/hooks/useVillageContent";
import { usePageVars } from "@/hooks/usePageContent";
import { APP_WORDS_PAGE, appWordOf, type AppWordSection } from "@shared/pageContent/appWords";
import { pageSectionKey } from "@shared/pageContent/types";

/**
 * The village's own words around the app (gap G7, shared/pageContent/appWords.ts).
 *
 *   const word = useAppWords();
 *   word("empty", "questsTitle") ?? t`The meadow is resting`
 *
 * Null for every box the village left blank, so the caller keeps the
 * platform's translated words. Read through the shared section cache, so
 * every caller on a page shares one read.
 */
export function useAppWords(): (section: AppWordSection, key: string, extra?: Record<string, string>) => string | null {
  const vars = usePageVars();
  const { content } = useVillageContent<Record<string, unknown>>(pageSectionKey(APP_WORDS_PAGE));
  return (section, key, extra) => appWordOf(content, section, key, { ...(vars ?? {}), ...(extra ?? {}) });
}
