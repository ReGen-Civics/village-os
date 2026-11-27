/**
 * THE APPROVAL INBOX (role journey L13, part A): one list of everything the
 * connector proposed and a person alone may do. Each card says who proposed
 * it, when, when it lapses, and what changes in plain words (before, after).
 * Approve or Decline one, or tick several and approve them together.
 *
 * Approving runs that thing's own admin route as THE PERSON PRESSING IT, so a
 * person without the power is told no by the route and the card stays. One
 * column, 44 pixel buttons, nothing that needs a wide screen: it is the page a
 * steward opens on a phone.
 *
 * WHERE IT LIVES (the lead, 27 Nov 2026: "/approvals becomes a view of Your work"). It is the Approvals section of
 * Your work (`/governance/work#approvals`), and the same component sits in Admin. Inside Your work a person the
 * inbox is not for sees no section at all (`hideRefused`), the way every other section of that page follows its
 * own key, and the page learns what the read found through `onRead`, so its summary can count what waits here.
 * Nothing about who may approve moved: the route still decides, as the person.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { BTN_PRIMARY, BTN_SECONDARY, CHIP_SOFT, HINT, TICK, TILE } from "@/components/journey/look";
import { byArrival } from "@/components/governance/deciderOrder";

interface Card {
  id: string;
  kind: string;
  title: string;
  by: string;
  at: string | null;
  expiresAt: string | null;
  words: { what: string; before: string; after: string };
  canRevert: boolean;
  decision: { state: string; by: string | null; at: string } | null;
  state: string;
}

/** What the read found, for the page around the inbox. `waiting` is 0 unless the read answered. */
export interface InboxRead {
  state: "ok" | "refused" | "failed";
  waiting: number;
}

/** A decided card's state as words. A state the page does not know shows nothing, never the raw word. */
const DECIDED_WORDS: Record<string, MessageDescriptor> = {
  approved: msg({ message: "Approved", context: "approval inbox: a decided proposal" }),
  declined: msg({ message: "Declined", context: "approval inbox: a decided proposal" }),
  expired: msg({ message: "Lapsed", context: "approval inbox: a decided proposal" }),
  reverted: msg({ message: "Put back", context: "approval inbox: a decided proposal" }),
};

const DAY_MS = 86_400_000;

/** Now and If you approve, set into the card's tile on the panel's own surface (a tile is never inside a tile). */
const INSET = "rounded-lg border border-border bg-card px-3 py-2";

