/**
 * PORTAL VISITORS: everyone who entered the portal (shared/entrance.ts), newest first, with the
 * people who said yes to keeping in touch as a list of their own, the page each one first asked
 * for, the pages they opened since, a Make member button for a visitor who has made an account
 * (the existing super-vouch, which asks its own capability; offered only once the address is proved),
 * whether each address is verified (the code, or Google), a CSV of either, and a way to forget one
 * person when they ask. Each row shows what the visitor chose under "What draws you here?" and what
 * they have done since (applied, made an account, sent a form), matched by address. While the
 * village has a Brevo list set up, it also says who has reached it and sends those waiting. Read through the one capability gate on `intake.moderate`
 * (server/routes/entrance.ts). Nothing here sends anybody an email.
 */
import { useCallback, useEffect, useState } from "react";
import { DoorOpen } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import { API_BASE, authHeaders, refusal } from "./adminApi";
import { INTERESTS, type Interest, type PortalEntry } from "@shared/entrance";

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
  const [interest, setInterest] = useState<Interest | "">("");
  const [emailList, setEmailList] = useState(false);
  const [syncNote, setSyncNote] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [forget, setForget] = useState("");
  const [forgetNote, setForgetNote] = useState("");
  const [memberNote, setMemberNote] = useState("");
  const [admitting, setAdmitting] = useState("");

  const params = new URLSearchParams();
  if (updatesOnly) params.set("updates", "1");
  if (interest) params.set("interest", interest);
  const query = params.toString() ? `?${params.toString()}` : "";

  const interestWords: Record<Interest, string> = {
    seeder: t({ message: "Founding seeder", context: "admin portal visitors: what drew them" }),
    home: t({ message: "A home", context: "admin portal visitors: what drew them" }),
    visit: t({ message: "Visiting", context: "admin portal visitors: what drew them" }),
    role: t({ message: "A role", context: "admin portal visitors: what drew them" }),
    curious: t({ message: "Curious", context: "admin portal visitors: what drew them" }),
  };

  const since = (e: PortalEntry): string[] => {
    const j = e.journey;
    if (!j) return [];
    const out: string[] = [];
    for (const a of j.applications) out.push(t({ message: `Applied (${a.status})`, context: "admin portal visitors: a later step" }));
    if (j.account) out.push(t({ message: "Has an account", context: "admin portal visitors: a later step" }));
    for (const f of j.forms) out.push(t({ message: `Sent ${f.type}`, context: "admin portal visitors: a later step, naming the form" }));
    return out;
  };

  const syncWaiting = async () => {
    setSyncing(true);
    setSyncNote("");
    try {
      const res = await fetch(`${API_BASE}/admin/entrance/sync`, { method: "POST", headers: authHeaders(password) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSyncNote(refusal(body, t({ message: "That did not go through.", context: "admin portal visitors" })));
        return;
      }
      const sent = Number(body.sent ?? 0);
      const waiting = Number(body.waiting ?? 0);
      setSyncNote(waiting === 0 ? t({ message: "Nobody is waiting: everyone who said yes is on the list.", context: "admin portal visitors: email list" }) : t({ message: `${sent} of ${waiting} reached the email list.`, context: "admin portal visitors: email list" }));
      void load();
    } catch {
      setSyncNote(t({ message: "That did not go through. Check your connection.", context: "admin portal visitors" }));
    } finally {
      setSyncing(false);
    }
  };

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
      setEmailList(body.emailList === true);
    } catch {
      setError(t({ message: "The list did not load. Check your connection.", context: "admin portal visitors" }));
    }
  }, [password, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const makeMember = async (e: PortalEntry) => {
    const account = e.journey?.account;
    if (!account || admitting) return;
    setAdmitting(account.id);
    setMemberNote("");
    try {
      const res = await fetch(`${API_BASE}/members/${encodeURIComponent(account.id)}/super-vouch`, { method: "POST", headers: authHeaders(password) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMemberNote(refusal(body, t({ message: "That did not go through.", context: "admin portal visitors" })));
        return;
      }
      setMemberNote(t({ message: `${e.name} is a member now.`, context: "admin portal visitors: make member done" }));
      void load();
    } catch {
      setMemberNote(t({ message: "That did not go through. Check your connection.", context: "admin portal visitors" }));
    } finally {
      setAdmitting("");
    }
  };

  const updatesWords = (e: PortalEntry): string =>
    e.updates === "yes"
      ? t({ message: "Yes", context: "admin portal visitors: keep in touch answer" })
      : e.updates === "no"
        ? t({ message: "No", context: "admin portal visitors: keep in touch answer" })
        : t({ message: "Not answered", context: "admin portal visitors: keep in touch answer" });

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
      a.download = `portal-visitors-${updatesOnly ? "updates-" : ""}${interest ? `${interest}-` : ""}${day()}.csv`;
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
      if (body.listProblem) setError(String(body.listProblem));
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

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground">
          <input type="checkbox" className="size-5" checked={updatesOnly} onChange={(e) => setUpdatesOnly(e.target.checked)} />
          {t({ message: "Only the people who said yes to keeping in touch", context: "admin portal visitors" })}
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
          {t({ message: "What drew them", context: "admin portal visitors: filter" })}
          <select value={interest} onChange={(e) => setInterest(e.target.value as Interest | "")} className="min-h-11 rounded-lg border border-border bg-background px-2 text-sm">
            <option value="">{t({ message: "Anything", context: "admin portal visitors: filter, no interest chosen" })}</option>
            {INTERESTS.map((k) => (
              <option key={k} value={k}>
                {interestWords[k]}
              </option>
            ))}
          </select>
        </label>
        {emailList && (
          <button type="button" onClick={syncWaiting} className={BTN} disabled={syncing}>
            {t({ message: "Send those waiting to the email list", context: "admin portal visitors: email list" })}
          </button>
        )}
      </div>
      {memberNote && (
        <p role="status" className="text-sm text-muted-foreground">
          {memberNote}
        </p>
      )}
      {syncNote && (
        <p role="status" className="text-sm text-muted-foreground">
          {syncNote}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
          {error}
        </p>
      )}

      {entries === null ? (
        <p className="text-sm text-muted-foreground">{t({ message: "Loading the visitors.", context: "admin portal visitors" })}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{updatesOnly ? t({ message: "Nobody has said yes to keeping in touch yet.", context: "admin portal visitors" }) : t({ message: "Nobody has entered the portal yet.", context: "admin portal visitors" })}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t({ message: "Portal visitors", context: "admin portal visitors" })}</caption>
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2">{t({ message: "Entered", context: "admin portal visitors" })}</th>
                <th scope="col" className="px-3 py-2">{t({ message: "Name", context: "admin portal visitors" })}</th>
                <th scope="col" className="px-3 py-2">{t({ message: "Email", context: "admin portal visitors" })}</th>
                <th scope="col" className="px-3 py-2">{t({ message: "Address", context: "admin portal visitors: verified or not" })}</th>
                <th scope="col" className="px-3 py-2">{t({ message: "WhatsApp", context: "admin portal visitors" })}</th>
                <th scope="col" className="px-3 py-2">{t({ message: "Link", context: "admin portal visitors" })}</th>
                <th scope="col" className="px-3 py-2">{t({ message: "Drawn by", context: "admin portal visitors" })}</th>
                <th scope="col" className="px-3 py-2">{t({ message: "Keep in touch", context: "admin portal visitors" })}</th>
                <th scope="col" className="px-3 py-2">{t({ message: "Since entering", context: "admin portal visitors" })}</th>
                <th scope="col" className="px-3 py-2">{t({ message: "First asked for", context: "admin portal visitors" })}</th>
                <th scope="col" className="px-3 py-2">{t({ message: "Pages opened", context: "admin portal visitors" })}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{when(e.at)}</td>
                  <td className="px-3 py-2 font-medium text-foreground break-words">{e.name}</td>
                  <td className="px-3 py-2 break-all">{e.email}</td>
                  <td className="px-3 py-2">
                    {e.verifiedAt
                      ? t({ message: "Verified", context: "admin portal visitors: the address is proved" })
                      : e.codeRequired
                        ? t({ message: "Unverified", context: "admin portal visitors: the code has not come" })
                        : t({ message: "Not checked", context: "admin portal visitors: entered while no code could be sent" })}
                  </td>
                  <td className="px-3 py-2 break-all">{e.whatsapp ?? ""}</td>
                  <td className="px-3 py-2 break-all">{e.link ?? ""}</td>
                  <td className="px-3 py-2">{e.interest ? interestWords[e.interest] : ""}</td>
                  <td className="px-3 py-2">
                    {updatesWords(e)}
                    {e.updates === "yes" && emailList && (
                      <span className="block text-xs text-muted-foreground" title={e.syncError ?? undefined}>
                        {e.syncedAt ? t({ message: "On the email list", context: "admin portal visitors: email list" }) : e.syncError ? t({ message: "Not sent yet: see the reason", context: "admin portal visitors: email list" }) : t({ message: "Waiting", context: "admin portal visitors: email list" })}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {since(e).length ? (
                      <ul className="space-y-0.5">
                        {since(e).map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      t({ message: "Nothing yet", context: "admin portal visitors: no later step" })
                    )}
                    {e.journey?.account && !e.journey.account.member && (e.verifiedAt || e.journey.account.verified) && (
                      <button type="button" className={`${BTN} mt-2`} disabled={!!admitting} onClick={() => void makeMember(e)}>
                        {t({ message: "Make member", context: "admin portal visitors: admit a visitor with an account" })}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 break-all text-muted-foreground">{e.nextPath ?? ""}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {(e.views ?? []).length === 0 ? (
                      t({ message: "None yet", context: "admin portal visitors: no pages opened" })
                    ) : (
                      <details>
                        <summary className="cursor-pointer">{t({ message: `Opened: ${(e.views ?? []).length}`, context: "admin portal visitors: how many pages a visitor opened" })}</summary>
                        <ul className="mt-1 space-y-0.5">
                          {(e.views ?? []).map((v, i) => (
                            <li key={i} className="break-all">
                              <span className="whitespace-nowrap">{when(v.at)}</span> {v.path}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
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
        <p className="text-sm text-muted-foreground">{t({ message: "Every entry kept for this address is deleted for good, and the address comes off the email list.", context: "admin portal visitors" })}</p>
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
