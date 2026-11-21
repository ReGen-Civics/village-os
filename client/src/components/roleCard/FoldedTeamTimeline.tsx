/**
 * The founding roles' dated outcomes on one timeline, folded until opened (the lead, 21 Nov 2026).
 * Sits right under the founding roles on /roles. Its own file so Roles.tsx stays under the line ratchet.
 */
import { lazy, Suspense } from "react";
import { ChevronDown } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import type { GanttRow } from "./DeliverablesGantt";

const DeliverablesGantt = lazy(() => import("./DeliverablesGantt"));

export default function FoldedTeamTimeline({ rows, title }: { rows: GanttRow[]; title: string }) {
  const { t } = useLingui();
  if (rows.length === 0) return null;
  return (
    <details className="group sheet-night rounded-2xl border border-notice/40 bg-card shadow-sm" data-team-deliverables="">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 p-5 font-display text-2xl text-card-foreground focus-visible:outline-2 focus-visible:outline-ring sm:p-7">
        <ChevronDown className="size-5 shrink-0 text-notice transition-transform group-open:rotate-180" aria-hidden="true" />
        {title}
      </summary>
      <div className="px-5 pb-5 sm:px-7 sm:pb-7">
        <p className="mb-4 text-sm text-muted-foreground">{t({ message: "Tap a bar for its dates. The dotted lines are the gates the roles share.", context: "founding team timeline: how to read it" })}</p>
        <Suspense fallback={null}>
          <DeliverablesGantt rows={rows} label={title} />
        </Suspense>
      </div>
    </details>
  );
}
