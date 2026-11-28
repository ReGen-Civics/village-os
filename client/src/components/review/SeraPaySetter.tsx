/**
 * THE ROLE'S OWN PAY SETTER, OPENED UNDER A PAY ROW IN SERA'S LIST.
 *
 * It is RolePayWithEngine, the same setter the org chart draws, handed two
 * things: what Sera lists for this role (from the row), and the effort
 * estimate stored with the role's last pay setting (read here, as the person).
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
import { payCall, readStoredEstimate, type SeraPay, type StoredEstimate } from "@/lib/seraPay";

export default function SeraPaySetter({ role, sera, onSet }: { role: { id: string; name: string }; sera: SeraPay; onSet?: () => void }) {
  const [stored, setStored] = useState<StoredEstimate | null>(null);
  useEffect(() => {
    let gone = false;
    void readStoredEstimate(role.id).then((estimate) => {
      if (!gone) setStored(estimate);
    });
    return () => {
      gone = true;
    };
  }, [role.id]);
  const call = useCallback((path: string, body?: unknown, method?: string) => payCall(path, body, method, (words) => toast.error(words)), []);
  return <RolePayWithEngine role={role} call={call} onSaved={() => onSet?.()} sera={sera} stored={stored} />;
}
