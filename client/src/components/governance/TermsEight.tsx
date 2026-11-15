/**
 * THE EIGHT SETTINGS, with the role's own suggestion for each (joining lane PR 3).
 *
 * Term, Clocks, Rhythm, Allowance, Bonus, Goals, Scoreboard, Ending. The role card holds a
 * suggested wording per setting; the candidate marks each "I accept" or "let's talk", with an
 * optional note. A setting the role has not written reads "We'll set this together." and asks
 * for no answer. Clocks also carries the candidate's commitment: a percentage of their energy
 * and attention, 0 to 100 in steps of ten, with no default. It is a planning signal, never hours.
 *
 * Drawn in the profile's look (docs/DESIGN_RULE.md): panels and tiles on the semantic tokens,
 * the eyebrow over each setting, gold focus, 44px targets. One component for both doors, the open
 * form and the member door, so they cannot drift apart.
 */
import { useLingui } from "@lingui/react/macro";
import { commitmentChoices, type PayAsk } from "@shared/commitmentRange";
import type { PayCeiling } from "@shared/roleCardSections";
import { ceilingAtWords } from "@shared/roleRewardWords";
import {
  COMMITMENT_CHOICES,
  COMMITMENT_HINT,
  SET_TOGETHER,
  TERMS_HINT,
  TERM_KEYS,
  TERM_NOTE_MAX,
  commitmentWords,
  type TermAnswers,
  type TermKey,
  type TermsWords,
} from "@shared/termsWords";

/** A person offering a role starts at 10%: 0% is no commitment at all (final verification, 11 Nov 2026). */
export const CANDIDATE_COMMITMENTS = COMMITMENT_CHOICES.filter((n) => n >= 10);

export interface TermsRole {
  id: string;
  name: string;
  words?: TermsWords;
  /** The commitment the role asks, when its card says. */
  commitmentPct?: number | null;
  /** The least one person may propose (Rye, 14 Nov 2026, shared/commitmentRange.ts). Unset: the usual choices. */
  commitmentMin?: number | null;
  /** The role's pay ceiling for the full role, when its card says: the form shows the most at each commitment and asks for an optional pay ask. */
  ceiling?: PayCeiling | null;
}

export interface TermsStepValue {
  answers: TermAnswers;
  /** Null until the person chooses: there is no default. */
  commitmentPct: number | null;
  /** Their optional pay ask (Rye, 14 Nov 2026): a monthly amount, or "negotiate on the first call if chosen". */
  payAsk?: PayAsk | null;
}

export const EMPTY_TERMS_STEP: TermsStepValue = { answers: {}, commitmentPct: null };

