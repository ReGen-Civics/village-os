/**
 * WHO CHANGED THIS SETTING, WHEN, AND WHY (change requests, Rye 2026-11-06,
 * 3g: "a per-setting history: who changed it, when and why, with a link to
 * the vote").
 *
 * `HistoryEntry` is one row of the record, used by the whole-village history
 * on Game Mechanics and by `SettingHistory`, the small History toggle beside
 * every dial. Both read `GET /api/game/mechanics/history` (with `?key=` for
 * one setting) and send the member's sign-in, so the server can name people
 * the way III.2 allows: "Role (FirstName)" for a signed-in reader, the role
 * alone for anyone else. The page never builds a name itself.
 */
import { useCallback, useId, useState } from "react";
import { Link } from "wouter";
import { History } from "lucide-react";
import { authToken } from "@/lib/gameApi";
import { Trans, useLingui } from "@lingui/react/macro";

export interface Amendment {
  id: string;
  key: string;
  label: string;
  from: string | null;
  fromWasDefault: boolean;
  to: string | null;
  toIsDefault: boolean;
  /** The server held both values back (a credential), see server/lib/mechanicsHistory.ts. */
  withheld?: boolean;
  by: string | null;
  source: string;
  proposalRef: string | null;
  /** The proposal a vote made this change under: its title is the village's reason. */
  proposal?: { id: string; title: string; ballotId: string | null } | null;
  note: string | null;
  at: string;
}

/** The ballot id inside a stored reference (`bal:<id>`), or null. */
export function ballotIdIn(proposalRef: string | null | undefined): string | null {
  const m = /(?:^|\s)bal:(\S+)/.exec(String(proposalRef ?? ""));
  return m ? m[1] : null;
}

export function historyHeaders(): Record<string, string> {
  const t = authToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** How the change was made, in plain words. */
export function howChanged(h: Pick<Amendment, "source" | "by">): string {
  if (h.source === "governance") return "Decided by a village vote";
  if (h.source === "platform") return "A platform update";
  return h.by ? `Changed directly by ${h.by}` : "Changed directly";
}

const day = (at: string) => new Date(at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export function HistoryEntry({ h, valueOf }: { h: Amendment; valueOf: (key: string, raw: string | null) => string }) {
  const from = h.withheld ? "kept private" : `${valueOf(h.key, h.from)}${h.fromWasDefault ? " (default)" : ""}`;
  const to = h.withheld ? "kept private" : `${valueOf(h.key, h.to)}${h.toIsDefault ? " (back to default)" : ""}`;
  const ballot = h.proposal?.ballotId ?? ballotIdIn(h.proposalRef);
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-medium text-foreground">{h.label}</span>
        <span className="text-xs text-muted-foreground">{day(h.at)}</span>
      </div>
      <p className="text-sm text-muted-foreground mt-0.5">
        <span className="sr-only"><Trans context="SettingHistory, span">From </Trans></span>
        <del className="text-muted-foreground">{from}</del>
        <span aria-hidden="true"> → </span>
        <span className="sr-only"> <Trans context="SettingHistory, span">to </Trans></span>
        <ins className="no-underline font-semibold text-notice">{to}</ins>
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{howChanged(h)}</p>
      {h.proposal?.title && (
        <p className="text-xs text-muted-foreground mt-0.5">
          Why: {h.proposal.title}
          {ballot && (
            <>
              {" "}
              <Link
                href={`/governance/decisions/${ballot}`}
                className="inline-flex min-h-[44px] items-center text-notice underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trans context="SettingHistory, Link">Read the vote
              </Trans></Link>
            </>
          )}
        </p>
      )}
      {!h.proposal?.title && ballot && (
        <p className="text-xs mt-0.5">
          <Link
            href={`/governance/decisions/${ballot}`}
            className="inline-flex min-h-[44px] items-center text-notice underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trans context="SettingHistory, Link">Read the vote that decided this
          </Trans></Link>
        </p>
      )}
      {h.note && <p className="text-xs text-muted-foreground mt-0.5">{h.note}</p>}
    </>
  );
}

/** The History toggle beside one setting. */
export function SettingHistory({
  settingKey,
  label,
  valueOf,
}: {
  settingKey: string;
  label: string;
  valueOf: (key: string, raw: string | null) => string;
}) {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Amendment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const panelId = useId();

  const load = useCallback(() => {
    setFailed(false);
    setRows(null);
    fetch(`/api/game/mechanics/history?key=${encodeURIComponent(settingKey)}`, { headers: historyHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setFailed(true));
  }, [settingKey]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && rows === null && !failed) load();
  };

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t({ message: `History of ${label}`, context: "SettingHistory, aria-label" })}
        className="inline-flex min-h-[44px] items-center gap-1 text-xs text-notice hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        <Trans context="SettingHistory, button"><History className="w-3 h-3" aria-hidden="true" /> History
      </Trans></button>
      {open && (
        <div id={panelId} className="mt-1 rounded-lg border border-border bg-muted" data-setting-history={settingKey}>
          {failed ? (
            <p className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs text-muted-foreground" role="alert">
              That did not load.
              <button type="button" onClick={load} className="min-h-[44px] font-semibold text-notice hover:underline">
                <Trans context="SettingHistory, button">Try again
              </Trans></button>
            </p>
          ) : rows === null ? (
            <p className="px-3 py-2 text-xs text-muted-foreground" role="status"><Trans context="SettingHistory, p">Loading the record…</Trans></p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground"><Trans context="SettingHistory, p">No changes yet. It has been this way since the village began.</Trans></p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((h) => (
                <li key={h.id} className="px-3 py-2">
                  <HistoryEntry h={h} valueOf={valueOf} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
