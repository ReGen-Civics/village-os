/**
 * /governance/treasury: THE GOVERNANCE PAGE'S TREASURY VIEW. The village's cash budget lives here, beside Now,
 * Decisions and How we decide (the lead, 27 Nov 2026: "why is there a cash budget page?! This can just be built into
 * the governance section under the treasury section"). /budget, its old address, redirects to #cash-budget.
 *
 * Nothing here decides anything. The desk is the same BudgetDesk Admin draws: every member reads it (budgets spec
 * R23, `GET /api/budgets` from the member rung) and the editor opens only for whoever the server lets change the
 * budget. Whoever holds a treasury power (token.mint, cash.pay, moon.approve_alone) also gets the door to the
 * village's books at /treasury.
 *
 * A lazy route; the desk is a lazy chunk of its own.
 */
import { lazy, Suspense } from "react";
import { Link } from "wouter";
import { Trans, useLingui } from "@lingui/react/macro";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { authToken } from "@/lib/gameApi";
import { SignInDoors } from "@/components/modules/ModuleGate";
import { BreathingLoader } from "@/components/natural";
import { CARD, EYEBROW, H1, H2, HINT, LEDE, LINK, WORLD } from "@/components/journey/look";
import { SHEET_LOOK } from "@/components/budgets/budgetLook";
import GovernanceTabs from "@/components/governance/now/GovernanceTabs";
import { anyTreasuryDoor, useTreasuryDoors } from "@/components/treasury/useTreasuryDoors";

const BudgetDesk = lazy(() => import("@/components/budgets/BudgetDesk"));

/** Where the cash budget sits, for the /budget redirect and every link to it. */
export const CASH_BUDGET_HREF = "/governance/treasury#cash-budget";

export default function GovernanceTreasury() {
  const { t } = useLingui();
  const { user, token } = useAuth();
  const bearer = token ?? authToken() ?? "";
  const doors = useTreasuryDoors(user ? token : null);
  return (
    <Layout>
      <div className={WORLD} data-world="night">
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:py-12 xl:max-w-[1200px]">
          <header className="space-y-2">
            <p className={EYEBROW}>
              <Trans context="governance now: eyebrow">How the village decides</Trans>
            </p>
            <h1 className={H1}>
              <Trans context="governance now: h1">Governance</Trans>
            </h1>
            <p className={LEDE}>
              <Trans context="governance treasury: lede">The village's cash, in the open: what it plans to pay this moon and what is left.</Trans>
            </p>
          </header>
          <GovernanceTabs signedIn={!!authToken()} />
          <section id="cash-budget" aria-labelledby="cash-budget-h" className="scroll-mt-28 space-y-4" data-governance-treasury="cash-budget">
            <div className="space-y-2">
              <p className={EYEBROW}>{t({ message: "Cash budget", context: "budget page" })}</p>
              <h2 id="cash-budget-h" className={H2}>
                {t({ message: "What the village can pay in cash", context: "budget page" })}
              </h2>
              <p className={HINT}>
                {t({ message: "The cash the village plans for role pay and quest pay this moon, line by line, and what is left once the pay already promised is taken off. Every member can read it. The people who hold the budget power change it.", context: "budget page" })}
              </p>
            </div>
            {!user ? (
              <div className={CARD}>
                <p className={`${HINT} mb-4`}>{t({ message: "Sign in to read the village's cash budget.", context: "budget page" })}</p>
                <SignInDoors next={CASH_BUDGET_HREF} align="start" />
              </div>
            ) : (
              <Suspense fallback={<BreathingLoader />}>
                <BudgetDesk bearer={bearer} look={SHEET_LOOK} />
              </Suspense>
            )}
          </section>
          {anyTreasuryDoor(doors) ? (
            <p className={HINT} data-governance-treasury="books">
              <Link href="/treasury" className={LINK}>
                <Trans context="governance treasury: the door to the village's books, for a holder of a treasury power">The village's books: mint, End of Moon pay and cash to send</Trans>
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </Layout>
  );
}
