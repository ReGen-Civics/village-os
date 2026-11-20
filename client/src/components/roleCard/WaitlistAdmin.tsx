/**
 * THE COMING-SOON WAITLIST, FOR ADMINS ONLY (shared/roleWaitlist.ts): who asked to hear when a role opens,
 * grouped by role with a count. Mounted on /roles only for a reader `useIsAdmin` says is an admin, and loaded
 * lazily, so a member's page never asks the admin route. A list, never a ranking: nothing here selects anyone.
 * Remove takes one row out when its person asks. "Write to everyone waiting" opens a letter that is sent only
 * when the person presses send (WaitlistLetter.tsx), and the letters sent so far are listed below, with no address.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { gameFetch } from "@/lib/gameApi";
import { civilDayWords } from "@shared/seasonPlans";
import type { WaitlistRow } from "@shared/roleWaitlist";
import { waitlistByRole } from "@shared/roleWaitlistLetters";
import { BTN_SECONDARY, HINT, TILE } from "@/components/journey/look";

const WaitlistLetter = lazy(() => import("@/components/roleCard/WaitlistLetter"));

interface SentLetter {
  id: string;
  at: string;
  by: string;
  line: string;
}

export default function WaitlistAdmin() {
  const { t } = useLingui();
  const [rows, setRows] = useState<WaitlistRow[] | null>(null);
  const [writing, setWriting] = useState<string | null>(null);
  const [sent, setSent] = useState<SentLetter[]>([]);
  const [blocked, setBlocked] = useState<string | null>(null);
  const loadSent = useCallback(() => {
    void gameFetch("/api/admin/roles/waitlist-letters")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setSent(Array.isArray(d.sent) ? d.sent : []);
        setBlocked(typeof d.blocked === "string" ? d.blocked : null);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    let live = true;
    void gameFetch("/api/admin/roles/waitlist")
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((d) => live && setRows(Array.isArray(d?.rows) ? d.rows : []))
      .catch(() => live && setRows([]));
    loadSent();
    return () => {
      live = false;
    };
  }, [loadSent]);
  const groups = useMemo(() => waitlistByRole(rows ?? []), [rows]);
  if (!rows) return null;
  const remove = async (id: string) => {
    const r = await gameFetch(`/api/admin/roles/waitlist/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (r.ok) setRows((rs) => (rs ?? []).filter((x) => x.id !== id));
  };
  return (
    <details className={`${TILE} mb-8`} data-waitlist-admin={rows.length}>
      <summary className="cursor-pointer font-semibold text-foreground">
        {t({ message: `Waitlist for coming-soon roles (${rows.length})`, context: "roles page, admins only: the waitlist" })}
      </summary>
      <p className={`mt-2 ${HINT}`}>
        {t({ message: "Only admins see this. Nothing is sent unless a person writes a letter and presses send.", context: "roles page, admins only: the waitlist" })}
      </p>
      <div className="mt-3 grid gap-4">
        {groups.map((g) => (
          <section key={g.roleId} className="grid gap-2" data-waitlist-role={g.roleId}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground">{t({ message: `${g.name}: ${g.count} waiting`, context: "roles page, admins only: one role's waitlist and its count" })}</h3>
              <button type="button" className={BTN_SECONDARY} disabled={blocked !== null} onClick={() => setWriting(writing === g.roleId ? null : g.roleId)}>
                {t({ message: `Write to everyone waiting for ${g.name}`, context: "roles page, admins only: open the letter" })}
              </button>
            </div>
            {blocked && writing === null && <p className={HINT}>{blocked}</p>}
            {writing === g.roleId && (
              <Suspense fallback={null}>
                <WaitlistLetter roleId={g.roleId} roleName={g.name} count={g.count} onDone={loadSent} />
              </Suspense>
            )}
            <ul className="grid gap-2">
              {g.rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground">
                  <span className="min-w-0 break-words">
                    <span className="font-semibold">{r.email}</span>
                    {r.whatsapp ? ` · ${r.whatsapp}` : ""} · {civilDayWords(r.createdAt.slice(0, 10))}
                  </span>
                  <button type="button" className={BTN_SECONDARY} onClick={() => void remove(r.id)}>
                    {t({ message: "Remove", context: "roles page, admins only: remove a waitlist sign-up" })}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {sent.length > 0 && (
        <section className="mt-4 grid gap-1" data-waitlist-sent>
          <h3 className="font-semibold text-foreground">{t({ message: "Letters sent so far", context: "roles page, admins only: the sent log" })}</h3>
          <ul className={`grid gap-1 ${HINT}`}>
            {sent.map((s) => (
              <li key={s.id}>
                {civilDayWords(s.at.slice(0, 10))} · {s.by} · {s.line}
              </li>
            ))}
          </ul>
        </section>
      )}
    </details>
  );
}
