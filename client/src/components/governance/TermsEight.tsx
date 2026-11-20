/**
 * THE EIGHT SETTINGS, with the role's own suggestion for each (joining lane PR 3).
 *
 * Term, Clocks, Rhythm, Allowance, Bonus, Goals, Scoreboard, Ending. The role card holds a
 * suggested wording per setting; the candidate marks each "I accept" or "let's talk", with an
 * optional note. The settings the role has not written are named once, in one line ("We'll set these
 * together: ..."; idea 16), and ask for no answer. Clocks also carries the candidate's commitment: a percentage of their energy
 * and attention, 0 to 100 in steps of ten, with no default. It is a planning signal, never hours.
 *
 * Drawn in the profile's look (docs/DESIGN_RULE.md): panels and tiles on the semantic tokens,
 * the eyebrow over each setting, gold focus, 44px targets. One component for both doors, the open
 * form and the member door, so they cannot drift apart.
 */
import { lazy, Suspense } from "react";
import { useLingui } from "@lingui/react/macro";
import GrowingField from "@/components/form/GrowingField";
import { commitmentChoices, type PayAsk } from "@shared/commitmentRange";
import PriceAsk from "./PriceAsk";
import type { ShapeShare, Split } from "@shared/proposalSplit";
import type { PayCeiling } from "@shared/roleCardSections";
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

// The split and its arithmetic load when the price step draws it, off /propose-a-role's first view (route-first-view.json).
const TermsSplit = lazy(() => import("./TermsSplit"));

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
  /** The role's pay ceiling for the full role, when its card says: the form suggests a price from it and offers the price popup. */
  ceiling?: PayCeiling | null;
  /** How many changes the applicant suggested to the role card, for the price popup's nudge. */
  suggestions?: number;
  /** The split in force on the role's card (its own shares, else the village's): the form offers it to adjust. */
  payShape?: ShapeShare[];
}

export interface TermsStepValue {
  answers: TermAnswers;
  /** Null until the person chooses: there is no default. */
  commitmentPct: number | null;
  /** Their optional pay ask (Rye, 14 Nov 2026): a monthly amount, or "negotiate on the first call if chosen". */
  payAsk?: PayAsk | null;
  /** Their cash, equity and credits split, as they left it (shared/proposalSplit.ts). Null: the role's split in force. */
  paySplit?: Split | null;
  /** The split the role card's Apply link carried, as written there ("50.50.0"), until the price step reads it. */
  splitQuery?: string;
  /** What the price step shows and the application sends, as TermsSplit.tsx works it: their split and whether they changed it. */
  paySplitView?: { shown: Split; changed: boolean; line: string } | null;
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
  priced,
}: {
  roles: ReadonlyArray<TermsRole>;
  value: TermsStepValue;
  onChange: (next: TermsStepValue) => void;
  problem?: string | null;
  idPrefix?: string;
  /** With several roles, the one this value's commitment, price and split are for (the lead, 17 Nov 2026); every other role brings its own. */
  priced?: string;
}) {
  const { t } = useLingui();
  // The role the commitment, price and split are for: the one role, or the one named.
  const one = roles.find((r) => r.id === priced) ?? (roles.length === 1 ? roles[0] : null);
  const labels: Record<TermKey, string> = {
    term: t({ message: "Term", context: "terms setting" }),
    clocks: t({ message: "Time", context: "terms setting" }),
    rhythm: t({ message: "Rhythm", context: "terms setting" }),
    allowance: t({ message: "Allowance", context: "terms setting" }),
    bonus: t({ message: "Bonus", context: "terms setting" }),
    goals: t({ message: "Goals", context: "terms setting" }),
    scoreboard: t({ message: "How we track progress", context: "terms setting" }),
    ending: t({ message: "Ending", context: "terms setting" }),
  };
  const several = roles.length > 1;
  /** What each role wrote for one setting, and the commitment it asks under Time. */
  const linesOf = (k: TermKey) =>
    roles
      .map((r) => ({ role: r, text: r.words?.[k]?.trim() ?? "", commitment: k === "clocks" ? (r.commitmentPct ?? null) : null }))
      .filter((l) => l.text || l.commitment !== null);
  /** The settings nobody has written: one line, "We'll set these together: ...", where eight blocks once said it each. */
  const together = TERM_KEYS.filter((k) => linesOf(k).length === 0);
  const togetherNames = together.map((k) => labels[k]).join(", ");
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
        const lines = linesOf(k);
        const written = lines.length > 0;
        // A setting no role has written is named once, in the line under the rows (idea 16); Time keeps its row for the commitment.
        if (!written && k !== "clocks") return null;
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
              <span className="sm:col-span-2" />
            )}
            {written && (
              <div className="flex gap-1 rounded-lg border border-border p-1 sm:w-48" role="radiogroup" aria-label={labels[k]}>
                {half("accept", t({ message: "I accept", context: "terms setting answer" }))}
                {half("talk", t({ message: "Let's talk", context: "terms setting answer" }))}
              </div>
            )}
            {written && answer?.choice === "talk" && (
              <div className="sm:col-span-2 sm:col-start-2">
                <GrowingField
                  aria-label={t`What you would like to talk about: ${labels[k]}`}
                  placeholder={t`A note, if you like`}
                  minRows={2}
                  clip={`term-${k}`}
                  limit={TERM_NOTE_MAX}
                  value={answer.note}
                  onChange={(note) => setAnswer(k, { choice: "talk", note })}
                  className={FIELD}
                />
              </div>
            )}
            {k === "clocks" && (
              <div className={`${TILE} sm:col-span-2 sm:col-start-2`} data-commitment="">
                <CommitmentFor idPrefix={idPrefix} role={one} roles={roles} value={value} onChange={onChange} named={several && !!one} />
              </div>
            )}
          </div>
        );
      })}
      </div>
      {together.length > 0 && (
        <p className="border-t border-border pt-4 text-foreground" data-set-together={together.join(" ")}>
          {together.length === 1
            ? t({ message: `We'll set this together: ${togetherNames}.`, context: "terms settings no role has written, in one line" })
            : t({ message: `We'll set these together: ${togetherNames}.`, context: "terms settings no role has written, in one line" })}
        </p>
      )}
      {problem && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {problem}
        </p>
      )}
    </fieldset>
  );
}

