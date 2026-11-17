/**
 * THE COMMITMENT SLIDER (the lead, 17 Nov 2026): on a role that takes part of a person (`commitmentMin` below
 * 100), the reader slides from the role's minimum to 100% and sees the band, and the split of the listed price,
 * at that commitment. A role offered whole draws no slider.
 *
 * A native range input, so arrows, Home and End and touch all work as the platform has them; it moves in the
 * same steps of 10 the application's terms accept (shared/commitmentRange.ts `commitmentChoices`), and its
 * spoken value names the commitment and the amounts at it.
 */
import { useLingui } from "@lingui/react/macro";
import { HINT, LABEL } from "@/components/journey/look";
import { sliderSteps, sliderValueText } from "./commitmentWords";

export default function CommitmentSlider({
  idPrefix,
  min,
  value,
  onChange,
  amounts = null,
}: {
  idPrefix: string;
  /** The least one person may propose (the card's `commitmentMin`). */
  min: number | null | undefined;
  value: number;
  onChange: (pct: number) => void;
  /** The band or price at the value, in words, for the spoken value. */
  amounts?: string | null;
}) {
  const { t, i18n } = useLingui();
  const steps = sliderSteps(min);
  if (steps.length < 2) return null;
  const lo = steps[0];
  const id = `${idPrefix}-commitment-slider`;
  return (
    <div className="grid gap-2" data-commitment-slider="">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={LABEL}>
          {t({ message: "Your commitment", context: "commitment slider label" })}
        </label>
        <span className="font-display text-2xl text-notice" aria-hidden="true" data-commitment-shown="">
          {value}%
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={lo}
        max={100}
        step={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={sliderValueText(i18n, value, amounts)}
        className="h-11 w-full cursor-pointer accent-notice"
        data-commitment-input=""
      />
      <div className={`flex justify-between ${HINT}`} aria-hidden="true">
        <span>{lo}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
