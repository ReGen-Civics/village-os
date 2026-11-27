/**
 * WHAT A PIECE OF FEEDBACK IS, said once for the server that stores it and the
 * guide's panel that takes it (the fold of /feedback into the guide, 26 Nov 2026).
 *
 * Three kinds. A bug (something broke), an idea (something missing) and plain
 * feedback (how something felt), because "this page confused me" is neither a
 * fault nor a feature and used to be forced into one of them.
 *
 * The title is the guide's suggestion when the member leaves it empty: the
 * first sentence of what they wrote, cut at a word. It is the member's own
 * words, never a summary and never a judgement, so the guide suggests and
 * repeats back and the team decides.
 */

export const FEEDBACK_KINDS = ["bug", "idea", "feedback"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export function isFeedbackKind(v: unknown): v is FeedbackKind {
  return typeof v === "string" && (FEEDBACK_KINDS as readonly string[]).includes(v);
}

/** The column sizes in feedback_items, and the floors the form explains before Send. */
export const FEEDBACK_TITLE_MAX = 200;
export const FEEDBACK_DETAIL_MAX = 8000;
export const FEEDBACK_TITLE_MIN = 4;
export const FEEDBACK_DETAIL_MIN = 10;

/** The longest title the guide suggests: a line that reads in one glance on the queue. */
export const SUGGESTED_TITLE_MAX = 72;

/** A screenshot after the browser's shrink is a few hundred KB; this is the ceiling the server takes. */
export const FEEDBACK_SHOT_MAX_BYTES = 4 * 1024 * 1024;
/** The longest edge a screenshot keeps: enough to read a page's words, small enough for a slow link. */
export const FEEDBACK_SHOT_EDGE = 1600;

/**
 * The guide's title for what the member wrote: their first sentence or line,
 * cut at a word boundary, with its first letter raised. Pure. Empty in, empty out.
 */
export function suggestTitle(detail: string): string {
  const text = String(detail ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const first = String(detail ?? "").trim().split(/\n/)[0].replace(/\s+/g, " ").trim();
  const sentence = (first.match(/^(.+?[.!?])(\s|$)/)?.[1] ?? first).replace(/[.!?]+$/, "").trim();
  let line = sentence || text;
  if (line.length > SUGGESTED_TITLE_MAX) {
    const cut = line.slice(0, SUGGESTED_TITLE_MAX + 1);
    const space = cut.lastIndexOf(" ");
    line = `${(space > 20 ? cut.slice(0, space) : cut.slice(0, SUGGESTED_TITLE_MAX)).replace(/[,;:]+$/, "")}…`;
  }
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/** The page a report came from, as the guide repeats it back: the path alone, "/" read as the home page. Pure. */
export function pageForHeard(href: string): string {
  try {
    const u = new URL(href, "http://x.invalid");
    return u.pathname || "/";
  } catch {
    return "/";
  }
}
