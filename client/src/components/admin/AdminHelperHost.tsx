/**
 * Where the Admin helper lives in the page, kept tiny so Admin pays nothing for
 * it until it opens: the panel itself (AdminHelperPanel.tsx) is a lazy chunk,
 * fetched the first time an admin opens it.
 *
 * It owns three things:
 *   - the keyboard shortcut, Ctrl+/ (Cmd+/ on a Mac), which toggles it;
 *   - where the panel starts: just under the sticky admin header, measured
 *     live, so the panel never covers the header (the #1046 banner) whatever
 *     the launch banner above it is doing; and where it stops, just above the
 *     phone's bottom bar, so that bar never covers the question box;
 *   - mounting the panel only while it is open.
 *
 * WHICH SURFACE IT MOUNTS (27 Nov 2026). The village's dial
 * `platform.admin_guide_dock` ships off, and off means the helper panel,
 * exactly as before: this host mounts it at once and it reads its own status.
 * That status is also how the host learns the dial is on, and then it mounts
 * the guide's dock (dock/GuideDock.tsx) in the panel's place, handing it the
 * status already read. This browser remembers the answer as a hint, so the
 * next open goes straight to the dock; the dock reads the status too, so a
 * village that turns the dial off again gets its panel back the same way.
 * The shortcut, `?helper=open`, the edges and the save bar are the same for
 * both.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { HelperProposal, HelperStatus } from "@shared/adminHelper";
import SaveBar, { saveEach, type SaveResult } from "@/components/SaveBar";
import type { NavGroup } from "./adminNavGroups";
import { applyProposal, readDockHint, rememberDockHint } from "./adminHelperApi";

const AdminHelperPanel = lazy(() => import("./AdminHelperPanel"));
const GuideDock = lazy(() => import("./dock/GuideDock"));

/** The conversations the dock offers beside Admin: the helper, and the organizing guide. */
const ADMIN_DOCK_MODES = ["helper", "organize"] as const;

/** One proposal as a mark, so a card can tell whether this exact change is waiting or saved. */
export const proposalMark = (p: Pick<HelperProposal, "key" | "to">): string => `${p.key}=${p.to}`;

/**
 * Open the guide when the address says `helper=open`, and take the word out of
 * the address so a reload or a shared link does not keep reopening it. Other
 * pages link here to send a person straight to the guide.
 */
export function takeHelperOpen(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  if (q.get("helper") !== "open") return false;
  q.delete("helper");
  const rest = q.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
  return true;
}

/** The id AdminHeader carries, so the helper can find the header's bottom edge. */
export const ADMIN_HEADER_ID = "admin-header";

/** True for Ctrl+/ or Cmd+/, typed anywhere. */
export function isHelperShortcut(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">): boolean {
  return e.key === "/" && (e.ctrlKey || e.metaKey) && !e.altKey;
}

function headerBottom(): number {
  const el = typeof document !== "undefined" ? document.getElementById(ADMIN_HEADER_ID) : null;
  return el ? Math.max(0, Math.round(el.getBoundingClientRect().bottom)) : 0;
}

/**
 * How much of the window's foot is covered: the phone's bottom bar
 * (AdminMobileNav), or the one save bar while it shows, whichever reaches
 * higher; 0 where neither is drawn. The panel stops above it, so the save bar
 * never sits on the guide's question box. The save bar is measured by its own
 * box and lift, never its on-screen rectangle, so its slide-in does not move
 * the reading.
 */
export function footCovered(): number {
  if (typeof document === "undefined") return 0;
  let h = 0;
  const nav = document.querySelector<HTMLElement>("[data-admin-bottom-bar]");
  if (nav) {
    const r = nav.getBoundingClientRect();
    if (r.height > 0 && r.top < window.innerHeight) h = Math.round(window.innerHeight - r.top);
  }
  const bar = document.querySelector<HTMLElement>("[data-save-bar]");
  if (bar && bar.offsetHeight > 0) h = Math.max(h, Math.round(bar.offsetHeight + (parseFloat(bar.style.bottom) || 0)));
  return h;
}

