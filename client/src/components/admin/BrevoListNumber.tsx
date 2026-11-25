/**
 * THE BREVO LIST'S NUMBER, on the Brevo card in Admin, Integrations (lead's ask, 25 Nov 2026: "should be set on
 * the same card"). It reads and writes the game variable `entrance.brevo_list_id` through the variables route
 * every dial uses, so there is one store and Game Mechanics shows the same value.
 */
import { useEffect, useId, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { API_BASE, authHeaders, refusal } from "./adminApi";

export const BREVO_LIST_DIAL = "entrance.brevo_list_id";

export default function BrevoListNumber({ password }: { password: string }) {
  const { t } = useLingui();
  const id = useId();
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`${API_BASE}/admin/variables`, { headers: authHeaders(password) })
      .then((r) => r.json().catch(() => null))
      .then((body) => {
        if (!live) return;
        const dial = (body?.categories ?? []).flatMap((c: any) => c.variables ?? []).find((v: any) => v.key === BREVO_LIST_DIAL);
        const value = dial ? String(dial.value ?? dial.default ?? "0") : "0";
        setSaved(value);
        setDraft(value);
      })
      .catch(() => live && setSaved("0"));
    return () => {
      live = false;
    };
  }, [password]);

  const save = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`${API_BASE}/admin/variables/${encodeURIComponent(BREVO_LIST_DIAL)}`, {
        method: "PUT",
        headers: authHeaders(password, { "Content-Type": "application/json" }),
        body: JSON.stringify({ value: draft.trim() }),
      });
      if (!res.ok) {
        setNote({ ok: false, text: refusal(await res.json().catch(() => ({})), t({ message: "That number was not saved.", context: "admin integrations: Brevo list number" })) });
        return;
      }
      await res.json().catch(() => null);
      setSaved(draft.trim());
      setNote({ ok: true, text: t({ message: "Saved.", context: "admin integrations: Brevo list number" }) });
    } catch {
      setNote({ ok: false, text: t({ message: "That number was not saved. Check your connection.", context: "admin integrations: Brevo list number" }) });
    } finally {
      setBusy(false);
    }
  };

  const changed = saved !== null && draft.trim() !== saved;
  return (
    <div className="mt-3 flex flex-col gap-1" data-brevo-list="">
      <label htmlFor={`${id}-list`} className="text-sm font-medium text-foreground">
        {t({ message: "List number", context: "admin integrations: Brevo list number field" })}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={`${id}-list`}
          inputMode="numeric"
          value={draft}
          disabled={saved === null}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
          className="w-32 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-deep/40"
        />
        <button type="button" onClick={() => void save()} disabled={busy || !changed || !draft.trim()} className="min-h-11 rounded-lg bg-teal-deep px-3 py-2 text-sm font-medium text-white hover:bg-teal-deep-dark disabled:opacity-50">
          {t({ message: "Save number", context: "admin integrations: Brevo list number" })}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t({ message: "The number of the Brevo list visitors join. 0 means nobody is sent to Brevo.", context: "admin integrations: Brevo list number hint" })}
      </p>
      {note && (
        <p role={note.ok ? "status" : "alert"} className={`text-xs ${note.ok ? "text-open" : "text-destructive"}`}>
          {note.text}
        </p>
      )}
    </div>
  );
}
