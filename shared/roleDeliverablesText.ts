/**
 * THE EDITOR'S TEXT FORM FOR DELIVERABLES: one per line, "start | end | title | workstream".
 * Kept apart from the reader (shared/roleDeliverables.ts) so a card that only reads its sections
 * does not carry it.
 *
 * Pure: no pool, no clock, no Node builtins.
 */
import type { Deliverable } from "./roleDeliverables";

const LINE_PROBLEM = "Write each deliverable as: start | end | title | workstream.";

/** The editor's line for one deliverable: "start | end | title | workstream". */
export function deliverableLine(d: Deliverable): string {
  return [d.start, d.milestone ? d.start : d.end, d.title, d.workstream ?? ""].join(" | ").replace(/\s\|\s$/, "");
}

/**
 * The editor's text read back into rows, one deliverable per line. A line that
 * does not read is answered with its own number, so the editor can say which.
 */
export function deliverablesFromText(text: string): { ok: true; value: Array<Record<string, unknown>> } | { ok: false; problem: string; line: number } {
  const out: Array<Record<string, unknown>> = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].replace(/^\s*(?:[-*•])\s+/, "").trim();
    if (!t) continue;
    const parts = t.split("|").map((p) => p.trim());
    if (parts.length < 3 || !parts[2]) return { ok: false, problem: LINE_PROBLEM, line: i + 1 };
    out.push({ start: parts[0], end: parts[1] || parts[0], title: parts[2], workstream: parts[3] ?? "" });
  }
  return { ok: true, value: out };
}
