/**
 * "I'VE READ THIS", FOR HOW WE WORK TOGETHER (the lead, 27 Nov 2026: "we can add a tick box at the bottom to say
 * 'I've read this' and it would go away and show up in their profile as read, with a link to open it again to read
 * it again if they need").
 *
 * A member who ticks the box at the end of the first chapter of /governance/how keeps the moment they read it in
 * their own `prefs` blob, under `howWeWorkRead`, so it follows them to every device; no column and no migration, the
 * way the speed cards keep theirs (shared/speedCards.ts). The chapter then folds to one line for them, and their
 * profile lists it as read with the way back in.
 *
 * It is the member's own and nobody else's: `publicUser` carries named prefs only (server/lib/publicPrefs.ts), and
 * this is not one of them. The one door is `GET`/`PUT /api/profile/how-we-work-read`, answering only to its owner.
 *
 * Pure: no React, no database.
 */

/** Where the read lives in `users.prefs`: the moment it was ticked, as an ISO timestamp. */
export const HOW_WE_WORK_READ_PREF = "howWeWorkRead";

/** The chapter's anchor on /governance/how, the profile's way back in. */
export const HOW_WE_WORK_ANCHOR = "how-we-work";

/** Where "Read it again" leads from anywhere in the app. */
export const HOW_WE_WORK_HREF = `/governance/how#${HOW_WE_WORK_ANCHOR}`;

export type ReadParse = { ok: true; read: boolean } | { ok: false; problem: string };

/** A PUT body's `read`: true ticks the box, false clears it. Nothing else is accepted. */
export function parseReadInput(input: unknown): ReadParse {
  if (input === true || input === false) return { ok: true, read: input };
  return { ok: false, problem: "read_not_true_or_false" };
}

/** When the member read it, or null when they have not (or the stored value no longer reads as a moment). */
export function readHowWeWorkRead(prefs: unknown): string | null {
  const stored = prefs && typeof prefs === "object" && !Array.isArray(prefs) ? (prefs as Record<string, unknown>)[HOW_WE_WORK_READ_PREF] : undefined;
  if (typeof stored !== "string" || stored.length > 40) return null;
  const at = Date.parse(stored);
  return Number.isFinite(at) ? new Date(at).toISOString() : null;
}
