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
 * props the page always gave it. The one difference nobody sees is a single
 * read of the helper's status when an admin opens the page, which is how the
 * page learns whether the dock is on before the button is pressed. Anyone who
 * is not an admin is never asked and always gets the launch guide. This
 * browser's hint from an earlier visit decides until the answer arrives, so a
 * village with the dock on does not see the old panel flash first.
 */
import { lazy, Suspense, useEffect, useState } from "react";
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

export function JourneyGuide({ open, onClose, launched = false, admin = false }: { open: boolean; onClose: () => void; launched?: boolean; admin?: boolean }) {
  const token = authToken() ?? "";
  const [dockOn, setDockOn] = useState<boolean>(() => readDockHint());
  const [status, setStatus] = useState<HelperStatus | null>(null);
  const [top, setTop] = useState(0);

  useEffect(() => {
    if (!admin || !token) return;
    const ctrl = new AbortController();
    fetchHelperStatus(token, ctrl.signal)
      .then((s) => {
        const on = s.dock === true;
        setStatus(s);
        setDockOn(on);
        if (on !== readDockHint()) rememberDockHint(on);
      })
      .catch(() => {
        /* unreachable: the hint stands, and the launch guide is what a browser with no hint draws */
      });
    return () => ctrl.abort();
  }, [admin, token]);

  const docked = admin && dockOn;
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
        initialStatus={status ?? undefined}
        // A village still on the road opens wide; a running one opens at the side. A remembered choice beats both.
        defaultShape={launched ? "docked" : "expanded"}
      />
    </Suspense>
  );
}
