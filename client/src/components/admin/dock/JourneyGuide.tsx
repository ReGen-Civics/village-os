/**
 * THE GUIDE ON THE ROAD TO LAUNCH: which one the page draws.
 *
 * `/journey-to-launch` has always drawn the launch guide
 * (components/journey/LaunchGuide.tsx), a corner panel with two tabs, Launch
 * and Organizing. With the village's dial `platform.admin_guide_dock` on, the
 * guide's dock (./GuideDock.tsx) takes its place and offers the same two
 * conversations, on the same two routes, with the same payload.
 *
 * WITH THE DIAL OFF NOTHING CHANGES: this draws the launch guide, with the
 * props the page always gave it, and the page loads exactly as it did. The one
 * difference nobody sees is a single read of the helper's status when an
 * admin OPENS the guide, which is how the page learns the dial is on. Anyone
 * who is not an admin is never asked and always gets the launch guide.
 *
 * The same swap the Admin host makes (../AdminHelperHost.tsx): the launch
 * guide opens at once, the status says whether the dock is on, and this
 * browser keeps the answer as a hint so the next open goes straight to the
 * dock. The dock reads the status too, so a village that turns the dial off
 * again gets its launch guide back the same way.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { HelperStatus } from "@shared/adminHelper";
import { LaunchGuide } from "@/components/journey/LaunchGuide";
import { authToken } from "@/lib/gameApi";
import { fetchHelperStatus } from "../adminHelperApi";
import { readDockHint, rememberDockHint } from "./dockState";

const GuideDock = lazy(() => import("./GuideDock"));

/** While the checklist is open the launch guide leads; once the village is live only organizing remains, as before. */
const BEFORE_LAUNCH = ["launch", "organize"] as const;
const AFTER_LAUNCH = ["organize"] as const;

/** The bottom edge of the site's own header while it is in view, so the dock starts under it; 0 once it has scrolled away. */
function headerBottom(): number {
  const el = typeof document !== "undefined" ? document.querySelector("header") : null;
  return el ? Math.max(0, Math.round(el.getBoundingClientRect().bottom)) : 0;
}

/** A launch row as the page holds it: where it is fixed, and the checklist's own words for that place. */
export interface LaunchFix {
  fixAt?: unknown;
  fixLabel?: unknown;
}

/** Each row's address and the checklist's own name for it, so a reply that carries the address is linked by that name. */
export function fixNames(fixes: readonly LaunchFix[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fixes ?? []) {
    if (typeof f?.fixAt === "string" && f.fixAt.startsWith("/") && typeof f.fixLabel === "string" && f.fixLabel.trim()) out[f.fixAt] = f.fixLabel.trim();
  }
  return out;
}

export function JourneyGuide({
  open,
  onClose,
  launched = false,
  admin = false,
  fixes,
  blocking,
}: {
  open: boolean;
  onClose: () => void;
  launched?: boolean;
  admin?: boolean;
  /** The checklist's rows, when the page has them. */
  fixes?: readonly LaunchFix[];
  /** How many rows block the launch, when the page has the count. The dock leads with it. */
  blocking?: number | null;
}) {
  const token = authToken() ?? "";
  const linkNames = useMemo(() => fixNames(fixes), [fixes]);
  const [dockOn, setDockOn] = useState<boolean>(() => readDockHint());
  // The status the launch guide's side read, handed to the dock so it is read once.
  const [fresh, setFresh] = useState<HelperStatus | null>(null);
  const [top, setTop] = useState(0);
  const docked = admin && dockOn;

  const heard = useCallback((s: HelperStatus) => {
    const on = s.dock === true;
    setDockOn(on);
    if (on !== readDockHint()) rememberDockHint(on);
  }, []);

  // The launch guide is open: ask once, as an admin, whether the dock is on.
  useEffect(() => {
    if (!open) {
      setFresh(null);
      return;
    }
    if (!admin || !token || docked) return;
    const ctrl = new AbortController();
    fetchHelperStatus(token, ctrl.signal)
      .then((s) => {
        setFresh(s);
        heard(s);
      })
      .catch(() => {
        /* unreachable: the launch guide stands, as it always did */
      });
    return () => ctrl.abort();
  }, [open, admin, token, docked, heard]);

  useEffect(() => {
    if (!open || !docked) return;
    const sync = () => setTop((was) => (was === headerBottom() ? was : headerBottom()));
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [open, docked]);

  if (!docked) return <LaunchGuide open={open} onClose={onClose} launched={launched} />;
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <GuideDock
        surface="journey"
        modes={launched ? AFTER_LAUNCH : BEFORE_LAUNCH}
        password={token}
        top={top}
        bottom="var(--tabbar-h, 0px)"
        onClose={onClose}
        initialStatus={fresh ?? undefined}
        onStatus={heard}
        linkNames={linkNames}
        blocking={typeof blocking === "number" && Number.isFinite(blocking) ? blocking : null}
        // A village still on the road opens wide; a running one opens at the side. A remembered choice beats both.
        defaultShape={launched ? "docked" : "expanded"}
      />
    </Suspense>
  );
}
