/**
 * A ROLE'S SHORT NAME ON AN APPLICANT'S BOOKING BUTTON (the lead, 27 Nov 2026: "Just the Role - Ops, Community,
 * Visionary"). The button reads "Book with Ops", never a person's name.
 *
 * Where it is kept: the village variable `org.role_short_labels` (shared/gameVariables.ts), one role per line as
 * `role-id = Label`. A role with no line reads its full name. Kept as a village setting so no table changes: the
 * labels are few, a founder sets them once, and the role card's full name stays the role's name everywhere else.
 *
 * PURE.
 */
export const ROLE_SHORT_LABELS_VARIABLE = "org.role_short_labels";

/** The longest short label kept; a longer one is cut, so a button never wraps on a phone. */
export const ROLE_SHORT_LABEL_MAX = 24;

/** `role-id = Label` lines (or `;`-separated pairs) as a map. Blank lines, lines without `=`, and empty sides are skipped. */
export function parseRoleShortLabels(raw: unknown): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of String(raw ?? "").split(/[\n;]+/)) {
    const at = part.indexOf("=");
    if (at <= 0) continue;
    const id = part.slice(0, at).trim();
    const label = part.slice(at + 1).trim().replace(/\s+/g, " ").slice(0, ROLE_SHORT_LABEL_MAX).trim();
    if (id && label) out.set(id, label);
  }
  return out;
}

/** The role's short label from the village's list, else its full name. */
export function roleShortLabel(roleId: string, fullName: string, raw: unknown): string {
  return parseRoleShortLabels(raw).get(roleId) ?? fullName;
}
