/**
 * The cash budget inside the admin panel, beside the other books a treasurer
 * keeps (CHANGELOG: "the Treasurer uploads a cash budget in Admin"). The same
 * desk every member reads at /budget; the server decides who may change it
 * (`role.pay`, the one door in server/routes/budgets.ts), and the editor shows
 * only when that door is open.
 */
import { lazy, Suspense } from "react";
import { Trans } from "@lingui/react/macro";
import { ADMIN_LOOK } from "@/components/budgets/budgetLook";

const BudgetDesk = lazy(() => import("@/components/budgets/BudgetDesk"));

export default function BudgetsTab({ password }: { password: string }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground"><Trans context="admin budgets tab">Cash budget</Trans></h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          <Trans context="admin budgets tab">What the village plans to pay in cash this moon, line by line, and what is left once the pay already promised is taken off. The pay engine reads the figure that is left.</Trans>
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground"><Trans context="admin budgets tab">Opening the budget…</Trans></p>}>
        <BudgetDesk bearer={password} look={ADMIN_LOOK} />
      </Suspense>
      <p className="text-sm"><a className="underline font-semibold text-foreground" href="/budget"><Trans context="admin budgets tab">Open the budget as its own page, the one every member reads</Trans></a></p>
    </div>
  );
}
