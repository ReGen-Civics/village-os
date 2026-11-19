/**
 * THE SPLIT, OFFERED AND PROPOSED (the lead, 17 Nov 2026), for the people deciding an application: each share
 * of the village's offer at the applicant's commitment beside what they proposed, percent and amount. A split the
 * applicant changed by hand carries a clear badge and its changed shares are marked; an untouched split shows no
 * badge. Facts side by side: nothing ranks or judges the change, and the contract sets the pay.
 */
import { useLingui } from "@lingui/react/macro";
import { changedShares, splitChanged, type ProposalSplit } from "@shared/proposalSplit";
import { moneyWords } from "@shared/roleRewardWords";
import { CHIP } from "@/components/journey/look";
import { ShareLabel, useShareNames } from "@/components/ContributionWord";

export default function SplitReview({ split, currency }: { split: ProposalSplit | null | undefined; currency: string | null }) {
  const { t, i18n } = useLingui();
  const names = useShareNames();
  if (!split || !split.proposed.shares.length) return null;
  const changed = splitChanged(split.offered, split.proposed);
  const marks = changedShares(split.offered, split.proposed);
  const money = (n: number | undefined) => (typeof n === "number" && currency ? moneyWords(n, currency, i18n.locale) : null);
  const cell = (pct: number | undefined, amount: number | undefined) => {
    const m = money(amount);
    return typeof pct === "number" ? (m ? `${pct}% · ${m}` : `${pct}%`) : "";
  };
  return (
    <div className="grid gap-2" data-split-review="" data-split-changed={changed ? "yes" : "no"}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-muted-foreground">{t({ message: `Cash, ${names.equity} and ${names.credits}`, context: "open proposal: the split heading, with the village's token names" })}</p>
        {changed && (
          <span className={CHIP} data-split-changed-badge="">
            {t({ message: "Split changed by applicant", context: "open proposal: the split badge" })}
          </span>
        )}
      </div>
      <table className="w-full text-left text-sm text-foreground">
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="py-1 pr-3 font-semibold">{t({ message: "Share", context: "open proposal: the split table" })}</th>
            <th scope="col" className="py-1 pr-3 font-semibold">{t({ message: "Offered", context: "open proposal: the split table" })}</th>
            <th scope="col" className="py-1 font-semibold">{t({ message: "Proposed", context: "open proposal: the split table" })}</th>
          </tr>
        </thead>
        <tbody>
          {split.proposed.shares.map((s, i) => {
            const o = split.offered.shares[i];
            const mark = marks[i];
            return (
              <tr key={s.label} className={mark ? "bg-notice/10 font-semibold" : ""} data-split-row={s.label} data-split-row-changed={mark ? "yes" : "no"}>
                <th scope="row" className={`py-1.5 pl-2 pr-3 font-medium capitalize ${mark ? "border-l-4 border-notice" : "border-l-4 border-transparent"}`}>
                  <ShareLabel label={s.label} />
                  {mark && <span className="ml-2 text-xs font-semibold normal-case text-notice">{t({ message: "changed", context: "open proposal: a changed share" })}</span>}
                </th>
                <td className="py-1.5 pr-3">{cell(o?.pct, o?.amount)}</td>
                <td className="py-1.5">{cell(s.pct, s.amount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {split.offered.total !== null && split.proposed.total !== null && split.offered.total !== split.proposed.total && (
        <p className="text-xs text-muted-foreground" data-split-totals="">
          {t({ message: `Offered at the suggested price, ${money(split.offered.total)}; proposed at their price, ${money(split.proposed.total)}.`, context: "open proposal: the split's two totals" })}
        </p>
      )}
    </div>
  );
}
