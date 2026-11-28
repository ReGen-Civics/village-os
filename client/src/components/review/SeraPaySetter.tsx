/**
 * THE ROLE'S OWN PAY SETTER, OPENED UNDER A PAY ROW IN SERA'S LIST.
 *
 * It is RolePayWithEngine, the same setter the org chart draws, handed what
 * Sera lists for this role (from the row), and, read here as the person, the
 * effort estimate stored with the role's last pay setting and the pay as it
 * stands. Handed her row, the setter arrives ready: her figure written and
 * chosen (Rye, 28 Nov 2026: "both write the figure and open the pay control to
 * show it, so that a player can simply accept or edit and accept").
 * Everything it sends goes through PUT /api/org/roles/:id/pay, so the pay
 * route's gate, its band, its reason and its second signer decide the outcome
 * exactly as they do from the org chart.
 *
 * Loaded on demand (SeraPayRow.tsx): the valuation engine is not part of the
 * list's first load.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import RolePayWithEngine from "@/components/valuation/RolePayWithEngine";
import { payCall, readPayHistory, type CurrentPay, type SeraPay, type StoredEstimate } from "@/lib/seraPay";

export default function SeraPaySetter({
  role,
  sera,
  onSet,
  onOutcome,
}: {
  role: { id: string; name: string };
  sera: SeraPay;
  /** Pay was set: the list may be read again. */
  onSet?: () => void;
  /** Whatever the pay route answered, for the walk through several roles. */
  onOutcome?: (state: "set" | "awaiting_second" | "village") => void;
}) {
  const [history, setHistory] = useState<{ stored: StoredEstimate | null; current: CurrentPay | null }>({ stored: null, current: null });
  useEffect(() => {
    let gone = false;
    void readPayHistory(role.id).then((h) => {
      if (!gone) setHistory(h);
    });
    return () => {
      gone = true;
    };
  }, [role.id]);
  const call = useCallback((path: string, body?: unknown, method?: string) => payCall(path, body, method, (words) => toast.error(words)), []);
  return <RolePayWithEngine role={role} call={call} onSaved={() => onSet?.()} sera={sera} stored={history.stored} current={history.current} onOutcome={onOutcome} />;
}
