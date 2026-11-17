/**
 * THE CARD'S COMMITMENT AND SPLIT (the lead, 17 Nov 2026): the slider, the band at the chosen commitment, and the
 * listed price at it split by hand into the shape in force. Loaded lazily (FullRoleCard.tsx), so the routes that
 * draw the card do not carry it in their first view; its state lives in useCommitmentChoice.ts.
 * What the reader chooses here rides the Apply link
 * into the application's price step (applyChoice.ts), where it is saved with the proposal.
 *
 * The band at the commitment shows only below 100% (the card's band line says the full band) and only while the
 * village shows pay ranges; the split's amounts only while the reader may see the
 * listed price (the card already drops a price the reader may not read). Display only: the contract sets the pay.
 */
import { useMemo } from "react";
import { useLingui } from "@lingui/react/macro";
import type { Split } from "@shared/proposalSplit";
import type { CommitmentChoice } from "./useCommitmentChoice";
import type { PayCeiling } from "@shared/roleCardSections";
import type { PublicPay } from "@shared/rolePublicPay";
import { moneyWords } from "@shared/roleRewardWords";
import CommitmentSlider from "./CommitmentSlider";
import SplitControl from "./SplitControl";
import { bandAt, bandAtWords, bandEnds, offersSlider } from "./commitmentWords";
import { perPeriod } from "./rewardWords";

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
      {/* At 100% the card's own band line already says it (bandWords, under the listed price). */}
      {sliding && band && choice.pct < 100 && (
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
