/**
 * THE CARD'S COMMITMENT AND SPLIT, AS STATE (the lead, 17 Nov 2026). Kept apart from CommitmentPicker.tsx so the
 * card can hold the choice (its Apply link carries it) while the picker itself loads lazily.
 */
import { useEffect, useState } from "react";
import { rangeMin } from "@shared/commitmentRange";
import { offeredSplit, retotal, splitTotal, type ShapeShare, type Split } from "@shared/proposalSplit";
import type { PayCeiling } from "@shared/roleCardSections";

export interface CommitmentChoice {
  pct: number;
  split: Split;
  offered: Split;
}

/**
 * The reader's choice, starting at 100% and the shape in force. A new commitment keeps their percents and works
 * the amounts again, and the village's split follows it, so "changed" always compares at the same total.
 */
export function useCommitmentChoice(min: number | null | undefined, ceiling: PayCeiling | null | undefined, shape: readonly ShapeShare[]) {
  const key = shape.map((s) => `${s.label}:${s.pct}`).join(",");
  const start = (pct: number): CommitmentChoice => {
    const offered = offeredSplit(shape, splitTotal(ceiling?.amount, pct, null));
    return { pct, split: offered, offered };
  };
  const [choice, setChoice] = useState<CommitmentChoice>(() => start(100));
  // The card's shape or price arrives after the first draw (it is read on mount): start again from it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setChoice(start(100)), [key, ceiling?.amount, min]);
  const setPct = (pct: number) =>
    setChoice((c) => {
      const total = splitTotal(ceiling?.amount, pct, null);
      return { pct, split: retotal(c.split, total), offered: offeredSplit(shape, total) };
    });
  const setSplit = (split: Split) => setChoice((c) => ({ ...c, split }));
  return { choice, setPct, setSplit, sliding: rangeMin(min) < 100, lo: rangeMin(min) };
}

