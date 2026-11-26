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
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import type { HelperProposal } from "@shared/adminHelper";
import SaveBar, { saveEach, type SaveResult } from "@/components/SaveBar";
import type { NavGroup } from "./adminNavGroups";
import { applyProposal } from "./adminHelperApi";

const AdminHelperPanel = lazy(() => import("./AdminHelperPanel"));

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

/** How much of the window's foot the phone's bottom bar (AdminMobileNav) covers; 0 where it is hidden. */
function bottomBarHeight(): number {
  const el = typeof document !== "undefined" ? document.querySelector<HTMLElement>("[data-admin-bottom-bar]") : null;
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  return r.height > 0 && r.top < window.innerHeight ? Math.round(window.innerHeight - r.top) : 0;
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
    const sync = () => setEdges({ top: headerBottom(), bottom: bottomBarHeight() });
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    const el = document.getElementById(ADMIN_HEADER_ID);
    const watch = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    if (el && watch) watch.observe(el);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      watch?.disconnect();
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
        <AdminHelperPanel
          password={password}
          groups={groups}
          tab={tab}
          top={edges.top}
          bottom={edges.bottom}
          onClose={() => setOpen(false)}
          onOpenTab={onOpenTab}
          waiting={waiting.map(proposalMark)}
          saved={saved}
          onReview={review}
          onUnreview={unreview}
        />
      </Suspense>
    </>
  );
}
