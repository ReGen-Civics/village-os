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
  /**
   * The gates on a chart that combines roles (the lead, 20 Nov 2026): a one-day row that two or more roles share
   * (same day, same title) is drawn once as a line across every lane, and rows that fall on the same day are
   * labelled once. Empty on one role's chart.
   */
  gates: Array<{ day: string; at: number; titles: string[]; roles: string[] }>;
}

const isoOf = (n: number): string => new Date(n * 86_400_000).toISOString().slice(0, 10);

/**
 * THE TIMELINE'S GEOMETRY, for one card or several (the three anchor roles on
 * one page). Rows keep their order, grouped by role and then by workstream in
 * the order each first appears. A milestone gets a day's width so it can be
 * seen. `today` is passed in, so the layout reads no clock.
 */
export function ganttLayout(all: ReadonlyArray<Deliverable & { role?: string }>, today?: string | null): GanttLayout | null {
  if (!all.length) return null;
  const { rows, gates: gateRows } = splitGates(all);
  const order: string[] = [];
  for (const r of rows) {
    const k = `${r.role ?? ""}\u0000${r.workstream ?? ""}`;
    if (!order.includes(k)) order.push(k);
  }
  const sorted = rows
    .map((r, i) => ({ r, i, k: order.indexOf(`${r.role ?? ""}\u0000${r.workstream ?? ""}`) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.r);
  const lo = Math.min(...all.map((r) => dayNumber(r.start)));
  const hi = Math.max(...all.map((r) => dayNumber(r.end))) + 1;
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
  // One gate per day: a line through the middle of that day, its titles said once.
  const byDay = new Map<string, { titles: string[]; roles: string[] }>();
  for (const g of gateRows) {
    const d = byDay.get(g.start) ?? { titles: [], roles: [] };
    if (!d.titles.some((x) => x.toLowerCase() === g.title.toLowerCase())) d.titles.push(g.title);
    if (g.role && !d.roles.includes(g.role)) d.roles.push(g.role);
    byDay.set(g.start, d);
  }
  const gates = Array.from(byDay, ([day, d]) => ({ day, at: at(dayNumber(day) + 0.5), ...d })).sort((a, b) => a.at - b.at);
  return { bars, first: firstDay, last: isoOf(hi - 1), months, today: tn !== null && tn >= lo && tn < hi ? at(tn) : null, gates };
}

/**
 * The rows a combined chart draws in its lanes, and its gates: a one-day row whose day and title (case aside)
 * appear under two or more roles. A milestone only one role has stays in that role's lane, as a diamond.
 */
export function splitGates<T extends Deliverable & { role?: string }>(rows: readonly T[]): { rows: T[]; gates: T[] } {
  const key = (r: T) => `${r.start}\u0000${r.title.toLowerCase()}`;
  const roles = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.milestone || !r.role) continue;
    const s = roles.get(key(r)) ?? new Set<string>();
    s.add(r.role);
    roles.set(key(r), s);
  }
  const isGate = (r: T) => !!r.milestone && !!r.role && (roles.get(key(r))?.size ?? 0) >= 2;
  return { rows: rows.filter((r) => !isGate(r)), gates: rows.filter(isGate) };
}
