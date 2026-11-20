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
 *
 * THE LINES LAND ON THEIR DATES (screenshot check of 1.3.38). The lines and the labels are placed against the bar
 * track itself: inside each lane the overlay keeps the lane's padding, and the label row above the lanes carries the
 * same border and padding, so a fraction of the track is the same pixel in all three. Each track also draws the
 * lines inside itself, so on a phone, where a row's name sits above its bar, the lines run only through the tracks
 * and never through the words; from @lg the overlay joins them through every lane. Today has a row of its own above
 * the gates, and gate labels that would touch go down a row (`placeLabels`), each kept inside the chart.
 */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import type { Deliverable } from "@shared/roleDeliverables";
import { ganttLayout, placeLabels, type GanttBar } from "@shared/roleDeliverablesGantt";

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

/** A label's height in the row above the lanes, and the month row's. */
const LABEL_ROW = 18;
/** A label's width before the browser has measured it (and in a test, which lays nothing out). */
const guessWidth = (text: string, pill = false) => Math.ceil(text.length * 7.4) + (pill ? 16 : 10);

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
  // The track's width and each label's own width, measured once laid out, so the labels can be kept apart.
  const trackRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Record<string, HTMLElement | null>>({});
  const [measured, setMeasured] = useState<{ track: number; widths: Record<string, number> }>({ track: 0, widths: {} });
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      const widths: Record<string, number> = {};
      // A label's own width, read with its cut lifted for the moment (a truncated box reports its cut width).
      for (const [k, node] of Object.entries(labelRefs.current)) {
        if (!node) continue;
        const { width, maxWidth } = node.style;
        node.style.width = "max-content";
        node.style.maxWidth = "none";
        const w = Math.ceil(node.getBoundingClientRect().width);
        node.style.width = width;
        node.style.maxWidth = maxWidth;
        if (w > 0) widths[k] = w;
      }
      const track = el.clientWidth;
      setMeasured((m) => (m.track === track && JSON.stringify(m.widths) === JSON.stringify(widths) ? m : { track, widths }));
    };
    measure();
    // The display face can land after the first measure, and a label is wider in it than in the fallback.
    let live = true;
    document.fonts?.ready.then(() => live && measure()).catch(() => {});
    if (typeof ResizeObserver === "undefined") return () => {
      live = false;
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [layout, locale]);
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

  // The lines: today, then each gate, each centred on its date. Drawn inside every track, and from @lg also through
  // the whole lane by an overlay that keeps the lane's padding (`inset`), so its track is the bars' track.
  const lines = (where: "lane" | "track"): ReactNode => (
    <>
      {layout.gates.map((g) => (
        <span key={g.day} className="absolute inset-y-0 -ml-px border-l-2 border-dotted border-notice/70" style={{ left: pct(g.at) }} {...(where === "lane" ? { "data-gantt-gate": g.day } : { "data-gantt-track-gate": g.day })} />
      ))}
      {layout.today !== null && (
        <span className="absolute inset-y-0 -ml-px border-l-2 border-dashed border-foreground/80" style={{ left: pct(layout.today) }} {...(where === "lane" ? { "data-gantt-today": "" } : { "data-gantt-track-today": "" })} />
      )}
    </>
  );
  const hasLines = layout.gates.length > 0 || layout.today !== null;
  const overlay = (inset: string): ReactNode =>
    hasLines ? (
      <div className={`pointer-events-none absolute inset-y-0 ${inset} hidden @lg:grid @lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] @lg:gap-3`} aria-hidden="true" data-gantt-overlay="">
        <span />
        <div className="relative">{lines("lane")}</div>
      </div>
    ) : null;

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
            {hasLines && (
              <span className="pointer-events-none absolute inset-0" aria-hidden="true">
                {lines("track")}
              </span>
            )}
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
            <p className="relative rounded-lg border border-notice/50 bg-card px-3 py-2 text-sm leading-snug text-card-foreground shadow-sm" data-gantt-tip={k}>
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
  // The row above the lanes: today on a row of its own, the gate labels below it on as many rows as keep them
  // apart, the months last. Placed in pixels against the measured track (a guess until it is measured).
  const track = measured.track || 600;
  const todayWord = t({ message: "Today", context: "deliverables timeline: the line for today" });
  const gateText = (g: (typeof layout.gates)[number]) => g.titles.join(", ");
  const todayPlace = layout.today !== null ? placeLabels([{ at: layout.today, width: measured.widths.today ?? guessWidth(todayWord, true) }], track).labels[0] : null;
  const gatePlaces = placeLabels(
    layout.gates.map((g) => ({ at: g.at, width: measured.widths[`gate-${g.day}`] ?? guessWidth(gateText(g)) })),
    track,
  );
  const gateTop = todayPlace ? LABEL_ROW + 2 : 0;
  const headHeight = gateTop + gatePlaces.rows * LABEL_ROW + LABEL_ROW;
  // The line sits under a label's 2px edge, so the box starts a pixel before it (or ends a pixel after it).
  const boxStyle = (p: { left: number; width: number; side: "start" | "end" }, top: number) => ({
    left: p.side === "start" ? p.left - 1 : p.left + 1,
    width: p.width,
    top,
  });
  // The lane's border and padding, on the label row too, so its track is the lanes' track to the pixel.
  const laneEdge = lanes ? "border border-transparent px-2.5" : "";

  return (
    <figure className="@container flex flex-col gap-3" data-testid="deliverables-gantt">
      <figcaption className="sr-only">{label}</figcaption>
      <div className="flex flex-col gap-1.5">
        <div className={`${ROW} ${laneEdge}`} aria-hidden="true" data-gantt-head="">
          <span className="hidden @lg:block" />
          <div ref={trackRef} className="relative text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground" style={{ height: headHeight }}>
            {layout.months.map((m, k) =>
              k % step === 0 ? (
                <span key={m.day} className={`absolute bottom-0 ${m.at * track + 32 > track ? "-translate-x-full" : ""}`} style={{ left: pct(m.at) }}>
                  {monthWords(m.day, locale)}
                </span>
              ) : null,
            )}
            {layout.gates.map((g, k) => {
              const p = gatePlaces.labels[k];
              return (
                <span
                  key={g.day}
                  ref={(el) => {
                    labelRefs.current[`gate-${g.day}`] = el;
                  }}
                  className={`absolute truncate font-bold leading-[18px] text-notice ${p.side === "start" ? "border-l-2 pl-1" : "border-r-2 pr-1 text-right"} border-dotted border-notice`}
                  style={{ ...boxStyle(p, gateTop + p.row * LABEL_ROW), maxWidth: p.width }}
                  title={gateWords(g)}
                  data-gantt-gate-label={g.day}
                  data-gantt-label-row={p.row}
                >
                  {gateText(g)}
                </span>
              );
            })}
            {todayPlace && (
              <span
                ref={(el) => {
                  labelRefs.current.today = el;
                }}
                className="absolute truncate rounded-full bg-foreground px-1.5 font-bold leading-4 text-background"
                style={{ ...boxStyle(todayPlace, 0), maxWidth: todayPlace.width }}
                data-gantt-today-label=""
              >
                {todayWord}
              </span>
            )}
          </div>
        </div>
        <div className="relative flex flex-col gap-2">
          {!lanes && overlay("inset-x-0")}
          {lanes
            ? groups.map((g) => (
                <section key={g.role} aria-label={g.role} className="relative flex flex-col gap-1.5 rounded-xl border border-border/60 bg-card/40 p-2.5" data-gantt-lane={g.role}>
                  {overlay("inset-x-2.5")}
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
