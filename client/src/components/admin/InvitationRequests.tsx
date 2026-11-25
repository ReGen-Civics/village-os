/**
 * INVITATION REQUESTS: visitors who asked, from their visitor profile, for an invitation to full membership
 * (shared/visitorProfile.ts). Each row names who asked, what they wrote, what draws them and how many
 * applications they sent. Promote makes them a member, one or many at once: their member account, already
 * verified, admitted through the super vouch, and one letter with a link to set a password and fill out their
 * profile. Decline leaves a few words on their profile, and they may ask again after 30 days.
 *
 * Read through `intake.moderate`; Promote and Decline ask `member.superVouch`, the key that admits members
 * (server/routes/visitorProfile.ts), so whoever may admit members today is who may promote.
 */
import { useCallback, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { API_BASE, authHeaders, refusal } from "./adminApi";
import type { InviteRequest } from "@shared/visitorProfile";

const BTN = "min-h-11 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50";
const BTN_MAIN = "min-h-11 rounded-lg bg-teal-deep px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-deep-dark disabled:opacity-50";

const when = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
};

export default function InvitationRequests({ password, onChange }: { password: string; onChange?: () => void }) {
  const { t } = useLingui();
  const [requests, setRequests] = useState<InviteRequest[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/visitors/invitations`, { headers: authHeaders(password) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(refusal(body, t({ message: "The requests did not load.", context: "admin invitation requests" })));
        setRequests([]);
        return;
      }
      setRequests(Array.isArray(body.requests) ? body.requests : []);
    } catch {
      setNote(t({ message: "The requests did not load. Check your connection.", context: "admin invitation requests" }));
    }
  }, [password]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (kind: "promote" | "decline", ids: string[]) => {
    if (!ids.length || busy) return;
    setBusy(true);
    setNote("");
    try {
      const res = await fetch(`${API_BASE}/admin/visitors/invitations/${kind}`, { method: "POST", headers: authHeaders(password, { "Content-Type": "application/json" }), body: JSON.stringify(kind === "decline" ? { ids, words } : { ids }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote(refusal(body, t({ message: "That did not go through.", context: "admin invitation requests" })));
        return;
      }
      const results: Array<{ ok: boolean; emailed?: boolean; message?: string }> = Array.isArray(body.results) ? body.results : [];
      const done = results.filter((r) => r.ok).length;
      const notes = results.filter((r) => !r.ok && r.message).map((r) => r.message);
      setNote(
        (kind === "promote"
          ? t({ message: `Promoted ${done} of ${results.length}. Each was emailed a link to set a password and fill out their profile.`, context: "admin invitation requests: promoted" })
          : t({ message: `Declined ${done} of ${results.length}. They read your words on their profile.`, context: "admin invitation requests: declined" })) + (notes.length ? ` ${notes.join(" ")}` : ""),
      );
      setPicked(new Set());
      setWords("");
      await load();
      onChange?.();
    } catch {
      setNote(t({ message: "That did not go through. Check your connection.", context: "admin invitation requests" }));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  const all = requests ?? [];
  const pickedIds = Array.from(picked);

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4" data-testid="invitation-requests">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <UserPlus className="h-5 w-5" aria-hidden="true" />
        {t({ message: `Invitation requests (${all.length})`, context: "admin invitation requests: heading with the count" })}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t({ message: "Visitors who asked for full membership from their visitor profile. Promote makes them a member and emails them a link to set a password. Promoting asks the power to admit members.", context: "admin invitation requests: what this is" })}
      </p>
      {note && (
        <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
          {note}
        </p>
      )}
      {requests === null ? (
        <p className="text-sm text-muted-foreground">{t({ message: "Loading the requests.", context: "admin invitation requests" })}</p>
      ) : all.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t({ message: "No requests waiting.", context: "admin invitation requests" })}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t({ message: "Invitation requests", context: "admin invitation requests" })}</caption>
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-2 py-2">
                    <input
                      type="checkbox"
                      className="size-5"
                      aria-label={t({ message: "Pick every request", context: "admin invitation requests: select all" })}
                      checked={picked.size === all.length && all.length > 0}
                      onChange={(e) => setPicked(e.target.checked ? new Set(all.map((r) => r.visitorId)) : new Set())}
                    />
                  </th>
                  <th scope="col" className="px-2 py-2">{t({ message: "Name", context: "admin portal visitors" })}</th>
                  <th scope="col" className="px-2 py-2">{t({ message: "Email", context: "admin portal visitors" })}</th>
                  <th scope="col" className="px-2 py-2">{t({ message: "Their words", context: "admin invitation requests: the note" })}</th>
                  <th scope="col" className="px-2 py-2">{t({ message: "Asked", context: "admin invitation requests: when" })}</th>
                  <th scope="col" className="px-2 py-2">{t({ message: "Applications", context: "admin invitation requests" })}</th>
                  <th scope="col" className="px-2 py-2"><span className="sr-only">{t({ message: "Promote", context: "admin invitation requests" })}</span></th>
                </tr>
              </thead>
              <tbody>
                {all.map((r) => (
                  <tr key={r.visitorId} className="border-t border-border align-top" data-invitation-request={r.email}>
                    <td className="px-2 py-2">
                      <input type="checkbox" className="size-5" aria-label={t({ message: `Pick ${r.name}`, context: "admin invitation requests: select one" })} checked={picked.has(r.visitorId)} onChange={() => toggle(r.visitorId)} />
                    </td>
                    <td className="px-2 py-2 font-medium text-foreground">
                      {r.name}
                      {r.hasAccount && <span className="block text-xs text-muted-foreground">{t({ message: "Has an account: promoting admits it", context: "admin invitation requests" })}</span>}
                    </td>
                    <td className="break-all px-2 py-2">{r.email}</td>
                    <td className="px-2 py-2 text-muted-foreground">{r.note ?? ""}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">{when(r.requestedAt)}</td>
                    <td className="px-2 py-2 text-muted-foreground">{r.applications}</td>
                    <td className="px-2 py-2">
                      <button type="button" className={BTN_MAIN} disabled={busy} onClick={() => void act("promote", [r.visitorId])}>
                        {t({ message: "Promote to member", context: "admin invitation requests: promote one" })}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
            <button type="button" className={BTN_MAIN} disabled={busy || !pickedIds.length} onClick={() => void act("promote", pickedIds)} data-promote-picked="">
              {t({ message: `Promote the ${pickedIds.length} picked`, context: "admin invitation requests: bulk promote" })}
            </button>
            <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm text-foreground">
              {t({ message: "Words for the people you decline (optional, they read it on their profile)", context: "admin invitation requests: decline words" })}
              <input value={words} maxLength={1000} onChange={(e) => setWords(e.target.value)} className="min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <button type="button" className={BTN} disabled={busy || !pickedIds.length} onClick={() => void act("decline", pickedIds)}>
              {t({ message: `Decline the ${pickedIds.length} picked`, context: "admin invitation requests: bulk decline" })}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