export default function ApprovalInbox({
  headers,
  hideRefused = false,
  onRead,
}: {
  headers: () => Record<string, string>;
  /** Draw nothing for a person the inbox is not for (Your work), in place of the sentence Admin shows. */
  hideRefused?: boolean;
  /** Told after every read what it found. */
  onRead?: (read: InboxRead) => void;
}) {
  const { t, i18n } = useLingui();
  const [waiting, setWaiting] = useState<Card[] | null>(null);
  const [decided, setDecided] = useState<Card[]>([]);
  const [state, setState] = useState<"ok" | "refused" | "failed">("ok");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  // Held in a ref, so a page passing a fresh function each render never makes the inbox read again.
  const told = useRef(onRead);
  told.current = onRead;
  const day = (iso: string | null) => (iso ? i18n.date(new Date(iso), { day: "numeric", month: "short" }) : "");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/approval-inbox", { headers: headers() });
      if (r.status === 401 || r.status === 403) {
        setState("refused");
        told.current?.({ state: "refused", waiting: 0 });
        return;
      }
      if (!r.ok) throw new Error("read failed");
      const d = (await r.json()) as { waiting?: Card[]; decided?: Card[] };
      const rows = Array.isArray(d?.waiting) ? d.waiting : [];
      // Decider calm: oldest first, by arrival and nothing else (governance/deciderOrder.ts).
      setWaiting(byArrival(rows, (c) => c.at));
      setDecided(Array.isArray(d?.decided) ? d.decided : []);
      setPicked({});
      setState("ok");
      told.current?.({ state: "ok", waiting: rows.length });
    } catch {
      setState("failed");
      told.current?.({ state: "failed", waiting: 0 });
    }
  }, [headers]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (id: string, action: "approve" | "decline" | "revert") => {
    setBusy(id);
    try {
      const r = await fetch(`/api/approval-inbox/${encodeURIComponent(id)}/${action}`, { method: "POST", headers: headers(), body: "{}" });
      const d = (await r.json().catch(() => ({}))) as { message?: string };
      if (!r.ok) toast.error(d.message ?? t`That could not be done`);
      else toast.success(action === "approve" ? t({ message: `Approved`, context: "approval inbox" }) : action === "decline" ? t({ message: `Declined`, context: "approval inbox" }) : t({ message: `Put back`, context: "approval inbox" }));
    } finally {
      setBusy(null);
      void load();
    }
  };

  const approvePicked = async () => {
    const ids = Object.keys(picked).filter((id) => picked[id]);
    if (!ids.length) return;
    setBusy("batch");
    try {
      const r = await fetch("/api/approval-inbox/approve-batch", { method: "POST", headers: headers(), body: JSON.stringify({ ids }) });
      const d = (await r.json().catch(() => ({}))) as { results?: Array<{ id: string; ok: boolean; message?: string }> };
      const failed = (d.results ?? []).filter((x) => !x.ok);
      if (!r.ok) toast.error(t`That could not be done`);
      else if (failed.length) toast.error(failed[0].message || t`Some could not be approved`);
      else toast.success(t({ message: `Approved`, context: "approval inbox" }));
    } finally {
      setBusy(null);
      void load();
    }
  };

  if (state === "refused") {
    if (hideRefused) return null;
    return (
      <p className={HINT} data-testid="inbox-refused">
        <Trans>The approval inbox is for admins and for holders of the powers it covers.</Trans>
      </p>
    );
  }
  if (state === "failed") {
    return (
      <div className="space-y-2" data-testid="inbox-failed">
        <p className={HINT}>
          <Trans>The approval inbox could not be read. Reload to try again.</Trans>
        </p>
        <button type="button" className={BTN_SECONDARY} onClick={() => void load()}>
          <Trans context="approval inbox: retry a failed read">Try again</Trans>
        </button>
      </div>
    );
  }
  if (!waiting) return null;
  const count = Object.values(picked).filter(Boolean).length;
  const now = Date.now();

  return (
    <div className="space-y-4" data-testid="approval-inbox">
      <ul className={`${HINT} list-disc space-y-1 pl-5`}>
        <li>
          <Trans context="approval inbox: how it works">Nothing here is live yet.</Trans>
        </li>
        <li>
          <Trans context="approval inbox: how it works">Approve runs the change as you, so it works only where you hold the power.</Trans>
        </li>
        <li>
          <Trans context="approval inbox: how it works">A proposal lapses seven days after it was filed.</Trans>
        </li>
      </ul>
      {waiting.length === 0 && (
        <p className={`${TILE} ${HINT}`}>
          <Trans context="approval inbox">Nothing is waiting.</Trans>
        </p>
      )}
      {/* Approving several together appears once one is ticked, so an untouched list carries no gold act it cannot use. */}
      {waiting.length > 1 && count > 0 && (
        <button type="button" className={BTN_PRIMARY} disabled={busy !== null} onClick={() => void approvePicked()}>
          <Trans context="approval inbox">Approve {count} selected</Trans>
        </button>
      )}
      <ul className="space-y-4">
        {waiting.map((c) => {
          const lapses = c.expiresAt ? Date.parse(c.expiresAt) : Number.NaN;
          // Inside two days of lapsing is said in gold, the one light a card carries.
          const soon = Number.isFinite(lapses) && lapses - now < 2 * DAY_MS;
          return (
            <li key={c.id} className={`${TILE} sm:p-5 ${soon ? "border-notice/60" : ""}`} data-testid={`inbox-${c.id}`}>
              <label className="flex min-h-11 items-start gap-3">
                {waiting.length > 1 && (
                  <input type="checkbox" className={`${TICK} mt-1`} checked={!!picked[c.id]} onChange={(e) => setPicked((p) => ({ ...p, [c.id]: e.target.checked }))} aria-label={c.title} />
                )}
                <span className="font-display text-lg font-bold text-card-foreground">{c.title}</span>
              </label>
              <p className={`${HINT} mt-1`}>
                {c.at ? <Trans>Proposed by {c.by} on {day(c.at)}.</Trans> : <Trans context="approval inbox">Proposed by {c.by}.</Trans>}{" "}
                {c.expiresAt ? (
                  <span className={soon ? "font-semibold text-notice" : undefined}>
                    <Trans context="approval inbox: when an undecided proposal lapses">Lapses {day(c.expiresAt)}.</Trans>
                  </span>
                ) : null}
              </p>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className={INSET}>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <Trans context="approval inbox">Now</Trans>
                  </dt>
                  <dd className="whitespace-pre-line break-words text-foreground">{c.words.before}</dd>
                </div>
                <div className={`${INSET} border-notice/60`}>
                  <dt className="text-xs font-semibold uppercase tracking-widest text-notice">
                    <Trans context="approval inbox">If you approve</Trans>
                  </dt>
                  <dd className="whitespace-pre-line break-words text-foreground">{c.words.after}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={BTN_PRIMARY} disabled={busy !== null} onClick={() => void post(c.id, "approve")}>
                  <Trans context="approval inbox">Approve</Trans>
                </button>
                <button type="button" className={BTN_SECONDARY} disabled={busy !== null} onClick={() => void post(c.id, "decline")}>
                  <Trans context="approval inbox">Decline</Trans>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {decided.length > 0 && (
        <details className="group rounded-xl border border-border/60 px-4 py-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-display text-lg font-bold text-card-foreground">
            <Trans>Decided in the last 30 days</Trans>
          </summary>
          <ul className="mt-2 space-y-3" aria-label={t({ message: `Decided`, context: "approval inbox" })}>
            {decided.map((c) => (
              <li key={c.id} className="border-t border-border pt-3 text-sm" data-testid={`decided-${c.id}`}>
                <p className="text-foreground">{c.title}</p>
                <p className={`${HINT} flex flex-wrap items-center gap-2`}>
                  {DECIDED_WORDS[c.state] ? <span className={CHIP_SOFT}>{i18n._(DECIDED_WORDS[c.state])}</span> : null}
                  {c.decision ? <span>{day(c.decision.at)}</span> : null}
                </p>
                {c.state === "approved" && c.canRevert && (
                  <button type="button" className={`${BTN_SECONDARY} mt-2`} disabled={busy !== null} onClick={() => void post(c.id, "revert")}>
                    <Trans context="approval inbox">Put it back</Trans>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
