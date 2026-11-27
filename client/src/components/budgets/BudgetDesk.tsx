/**
 * THE CASH BUDGET DESK (budgets spec v0.2; CHANGELOG "the Treasurer uploads a
 * cash budget in Admin").
 *
 * Reads `GET /api/budgets` for this moon: the one figure the pay engine reads
 * (`cashBudgetLeft`: planned, committed, left), every line that touches the
 * moon, and the door the server answers for this reader. Every member reads
 * it (R23). When the door is open (`door.mayWrite`, the village's one check for
 * `role.pay`, `budgetDoorOf` in server/routes/budgets.ts) and the caller lets
 * it, the editor loads as its own chunk; nobody else downloads it.
 *
 * Drawn in Admin (components/admin/BudgetsTab.tsx) and on /governance/treasury
 * (pages/GovernanceTreasury.tsx), each with its own look and its own bearer.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { formatMoney } from "@shared/money";
import { fetchCall, sentenceOf, type BudgetCall, type BudgetRead } from "./budgetApi";
import type { BudgetLook } from "./budgetLook";
import BudgetLineRow from "./BudgetLineRow";
import { NOT_COUNTED_WORDS } from "./budgetWords";

const BudgetEditor = lazy(() => import("./BudgetEditor"));

export interface BudgetDeskProps {
  /** The session the desk reads and writes as. */
  bearer: string;
  look: BudgetLook;
  /** Offer the editor when the server's door is open for this reader. */
  editable?: boolean;
  /** For a suite: the call the desk makes, in place of `fetch`. */
  call?: BudgetCall;
  /**
   * Told each read the desk takes. Governance's Treasury reads the server's door from it (`door.mayWrite`, the
   * village's one check for `role.pay`) to show the pricing desk to the same holders, with no second request.
   */
  onRead?: (read: BudgetRead) => void;
  /**
   * Draw the moon's figure panel (planned, already promised, left). Governance's Treasury draws the same figure as
   * its first screen's purses from `onRead`, and passes false so it is read once and shown once.
   */
  showFigure?: boolean;
}

const dayOf = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export default function BudgetDesk({ bearer, look, editable = true, call: given, onRead, showFigure = true }: BudgetDeskProps) {
  const { t, i18n } = useLingui();
  const [call] = useState<BudgetCall>(() => given ?? fetchCall(bearer));
  const [read, setRead] = useState<BudgetRead | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const told = useRef(onRead);
  told.current = onRead;

  const load = useCallback(async () => {
    const r = await call("/budgets", undefined, "GET");
    if (r.ok && r.data && Array.isArray(r.data.lines)) {
      setRead(r.data as BudgetRead);
      setProblem(null);
      told.current?.(r.data as BudgetRead);
      return;
    }
    if (r.status === 0) setProblem(t({ message: "The budget could not be reached just now. Check the connection and try again.", context: "budget desk error" }));
    else if (r.status === 401) setProblem(t({ message: "Sign in to read the budget.", context: "budget desk error" }));
    else setProblem(sentenceOf(r.data, t({ message: "The budget could not be read just now. Try again in a moment.", context: "budget desk error" })));
  }, [call, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (problem) return <p className={look.error} role="alert">{problem}</p>;
  if (!read) return <p className={look.hint}>{t({ message: "Reading the budget…", context: "budget desk loading" })}</p>;

  const { figure, moon, villageCurrency } = read;
  const notCounted = figure?.working?.notCounted ?? [];
  const reasons = Array.from(new Set(notCounted.map((n) => n.reason))).map((r) => i18n._(NOT_COUNTED_WORDS[r]));
  const canEdit = editable && read.door?.mayWrite === true;
  const Heading = look.hTag;

  return (
    <div className="flex flex-col gap-6" data-budget-desk>
      {showFigure && <section className={look.panel} aria-labelledby="budget-moon">
        <p className={look.eyebrow}>{t({ message: "This moon", context: "budget desk" })}</p>
        <h2 id="budget-moon" className={`${look.h2} mb-1`}>{t({ message: "Cash for role pay and quest pay", context: "budget desk" })}</h2>
        <p className={`${look.hint} mb-5`}>{t({ message: `${dayOf(moon.startsOn)} to ${dayOf(moon.endsOn)}`, context: "budget desk moon dates" })}</p>
        {figure ? (
          <dl className="grid gap-3 sm:grid-cols-3" data-budget-figure>
            <div className={look.tile}>
              <dt className={look.label}>{t({ message: "Planned", context: "budget figure" })}</dt>
              <dd className={look.figure}>{formatMoney(figure.plannedMinor, figure.currency)}</dd>
            </div>
            <div className={look.tile}>
              <dt className={look.label}>{t({ message: "Already promised", context: "budget figure" })}</dt>
              <dd className={look.figure}>{formatMoney(figure.committedMinor, figure.currency)}</dd>
            </div>
            <div className={look.tile}>
              <dt className={look.label}>{t({ message: "Left this moon", context: "budget figure" })}</dt>
              <dd className={look.figure} data-budget-left>{formatMoney(figure.leftMinor, figure.currency)}</dd>
            </div>
          </dl>
        ) : (
          <p className={look.hint} data-budget-no-figure>
            {villageCurrency
              ? t({ message: "No line for role pay or quest pay counts in this moon yet, so the budget sets no limit on pay.", context: "budget desk no figure" })
              : t({ message: "The village has no currency set yet, so there is no figure to work out. An admin sets it in the setup wizard.", context: "budget desk no figure" })}
          </p>
        )}
        {notCounted.length > 0 && (
          <p className={`${look.hint} mt-4`}>
            {t({ message: `${notCounted.length} lines touch this moon and do not count yet: ${reasons.join("; ")}.`, context: "budget desk lines not counted" })}
          </p>
        )}
        {read.note?.note && <p className={`${look.hint} mt-4`}>{read.note.note}</p>}
      </section>}

      {canEdit ? (
        <Suspense fallback={<p className={look.hint}>{t({ message: "Opening the budget editor…", context: "budget desk loading" })}</p>}>
          <BudgetEditor call={call} read={read} look={look} reload={load} />
        </Suspense>
      ) : (
        <section className={look.panel} aria-labelledby="budget-lines">
          <Heading id="budget-lines" className={`${look.h2} mb-1`}>{t({ message: "The lines", context: "budget desk" })}</Heading>
          {read.door?.message && <p className={`${look.hint} mb-4`} data-budget-door>{read.door.message}</p>}
          {read.lines.length === 0 ? (
            <p className={look.hint}>{t({ message: "No budget line touches this moon yet.", context: "budget desk empty" })}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {read.lines.map((l) => <BudgetLineRow key={l.id} line={l} villageCurrency={villageCurrency} look={look} />)}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
