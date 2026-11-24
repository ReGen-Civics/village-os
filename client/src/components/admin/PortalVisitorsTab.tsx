/**
 * PORTAL VISITORS: everyone who entered the portal (shared/entrance.ts), newest first, with the
 * people who asked for updates as a list of their own, a CSV of either, and a way to forget one
 * person when they ask. Read through the one capability gate on `intake.moderate`
 * (server/routes/entrance.ts). Nothing here sends anybody an email.
 */
import { useCallback, useEffect, useState } from "react";
import { DoorOpen } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { API_BASE, authHeaders, refusal } from "./adminApi";
import type { PortalEntry } from "@shared/entrance";

const BTN = "min-h-11 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50";

const day = () => new Date().toISOString().slice(0, 10);

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function PortalVisitorsTab({ password }: { password: string }) {
  const { t } = useLingui();
  const [entries, setEntries] = useState<PortalEntry[] | null>(null);
  const [updatesOnly, setUpdatesOnly] = useState(false);
  const [error, setError] = useState("");
  const [forget, setForget] = useState("");
  const [forgetNote, setForgetNote] = useState("");

  const query = updatesOnly ? "?updates=1" : "";

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/entrance/entries${query}`, { headers: authHeaders(password) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(refusal(body, t({ message: "The list did not load.", context: "admin portal visitors" })));
        setEntries([]);
        return;
      }
      setEntries(Array.isArray(body.entries) ? body.entries : []);
    } catch {
      setError(t({ message: "The list did not load. Check your connection.", context: "admin portal visitors" }));
    }
  }, [password, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = async () => {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/entrance/entries.csv${query}`, { headers: authHeaders(password) });
      if (!res.ok) {
        setError(refusal(await res.json().catch(() => ({})), t({ message: "The CSV did not download.", context: "admin portal visitors" })));
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `portal-visitors-${updatesOnly ? "updates-" : ""}${day()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t({ message: "The CSV did not download.", context: "admin portal visitors" }));
    }
  };

  const forgetPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = forget.trim();
    if (!email) return;
    setForgetNote("");
    try {
      const res = await fetch(`${API_BASE}/admin/entrance/entries?email=${encodeURIComponent(email)}`, { method: "DELETE", headers: authHeaders(password) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setForgetNote(refusal(body, t({ message: "That did not go through.", context: "admin portal visitors" })));
        return;
      }
      const n = Number(body.removed ?? 0);
      setForgetNote(n === 0 ? t({ message: `Nothing is kept for ${email}.`, context: "admin portal visitors" }) : t({ message: `Forgotten: every entry for ${email}. Their device will meet the entrance again.`, context: "admin portal visitors" }));
      setForget("");
      void load();
    } catch {
      setForgetNote(t({ message: "That did not go through. Check your connection.", context: "admin portal visitors" }));
    }
  };

  return (
    <div className="space-y-6" data-testid="portal-visitors">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <DoorOpen className="h-5 w-5" aria-hidden="true" />
            {t({ message: "Portal visitors", context: "admin portal visitors" })}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t({ message: "Everyone who gave their name and email at the portal entrance, newest first. The entrance is on while the setting Ask visitors for their name and email before the portal is on, in Game Mechanics. Nobody here has been emailed by the platform.", context: "admin portal visitors" })}
          </p>
        </div>
        <button type="button" onClick={exportCsv} className={BTN}>
          {t({ message: "Download CSV", context: "admin portal visitors" })}
        </button>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground">
        <input type="checkbox" className="size-5" checked={updatesOnly} onChange={(e) => setUpdatesOnly(e.target.checked)} />
        {t({ message: "Only the people who asked for updates", context: "admin portal visitors" })}
      </label>

      {error && (
        <p role="alert" className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
          {error}
        </p>
      )}

      {entries === null ? (
        <p className="text-sm text-muted-foreground">{t({ message: "Loading the visitors.", context: "admin portal visitors" })}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{updatesOnly ? t({ message: "Nobody has asked for updates yet.", context: "admin portal visitors" }) : t({ message: "Nobody has entered the portal yet.", context: "admin portal visitors" })}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t({ message: "Portal visitors", context: "admin portal visitors" })}</caption>
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2">{t({ message: "Entered", context: "admin portal visitors" })}</th>
                <th scope="col" className="px-3 py-2">{t({ message: "Name", context: "admin portal visitors" })}</th>
                <th scope="col" className="px-3 py-2">{t({ message: "Email", context: "admin portal visitors" })}</th>
                <th scope="col" className="px-3 py-2">{t({ message: "WhatsApp", context: "admin portal visitors" })}</th>
                <th scope="col" className="px-3 py-2">{t({ message: "Link", context: "admin portal visitors" })}</th>
                <th scope="col" className="px-3 py-2">{t({ message: "Updates", context: "admin portal visitors" })}</th>
                <th scope="col" className="px-3 py-2">{t({ message: "Was going to", context: "admin portal visitors" })}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{when(e.at)}</td>
                  <td className="px-3 py-2 font-medium text-foreground break-words">{e.name}</td>
                  <td className="px-3 py-2 break-all">{e.email}</td>
                  <td className="px-3 py-2 break-all">{e.whatsapp ?? ""}</td>
                  <td className="px-3 py-2 break-all">{e.link ?? ""}</td>
                  <td className="px-3 py-2">{e.updates ? t({ message: "Yes", context: "admin portal visitors: asked for updates" }) : t({ message: "No", context: "admin portal visitors: asked for updates" })}</td>
                  <td className="px-3 py-2 break-all text-muted-foreground">{e.nextPath ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={forgetPerson} className="space-y-2 rounded-xl border border-border bg-card p-4">
        <label htmlFor="portal-forget" className="block text-sm font-semibold text-foreground">
          {t({ message: "Forget a person, when they ask", context: "admin portal visitors" })}
        </label>
        <p className="text-sm text-muted-foreground">{t({ message: "Every entry kept for this address is deleted for good.", context: "admin portal visitors" })}</p>
        <div className="flex flex-wrap gap-2">
          <input id="portal-forget" type="email" value={forget} onChange={(e) => setForget(e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder={t({ message: "their email address", context: "admin portal visitors" })} />
          <button type="submit" className={BTN} disabled={!forget.trim()}>
            {t({ message: "Forget", context: "admin portal visitors" })}
          </button>
        </div>
        {forgetNote && (
          <p role="status" className="text-sm text-muted-foreground">
            {forgetNote}
          </p>
        )}
      </form>
    </div>
  );
}