export default function AdminHelperHost({
  open,
  setOpen,
  password,
  groups,
  tab,
  onOpenTab,
}: {
  open: boolean;
  setOpen: (next: boolean | ((was: boolean) => boolean)) => void;
  password: string;
  groups: readonly NavGroup[];
  tab: string;
  onOpenTab: (key: string) => void;
}) {
  const { t } = useLingui();
  const [edges, setEdges] = useState({ top: 0, bottom: 0 });
  /*
   * REVIEW AND SAVE. A change the guide proposes is never written by the guide.
   * "Review and save" puts it on the page's one save bar, beside every other
   * unsaved edit, and a person's Save writes it through the dial's own admin
   * route (PUT /admin/variables/:key), the route and the gate a person editing
   * the dial by hand would meet. A dial this person may not change is refused
   * there, in the server's words, and stays on the bar.
   *
   * Held here and not in the panel, because this host is always mounted: closing
   * the guide never loses a waiting change, and the leave guard still asks.
   */
  const [waiting, setWaiting] = useState<HelperProposal[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const review = (p: HelperProposal) => setWaiting((w) => [...w.filter((x) => x.key !== p.key), p]);
  const unreview = (p: HelperProposal) => setWaiting((w) => w.filter((x) => proposalMark(x) !== proposalMark(p)));
  const saveWaiting = async (): Promise<SaveResult> => {
    const now = waiting;
    const { result, failedKeys } = await saveEach(now.map((p) => ({
      key: p.key,
      label: p.label,
      run: async () => {
        const out = await applyProposal(password, p);
        return out.ok ? null : out.error;
      },
    })));
    setSaved((s) => [...s, ...now.filter((p) => !failedKeys.has(p.key)).map(proposalMark)]);
    setWaiting((w) => w.filter((p) => failedKeys.has(p.key)));
    return result;
  };

  /*
   * Whether the village's dock is on, as the last surface to read the status
   * heard it; until one has, this browser's hint (false on a browser that never
   * met a dock, which is every browser of a village with the dial off). The
   * status travels to the other surface with the swap, so it is read once.
   */
  const [dockOn, setDockOn] = useState<boolean>(() => readDockHint());
  const [fresh, setFresh] = useState<{ from: "panel" | "dock"; status: HelperStatus } | null>(null);
  const heard = useCallback((from: "panel" | "dock", status: HelperStatus) => {
    const on = status.dock === true;
    setFresh({ from, status });
    setDockOn(on);
    if (on !== readDockHint()) rememberDockHint(on);
  }, []);
  const heardByPanel = useCallback((status: HelperStatus) => heard("panel", status), [heard]);
  const heardByDock = useCallback((status: HelperStatus) => heard("dock", status), [heard]);
  // Each open reads the status afresh, as it always did.
  useEffect(() => {
    if (!open) setFresh(null);
  }, [open]);

  useEffect(() => {
    if (takeHelperOpen()) setOpen(true);
  }, [setOpen]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!isHelperShortcut(e)) return;
      e.preventDefault();
      setOpen((was) => !was);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    const sync = () => {
      const next = { top: headerBottom(), bottom: footCovered() };
      setEdges((was) => (was.top === next.top && was.bottom === next.bottom ? was : next));
    };
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    const el = document.getElementById(ADMIN_HEADER_ID);
    const watch = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    if (el && watch) watch.observe(el);
    // The save bar comes and goes with any surface's edits, not only the guide's.
    const comes = typeof MutationObserver !== "undefined" ? new MutationObserver(sync) : null;
    comes?.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      watch?.disconnect();
      comes?.disconnect();
    };
  }, [open]);

  const bar = (
    <SaveBar
      count={waiting.length}
      onSave={saveWaiting}
      onDiscard={() => setWaiting([])}
      what={t({ message: "the guide's proposed changes", context: "admin helper, what the save bar saves" })}
    />
  );
  if (!open) return bar;
  return (
    <>
      {bar}
      <Suspense fallback={null}>
        {dockOn ? (
          <GuideDock
            surface="admin"
            modes={ADMIN_DOCK_MODES}
            password={password}
            groups={groups}
            tab={tab}
            top={edges.top}
            bottom={edges.bottom}
            onClose={() => setOpen(false)}
            onOpenTab={onOpenTab}
            initialStatus={fresh?.from === "panel" ? fresh.status : undefined}
            waiting={waiting.map(proposalMark)}
            saved={saved}
            onBar={waiting}
            onReview={review}
            onUnreview={unreview}
            onStatus={heardByDock}
          />
        ) : (
          <AdminHelperPanel
            password={password}
            groups={groups}
            tab={tab}
            top={edges.top}
            bottom={edges.bottom}
            onClose={() => setOpen(false)}
            onOpenTab={onOpenTab}
            initialStatus={fresh?.from === "dock" ? fresh.status : undefined}
            waiting={waiting.map(proposalMark)}
            saved={saved}
            onReview={review}
            onUnreview={unreview}
            onStatus={heardByPanel}
          />
        )}
      </Suspense>
    </>
  );
}
