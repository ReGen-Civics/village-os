/**
 * WHAT A PAY ROW IN SERA'S LIST OFFERS.
 *
 * Who sets pay, as before. And, for a reader the pay route lets through, one
 * control that opens the role's own pay setter under the row (Rye, 27 Nov
 * 2026: "Sera, can also make suggestions for pay and new roles, but with our
 * confirmation."). The confirmation is made in that setter, by that person,
 * through the pay route and its rules. The row itself sends nothing and has
 * no tick; opening the setter sends nothing either.
 *
 * "Lets through" is the standing the pay settings read answers for this reader
 * (lib/seraPay.ts), which is null whenever the pay route would refuse them: a
 * member with no standing, anybody under a deny, and an admin where the
 * village holds the power itself. Those readers see who sets pay and nothing
 * to press.
 */
import { lazy, Suspense, useEffect, useId, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { whoSetsPayWords, type Door } from "@shared/seraDecides";
import type { ListedDifference } from "@/lib/seraReview";
import { readPayDoor, seraPayFromRow } from "@/lib/seraPay";
import { secondary } from "@/components/review/seraStyles";

// The setter and the valuation engine load only when somebody opens one.
const SeraPaySetter = lazy(() => import("@/components/review/SeraPaySetter"));

const QUIET = "text-[13px] text-muted-foreground";

/** Whether this reader may set pay. False until the read answers, and when it does not. */
function useMaySetPay(): boolean {
  const [may, setMay] = useState(false);
  useEffect(() => {
    let gone = false;
    void readPayDoor().then((door) => {
      if (!gone) setMay(door !== null);
    });
    return () => {
      gone = true;
    };
  }, []);
  return may;
}

export default function SeraPayRow({ d, pay, agent, onSet }: { d: ListedDifference; pay: Door | null; agent: string; onSet?: () => void }) {
  const may = useMaySetPay();
  const [open, setOpen] = useState(false);
  const panel = useId();
  const roleId = d.subject.ourId;
  const canOpen = may && !!roleId;
  if (!pay && !canOpen) return null;
  return (
    <div className="space-y-1.5">
      {pay ? <p className={QUIET}>{whoSetsPayWords(pay)}</p> : null}
      {canOpen && roleId ? (
        <>
          <button type="button" aria-expanded={open} aria-controls={panel} data-set-pay={d.key} onClick={() => setOpen((o) => !o)} className={secondary}>
            {open ? <Trans context="sera pay">Close this role's pay</Trans> : <Trans context="sera pay">Open this role's pay</Trans>}
          </button>
          {open ? (
            <div id={panel} className="rounded-xl border border-border bg-card p-3">
              <Suspense fallback={<p className={QUIET}><Trans context="sera pay">Opening this role's pay.</Trans></p>}>
                <SeraPaySetter role={{ id: roleId, name: d.subject.name }} sera={seraPayFromRow(d, agent)} onSet={onSet} />
              </Suspense>
            </div>
          ) : (
            <p className={QUIET}>
              <Trans context="sera pay">Nothing is set from this list. This opens the role's pay, where you set it.</Trans>
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
