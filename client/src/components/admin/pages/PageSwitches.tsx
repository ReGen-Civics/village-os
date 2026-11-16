/**
 * Admin, Pages: whether visitors see the story pages at all, and each one on
 * its own (shared/brochure.ts, `PUT /api/admin/brochure-pages`).
 *
 * The master switch hides every story page at once. Each page also carries
 * "Show this page", so a village can switch off the one page that does not
 * fit it (Housing, for a village with no lots) and keep the rest. Both save
 * the moment they change, apart from the Save button for the words, because
 * they change nothing a founder could lose by switching pages.
 */
import { useCallback, useEffect, useState } from "react";
import { API_BASE, authHeaders, refusal } from "../adminApi";
import { isMemberDoor, isSwitchablePage } from "@shared/brochure";
import { Trans } from "@lingui/react/macro";

export interface Switches {
  enabled: boolean;
  hidden: string[];
  /** Member doors opened to visitors while the story pages are off (gap G15). */
  open?: string[];
}

export interface BrochureSwitches {
  /** Null until the server has answered, and while it refuses to. */
  state: Switches | null;
  busy: boolean;
  /** The last refusal, and which switch it answered ("all" or a page's address). */
  error: { at: string; text: string } | null;
  setMaster: (on: boolean) => void;
  setPage: (path: string, show: boolean) => void;
  setOpen: (path: string, open: boolean) => void;
}

/** Both switches, read once and changed through the one route. */
export function useBrochureSwitches(password: string): BrochureSwitches {
  const [state, setState] = useState<Switches | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ at: string; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/admin/brochure-pages`, { headers: authHeaders(password) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d || typeof d.enabled !== "boolean") return;
        setState({
          enabled: d.enabled,
          hidden: Array.isArray(d.hidden) ? d.hidden.filter((p: unknown) => typeof p === "string") : [],
          open: Array.isArray(d.open) ? d.open.filter((p: unknown) => typeof p === "string") : [],
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [password]);

  /*
   * The switch moves the moment it is pressed and the server's answer then
   * settles it, so a slow save never reads as a click that did nothing. A
   * refusal puts it back where it was and says why beside it.
   */
  const send = useCallback(
    async (at: string, body: { enabled?: boolean; pages?: Record<string, boolean>; open?: Record<string, boolean> }) => {
      const before = state;
      if (before) {
        const hidden = new Set(before.hidden);
        for (const [p, show] of Object.entries(body.pages ?? {})) {
          if (show) hidden.delete(p);
          else hidden.add(p);
        }
        const open = new Set(before.open ?? []);
        for (const [p, on] of Object.entries(body.open ?? {})) {
          if (on) open.add(p);
          else open.delete(p);
        }
        setState({ enabled: body.enabled ?? before.enabled, hidden: Array.from(hidden), open: Array.from(open) });
      }
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/admin/brochure-pages`, {
          method: "PUT",
          headers: authHeaders(password, { "Content-Type": "application/json" }),
          body: JSON.stringify(body),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(refusal(d, "That did not save."));
        setState({ enabled: Boolean(d.enabled), hidden: Array.isArray(d.hidden) ? d.hidden : [], open: Array.isArray(d.open) ? d.open : [] });
      } catch (e) {
        if (before) setState(before);
        setError({ at, text: e instanceof Error ? e.message : "That did not save." });
      }
      setBusy(false);
    },
    [password, state],
  );

  return {
    state,
    busy,
    error,
    setMaster: (on) => void send("all", { enabled: on }),
    setPage: (path, show) => void send(path, { pages: { [path]: show } }),
    setOpen: (path, open) => void send(path, { open: { [path]: open } }),
  };
}

/**
 * Whether visitors can see this village's story pages at all (the Home page,
 * the journeys, Team, Visit and the rest in shared/brochure.ts). It took a
 * database statement and a restart until 2026-10-22; it applies on the next
 * page load now.
 */
export function BrochureSwitch({ switches }: { switches: BrochureSwitches }) {
  const { state, busy, error, setMaster } = switches;
  if (state === null) return null;
  const on = state.enabled;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-border rounded-xl p-4 bg-card">
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-sm font-bold text-foreground">{on ? "Your story pages are showing" : "Your story pages are hidden"}</p>
        <p className="text-[11px] text-muted-foreground">
          {on
            ? "Visitors see your homepage, journeys, team, visit and the other pages edited here."
            : "Visitors see the simple welcome page instead, and these pages answer not found. Turn them on when their words are yours."}
        </p>
        {error?.at === "all" && <p role="alert" className="text-[11px] text-red-700 mt-1">{error.text}</p>}
      </div>
      <button
        type="button"
        onClick={() => setMaster(!on)}
        disabled={busy}
        className="shrink-0 px-3 py-1.5 text-xs font-medium border border-teal-deep text-teal-deep rounded-lg hover:bg-teal-deep/5 disabled:opacity-50"
      >
        {busy ? "Saving..." : on ? "Hide them" : "Show them"}
      </button>
    </div>
  );
}

/** What the line under "Show this page" says, in each state. */
export const PAGE_SWITCH_WORDS = {
  on: "Visitors can open this page, and it has its place in the menu and footer.",
  off: "Hidden. The menu and footer leave it out, buttons to it on your other pages go, and its address shows the not-found page. Your words here are kept.",
  allHidden: "All your story pages are hidden right now, so this one is too. Its own switch counts again once they are showing.",
  openOn: "Visitors can read this page even while your other story pages are hidden.",
  openOff: "While your story pages are hidden, only signed-in members can open this page.",
  saves: "Saves as soon as you change it.",
} as const;

/**
 * "Show this page", at the top of one story page's words. Nothing renders for
 * a page without a switch of its own (the homepage and the whole-site words),
 * or before the server has said where the switches stand.
 */
export function PageSwitch({ path, switches }: { path: string; switches: BrochureSwitches }) {
  const { state, busy, error, setPage, setOpen } = switches;
  if (state === null || !isSwitchablePage(path)) return null;
  const shown = !state.hidden.includes(path);
  const id = `page-switch-${path.replace(/[^a-z0-9]+/gi, "-")}`;
  // A member door (the letter members sign) may open to visitors on its own (gap G15).
  const door = isMemberDoor(path);
  const open = door && (state.open ?? []).includes(path);
  const line = !shown ? PAGE_SWITCH_WORDS.off : state.enabled || open ? PAGE_SWITCH_WORDS.on : PAGE_SWITCH_WORDS.allHidden;
  return (
    <div className="mb-4 border border-border rounded-xl p-4 bg-card">
      <label htmlFor={id} className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
        <input id={id} type="checkbox" checked={shown} disabled={busy} onChange={(e) => setPage(path, e.target.checked)} />
        Show this page
      </label>
      <p className="text-[11px] text-muted-foreground mt-1">
        {line} {PAGE_SWITCH_WORDS.saves}
      </p>
      {door && shown && (
        <>
          <label htmlFor={`${id}-open`} className="mt-2 inline-flex items-center gap-2 text-sm text-foreground">
            <input id={`${id}-open`} type="checkbox" checked={open} disabled={busy} onChange={(e) => setOpen(path, e.target.checked)} />
            <Trans>Show it to visitors even while the story pages are hidden</Trans>
          </label>
          <p className="text-[11px] text-muted-foreground mt-1">{open ? PAGE_SWITCH_WORDS.openOn : PAGE_SWITCH_WORDS.openOff}</p>
        </>
      )}
      {error?.at === path && <p role="alert" className="text-[11px] text-red-700 mt-1">{error.text}</p>}
    </div>
  );
}
