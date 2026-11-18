/**
 * THE ORG CHART, PICTURE IN PICTURE (Rye, 16 Nov 2026: "a picture in picture of our /circles page that
 * shows the org that people can click into here"; approved 17 Nov).
 *
 * The live circles drawing from the top of /circles (CirclesMiniMap, reused, never copied), set beside
 * the roster on a wide screen. The whole picture is one link into /circles. It is loaded with OrgPreview,
 * after the page, so the drawing's layout code never rides the /roles first view.
 */
import { useLingui } from "@lingui/react/macro";
import CirclesMiniMap, { type MiniCircle, type MiniSeat } from "@/components/CirclesMiniMap";
import { cssColourForCircle } from "@shared/circleView";

export interface OrgChartCounts {
  circleId: string | null;
  circleName: string;
  held: number;
  open: number;
}

export default function OrgChartTile({ circles, seats, counts }: { circles: MiniCircle[]; seats: MiniSeat[]; counts: OrgChartCounts }) {
  const { t } = useLingui();
  const circle = circles.find((c) => c.id === counts.circleId) ?? null;
  const hue = cssColourForCircle({ id: counts.circleId ?? "", color: circle?.color ?? null });
  const detail = t({ message: `${counts.circleName}: ${counts.held} held, ${counts.open} open`, context: "roles page org chart: the circle's held and open roles" });
  return (
    <div className="grid gap-3 rounded-2xl border border-notice/40 bg-card p-3 shadow-sm" data-org-chart-tile="">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs font-bold uppercase tracking-widest text-notice">{t({ message: "The org chart", context: "roles page org chart tile heading" })}</p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
          <span className="size-1.5 rounded-full bg-notice" aria-hidden="true" />
          {t({ message: "Live", context: "roles page org chart: drawn from the village's circles now" })}
        </span>
      </div>
      <CirclesMiniMap
        circles={circles}
        seats={seats}
        door={{
          href: "/circles",
          title: t({ message: "Open the circles", context: "roles page org chart: the link into /circles" }),
          detail,
          ariaLabel: t({ message: `Open the circles. ${counts.circleName}: ${counts.held} held, ${counts.open} open.`, context: "roles page org chart link, read aloud" }),
        }}
      />
      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground" aria-hidden="true">
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: hue }} />
          {t({ message: "Held", context: "roles page org chart legend: a held role" })}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-dashed" style={{ borderColor: hue }} />
          {t({ message: "Not held yet", context: "roles page org chart legend: a role nobody holds yet" })}
        </li>
      </ul>
    </div>
  );
}
