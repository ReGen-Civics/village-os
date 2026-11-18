/**
 * THE SPLIT, BY HAND (the lead, 17 Nov 2026): the total shared into the village's pay shape, each share with a
 * percent field and an amount field. Typing a percent updates its amount; typing an amount updates its percent.
 * The other shares move with it in proportion so the split still adds up to 100% and to the total
 * (shared/proposalSplit.ts holds the rule and its tests). Labels come from the shape in force, never typed here.
 *
 * Used on the role card under the commitment slider, and in the application's price step, where the split is
 * saved with the proposal beside what the village offered. Drawn in the profile's look (docs/DESIGN_RULE.md).
 * No 120% figure: the cap stays a backend rule.
 */
import { useLingui } from "@lingui/react/macro";
import { setAmount, setPercent, splitChanged, type Split } from "@shared/proposalSplit";
import type { CeilingPeriod } from "@shared/roleCardSections";
import { moneyWords } from "@shared/roleRewardWords";
import { BTN_SECONDARY, FIELD, HINT, LABEL } from "@/components/journey/look";
import { perPeriod } from "./rewardWords";
import { totalAgainstBand, type BandAt } from "./commitmentWords";

/** Digits only, as a whole number; empty reads as 0 so clearing a field gives its share back to the others. */
const wholeOf = (raw: string): number => {
  const t = raw.replace(/[^\d]/g, "");
  return t ? Math.min(Number(t), 1_000_000_000) : 0;
};

export default function SplitControl({
  idPrefix,
  split,
  offered,
  onChange,
  currency,
  per,
  pct,
  band = null,
}: {
  idPrefix: string;
  split: Split;
  /** The village's split at the same total: "Use the village's split" puts it back. */
  offered: Split;
  onChange: (next: Split) => void;
  /** The currency and period of the total, when the split has one. */
  currency: string | null;
  per: CeilingPeriod | null;
  /** The commitment the total is worked at, for the words. */
  pct: number | null;
  /** The band at the same commitment, when the village shows ranges: a total outside it is said. */
  band?: BandAt | null;
}) {
  const { t, i18n } = useLingui();
  if (!split.shares.length) return null;
  const hasAmounts = split.total !== null && !!currency;
  const money = (n: number) => moneyWords(n, currency ?? "USD", i18n.locale);
  const changed = splitChanged(offered, split);
  const against = totalAgainstBand(i18n, split, band);
  const totalWords = split.total !== null && currency && per ? perPeriod(i18n, money(split.total), per) : null;

  return (
    <fieldset className="grid gap-3 rounded-xl border border-border bg-muted p-4" data-split-control="">
      <legend className="sr-only">{t({ message: "How your total is split", context: "split control legend" })}</legend>
      <p className={LABEL} aria-hidden="true">
        {t({ message: "How your total is split", context: "split control heading" })}
      </p>
      <p className="text-sm text-foreground" data-split-editable="">
        {hasAmounts
          ? t({ message: "You can change this split for your proposal. Type a percent or an amount.", context: "split control: it is editable" })
          : t({ message: "You can change this split for your proposal. Type a percent for each share.", context: "split control: it is editable, percents only" })}
      </p>
      <ul className="grid gap-2">
        {split.shares.map((s, i) => {
          const pctId = `${idPrefix}-split-${i}-pct`;
          const amountId = `${idPrefix}-split-${i}-amount`;
          return (
            <li key={s.label} className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_9rem]" data-split-share={s.label}>
              <span className="min-w-0 break-words font-medium capitalize text-foreground">{s.label}</span>
              <span className="relative">
                <label htmlFor={pctId} className="sr-only">
                  {t({ message: `${s.label}, percent of the total`, context: "split control: a share's percent field" })}
                </label>
                <input
                  id={pctId}
                  type="text"
                  inputMode="numeric"
                  value={String(s.pct)}
                  onChange={(e) => onChange(setPercent(split, i, wholeOf(e.target.value)))}
                  className={`${FIELD} min-h-11 pr-7 text-right`}
                  data-split-pct={s.label}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">
                  %
                </span>
              </span>
              {hasAmounts && (
                <span className="col-span-2 sm:col-span-1">
                  <label htmlFor={amountId} className="sr-only">
                    {t({ message: `${s.label}, amount in ${currency}`, context: "split control: a share's amount field" })}
                  </label>
                  <input
                    id={amountId}
                    type="text"
                    inputMode="numeric"
                    value={String(s.amount ?? 0)}
                    onChange={(e) => onChange(setAmount(split, i, wholeOf(e.target.value)))}
                    className={`${FIELD} min-h-11 text-right`}
                    data-split-amount={s.label}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className={HINT}>{t({ message: "When you change one share, the others move with it in proportion, so the split still adds up to 100% and to your total.", context: "split control: how the shares rebalance" })}</p>
      {totalWords && (
        <p className="font-medium text-foreground" aria-live="polite" data-split-total="">
          {pct
            ? t({ message: `Total: ${totalWords} at ${pct}%`, context: "split control: the total the split adds up to" })
            : t({ message: `Total: ${totalWords} for the full role`, context: "split control: the total, before a commitment is chosen" })}
        </p>
      )}
      {against && (
        <p className="text-sm text-foreground" data-split-against-band="">
          {against}
        </p>
      )}
      {changed && (
        <button type="button" onClick={() => onChange(offered)} className={`${BTN_SECONDARY} justify-self-start`} data-split-reset="">
          {t({ message: "Use the village's split", context: "split control: put the default back" })}
        </button>
      )}
    </fieldset>
  );
}
