/**
 * THE NEWCOMER'S BUDDY, chosen in the adopt act (the lead, 27 Nov 2026: "The buddy by default will be the Ops role
 * unless I choose someone else"). Left on the default, whoever holds the welcoming role is the buddy; picking a member
 * sends their id with the adoption. The list is the team the walkthrough already offers for reference owners.
 */
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { gameFetch } from "@/lib/gameApi";
import { FIELD, HINT, LABEL } from "@/components/journey/look";

export default function BuddyPicker({ applicationRef, value, onChange, startNow = false, onStartNow }: { applicationRef: string; value: string; onChange: (id: string) => void; startNow?: boolean; onStartNow?: (v: boolean) => void }) {
  const { t } = useLingui();
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    let alive = true;
    void gameFetch(`/api/governance/applications/${encodeURIComponent(applicationRef)}/walkthrough`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setMembers(Array.isArray(d?.walkthrough?.members) ? d.walkthrough.members : []))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [applicationRef]);
  if (!members.length) return null;
  return (
    <label className="mt-3 block" data-buddy-picker="">
      <span className={LABEL}>{t({ message: "Their buddy for the first week", context: "open proposal: the adopt act's buddy" })}</span>
      <select className={`mt-1 min-h-11 ${FIELD}`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t({ message: "Whoever holds the welcoming role (the default)", context: "open proposal: the default buddy" })}</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <span className={`block ${HINT}`}>{t({ message: "Their name and role go in the start letter and on their profile.", context: "open proposal: what the buddy choice does" })}</span>
      {onStartNow && (
        // Ruling 8: by default they start on the all-hands day on or after the next season begins.
        <span className="mt-3 flex min-h-11 items-center gap-2 text-foreground" data-start-now="">
          <input type="checkbox" className="size-5" checked={startNow} onChange={(e) => onStartNow(e.target.checked)} aria-describedby="start-now-hint" />
          {t({ message: "Start now: on the next all-hands day", context: "open proposal: the adopt act's start now" })}
        </span>
      )}
      {onStartNow && <span id="start-now-hint" className={`block ${HINT}`}>{t({ message: "Left off, they start on the all-hands day on or after the next season begins. Ops decides.", context: "open proposal: what start now does" })}</span>}
    </label>
  );
}
