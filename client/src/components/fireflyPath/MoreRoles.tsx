/**
 * MORE THAN ONE ROLE IN ONE APPLICATION (the lead, 17 Nov 2026, confirmed 18 Nov): one person may propose for
 * several roles, across circles, in one collective proposal, with a commitment for each. Each role keeps its own
 * price, split and agreement, and the prices add up ("two roles at 50% are rewarded like one whole role").
 *
 * Drawn on The terms, under the first role's own commitment: each role added with its own commitment, suggested
 * price and split (`CommitmentFor`, the same control the first role uses), a way to add another role from any
 * circle, and the total across every role. Loaded lazily, so none of it rides /propose-a-role's first view
 * (scripts/route-first-view.json).
 *
 * A COMING-SOON ROLE: ITS WAITLIST FIRST, AND AN EARLY APPLICATION (the lead, 20 Nov 2026). It is listed under the
 * picker as not open yet, each with the link to join its waitlist on the roles page (`waitlistHref` in
 * shared/roleListing.ts) and, after it, "Apply early", which adds it here on its own terms. The server keeps it
 * marked as an early application (shared/openProposals.ts `notYetOpen`).
 *
 * The cap on a price stays the server's to judge and is never shown here. Nothing ranks or judges anyone.
 */
import { useLingui } from "@lingui/react/macro";
import { askPeriod, ceilingAt } from "@shared/commitmentRange";
import { waitlistHref } from "@shared/roleListing";
import { moneyWords } from "@shared/roleRewardWords";
import { perPeriod } from "@/components/roleCard/rewardWords";
import { BTN_SECONDARY, EYEBROW, FIELD, HINT, LABEL, LINK, TILE } from "@/components/journey/look";
import { CommitmentFor, EMPTY_TERMS_STEP, type TermsRole, type TermsStepValue } from "@/components/governance/TermsEight";
import { EarlyWords } from "./EarlyWords";

/** A role the form offers, as this step reads it. */
export interface MoreRolesRole extends TermsRole {
  circle: string;
  held?: boolean;
  /** Every place taken, still recruiting: offered, marked "More players welcome". */
  stillRecruiting?: boolean;
  /** Not open yet: its waitlist first, and added only as an early application (the lead, 20 Nov 2026). */
  comingSoon?: boolean;
  /** A future venture asks for a pitch of its own: never added here. */
  futureVenture?: boolean;
}

/** A role added after the first, with its own commitment, price ask and split. */
export interface ExtraRole {
  roleId: string;
  terms: TermsStepValue;
}

/** What one role adds to the total: their own price when they wrote one in the role's period, else the suggested price at their commitment. */
function priceOf(role: TermsRole | undefined, v: TermsStepValue): { amount: number; currency: string; per: NonNullable<TermsRole["ceiling"]>["per"] } | null {
  const c = role?.ceiling;
  if (!c || !v.commitmentPct) return null;
  const ask = v.payAsk;
  const amount = ask?.kind === "amount" && askPeriod(ask) === c.per ? ask.monthly : ceilingAt(c.amount, v.commitmentPct);
  return amount > 0 ? { amount, currency: c.currency, per: c.per } : null;
}

