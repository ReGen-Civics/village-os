/**
 * THE CARD'S COMMITMENT AND SPLIT (the lead, 17 Nov 2026): the slider, the band at the chosen commitment, and the
 * listed price at it split by hand into the shape in force. What the reader chooses here rides the Apply link
 * into the application's price step (applyChoice.ts), where it is saved with the proposal.
 *
 * The band shows only while the village shows pay ranges; the split's amounts only while the reader may see the
 * listed price (the card already drops a price the reader may not read). Display only: the contract sets the pay.
 */
import { useEffect, useMemo, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { rangeMin } from "@shared/commitmentRange";
import { offeredSplit, retotal, splitTotal, type ShapeShare, type Split } from "@shared/proposalSplit";
import type { PayCeiling } from "@shared/roleCardSections";
import type { PublicPay } from "@shared/rolePublicPay";
import { moneyWords } from "@shared/roleRewardWords";
import CommitmentSlider from "./CommitmentSlider";
import SplitControl from "./SplitControl";
import { bandAt, bandAtWords, bandEnds, offersSlider } from "./commitmentWords";
import { perPeriod } from "./rewardWords";

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
  return { choice, setPct, setSplit, sliding: offersSlider(min), lo: rangeMin(min) };
}

export default function CommitmentPicker({
  idPrefix,
  min,
  ceiling,
  publicPay,
  showsRange,
  choice,
  onPct,
  onSplit,
}: {
  idPrefix: string;
  min: number | null | undefined;
  /** The listed price for the full role, when the reader may see it. */
  ceiling: PayCeiling | null | undefined;
  publicPay: PublicPay | null | undefined;
  showsRange: boolean;
  choice: CommitmentChoice;
  onPct: (pct: number) => void;
  onSplit: (split: Split) => void;
}) {
  const { i18n } = useLingui();
  const band = useMemo(() => bandAt(publicPay, showsRange, choice.pct), [publicPay, showsRange, choice.pct]);
  const sliding = offersSlider(min);
  const priced = ceiling && choice.split.total !== null ? perPeriod(i18n, moneyWords(choice.split.total, ceiling.currency, i18n.locale), ceiling.per) : null;
  const spoken = band ? bandEnds(i18n, band) : priced;
  if (!sliding && !choice.split.shares.length) return null;
  return (
    <div className="grid gap-3" data-commitment-picker="">
      {sliding && <CommitmentSlider idPrefix={idPrefix} min={min} value={choice.pct} onChange={onPct} amounts={spoken} />}
      {sliding && band && (
        <p className="leading-relaxed text-card-foreground" aria-live="polite" data-pay-band-at="">
          {bandAtWords(i18n, band)}
        </p>
      )}
      {choice.split.shares.length > 0 && (
        <SplitControl
          idPrefix={idPrefix}
          split={choice.split}
          offered={choice.offered}
          onChange={onSplit}
          currency={ceiling?.currency ?? null}
          per={ceiling?.per ?? null}
          pct={sliding ? choice.pct : null}
          band={band}
        />
      )}
    </div>
  );
}
