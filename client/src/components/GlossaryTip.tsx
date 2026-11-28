/**
 * A WORD THE VILLAGE EXPLAINS, AND THE WORD IS THE TIP (the lead, 27 Nov 2026: "tooltips should be on the word not
 * next to it like this. fix this for all tooltips across the site, should be something subtle and not disrupt the
 * whole paragraph text like this." This replaces 25 Nov's "tooltips next to them!", which drew an "i" mark after the
 * word).
 *
 * `children` is the word as the sentence has it. While the village has written a sentence for that slot
 * (shared/glossary.ts, the content section `app-glossary`) the word itself is InfoTip's trigger: a thin dotted
 * underline, a tap or a click opens it, Tab reaches it and opens it, Escape closes it, and a screen reader hears the
 * word and then the sentence. A village that has written none reads the word as plain text, no underline, exactly as
 * before. The plaque takes the page's own colours in the light and the dark (InfoTip.tsx).
 *
 * `fallback` is the platform's own sentence for a page that had one before the village wrote theirs (the calendar's
 * moons): the village's sentence wins when there is one.
 */
import type { ReactNode } from "react";
import InfoTip from "@/components/InfoTip";
import { useGlossary } from "@/hooks/useGlossary";
import type { GlossarySlot } from "@shared/glossary";

export default function GlossaryTip({ slot, children, fallback, className }: { slot: GlossarySlot; children: ReactNode; fallback?: string; className?: string }) {
  const meaning = useGlossary()?.[slot] || fallback;
  if (!meaning) return <>{children}</>;
  return (
    <span data-glossary={slot}>
      <InfoTip tip={meaning} className={className}>
        {children}
      </InfoTip>
    </span>
  );
}

/**
 * A line of the village's own words (a heading, an intro) with the first whole-word match of `match` wearing the
 * slot's tip. A line without the word comes back as it is, or, with `whole`, wears the tip across the whole line,
 * for a heading the word sat beside.
 */
export function GlossaryText({ slot, text, match, whole = false }: { slot: GlossarySlot; text: string; match: RegExp; whole?: boolean }) {
  const found = match.exec(text);
  if (!found) return whole ? <GlossaryTip slot={slot}>{text}</GlossaryTip> : <>{text}</>;
  const at = found.index;
  return (
    <>
      {text.slice(0, at)}
      <GlossaryTip slot={slot}>{found[0]}</GlossaryTip>
      {text.slice(at + found[0].length)}
    </>
  );
}
