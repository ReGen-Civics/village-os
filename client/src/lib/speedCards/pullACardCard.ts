/**
 * THE "PULL A CARD" SPEED CARD, one entry for the phone's quick cards (the More sheet's "Yours" grid).
 *
 * The customise lane owns the grid and its registry of speed cards; this lane owns the card's feature
 * (/profile/today-card, shared/myCard.ts) and registers exactly this one entry. The registry did not exist when
 * this was written, so the entry is a plain constant the registry imports: an id, its words, its glyph, where
 * it goes, and its visibility rule.
 *
 * VISIBLE ONLY WHEN HUMAN DESIGN OR GENE KEYS IS ON FOR THE MEMBER: the village has the Gene Keys module on
 * (Human Design is read from the same lines, there is no separate module) AND the member has found their lines.
 * Without lines there is no deck to draw from, so the slot stays open for another card. `usePullACardShown`
 * answers that with the read every profile surface already shares (`useMyGeneKeys`), so a grid that mounts it
 * costs no new request when the profile has already read the lines.
 *
 * The glyph is a lucide icon, the family the sheet already draws (no new icon set), and the same one the profile's
 * card and the draw button wear.
 */
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import type { ComponentType } from "react";
import { Sparkles } from "lucide-react";
import { useMyGeneKeys } from "@/components/geneKeys/useMyGeneKeys";
import { TODAY_CARD_PATH } from "@shared/myCard";

export interface PullACardSpeedCard {
  id: "pull-a-card";
  label: MessageDescriptor;
  icon: ComponentType<{ className?: string }>;
  href: string;
  /** The module the card needs on. */
  module: "gene-keys";
  /** Shown only to a member whose lines are found, while the module is on. */
  visible(ctx: { moduleOn: boolean; hasLines: boolean }): boolean;
}

export const PULL_A_CARD_CARD: PullACardSpeedCard = {
  id: "pull-a-card",
  label: msg({ message: "Pull a card", context: "the phone's More sheet: speed card, today's card drawn from the member's own lines" }),
  icon: Sparkles,
  href: TODAY_CARD_PATH,
  module: "gene-keys",
  visible: ({ moduleOn, hasLines }) => moduleOn && hasLines,
};

/** Whether the speed card shows for the signed-in member now. False while the lines are still being read. */
export function usePullACardShown(): boolean {
  const { on, mine } = useMyGeneKeys();
  return PULL_A_CARD_CARD.visible({ moduleOn: on, hasLines: !!mine });
}
