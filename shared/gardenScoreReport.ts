/**
 * THE SCOREBOARD, PRINTED: the seven counts of shared/gardenScore.ts as a table, as a readable report and as
 * Markdown. The script (scripts/garden-scoreboard.ts) writes what these return; nothing here measures anything.
 *
 * Pure: no I/O, no clock.
 */
import type { Count, OpenItem, Scoreboard } from "./gardenScore";

/** The open items of a count under their headings, the largest heading first. */
export function openGroups(count: Pick<Count, "open">): Array<{ group: string; items: OpenItem[] }> {
  const groups = new Map<string, OpenItem[]>();
  for (const item of count.open) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  return [...groups.entries()].map(([group, items]) => ({ group, items })).sort((a, b) => b.items.length - a.items.length || (a.group < b.group ? -1 : 1));
}

const cell = (n: number | null): string => (n === null ? "not measured" : String(n));

/** One count as the row of a table: its name, done, total, open, and its largest headings of open items. */
export function summaryRow(count: Count, groups = 4): { title: string; done: string; total: string; open: string; largest: string } {
  if (!count.measured) return { title: count.title, done: cell(null), total: cell(null), open: cell(null), largest: count.notMeasured ?? "" };
  const largest = openGroups(count)
    .slice(0, groups)
    .map((g) => `${g.group} (${g.items.length})`)
    .join("; ");
  return { title: count.title, done: cell(count.done), total: cell(count.total), open: String(count.open.length), largest: largest || "none" };
}

/** The seven counts as a plain table, for a terminal. */
export function scoreTable(board: Scoreboard): string {
  const rows = board.counts.map((c) => summaryRow(c));
  const width = (key: "title" | "done" | "total" | "open", head: string) => Math.max(head.length, ...rows.map((r) => r[key].length));
  const w = { title: width("title", "count"), done: width("done", "done"), total: width("total", "total"), open: width("open", "open") };
  const line = (title: string, done: string, total: string, open: string) => `  ${title.padEnd(w.title)}  ${done.padStart(w.done)}  ${total.padStart(w.total)}  ${open.padStart(w.open)}`;
  return [line("count", "done", "total", "open"), line("-".repeat(w.title), "-".repeat(w.done), "-".repeat(w.total), "-".repeat(w.open)), ...rows.map((r) => line(r.title, r.done, r.total, r.open))].join("\n");
}

export interface ReportOptions {
  /** List every open item. Without it each heading shows a few and says how many more there are. */
  all?: boolean;
  /** How many headings of open items to show for a count, and how many items under each. */
  groups?: number;
  items?: number;
}

function countLines(count: Count, options: ReportOptions, bullet: string, spaced = false): string[] {
  const out: string[] = [];
  const gap = () => {
    if (spaced) out.push("");
  };
  out.push(`Done means: ${count.doneMeans}`);
  gap();
  if (!count.measured) {
    out.push(`Not measured. ${count.notMeasured ?? ""}`);
    return out;
  }
  for (const p of count.parts) out.push(`${bullet}${p.name}: ${p.value}${p.of === undefined ? "" : ` of ${p.of}`}`);
  for (const note of count.notes) out.push(`${bullet}${note}`);
  const groups = openGroups(count);
  gap();
  if (!groups.length) {
    out.push("Nothing is open.");
    return out;
  }
  const shownGroups = options.all ? groups : groups.slice(0, options.groups ?? 12);
  out.push(`Open: ${count.open.length}, under ${groups.length} heading${groups.length === 1 ? "" : "s"}.`);
  gap();
  for (const g of shownGroups) {
    out.push(`${bullet}${g.group}: ${g.items.length}`);
    const shown = options.all ? g.items : g.items.slice(0, options.items ?? 3);
    for (const item of shown) out.push(`  ${bullet}${item.name}. ${item.why}`);
    if (shown.length < g.items.length) out.push(`  ${bullet}and ${g.items.length - shown.length} more`);
  }
  if (shownGroups.length < groups.length) {
    const rest = groups.slice(shownGroups.length);
    out.push(`${bullet}and ${rest.length} more headings holding ${rest.reduce((n, g) => n + g.items.length, 0)} items: ${rest.map((g) => `${g.group} (${g.items.length})`).join(", ")}`);
  }
  return out;
}

/** The whole report for a terminal: the table, then each count with its numbers and its open items. */
export function scoreText(board: Scoreboard, options: ReportOptions = {}): string {
  const out = ["", "The Admin Garden scoreboard", "", scoreTable(board), ""];
  for (const count of board.counts) {
    out.push(`${count.title.toUpperCase()}: ${count.measured ? `${count.done} of ${count.total}` : "not measured"}`);
    out.push(...countLines(count, options, "  - ").map((l) => `  ${l}`));
    out.push("");
  }
  if (!options.all) out.push("Run with --all to list every open item.", "");
  return out.join("\n");
}

const md = (s: string): string => s.replace(/\|/g, "\\|");

/** The report as Markdown: the table first, then each count. `stamp` is a line the caller adds (the commit and the day). */
export function scoreMarkdown(board: Scoreboard, options: ReportOptions & { stamp?: string } = {}): string {
  const out = ["# The Admin Garden scoreboard", ""];
  if (options.stamp) out.push(options.stamp, "");
  out.push("Printed by `npx tsx scripts/garden-scoreboard.ts`. Every number is measured from code. An item the code cannot account for is open and named.", "");
  out.push("| Count | Done | Total | Open | Largest groups of open items |", "|---|---:|---:|---:|---|");
  for (const count of board.counts) {
    const r = summaryRow(count);
    out.push(`| ${r.title} | ${r.done} | ${r.total} | ${r.open} | ${md(r.largest)} |`);
  }
  out.push("");
  for (const count of board.counts) {
    out.push(`## ${count.title}: ${count.measured ? `${count.done} of ${count.total}` : "not measured"}`, "");
    out.push(...countLines(count, options, "- ", true));
    out.push("");
  }
  return out.join("\n");
}
