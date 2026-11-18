/**
 * THE DOOR FROM THE ROSTER TO THE ORG CHART (Rye, 16 and 17 Nov 2026).
 *
 * A wide screen gets the live picture in picture (OrgChartTile, loaded after the page). A phone gets
 * one tappable row with the same counts, because a 200px drawing beside a column of cards helps nobody
 * on a 390px screen. Both are one link into /circles; there is no second destination.
 */
import { lazy, Suspense } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useLingui } from "@lingui/react/macro";
import type { MiniCircle, MiniSeat } from "@/components/CirclesMiniMap";
import type { OrgChartCounts } from "./OrgChartTile";
import { useWide } from "./useWide";

const OrgChartTile = lazy(() => import("./OrgChartTile"));

export type { OrgChartCounts };

function OrgChartRow({ counts }: { counts: OrgChartCounts }) {
  const { t } = useLingui();
  return (
    <Link
      href="/circles"
      className="flex min-h-14 items-center gap-3 rounded-2xl border border-notice/40 bg-card px-3 py-2.5 no-underline shadow-sm hover:border-notice focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      data-org-chart-row=""
    >
      <svg viewBox="0 0 40 40" className="size-10 shrink-0 text-notice" aria-hidden="true">
        <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeOpacity={0.5} strokeWidth={1.5} />
        <circle cx="20" cy="20" r="9" fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={1.5} />
        <circle cx="20" cy="4" r="2.5" fill="currentColor" />
        <circle cx="34" cy="26" r="2.5" fill="currentColor" />
        <circle cx="6" cy="26" r="2.5" fill="none" stroke="currentColor" strokeDasharray="1.5 1.5" />
      </svg>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug text-card-foreground">{t({ message: "See the org chart", context: "roles page: the link into /circles on a phone" })}</span>
        <span className="block text-xs text-muted-foreground">{t({ message: `${counts.circleName}: ${counts.held} held, ${counts.open} open`, context: "roles page org chart: the circle's held and open roles" })}</span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-notice" aria-hidden="true" />
    </Link>
  );
}

export default function OrgPreview({ circles, seats, counts }: { circles: MiniCircle[]; seats: MiniSeat[]; counts: OrgChartCounts }) {
  const wide = useWide();
  if (circles.length === 0) return null;
  if (!wide) return <OrgChartRow counts={counts} />;
  return (
    <Suspense fallback={<OrgChartRow counts={counts} />}>
      <OrgChartTile circles={circles} seats={seats} counts={counts} />
    </Suspense>
  );
}