export default function MoreRoles({
  offered,
  first,
  firstTerms,
  extras,
  onChange,
  max,
  problemOf,
}: {
  offered: ReadonlyArray<MoreRolesRole>;
  first: MoreRolesRole;
  firstTerms: TermsStepValue;
  extras: ReadonlyArray<ExtraRole>;
  onChange: (next: ExtraRole[]) => void;
  max: number;
  problemOf: (index: number) => string | null;
}) {
  const { t, i18n } = useLingui();
  const byId = new Map(offered.map((r) => [r.id, r]));
  const chosen = new Set([first.id, ...extras.map((x) => x.roleId)]);
  // Open roles and held roles still recruiting; never a fully held role, a future venture, or a role not open yet.
  const addable = offered.filter((r) => !chosen.has(r.id) && !r.held && !r.futureVenture && !r.comingSoon);
  // Not open yet: shown under the picker, each with its waitlist and then "Apply early" (the lead, 20 Nov 2026).
  const notYet = offered.filter((r) => !chosen.has(r.id) && r.comingSoon && !r.futureVenture);
  const optionName = (r: MoreRolesRole) =>
    r.stillRecruiting
      ? t({ message: `${r.name}: More players welcome`, context: "founding application, a held role that is still recruiting, to add" })
      : r.name;
  const circles = Array.from(new Set(addable.map((r) => r.circle)));
  const set = (i: number, terms: TermsStepValue) => onChange(extras.map((x, j) => (j === i ? { ...x, terms } : x)));
  const remove = (i: number) => onChange(extras.filter((_, j) => j !== i));
  const add = (id: string) => {
    if (!id || chosen.has(id) || extras.length + 1 >= max) return;
    onChange([...extras, { roleId: id, terms: EMPTY_TERMS_STEP }]);
  };

  // THE TOTAL ACROSS ROLES: the commitments added, and the prices added when every priced role reads in one currency and period.
  const all = [{ role: first as TermsRole, terms: firstTerms }, ...extras.map((x) => ({ role: byId.get(x.roleId) as TermsRole | undefined, terms: x.terms }))];
  const pctTotal = all.reduce((n, x) => n + (x.terms.commitmentPct ?? 0), 0);
  const prices = all.map((x) => priceOf(x.role, x.terms)).filter((p): p is NonNullable<typeof p> => !!p);
  const oneKind = prices.length > 0 && prices.every((p) => p.currency === prices[0].currency && p.per === prices[0].per);
  const priceTotal = oneKind ? prices.reduce((n, p) => n + p.amount, 0) : null;

  return (
    <section aria-labelledby="more-roles-h" className="grid gap-4" data-more-roles="">
      <div className="grid gap-1">
        <h3 id="more-roles-h" className={LABEL}>
          {t({ message: "More than one role", context: "founding application, roles added to one application" })}
        </h3>
        <p className={HINT}>
          {t({ message: `Up to ${max} roles in one application, in any circle, each with its own commitment, price and agreement. The prices add up: two roles at 50% are rewarded like one whole role.`, context: "founding application, roles added to one application" })}
        </p>
      </div>
      {extras.map((x, i) => {
        const role = byId.get(x.roleId);
        if (!role) return null;
        const problem = problemOf(i + 1);
        return (
          <div key={x.roleId} className={`${TILE} grid scroll-mt-24 gap-3`} data-more-role={i + 1} tabIndex={-1}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={EYEBROW}>{role.circle}</p>
                <p className="break-words font-display text-xl text-foreground">{role.name}</p>
              </div>
              <button type="button" onClick={() => remove(i)} className={`${BTN_SECONDARY} jw-btn min-h-11`} data-remove-role={x.roleId}>
                {t({ message: `Remove ${role.name}`, context: "founding application, roles added to one application" })}
              </button>
            </div>
            {role.comingSoon && (
              <p className="border-l-4 border-notice pl-3 text-sm text-foreground" data-more-role-early="">
                {t({ message: "An early application. This role isn't open yet: we may not get back to you, and the card details may change.", context: "founding application, a coming-soon role added early" })}
              </p>
            )}
            <CommitmentFor idPrefix={`more-role-${i + 1}`} role={role} value={x.terms} onChange={(next) => set(i, next)} named />
            {problem && (
              <p className="border-l-4 border-notice pl-3 text-sm font-medium text-foreground" data-field-problem="">
                {problem}
              </p>
            )}
          </div>
        );
      })}
      {extras.length + 1 < max && addable.length > 0 && (
        <div className="grid gap-2">
          <label htmlFor="more-roles-add" className={LABEL}>
            {t({ message: "Add another role", context: "founding application, roles added to one application" })}
          </label>
          <select id="more-roles-add" value="" onChange={(e) => add(e.target.value)} className={`${FIELD} min-h-11 py-3 sm:max-w-md`} data-add-role="">
            <option value="">{t({ message: "Choose a role", context: "founding application, roles added to one application" })}</option>
            {circles.map((c) => (
              <optgroup key={c} label={c}>
                {addable.filter((r) => r.circle === c).map((r) => (
                  <option key={r.id} value={r.id}>
                    {optionName(r)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}
      {notYet.length > 0 && (
        <div className="grid gap-1" data-roles-not-open="">
          <p className={HINT}>
            {t({ message: "Not open yet. Join a role's waitlist to hear when it opens.", context: "founding application, coming-soon roles under the picker" })} <EarlyWords />
          </p>
          <ul className="grid gap-1">
            {notYet.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 text-sm">
                <a className={`${LINK} inline-flex min-h-11 items-center`} href={waitlistHref(r.id)} data-waitlist-role={r.id}>
                  {t({ message: `Join the waitlist for ${r.name}`, context: "founding application, a coming-soon role's waitlist" })}
                </a>
                {extras.length + 1 < max && (
                  <button type="button" className={`${LINK} inline-flex min-h-11 items-center`} onClick={() => add(r.id)} data-apply-early={r.id}>
                    {t({ message: `Apply early for ${r.name}`, context: "founding application, add a coming-soon role as an early application" })}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {extras.length > 0 && (
        <p className={`${TILE} text-foreground`} data-roles-total="" aria-live="polite">
          {priceTotal !== null
            ? t({ message: `Across your ${all.length} roles: ${pctTotal}% commitment in all, and ${perPeriod(i18n, moneyWords(priceTotal, prices[0].currency, i18n.locale), prices[0].per)} together.`, context: "founding application, the total across roles" })
            : t({ message: `Across your ${all.length} roles: ${pctTotal}% commitment in all.`, context: "founding application, the total across roles" })}
        </p>
      )}
    </section>
  );
}
