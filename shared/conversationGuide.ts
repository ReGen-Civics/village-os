/**
 * A CONVERSATION GUIDE for the people reviewing an application (the lead, 20 Nov 2026, idea 23).
 *
 * Made from the role card's own selection criteria (`selectionCriteria`, snapshotted on the
 * application when it was confirmed) and its qualities (`qualities`, the card's "Qualities we're
 * looking for"). Each line is a prompt to talk about, with a box for notes.
 *
 *   NO SCORES, NO RANKS, NO RATINGS. A note is words. Nothing is totalled, sorted or compared.
 *   The scorecards (shared/applicationReview.ts) stay the place levels are written.
 *   Read by the reviewers and the role that makes the final call, never the applicant and
 *   never a recused reviewer. Deleted with the application's review and with the member who
 *   wrote it. NO MODEL reads or writes a note (server/lib/applicationReview.refusal.test.ts).
 *
 * The questions are worded by the page (Lingui) from `GuideItem.text`; this file holds only the
 * data and the rules.
 *
 * Pure: no pool, no clock, no Node builtins.
 */
import type { Criterion } from "./applicationReview";

export const GUIDE_LIMITS = {
  note: 1000,
  /** Qualities shown beside the criteria: past this the guide stops being a conversation. */
  qualities: 6,
} as const;

export const GUIDE_WORDS = {
  notAllowed: "Only the people reviewing this application, and the role that makes the final call, keep notes here.",
  noSuchLine: "That line is not on this guide.",
  tooLong: `Keep a note to ${GUIDE_LIMITS.note} characters.`,
} as const;

export type GuideItemKind = "criterion" | "quality";

/** One prompt: a criterion the role names or a quality its card hopes for. */
export interface GuideItem {
  key: string;
  kind: GuideItemKind;
  text: string;
}

/** The guide's lines: every criterion, then up to six qualities that are not already a criterion. */
export function guideItems(criteria: readonly Criterion[], qualities: readonly string[]): GuideItem[] {
  const items: GuideItem[] = criteria.map((c) => ({ key: `c:${c.id}`, kind: "criterion", text: c.text }));
  const seen = new Set(items.map((i) => i.text.trim().toLowerCase()));
  let n = 0;
  for (const q of qualities) {
    const text = String(q ?? "").trim().slice(0, 200);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    n += 1;
    items.push({ key: `q:${n}`, kind: "quality", text });
    if (n >= GUIDE_LIMITS.qualities) break;
  }
  return items;
}

/**
 * Who may read and write the guide's notes: "Interviewers + placers" (ruling 22, QA round 5), the same people as a
 * reference's details. A consent peer holding none of the conversation roles reads none of them.
 */
export function mayUseGuide(f: { isApplicant: boolean; recused: boolean; isPlacer: boolean; isInterviewer: boolean }): boolean {
  if (f.isApplicant || f.recused) return false;
  return f.isPlacer || f.isInterviewer;
}

export type GuideNoteRead = { ok: true; key: string; note: string } | { ok: false; error: string };

/** One note's request, read. An empty note is allowed: it clears the line. */
export function readGuideNote(raw: unknown, items: readonly GuideItem[]): GuideNoteRead {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const key = typeof o.key === "string" ? o.key : "";
  if (!items.some((i) => i.key === key)) return { ok: false, error: GUIDE_WORDS.noSuchLine };
  const note = typeof o.note === "string" ? o.note.replace(/\r\n/g, "\n").trim() : "";
  if (note.length > GUIDE_LIMITS.note) return { ok: false, error: GUIDE_WORDS.tooLong };
  return { ok: true, key, note };
}

/** A note as the reviewers read it. `mine` is the viewer's own, the only one they may change. */
export interface GuideNoteView {
  key: string;
  by: string;
  note: string;
  mine: boolean;
}

export interface GuideView {
  items: GuideItem[];
  notes: GuideNoteView[];
}