/** The commitments one role offers: from its minimum, when it states one (Rye, 14 Nov 2026); the usual choices otherwise. */
function choicesFor(role: TermsRole | null): readonly number[] {
  const min = role?.commitmentMin ?? null;
  return typeof min === "number" ? commitmentChoices(min) : CANDIDATE_COMMITMENTS;
}

/**
 * ONE ROLE'S COMMITMENT, PRICE AND SPLIT: the commitment chosen, the suggested price from it with the popup to propose
 * their own (Rye, 14 Nov 2026), and the split to adjust (17 Nov). Drawn in the Time row, and for each role added to
 * the application (components/fireflyPath/MoreRoles.tsx), so every role is offered on its own terms.
 */
export function CommitmentFor({ idPrefix, role, roles, value, onChange, named = false }: { idPrefix: string; role: TermsRole | null; roles?: ReadonlyArray<TermsRole>; value: TermsStepValue; onChange: (next: TermsStepValue) => void; named?: boolean }) {
  const { t } = useLingui();
  const ceiling = role?.ceiling ?? null;
  const splitRole = role && (role.payShape?.length ?? 0) > 0 ? role : null;
  return (
    <>
      <label htmlFor={`${idPrefix}-commitment`} className="text-sm font-semibold text-foreground">
        {named && role ? t({ message: `Your commitment: ${role.name}`, context: "terms commitment, one of several roles" }) : t({ message: "Your commitment", context: "terms commitment" })}
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
        {choicesFor(role ?? (roles?.length === 1 ? roles[0] : null)).map((n) => (
          <option key={n} value={n}>
            {n}%
          </option>
        ))}
      </select>
      <p className={`${HINT} mt-2`} data-commitment-hint="">
        {t`This is about energy and attention, never hours. You can change it later.`}
      </p>
      {ceiling && <PriceAsk idPrefix={idPrefix} ceiling={ceiling} pct={value.commitmentPct} value={value.payAsk ?? null} onChange={(payAsk) => onChange({ ...value, payAsk })} suggestionCount={role?.suggestions ?? 0} />}
      {splitRole && (
        <div className="mt-4">
          <Suspense fallback={null}>
            <TermsSplit idPrefix={idPrefix} role={splitRole} value={value} onChange={onChange} />
          </Suspense>
        </div>
      )}
    </>
  );
}

// Kept so a test can hold the lines the lead named word for word.
export { COMMITMENT_HINT, SET_TOGETHER, TERMS_HINT };

/** The terms as the saved draft keeps them: the split's percents only (client/src/components/fireflyPath/applyDraft.ts). */
export function draftTerms(v: TermsStepValue): { answers: TermAnswers; commitmentPct: number | null; payAsk?: PayAsk | null; paySplit: ShapeShare[] | null } {
  return { answers: v.answers, commitmentPct: v.commitmentPct, payAsk: v.payAsk ?? null, paySplit: v.paySplit ? v.paySplit.shares.map((s) => ({ label: s.label, pct: s.pct })) : null };
}

/** A saved draft's split percents as the step holds them: the amounts are worked again at the price in force. */
export const splitOfDraft = (pcts: ShapeShare[] | null | undefined): Split | null => (pcts?.length ? { total: null, shares: pcts.map((p) => ({ label: p.label, pct: p.pct })) } : null);

/**
 * What the role card's Apply link carried (client/src/components/roleCard/applyChoice.ts): the commitment chosen on
 * the slider, and the split when the reader changed it. Each only when it fits this role; the link wins over a
 * draft, because it is the reader's latest choice.
 */
export function withCardChoice(v: TermsStepValue, search: string, role: Pick<TermsRole, "commitmentMin" | "payShape"> | undefined): TermsStepValue {
  if (!role) return v;
  const q = new URLSearchParams(search);
  const n = Number(q.get("commitment"));
  const pct = commitmentChoices(role.commitmentMin).includes(n) ? n : null;
  const split = q.get("split");
  return { ...v, ...(pct !== null ? { commitmentPct: pct } : {}), ...(split && role.payShape?.length ? { splitQuery: split.slice(0, 64) } : {}) };
}

/** The split the application sends for one role (shared/proposalSplit.ts): every share, with amounts when there is a price. */
export function splitBody(v: TermsStepValue): { paySplit?: { shares: Split["shares"] } } {
  return v.paySplitView ? { paySplit: { shares: v.paySplitView.shown.shares } } : {};
}
