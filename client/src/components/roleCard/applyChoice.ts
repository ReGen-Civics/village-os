/**
 * WHAT THE CARD HANDS THE APPLICATION (the lead, 17 Nov 2026): the commitment chosen on the slider and the split,
 * carried on the Apply link as `?role=<id>&commitment=60&split=50.50.0`, so the price step opens where the reader
 * left the card. The split is the percents in the shape's own order; the application reads them against its own
 * shape in force and drops anything that does not fit, so a stale or hand-typed link can only fall back to the
 * village's split, never set a figure.
 */
import { commitmentChoices } from "@shared/commitmentRange";
import { shapePercents, splitChanged, type ShapeShare, type Split } from "@shared/proposalSplit";

/** The query a card adds to its Apply link: the commitment when one is chosen, the split only when it was changed. */
export function choiceQuery(pct: number | null, split: Split | null, offered: Split | null): string {
  const q = new URLSearchParams();
  if (typeof pct === "number") q.set("commitment", String(pct));
  if (split && offered && splitChanged(offered, split)) q.set("split", split.shares.map((s) => s.pct).join("."));
  return q.toString();
}

/** The commitment a link carries, when it is one the role takes (its steps of 10 from the minimum). */
export function commitmentFromQuery(search: string, min: number | null | undefined): number | null {
  const raw = new URLSearchParams(search).get("commitment");
  const n = raw && /^\d{1,3}$/.test(raw) ? Number(raw) : NaN;
  return commitmentChoices(min).includes(n) ? n : null;
}

/** The split a link carries, as percents of the shape in force: whole, one per share, adding to 100. Else null. */
export function splitFromQuery(search: string, shape: readonly ShapeShare[]): ShapeShare[] | null {
  const raw = new URLSearchParams(search).get("split");
  if (!raw || raw.length > 64) return null;
  const parts = raw.split(".");
  const base = shapePercents(shape);
  if (!base.length || parts.length !== base.length || !parts.every((p) => /^\d{1,3}$/.test(p))) return null;
  const pcts = parts.map(Number);
  if (pcts.some((p) => p > 100) || pcts.reduce((a, b) => a + b, 0) !== 100) return null;
  return base.map((s, i) => ({ label: s.label, pct: pcts[i] }));
}
