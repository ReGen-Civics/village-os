/**
 * THE FULL-ACCESS SWITCH, for Admin, Players, Agents (the lead, 20 Nov 2026; shared/agentFullAccess.ts).
 *
 * One control: which role's agent has full access, or none. It names a ROLE, never a person, and reaches only the
 * agent of whoever holds a live seat in it, so it drops off when the seat changes hands. A person sets it; the
 * server refuses an agent account, and the connector can never reach the route. Turning it on or off is recorded
 * and posted to the Anchor Circle.
 *
 * READS OPEN (the lead, 25 Nov 2026), beside it: a second switch, off by default, that lets the same agent read the
 * village's pages without a listed path, as a plain member reads them, under the read floor. A person sets it too,
 * through its own route, and it is recorded and told to the Anchor Circle the same way.
 *
 * Light-only, like the rest of the admin tabs.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trans, useLingui } from "@lingui/react/macro";
import { API_BASE, authHeaders, refusal } from "./adminApi";

interface FullAccessAnswer {
  on: boolean;
  roleId: string | null;
  roleName: string | null;
  setBy: string | null;
  setAt: string | null;
  roles: Array<{ id: string; name: string }>;
  /** Reads open (25 Nov 2026). Absent on a server without it: then the second switch is not shown. */
  readsOpen?: boolean;
  readsSetBy?: string | null;
}

const field = "w-full rounded-md border border-border bg-white px-2 py-1 text-sm text-foreground";
const primary = "min-h-9 rounded-md bg-teal-deep px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60";

export default function AgentFullAccessPanel({ password }: { password: string }) {
  const { t } = useLingui();
  const [state, setState] = useState<FullAccessAnswer | null>(null);
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingReads, setSavingReads] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/admin/agent-accounts/full-access`, { headers: authHeaders(password) });
      if (!r.ok) return;
      const d = (await r.json()) as FullAccessAnswer;
      // A server without the switch answers something else: then there is nothing to show.
      if (!d || !Array.isArray(d.roles)) return setState(null);
      setState(d);
      setPick(d.roleId ?? "");
    } catch {
      setState(null);
    }
  }, [password]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === null) return null;
  const roleName = state.roleName ?? state.roleId ?? "";
  const setBy = state.setBy ?? t({ message: "a person", context: "full access, who set it when the name is unknown" });

  const save = async () => {
    const roleId = pick || null;
    const name = state.roles.find((r) => r.id === roleId)?.name ?? "";
    const ask = roleId
      ? t`Give full access to the agent of whoever holds ${name}? The Anchor Circle is told.`
      : t`Turn full access off? The Anchor Circle is told.`;
    if (!window.confirm(ask)) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/admin/agent-accounts/full-access`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ roleId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return toast.error(refusal(d, t`That did not save.`));
      toast.success(roleId ? t`Full access is on for that role's agent.` : t`Full access is off.`);
      void load();
    } finally {
      setSaving(false);
    }
  };

  const saveReads = async (on: boolean) => {
    const ask = on
      ? t`Open reads for the agent of whoever holds ${roleName}? The Anchor Circle is told.`
      : t`Close reads again? The Anchor Circle is told.`;
    if (!window.confirm(ask)) return;
    setSavingReads(true);
    try {
      const r = await fetch(`${API_BASE}/admin/agent-accounts/full-access/reads-open`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ on }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return toast.error(refusal(d, t`That did not save.`));
      toast.success(on ? t`Reads are open for that role's agent.` : t`Reads are closed again.`);
      void load();
    } finally {
      setSavingReads(false);
    }
  };
  const readsBy = state.readsSetBy ?? t({ message: "a person", context: "reads open, who set it when the name is unknown" });

  return (
    <div className="space-y-3 rounded-xl border border-border bg-white p-4" aria-label={t`Full access for one role's agent`}>
      <p className="text-sm font-semibold text-foreground"><Trans>Full access for one role's agent</Trans></p>
      <p role="note" className="rounded-md bg-amber-light px-3 py-2 text-sm text-notice">
        <Trans>Warning: with this on, the agent of whoever holds this role can make most admin changes, change settings, send email and accept proposals, each one approved in the chat and recorded, and every email names who it goes to before the yes. Money, secrets, erasure, the veto and the agent accounts stay a person's act.</Trans>
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="w-full text-sm text-foreground sm:w-auto">
          <Trans context="full access, the role picker">Role</Trans>
          <select aria-label={t`Role whose agent has full access`} className={field} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">{t({ message: "Off: no role", context: "full access, the role picker" })}</option>
            {state.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <button type="button" className={primary} disabled={saving || pick === (state.roleId ?? "")} onClick={() => void save()}>
          {saving ? t({ message: "Saving", context: "full access, the save button" }) : t({ message: "Save", context: "full access, the save button" })}
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        {state.on
          ? <Trans>On for the agent of whoever holds {roleName}. Set by {setBy}.</Trans>
          : <Trans>Off. Agents reach only the paths listed below and the changes approved one by one.</Trans>}
      </p>
      {typeof state.readsOpen === "boolean" && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm font-semibold text-foreground"><Trans context="agents panel, the reads open switch heading">Reads open</Trans></p>
          <p className="text-sm text-foreground">
            <Trans>With this on, the same agent may read the village's pages without a listed path, as a plain member reads them, so an admin's wider view never reaches it. Writes still need your yes in the chat. Secrets and keys, money and pay, applicant data, members' contact details and legal names, sign-in and tokens, the agent list, voice recordings and erasure records stay closed.</Trans>
          </p>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              aria-label={t`Reads open for the full-access role's agent`}
              checked={state.readsOpen}
              disabled={savingReads || (!state.on && !state.readsOpen)}
              onChange={(e) => void saveReads(e.target.checked)}
            />
            {state.readsOpen
              ? <Trans>Open. Set by {readsBy}.</Trans>
              : state.on
                ? <Trans>Closed. Tick to open reads.</Trans>
                : <Trans>Name a role above first.</Trans>}
          </label>
        </div>
      )}
    </div>
  );
}
