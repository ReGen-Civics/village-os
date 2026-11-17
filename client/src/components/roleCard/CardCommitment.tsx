/**
 * THE CARD'S SLIDER AND SPLIT, HOLDING THEIR OWN CHOICE (the lead, 17 Nov 2026). FullRoleCard loads this lazily, so
 * neither the controls nor the split's arithmetic ride the first view of /roles or /propose-a-role
 * (scripts/route-first-view.json); the card hears back only the query its Apply link carries (applyChoice.ts).
 */
import { useEffect } from "react";
import type { ShapeShare } from "@shared/proposalSplit";
import type { PayCeiling } from "@shared/roleCardSections";
import type { PublicPay } from "@shared/rolePublicPay";
import CommitmentPicker from "./CommitmentPicker";
import { choiceQuery } from "./applyChoice";
import { useCommitmentChoice } from "./useCommitmentChoice";

export default function CardCommitment({
  idPrefix,
  min,
  ceiling,
  shape,
  publicPay,
  showsRange,
  onChoice,
}: {
  idPrefix: string;
  min: number | null | undefined;
  ceiling: PayCeiling | null | undefined;
  shape: readonly ShapeShare[];
  publicPay: PublicPay | null | undefined;
  showsRange: boolean;
  /** The query the Apply link adds: the commitment when the role can be shared, the split when it was changed. */
  onChoice: (query: string) => void;
}) {
  const { choice, setPct, setSplit, sliding } = useCommitmentChoice(min, ceiling, shape);
  const query = choiceQuery(sliding ? choice.pct : null, choice.split, choice.offered);
  useEffect(() => onChoice(query), [query, onChoice]);
  return <CommitmentPicker idPrefix={idPrefix} min={min} ceiling={ceiling} publicPay={publicPay} showsRange={showsRange} choice={choice} onPct={setPct} onSplit={setSplit} />;
}