// The profile's shapes (docs/DESIGN_RULE.md): a tile, the eyebrow, a field, a hint.
const TILE = "rounded-xl border border-border bg-muted p-4";
const HINT = "text-sm text-muted-foreground";
const FIELD = "w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export default function TermsEight({
  roles,
  value,
  onChange,
  problem,
  idPrefix = "terms",
}: {
  roles: ReadonlyArray<TermsRole>;
  value: TermsStepValue;
  onChange: (next: TermsStepValue) => void;
  problem?: string | null;
  idPrefix?: string;
}) {
  const { t } = useLingui();
  // One role with a pay ceiling: the form shows the most at the chosen commitment, and the optional ask.
  const ceiling = roles.length === 1 ? (roles[0].ceiling ?? null) : null;
  const labels: Record<TermKey, string> = {
    term: t({ message: "Term", context: "terms setting" }),
    clocks: t({ message: "Clocks", context: "terms setting" }),
    rhythm: t({ message: "Rhythm", context: "terms setting" }),
    allowance: t({ message: "Allowance", context: "terms setting" }),
    bonus: t({ message: "Bonus", context: "terms setting" }),
    goals: t({ message: "Goals", context: "terms setting" }),
    scoreboard: t({ message: "Scoreboard", context: "terms setting" }),
    ending: t({ message: "Ending", context: "terms setting" }),
  };
  const several = roles.length > 1;
  const setAnswer = (k: TermKey, next: { choice: "accept" | "talk"; note: string } | undefined) => {
    const answers = { ...value.answers };
    if (next) answers[k] = next;
    else delete answers[k];
    onChange({ ...value, answers });
  };

  return (
    <fieldset className="grid gap-3" data-terms-eight="">
      <legend className="sr-only">{t({ message: "The terms", context: "terms step" })}</legend>
      <p className={HINT} data-terms-hint="">
        {t`Mark anything you'd like to talk through. Nothing is final until we agree together.`}
      </p>
      {/* One row per setting (D-06): its name, the role's wording, and a two-part I accept / Let's talk
          control. A phone stacks the three; from sm up they sit on one line, with any note and the
          commitment beneath. The radios stay radios, each laid over its half of the control. */}
      <div className="grid" data-terms-rows="">
      {TERM_KEYS.map((k) => {
        const lines = roles
          .map((r) => ({ role: r, text: r.words?.[k]?.trim() ?? "", commitment: k === "clocks" ? (r.commitmentPct ?? null) : null }))
          .filter((l) => l.text || l.commitment !== null);
        const written = lines.length > 0;
        const answer = value.answers[k];
        const name = `${idPrefix}-${k}`;
        const half = (choice: "accept" | "talk", words: string) => (
          <label className="relative flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-md px-3 text-sm text-muted-foreground hover:text-foreground has-[:checked]:bg-muted has-[:checked]:text-foreground has-[:checked]:ring-1 has-[:checked]:ring-notice/70 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
            <input
              type="radio"
              name={name}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              checked={answer?.choice === choice}
              onChange={() => setAnswer(k, { choice, note: answer?.note ?? "" })}
            />
            {words}
          </label>
        );
        return (
          <div key={k} className="grid gap-3 border-t border-border py-4 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-center sm:gap-x-5" data-term={k} data-written={written ? "yes" : "no"}>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{labels[k]}</p>
            {written ? (
              <div className="grid gap-1">
                {lines.map((l) => (
                  <div key={l.role.id} className="text-foreground">
                    {several && <p className="text-sm font-semibold text-foreground">{l.role.name}</p>}
                    {l.commitment !== null && <p className="font-medium">{commitmentWords(l.commitment)}</p>}
                    {l.text && <p className="whitespace-pre-line break-words leading-relaxed">{l.text}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-foreground sm:col-span-2" data-set-together="">
                {t`We'll set this together.`}
              </p>
            )}
            {written && (
              <div className="flex gap-1 rounded-lg border border-border p-1 sm:w-48" role="radiogroup" aria-label={labels[k]}>
                {half("accept", t({ message: "I accept", context: "terms setting answer" }))}
                {half("talk", t({ message: "Let's talk", context: "terms setting answer" }))}
              </div>
            )}
            {written && answer?.choice === "talk" && (
              <textarea
                aria-label={t`What you would like to talk about: ${labels[k]}`}
                placeholder={t`A note, if you like`}
                rows={2}
                maxLength={TERM_NOTE_MAX}
                value={answer.note}
                onChange={(e) => setAnswer(k, { choice: "talk", note: e.target.value })}
                className={`${FIELD} sm:col-span-2 sm:col-start-2`}
              />
            )}
            {k === "clocks" && (
              <div className={`${TILE} sm:col-span-2 sm:col-start-2`} data-commitment="">
                <label htmlFor={`${idPrefix}-commitment`} className="text-sm font-semibold text-foreground">
                  {t({ message: "Your commitment", context: "terms commitment" })}
                </label>
                <p className={`${HINT} mt-1`}>{t`How much of your energy and attention this role gets in a week. 100% is full commitment, and you manage your own workload.`}</p>
                <select
                  id={`${idPrefix}-commitment`}
                  value={value.commitmentPct === null ? "" : String(value.commitmentPct)}
                  onChange={(e) => onChange({ ...value, commitmentPct: e.target.value === "" ? null : Number(e.target.value) })}
                  className={`${FIELD} mt-2 min-h-11 sm:max-w-xs`}
                  required
                >
                  <option value="">{t({ message: "Choose your commitment", context: "terms commitment" })}</option>
                  {choicesFor(roles).map((n) => (
                    <option key={n} value={n}>
                      {n}%
                    </option>
                  ))}
                </select>
                <p className={`${HINT} mt-2`} data-commitment-hint="">
                  {t`This is about energy and attention, never hours. You can change it later.`}
                </p>
                {ceiling && value.commitmentPct !== null && value.commitmentPct > 0 && (
                  <p className="mt-2 font-semibold text-foreground" aria-live="polite" data-commitment-ceiling="">
                    {t({ message: `${ceilingAtWords(ceiling, value.commitmentPct)} at this commitment`, context: "terms commitment: the most the role pays at the chosen commitment" })}
                  </p>
                )}
                {ceiling && <PayAskField idPrefix={idPrefix} value={value.payAsk ?? null} onChange={(payAsk) => onChange({ ...value, payAsk })} />}
              </div>
            )}
          </div>
        );
      })}
      </div>
      {problem && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {problem}
        </p>
      )}
    </fieldset>
  );
}

/** The commitments one role offers: from its minimum, when it states one (Rye, 14 Nov 2026); the usual choices otherwise. */
function choicesFor(roles: ReadonlyArray<TermsRole>): readonly number[] {
  const min = roles.length === 1 ? roles[0].commitmentMin : null;
  return typeof min === "number" ? commitmentChoices(min) : CANDIDATE_COMMITMENTS;
}

/**
 * THE OPTIONAL PAY ASK (Rye, 14 Nov 2026, ruling 3): a monthly amount, or "negotiate on the first call if
 * chosen". Either way the contract sets the amount, at or under the ceiling. Choosing neither is fine.
 */
function PayAskField({ idPrefix, value, onChange }: { idPrefix: string; value: PayAsk | null; onChange: (next: PayAsk | null) => void }) {
  const { t } = useLingui();
  const kind = value?.kind ?? null;
  return (
    <fieldset className="mt-4 grid gap-2 border-t border-border pt-3" data-pay-ask="">
      <legend className="text-sm font-semibold text-foreground">{t({ message: "What you would ask (optional)", context: "terms: the pay ask" })}</legend>
      <label className="flex min-h-11 items-center gap-2 text-foreground">
        <input type="radio" name={`${idPrefix}-ask`} className="size-5 accent-notice" checked={kind === "amount"} onChange={() => onChange({ kind: "amount", monthly: value?.kind === "amount" ? value.monthly : 0 })} />
        {t({ message: "A monthly amount", context: "terms: the pay ask" })}
      </label>
      {kind === "amount" && (
        <input
          id={`${idPrefix}-ask-amount`}
          type="number"
          inputMode="numeric"
          min={1}
          step={100}
          aria-label={t({ message: "The monthly amount you would ask", context: "terms: the pay ask" })}
          value={value?.kind === "amount" && value.monthly > 0 ? String(value.monthly) : ""}
          onChange={(e) => onChange({ kind: "amount", monthly: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
          className={`${FIELD} min-h-11 sm:max-w-xs`}
          data-pay-ask-amount=""
        />
      )}
      <label className="flex min-h-11 items-center gap-2 text-foreground">
        <input type="radio" name={`${idPrefix}-ask`} className="size-5 accent-notice" checked={kind === "negotiate"} onChange={() => onChange({ kind: "negotiate" })} />
        {t({ message: "Negotiate on the first call if chosen", context: "terms: the pay ask" })}
      </label>
      {kind && (
        <button type="button" onClick={() => onChange(null)} className="justify-self-start text-sm text-muted-foreground underline underline-offset-4">
          {t({ message: "Leave it blank", context: "terms: the pay ask" })}
        </button>
      )}
      <p className={HINT}>{t({ message: "Either way, the contract sets the amount, at or under what the role pays at your commitment.", context: "terms: the pay ask" })}</p>
    </fieldset>
  );
}

// Kept so a test can hold the lines the lead named word for word.
export { COMMITMENT_HINT, SET_TOGETHER, TERMS_HINT };
