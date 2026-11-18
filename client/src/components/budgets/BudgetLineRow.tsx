/**
 * One budget line as every member reads it: its label, category, period and
 * planned amount, the amount in the village's currency when the line is in
 * another, spent only when the server sent it (R23: `cash.pay` holders), and
 * its note. `children` is where the editor puts its buttons.
 */
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { formatMoney } from "@shared/money";
import type { BudgetLine } from "./budgetApi";
import type { BudgetLook } from "./budgetLook";
import { CATEGORY_WORDS, STATUS_WORDS } from "./budgetWords";

export default function BudgetLineRow({ line, villageCurrency, look, children }: { line: BudgetLine; villageCurrency: string | null; look: BudgetLook; children?: ReactNode }) {
  const { t, i18n } = useLingui();
  const foreign = !!villageCurrency && line.currency.toUpperCase() !== villageCurrency.toUpperCase();
  return (
    <li className={`${look.tile} flex flex-col gap-2`} data-budget-line={line.id} data-status={line.status}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={`font-semibold text-foreground ${line.status === "withdrawn" ? "line-through opacity-70" : ""}`}>{line.label}</p>
        <p className="font-semibold text-foreground">{formatMoney(line.plannedMinor, line.currency)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={look.chip}>{i18n._(CATEGORY_WORDS[line.category])}</span>
        <span className={look.chip}>{line.periodKey}</span>
        {line.status !== "approved" && <span className={look.chip}>{i18n._(STATUS_WORDS[line.status])}</span>}
        {line.villageWide && <span className={look.chip}>{t({ message: "Whole village", context: "budget line scope" })}</span>}
      </div>
      {foreign && (
        <p className={look.hint}>
          {line.convertedMinor === null
            ? t({ message: "No rate is locked for this currency yet, so this line does not count.", context: "budget line in another currency" })
            : t({ message: `About ${formatMoney(line.convertedMinor, villageCurrency!)} at the locked rate.`, context: "budget line in another currency" })}
        </p>
      )}
      {line.spentMinor !== null && (
        <p className={look.hint}>{t({ message: `Spent so far: ${formatMoney(line.spentMinor, line.currency)}`, context: "budget line spent" })}</p>
      )}
      {line.note && <p className={look.hint}>{line.note}</p>}
      {children}
    </li>
  );
}
