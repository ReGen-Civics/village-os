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
 *
 * "THREE ROLES, ONE TIMELINE" (the lead, 20 Nov 2026; the roles lane's ideas 4 and 5): on a chart that combines
 * roles each role is a lane, today is one labelled line through every lane, and the gates (a one-day row two or
 * more roles share, shared/roleDeliverablesGantt.ts `splitGates`) are lines through every lane, labelled once
 * even when two fall on one day. A bar is a button: a tap, a click, a hover or a focus says its dates and, when
 * the row says one, what it feeds. The list under "Dates as a list" stays, with the same words.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import type { Deliverable } from "@shared/roleDeliverables";
import { ganttLayout, type GanttBar } from "@shared/roleDeliverablesGantt";

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

/** The bar column's grid, the same in every row and in the overlay, so lines and bars agree. */
const ROW = "grid @lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] @lg:gap-3";
const pct = (x: number) => `${Math.min(100, Math.max(0, x * 100))}%`;

export default function DeliverablesGantt({ rows, label }: { rows: GanttRow[]; label: string }) {
  const { t, i18n } = useLingui();
  const locale = i18n.locale || "en";
  const layout = useMemo(() => ganttLayout(rows, todayIso()), [rows]);
  // The bar whose dates are showing: the one tapped or clicked open, or the one under the mouse.
  const [opened, setOpened] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  if (!layout) return null;
  const when = (r: GanttRow) =>
    r.milestone
      ? t({ message: `On ${dayWords(r.start, locale)}`, context: "deliverables timeline: a milestone's day" })
      : t({ message: `${dayWords(r.start, locale)} to ${dayWords(r.end, locale)}`, context: "deliverables timeline: a deliverable's dates" });
  const feedsWords = (r: GanttRow) => (r.feeds ? t({ message: `Feeds: ${r.feeds}`, context: "deliverables timeline: what a deliverable feeds" }) : "");
  // A month label every month, or every third once the span is long, so the labels never collide.
  const step = layout.months.length > 8 ? 3 : 1;
  const lanes = layout.bars.some((b) => b.role);
  const shown = hovered ?? opened;
  const gateWords = (g: (typeof layout.gates)[number]) => `${g.titles.join(", ")}, ${dayWords(g.day, locale)}`;

  // The lines that run through every lane: today, then each gate. Their labels sit once, in the month row.
  const overlay = (): ReactNode => (
    <div className={`pointer-events-none absolute inset-0 ${ROW}`} aria-hidden="true">
      <span className="hidden @lg:block" />
      <div className="relative">
        {layout.gates.map((g) => (
          <span key={g.day} className="absolute inset-y-0 border-l-2 border-dotted border-notice/70" style={{ left: pct(g.at) }} data-gantt-gate={g.day} />
        ))}
        {layout.today !== null && (
          <span className="absolute inset-y-0 border-l-2 border-dashed border-foreground/80" style={{ left: pct(layout.today) }} data-gantt-today="" />
        )}
      </div>
    </div>
  );

  const bar = (b: GanttBar, k: number): ReactNode => {
    const tip = `${b.role ? `${b.role}: ` : ""}${b.title}, ${when(b)}${b.feeds ? `. ${feedsWords(b)}` : ""}`;
    const isOpen = shown === k;
    return (
      <div key={k} className="flex flex-col gap-1">
        <div className={`${ROW} items-center gap-1`}>
          <span className="min-w-0 text-sm leading-snug text-card-foreground">{b.title}</span>
          <button
            type="button"
            className="relative h-7 w-full rounded-lg bg-muted text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={tip}
            aria-expanded={isOpen}
            onClick={() => setOpened((o) => (o === k ? null : k))}
            onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(k)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(null)}
            onFocus={() => setHovered(k)}
            onBlur={() => setHovered(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpened(null);
                setHovered(null);
              }
            }}
            data-gantt-bar={k}
          >
            <svg viewBox="0 0 1000 28" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
              {layout.months.map((m) => (
                <line key={m.day} x1={m.at * 1000} x2={m.at * 1000} y1={0} y2={28} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              ))}
              {!b.milestone && <rect x={b.from * 1000} y={6} width={Math.max(4, (b.to - b.from) * 1000)} height={16} rx={4} className={isOpen ? "fill-foreground" : "fill-notice"} />}
            </svg>
            {b.milestone && (
              <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-notice" style={{ left: pct((b.from + b.to) / 2) }} aria-hidden="true">
                <svg viewBox="0 0 16 16" className="size-4"><path d="M8 1 15 8 8 15 1 8Z" className={isOpen ? "fill-foreground" : "fill-notice"} /></svg>
              </span>
            )}
          </button>
        </div>
        {isOpen && (
          <div className={ROW}>
            <span className="hidden @lg:block" />
            <p className="rounded-lg border border-notice/50 bg-card px-3 py-2 text-sm leading-snug text-card-foreground shadow-sm" data-gantt-tip={k}>
              <span className="font-semibold">{b.title}</span>
              <span className="block text-muted-foreground">{when(b)}</span>
              {b.feeds && <span className="block">{feedsWords(b)}</span>}
            </p>
          </div>
        )}
      </div>
    );
  };

  // Lanes by role on a combined chart, each with its workstreams; one role's chart groups by workstream alone.
  const groups: Array<{ role: string; bars: Array<{ b: GanttBar; k: number }> }> = [];
  layout.bars.forEach((b, k) => {
    const role = b.role ?? "";
    const g = groups.find((x) => x.role === role);
    if (g) g.bars.push({ b, k });
    else groups.push({ role, bars: [{ b, k }] });
  });
  const workstreams = (list: Array<{ b: GanttBar; k: number }>) => {
    let ws = "";
    return list.map(({ b, k }) => {
      const head = b.workstream && b.workstream !== ws ? b.workstream : null;
      ws = b.workstream ?? "";
      return (
        <div key={k} className="flex flex-col gap-1">
          {head && <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{head}</p>}
          {bar(b, k)}
        </div>
      );
    });
  };
  const topRoom = layout.gates.length > 0 || layout.today !== null;

  return (
    <figure className="@container flex flex-col gap-3" data-testid="deliverables-gantt">
      <figcaption className="sr-only">{label}</figcaption>
      <div className="flex flex-col gap-1.5">
        <div className={ROW} aria-hidden="true">
          <span className="hidden @lg:block" />
          <div className={`relative text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground ${topRoom ? "h-10" : "h-5"}`}>
            {layout.months.map((m, k) =>
              k % step === 0 ? (
                <span key={m.day} className="absolute bottom-0" style={{ left: pct(m.at) }}>
                  {monthWords(m.day, locale)}
                </span>
              ) : null,
            )}
            {layout.gates.map((g) => (
              <span key={g.day} className="absolute top-0 max-w-[9rem] truncate border-l-2 border-dotted border-notice pl-1 font-bold text-notice" style={{ left: pct(g.at) }}>
                {g.titles.join(", ")}
              </span>
            ))}
            {layout.today !== null && (
              <span className="absolute top-0 rounded-full bg-foreground px-1.5 font-bold text-background" style={{ left: pct(layout.today) }}>
                {t({ message: "Today", context: "deliverables timeline: the line for today" })}
              </span>
            )}
          </div>
        </div>
        <div className="relative flex flex-col gap-2">
          {overlay()}
          {lanes
            ? groups.map((g) => (
                <section key={g.role} aria-label={g.role} className="relative flex flex-col gap-1.5 rounded-xl border border-border/60 bg-card/40 p-2.5" data-gantt-lane={g.role}>
                  <p className="text-xs font-bold uppercase tracking-widest text-notice">{g.role}</p>
                  {workstreams(g.bars)}
                </section>
              ))
            : workstreams(groups[0]?.bars ?? [])}
        </div>
      </div>
      {layout.gates.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" data-gantt-gates="">
          {layout.gates.map((g) => (
            <li key={g.day} className="inline-flex items-center gap-1.5">
              <span className="h-3 border-l-2 border-dotted border-notice" aria-hidden="true" />
              {t({ message: `Gate: ${gateWords(g)}`, context: "deliverables timeline: a gate several roles share, its titles and day" })}
            </li>
          ))}
        </ul>
      )}
      <details className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm" data-testid="deliverables-list">
        <summary className="cursor-pointer font-semibold text-card-foreground">{t({ message: "Dates as a list", context: "deliverables timeline: the text version" })}</summary>
        <ul className="mt-2 space-y-1.5">
          {layout.gates.map((g) => (
            <li key={`gate-${g.day}`} className="leading-snug text-card-foreground">
              <span className="font-semibold">{g.titles.join(", ")}</span>
              {g.roles.length > 0 && <span className="text-muted-foreground"> ({g.roles.join(", ")})</span>}
              <span className="block text-muted-foreground">{t({ message: `On ${dayWords(g.day, locale)}`, context: "deliverables timeline: a milestone's day" })}</span>
            </li>
          ))}
          {layout.bars.map((b, k) => (
            <li key={k} className="leading-snug text-card-foreground">
              <span className="font-semibold">{b.title}</span>
              {(b.role || b.workstream) && <span className="text-muted-foreground"> ({[b.role, b.workstream].filter(Boolean).join(", ")})</span>}
              <span className="block text-muted-foreground">{when(b)}</span>
              {b.feeds && <span className="block text-muted-foreground">{feedsWords(b)}</span>}
            </li>
          ))}
        </ul>
      </details>
    </figure>
  );
}
