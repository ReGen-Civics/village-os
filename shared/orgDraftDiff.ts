/**
 * BEFORE AND AFTER, IN WORDS AND LINES (the draft page, PR A).
 *
 * The draft page shows what a draft changes field by field: a text field as the
 * words that went and the words that came, a list as the lines that went and the
 * lines that came. Diffed on the server, so the page ships no diff code (the
 * client budget) and every reader sees the same answer.
 *
 * Plain longest-common-subsequence over tokens. A role card's fields are short
 * (a few hundred words at most), so the quadratic table is small; past
 * `MAX_CELLS` the diff gives up gracefully and reports the whole field as
 * replaced, which is true, only coarser.
 */

/** One run of a diff: kept, taken out, or put in. */
export type DiffOp = "same" | "del" | "add";
export interface DiffRun {
  op: DiffOp;
  text: string;
}

/** The largest table the diff builds before it falls back to "all replaced". */
export const MAX_CELLS = 250_000;

/** Words and the whitespace between them, kept as separate tokens so the text joins back exactly. */
export function tokens(s: string): string[] {
  return s.match(/\s+|[^\s]+/g) ?? [];
}

function lcs<T>(a: readonly T[], b: readonly T[]): DiffRun[] | null {
  const n = a.length;
  const m = b.length;
  if ((n + 1) * (m + 1) > MAX_CELLS) return null;
  const w = m + 1;
  const t = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      t[i * w + j] = a[i] === b[j] ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
    }
  }
  const out: Array<{ op: DiffOp; item: T }> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: "same", item: a[i] });
      i++;
      j++;
    } else if (t[(i + 1) * w + j] >= t[i * w + j + 1]) {
      out.push({ op: "del", item: a[i++] });
    } else {
      out.push({ op: "add", item: b[j++] });
    }
  }
  while (i < n) out.push({ op: "del", item: a[i++] });
  while (j < m) out.push({ op: "add", item: b[j++] });
  return out.map((r) => ({ op: r.op, text: String(r.item) }));
}

/** Join neighbouring runs of the same kind, so "the project" is one run, not three. */
function merge(runs: readonly DiffRun[]): DiffRun[] {
  const out: DiffRun[] = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last && last.op === r.op) last.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

/**
 * Whitespace between two changed words belongs to the change, so "the project" reads as one
 * removal and not "the", a kept space, and "project". A kept run that is only whitespace and sits
 * between a removal and an addition (or two changes) is folded into both sides.
 */
function absorbSpaces(runs: DiffRun[]): DiffRun[] {
  const out: DiffRun[] = [];
  for (let k = 0; k < runs.length; k++) {
    const r = runs[k];
    const prev = runs[k - 1];
    const next = runs[k + 1];
    if (r.op === "same" && /^\s+$/.test(r.text) && prev && next && prev.op !== "same" && next.op !== "same") {
      out.push({ op: "del", text: r.text }, { op: "add", text: r.text });
      continue;
    }
    out.push(r);
  }
  // Removals first, then additions, within each changed stretch, so the page reads Before then After.
  const sorted: DiffRun[] = [];
  let stretch: DiffRun[] = [];
  const flush = () => {
    sorted.push(...stretch.filter((x) => x.op === "del"), ...stretch.filter((x) => x.op === "add"));
    stretch = [];
  };
  for (const r of out) {
    if (r.op === "same") {
      flush();
      sorted.push(r);
    } else stretch.push(r);
  }
  flush();
  return merge(sorted);
}

/** A text field's change as words: what stayed, what went, what came. Null on either side reads as empty. */
export function wordDiff(before: string | null, after: string | null): DiffRun[] {
  const a = tokens(before ?? "");
  const b = tokens(after ?? "");
  const runs = lcs(a, b);
  if (!runs) return [...(before ? [{ op: "del" as const, text: before }] : []), ...(after ? [{ op: "add" as const, text: after }] : [])];
  return absorbSpaces(merge(runs));
}

/** A list field's change by line: each line kept, taken out or put in, in the order the new list reads. */
export function lineDiff(before: readonly string[], after: readonly string[]): DiffRun[] {
  const runs = lcs(before, after);
  if (!runs) return [...before.map((text) => ({ op: "del" as const, text })), ...after.map((text) => ({ op: "add" as const, text }))];
  return runs;
}

/** How many lines a list diff added, removed and kept. */
export function lineCounts(runs: readonly DiffRun[]): { added: number; removed: number; kept: number } {
  let added = 0;
  let removed = 0;
  let kept = 0;
  for (const r of runs) {
    if (r.op === "add") added++;
    else if (r.op === "del") removed++;
    else kept++;
  }
  return { added, removed, kept };
}
