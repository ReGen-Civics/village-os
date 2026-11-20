/**
 * THE DELIVERABLES TIMELINE'S GEOMETRY (shared/roleDeliverables.ts holds the rows). Kept apart from
 * the reader so only the lazily loaded chart carries it.
 *
 * Pure: no pool, no clock, no Node builtins.
 */
import { dayNumber, readDay, type Deliverable } from "./roleDeliverables";

/** One bar of the timeline, placed as fractions of the whole span (0 to 1). */
export interface GanttBar extends Deliverable {
  /** Which role the row belongs to, on a chart that combines several cards. */
  role?: string;
  from: number;
  to: number;
}

export interface GanttLayout {
  bars: GanttBar[];
  /** The first and last day the chart spans. */
  first: string;
  last: string;
  /** The first day of each month inside the span, with its place along it. */
  months: Array<{ day: string; at: number }>;
  /** Where today falls, when it falls inside the span. */
  today: number | null;
}

const isoOf = (n: number): string => new Date(n * 86_400_000).toISOString().slice(0, 10);

/**
 * THE TIMELINE'S GEOMETRY, for one card or several (the three anchor roles on
 * one page). Rows keep their order, grouped by role and then by workstream in
 * the order each first appears. A milestone gets a day's width so it can be
 * seen. `today` is passed in, so the layout reads no clock.
 */
export function ganttLayout(rows: ReadonlyArray<Deliverable & { role?: string }>, today?: string | null): GanttLayout | null {
  if (!rows.length) return null;
  const order: string[] = [];
  for (const r of rows) {
    const k = `${r.role ?? ""}\u0000${r.workstream ?? ""}`;
    if (!order.includes(k)) order.push(k);
  }
  const sorted = rows
    .map((r, i) => ({ r, i, k: order.indexOf(`${r.role ?? ""}\u0000${r.workstream ?? ""}`) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.r);
  const lo = Math.min(...sorted.map((r) => dayNumber(r.start)));
  const hi = Math.max(...sorted.map((r) => dayNumber(r.end))) + 1;
  const span = Math.max(1, hi - lo);
  const at = (n: number) => (n - lo) / span;
  const bars = sorted.map((r) => ({ ...r, from: at(dayNumber(r.start)), to: at(dayNumber(r.end) + 1) }));
  const months: GanttLayout["months"] = [];
  const firstDay = isoOf(lo);
  let y = Number(firstDay.slice(0, 4));
  let m = Number(firstDay.slice(5, 7));
  for (let guard = 0; guard < 240; guard++) {
    const day = `${y}-${String(m).padStart(2, "0")}-01`;
    const n = dayNumber(day);
    if (n >= hi) break;
    if (n >= lo) months.push({ day, at: at(n) });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  const t = today ? readDay(today) : null;
  const tn = t ? dayNumber(t) : null;
  return { bars, first: firstDay, last: isoOf(hi - 1), months, today: tn !== null && tn >= lo && tn < hi ? at(tn) : null };
}
