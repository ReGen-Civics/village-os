/**
 * THE REVIEW'S OTHER LINES (applicant journey QA, 15 Nov 2026): the price and the notes on the role card both
 * go with the application, so Review & submit says them too, each with a way back to its step.
 *
 * Kept beside ApplySteps.tsx because pages/ProposeARole.tsx holds the file-lines ceiling.
 */
// A value import of the runtime, as client/src/lib/unsavedChanges.ts has: precompileEnglish compiles the messages of
// a file that imports it and skips one that only uses `msg`.
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { askPeriod, ceilingAt, priceDifferencePct, signedPct, type PayAsk } from "@shared/commitmentRange";
import type { PayCeiling } from "@shared/roleCardSections";
import { moneyWords } from "@shared/roleRewardWords";
import { perPeriod } from "@/components/roleCard/rewardWords";

export interface ReviewExtra {
  step: number;
  label: string;
  line: string;
}

const short = (s: string) => (s.trim().length > 90 ? `${s.trim().slice(0, 90)}…` : s.trim());

export function reviewExtras(
  i18n: I18n = appI18n,
  p: { termsStep: number; valueStep: number; ceiling: PayCeiling | null | undefined; pct: number | null; ask: PayAsk | null | undefined; notes: ReadonlyArray<{ text: string }> },
): ReviewExtra[] {
  const out: ReviewExtra[] = [];
  if (p.ceiling) {
    const c = p.ceiling;
    const priced = (n: number, per = c.per) => perPeriod(i18n, moneyWords(n, c.currency, i18n.locale), per);
    const suggested = p.pct && p.pct > 0 ? ceilingAt(c.amount, p.pct) : null;
    const ask = p.ask ?? null;
    const diff = ask?.kind === "amount" && suggested && askPeriod(ask) === c.per ? priceDifferencePct(suggested, ask.monthly) : null;
    const line = !ask
      ? suggested
        ? i18n._(msg({ message: `The suggested price, ${priced(suggested)}`, context: "founding application review: the price" }))
        : i18n._(msg({ message: "Choose your commitment to see a suggested price", context: "founding application review: the price" }))
      : ask.kind === "negotiate"
        ? i18n._(msg({ message: "Negotiate on the first call if chosen", context: "founding application review: the price" }))
        : diff !== null
          ? i18n._(msg({ message: `${priced(ask.monthly, askPeriod(ask))} (${signedPct(diff)} on the suggestion)`, context: "founding application review: the price" }))
          : priced(ask.monthly, askPeriod(ask));
    out.push({ step: p.termsStep, label: i18n._(msg({ message: "Your price", context: "founding application review" })), line: ask?.why ? `${line} · ${short(ask.why)}` : line });
  }
  const n = p.notes.length;
  if (n > 0) {
    out.push({
      step: p.valueStep,
      label: i18n._(msg({ message: `Your notes on the role (${n})`, context: "founding application review" })),
      line: n === 1 ? short(p.notes[0].text) : i18n._(msg({ message: `${short(p.notes[0].text)} and ${n - 1} more`, context: "founding application review: the notes on the role" })),
    });
  }
  return out;
}
