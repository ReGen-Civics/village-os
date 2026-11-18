/**
 * /budget: the village's cash budget, read by every member (budgets spec R23,
 * `GET /api/budgets` from the member rung). The moon's figure, every line that
 * touches the moon, and, for whoever the server's door lets change the budget
 * (`role.pay`, admin or not), the editor as its own chunk. Admins also open it
 * in Admin, Cash Budget.
 *
 * A lazy route; the desk is a lazy chunk of its own, and the editor another.
 */
import { lazy, Suspense } from "react";
import Layout from "@/components/Layout";
import { useLingui } from "@lingui/react/macro";
import { useAuth } from "@/contexts/AuthContext";
import { authToken } from "@/lib/gameApi";
import { SignInDoors } from "@/components/modules/ModuleGate";
import { BreathingLoader } from "@/components/natural";
import { CARD, EYEBROW, H1, HINT, LEDE, WORLD } from "@/components/journey/look";
import { SHEET_LOOK } from "@/components/budgets/budgetLook";

const BudgetDesk = lazy(() => import("@/components/budgets/BudgetDesk"));

export default function Budget() {
  const { t } = useLingui();
  const { user, token } = useAuth();
  const bearer = token ?? authToken() ?? "";
  return (
    <Layout>
      <div className={WORLD} data-world="night">
        <div className="container mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12">
          <header className="flex flex-col gap-3">
            <p className={EYEBROW}>{t({ message: "Cash budget", context: "budget page" })}</p>
            <h1 className={H1}>{t({ message: "What the village can pay in cash", context: "budget page" })}</h1>
            <p className={LEDE}>
              {t({ message: "The cash the village plans for role pay and quest pay this moon, line by line, and what is left once the pay already promised is taken off. Every member can read it. The people who hold the budget power change it.", context: "budget page" })}
            </p>
          </header>
          {!user ? (
            <section className={CARD}>
              <p className={`${HINT} mb-4`}>{t({ message: "Sign in to read the village's cash budget.", context: "budget page" })}</p>
              <SignInDoors next="/budget" align="start" />
            </section>
          ) : (
            <Suspense fallback={<BreathingLoader />}>
              <BudgetDesk bearer={bearer} look={SHEET_LOOK} />
            </Suspense>
          )}
        </div>
      </div>
    </Layout>
  );
}
