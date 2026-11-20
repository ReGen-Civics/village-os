/**
 * THE REVIEW'S OTHER LINES (applicant journey QA, 15 Nov 2026): the price and the notes on the role card both
 * go with the application, so Review & submit says them too, each with a way back to its step.
 *
 * The cap at their commitment (Rye, 15 Nov 2026: proposals go up to 120% of the suggested price) is drawn only
 * for a reviewer or an admin who asks for it (`showCap`). The applicant's own Review & submit never shows a cap
 * amount (lead, 17 Nov 2026), so it is off unless a caller turns it on.
 * The split line (shared/proposalSplit.ts) says each share, and says when they changed it.
 *
 * Kept beside ApplySteps.tsx because pages/ProposeARole.tsx holds the file-lines ceiling.
 */
// A value import of the runtime, as client/src/lib/unsavedChanges.ts has: precompileEnglish compiles the messages of
// a file that imports it and skips one that only uses `msg`.
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { askPeriod, capAt, ceilingAt, priceDifferencePct, signedPct, type PayAsk } from "@shared/commitmentRange";
import type { PayCeiling } from "@shared/roleCardSections";
import { moneyWords } from "@shared/roleRewardWords";
import { perPeriod } from "@/components/roleCard/rewardWords";

export interface ReviewExtra {
  step: number;
  label: string;
  line: string;
}

const short = (s: string) => (s.trim().length > 90 ? `${s.trim().slice(0, 90)}…` : s.trim());

/** One role's money on the review: its price and its split (several roles, the lead, 17 Nov 2026). */
export interface ReviewRoleMoney {
  name: string;
  ceiling: PayCeiling | null | undefined;
  pct: number | null;
  ask: PayAsk | null | undefined;
  split?: { line?: string } | null;
}

/** The price line for one role, and what it adds to a total: their own amount in the role's period, else the suggestion. */
function priceOf(i18n: I18n, c: PayCeiling, pct: number | null, ask: PayAsk | null, showCap: boolean): { line: string; amount: number | null } {
  const priced = (n: number, per = c.per) => perPeriod(i18n, moneyWords(n, c.currency, i18n.locale), per);
  const suggested = pct && pct > 0 ? ceilingAt(c.amount, pct) : null;
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
  // The cap amount, for reviewers and admins only: never on an applicant's surface (lead, 17 Nov 2026).
  const cap = showCap ? capAt(c.amount, pct && pct > 0 ? pct : 100) : 0;
  const capped = cap > 0 ? `${line} · ${i18n._(msg({ message: `Proposals up to ${priced(cap)}`, context: "founding application review: the cap on a proposal" }))}` : line;
  const amount = ask?.kind === "amount" && askPeriod(ask) === c.per ? ask.monthly : suggested;
  return { line: ask?.why ? `${capped} · ${short(ask.why)}` : capped, amount };
}

export function reviewExtras(
  i18n: I18n = appI18n,
  p: { termsStep: number; valueStep: number; ceiling: PayCeiling | null | undefined; pct: number | null; ask: PayAsk | null | undefined; notes: ReadonlyArray<{ text: string }>; showCap?: boolean; split?: { line?: string } | null; roles?: ReadonlyArray<ReviewRoleMoney> },
): ReviewExtra[] {
  const out: ReviewExtra[] = [];
  // SEVERAL ROLES (production check of 1.3.24): each role's price and split, then the prices added together.
  if (p.roles && p.roles.length > 1) {
    const amounts: Array<{ amount: number; currency: string; per: PayCeiling["per"] }> = [];
    for (const r of p.roles) {
      if (r.ceiling) {
        const price = priceOf(i18n, r.ceiling, r.pct, r.ask ?? null, p.showCap === true);
        if (price.amount) amounts.push({ amount: price.amount, currency: r.ceiling.currency, per: r.ceiling.per });
        out.push({ step: p.termsStep, label: i18n._(msg({ message: `Your price: ${r.name}`, context: "founding application review, one of several roles" })), line: price.line });
      }
      if (r.split?.line) out.push({ step: p.termsStep, label: i18n._(msg({ message: `Your split: ${r.name}`, context: "founding application review, one of several roles" })), line: r.split.line });
    }
    const one = amounts.length > 1 && amounts.every((x) => x.currency === amounts[0].currency && x.per === amounts[0].per);
    if (one) {
      const total = perPeriod(i18n, moneyWords(amounts.reduce((n, x) => n + x.amount, 0), amounts[0].currency, i18n.locale), amounts[0].per);
      out.push({ step: p.termsStep, label: i18n._(msg({ message: "Across your roles", context: "founding application review, several roles" })), line: i18n._(msg({ message: `${total} together`, context: "founding application review: the prices of several roles added" })) });
    }
  } else {
    if (p.ceiling) out.push({ step: p.termsStep, label: i18n._(msg({ message: "Your price", context: "founding application review" })), line: priceOf(i18n, p.ceiling, p.pct, p.ask ?? null, p.showCap === true).line });
  // The split's line is worked where the split is (governance/TermsSplit.tsx), so its words load with it.
    if (p.split?.line) out.push({ step: p.termsStep, label: i18n._(msg({ message: "Your split", context: "founding application review" })), line: p.split.line });
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

/**
 * THE RECORDINGS ON REVIEW (applicant QA, 20 Nov 2026): recordings left without their tick were dropped at Send with
 * nothing said on Review & submit, so minutes of talking went unsent. The line says whether they go, and its Change
 * leads back to the tick on About you. Nothing is ticked for them. No recordings: no line.
 */
export function recordingsReview(i18n: I18n, v: { step: number; recordings: number; consent: boolean }): ReviewExtra[] {
  const n = v.recordings;
  if (n <= 0) return [];
  const line = v.consent
    ? n === 1
      ? i18n._(msg({ message: "1 recording, sent with your application", context: "founding application review" }))
      : i18n._(msg({ message: `${n} recordings, sent with your application`, context: "founding application review" }))
    : n === 1
      ? i18n._(msg({ message: "1 recording, not sent. Tick the box under it to send it.", context: "founding application review" }))
      : i18n._(msg({ message: `${n} recordings, not sent. Tick the box under them to send them.`, context: "founding application review" }));
  return [{ step: v.step, label: i18n._(msg({ message: "Your recordings", context: "founding application review" })), line }];
}
