/**
 * THE COMING-SOON WAITLIST, FOR ADMINS ONLY (shared/roleWaitlist.ts): who asked to hear when a role opens.
 * Mounted on /roles only for a reader `useIsAdmin` says is an admin, and loaded lazily, so a member's page
 * never asks the admin route. A list, never a ranking: nothing here selects anyone. Remove takes one row out
 * when its person asks.
 */
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { gameFetch } from "@/lib/gameApi";
import { civilDayWords } from "@shared/seasonPlans";
import type { WaitlistRow } from "@shared/roleWaitlist";
import { BTN_SECONDARY, HINT, TILE } from "@/components/journey/look";

export default function WaitlistAdmin() {
  const { t } = useLingui();
  const [rows, setRows] = useState<WaitlistRow[] | null>(null);
  useEffect(() => {
    let live = true;
    void gameFetch("/api/admin/roles/waitlist")
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((d) => live && setRows(Array.isArray(d?.rows) ? d.rows : []))
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, []);
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
      <p className={`mt-2 ${HINT}`}>{t({ message: "Only admins see this. Nothing is sent from it.", context: "roles page, admins only: the waitlist" })}</p>
      <ul className="mt-3 grid gap-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-card-foreground">
            <span className="min-w-0 break-words">
              <span className="font-semibold">{r.email}</span>
              {r.whatsapp ? ` · ${r.whatsapp}` : ""} · {r.roles.map((x) => x.name).join(", ")} · {civilDayWords(r.createdAt.slice(0, 10))}
            </span>
            <button type="button" className={BTN_SECONDARY} onClick={() => void remove(r.id)}>
              {t({ message: "Remove", context: "roles page, admins only: remove a waitlist sign-up" })}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
