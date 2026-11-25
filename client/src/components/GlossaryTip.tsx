/**
 * A SMALL INFO MARK BESIDE A WORD THE VILLAGE EXPLAINS (the lead, 25 Nov 2026: "tooltips next to them!").
 *
 * Drawn after the word, never in place of it, and only while the village has written a sentence for that slot
 * (shared/glossary.ts, the content section `app-glossary`): a village that has written none reads its pages exactly
 * as before. The mark is InfoTip's bare trigger with an "i": a real button, so a tap or a click opens it, Tab reaches
 * it and opens it, Escape closes it, and a screen reader hears "What <word> means" and then the sentence. Its tap box
 * is 44px with a 16px footprint, so the line around it does not move at 320px, and the plaque takes the page's own
 * colours in the light and the dark.
 */
import { useLingui } from "@lingui/react/macro";
import InfoTip from "@/components/InfoTip";
import { useGlossary } from "@/hooks/useGlossary";
import type { GlossarySlot } from "@shared/glossary";

export default function GlossaryTip({ slot, word, className = "" }: { slot: GlossarySlot; word: string; className?: string }) {
  const { t } = useLingui();
  const meaning = useGlossary()?.[slot];
  if (!meaning) return null;
  return (
    <span className={`ml-1 inline-block align-baseline ${className}`} data-glossary={slot}>
      <InfoTip tip={meaning} mark="i" tapBox label={t({ message: `What "${word}" means`, context: "glossary tip: the info mark beside a word the village explains" })} />
    </span>
  );
}
