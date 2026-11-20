/**
 * THE VILLAGE'S OWN WORDS, EACH WITH ITS TIP, ON A ROLE CARD (the lead, 20 Nov 2026; shared/roleCardWordTips.ts
 * holds where the words come from and the matching).
 *
 * Same mechanics as the moon word and the contribution token (WordTip.tsx): focusable, a dotted underline, a tap
 * or hover or focus opens it, Escape closes it, a sheet along the foot of a phone. No new dependency.
 *
 * The card puts its tips in context once (`CardTipsProvider`), so every passage under it, a bullet, a tile, a
 * heading, reads them with `TipText` and nothing is threaded through props. The page puts the anchor circle in
 * context (`AnchorCircleTip`), because the page holds the village's circles and the card does not.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import { mergeWordTips, tipParts, type WordTipLine } from "@shared/roleCardWordTips";
import { WordTip } from "@/components/WordTip";

const NO_TIPS: WordTipLine[] = [];
const Tips = createContext<WordTipLine[]>(NO_TIPS);

/** The village's anchor circle, by name, with its own purpose, from the page that holds the circles. */
export const AnchorCircleTip = createContext<{ name: string; purpose: string } | null>(null);

const DEFAULTS = [
  [msg({ message: "consent", context: "role card tooltip: the word" }), msg({ message: "A decision passes by consent when nobody in the circle has a reasoned objection. It is safe enough to try, and it can change.", context: "role card tooltip: consent" })],
  [msg({ message: "steward", context: "role card tooltip: the word" }), msg({ message: "A steward looks after one part of the village on everyone's behalf, and answers to their circle.", context: "role card tooltip: steward" })],
  [msg({ message: "Founding Seeder", context: "role card tooltip: the word" }), msg({ message: "Someone who means to live in the village one day and starts on the resident path now.", context: "role card tooltip: Founding Seeder" })],
  [msg({ message: "Digital Companion", context: "role card tooltip: the word" }), msg({ message: "The AI assistant that works beside the person in this role. It drafts, remembers and prepares; the person decides.", context: "role card tooltip: Digital Companion" })],
] as const;

const ANCHOR_DEFAULT = msg({ message: "The circle every other circle links back to. It holds the village's shared direction.", context: "role card tooltip: the anchor circle, when it has no purpose written" });

/** The tips for this card: the village's own lines over the anchor circle's purpose and the platform's defaults. */
export function useCardTips(own: readonly WordTipLine[] | undefined): WordTipLine[] {
  const { i18n } = useLingui();
  const anchor = useContext(AnchorCircleTip);
  return useMemo(() => {
    const defaults: WordTipLine[] = DEFAULTS.map(([w, tip]) => ({ word: i18n._(w), tip: i18n._(tip) }));
    if (anchor?.name) defaults.unshift({ word: anchor.name, tip: anchor.purpose.trim() || i18n._(ANCHOR_DEFAULT) });
    return mergeWordTips(defaults, own);
  }, [i18n, anchor, own]);
}

export function CardTipsProvider({ tips, children }: { tips: WordTipLine[]; children: ReactNode }) {
  return <Tips.Provider value={tips}>{children}</Tips.Provider>;
}

/**
 * A passage (one line, one tile, one heading) with the first mention of each tipped word wearing its tip. Text
 * without one comes back as is. Worked out whole on every render, so a re-render never loses a tip.
 */
export function TipText({ text }: { text: string | null | undefined }) {
  const tips = useContext(Tips);
  const s = text ?? "";
  if (!tips.length || !s) return <>{s}</>;
  const parts = tipParts(s, tips);
  return <>{parts.map((p, i) => (typeof p === "string" ? p : <WordTip key={i} tip={p.tip} kind="tip-word">{p.word}</WordTip>))}</>;
}
