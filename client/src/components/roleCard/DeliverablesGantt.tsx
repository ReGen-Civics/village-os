/**
 * THE DELIVERABLES TIMELINE (the lead, Anchor session of 19 Nov 2026): a role's dated outcomes as a
 * simple Gantt chart, one row each, grouped by workstream. The same chart combines several roles on
 * one page (the founding team's anchor roles), each row then named by its role.
 *
 * Accessible by construction: the bars are drawn for the eye (aria-hidden), and the same rows are
 * always in the page as a list with their dates in words, open under "Dates as a list". Each bar
 * carries its title and dates on hover. One series, so one colour (the notice token) and no legend:
 * the workstream is said by its group heading, never by colour. A milestone is a diamond.
 *
 * Laid out by the card's width (container queries): on a phone the label sits above its bar, from
 * @lg beside it. Loaded lazily by the card, so none of this rides a route's first view.
 */
import { useMemo } from "react";
import { useLingui } from "@lingui/react/macro";
import type { Deliverable } from "@shared/roleDeliverables";
import { ganttLayout } from "@shared/roleDeliverablesGantt";

export type GanttRow = Deliverable & { role?: string };

function dayWords(day: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale || "en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
  } catch {
    return day;
  }
}

function monthWords(day: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale || "en", { month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
  } catch {
    return day.slice(5, 7);
  }
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function DeliverablesGantt({ rows, label }: { rows: GanttRow[]; label: string }) {
  const { t, i18n } = useLingui();
  const locale = i18n.locale || "en";
  const layout = useMemo(() => ganttLayout(rows, todayIso()), [rows]);
  if (!layout) return null;
  const when = (r: GanttRow) =>
    r.milestone
      ? t({ message: `On ${dayWords(r.start, locale)}`, context: "deliverables timeline: a milestone's day" })
      : t({ message: `${dayWords(r.start, locale)} to ${dayWords(r.end, locale)}`, context: "deliverables timeline: a deliverable's dates" });
  // A month label every month, or every third once the span is long, so the labels never collide.
  const step = layout.months.length > 8 ? 3 : 1;
  let group = "";

  return (
    <figure className="@container flex flex-col gap-3" data-testid="deliverables-gantt">
      <figcaption className="sr-only">{label}</figcaption>
      <div aria-hidden="true" className="flex flex-col gap-1.5">
        <div className="grid @lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] @lg:gap-3">
          <span className="hidden @lg:block" />
          <div className="relative h-5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {layout.months.map((m, k) =>
              k % step === 0 ? (
                <span key={m.day} className="absolute top-0 -translate-x-0" style={{ left: `${m.at * 100}%` }}>
                  {monthWords(m.day, locale)}
                </span>
              ) : null,
            )}
          </div>
        </div>
        {layout.bars.map((b, k) => {
          const g = `${b.role ?? ""}\u0000${b.workstream ?? ""}`;
          const head = g !== group && (b.role || b.workstream) ? [b.role, b.workstream].filter(Boolean).join(" · ") : null;
          group = g;
          const tip = `${b.role ? `${b.role}: ` : ""}${b.title}, ${when(b)}`;
          return (
            <div key={k} className="flex flex-col gap-1">
              {head && <p className="mt-2 text-xs font-bold uppercase tracking-widest text-notice">{head}</p>}
              <div className="grid items-center gap-1 @lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] @lg:gap-3" title={tip}>
                <span className="min-w-0 text-sm leading-snug text-card-foreground">{b.title}</span>
                <div className="relative h-6 rounded-lg bg-muted">
                  <svg viewBox="0 0 1000 24" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
                    {layout.months.map((m) => (
                      <line key={m.day} x1={m.at * 1000} x2={m.at * 1000} y1={0} y2={24} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    ))}
                    {layout.today !== null && <line x1={layout.today * 1000} x2={layout.today * 1000} y1={0} y2={24} className="stroke-foreground" strokeWidth={2} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
                    {!b.milestone && <rect x={b.from * 1000} y={5} width={Math.max(4, (b.to - b.from) * 1000)} height={14} rx={4} className="fill-notice" />}
                  </svg>
                  {b.milestone && (
                    <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-notice" style={{ left: `${((b.from + b.to) / 2) * 100}%` }}>
                      <svg viewBox="0 0 16 16" className="size-4"><path d="M8 1 15 8 8 15 1 8Z" className="fill-notice" /></svg>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <details className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm" data-testid="deliverables-list">
        <summary className="cursor-pointer font-semibold text-card-foreground">{t({ message: "Dates as a list", context: "deliverables timeline: the text version" })}</summary>
        <ul className="mt-2 space-y-1.5">
          {layout.bars.map((b, k) => (
            <li key={k} className="leading-snug text-card-foreground">
              <span className="font-semibold">{b.title}</span>
              {(b.role || b.workstream) && <span className="text-muted-foreground"> ({[b.role, b.workstream].filter(Boolean).join(", ")})</span>}
              <span className="block text-muted-foreground">{when(b)}</span>
            </li>
          ))}
        </ul>
      </details>
    </figure>
  );
}
