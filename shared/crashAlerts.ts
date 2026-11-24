/**
 * WHO HEARS ABOUT A CRASH (2026-11-24).
 *
 * `reportError` (server/lib/errors.ts) tells the people responsible for the
 * village whenever something breaks: a job that threw, a boot that failed, a
 * member's browser showing its crash screen. It used to ring every admin and
 * founder under the `payments_alert` kind, so an admin whose seat has nothing
 * to do with operations got an email for every crash, and the crash rode the
 * same kind as a disputed charge.
 *
 * Two things change, and both are here so the server and the registry read
 * one definition:
 *
 *  - Crashes have their own notification kind, `crash_alert`. Payment alerts
 *    keep `payments_alert`, untouched.
 *  - A village dial, `ops.crash_alert_recipients`, narrows the alert to named
 *    accounts among the admins and founders. Blank is everyone, which is what
 *    every village had before this existed.
 *
 * A list that matches nobody falls back to everyone. An alarm that reaches no
 * one is the failure this whole spine exists to prevent, and a typo or a
 * departed address would otherwise produce exactly that, silently.
 *
 * The webhook (Admin, Integrations) is a separate sink and this does not touch it.
 */

/** The dial's key in shared/gameVariables.ts. */
export const CRASH_ALERT_RECIPIENTS_KEY = "ops.crash_alert_recipients";

/** The notification kind a crash rides (shared/notificationKinds.ts, server/lib/notify.ts). */
export const CRASH_ALERT_TYPE = "crash_alert";

/** How many addresses the list may hold: a crash goes to a few people, never to a crowd. */
export const CRASH_ALERT_MAX_RECIPIENTS = 10;

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** The addresses a stored value names, trimmed and lowercased, each once. Junk entries are dropped. */
export function parseCrashAlertRecipients(raw: unknown): string[] {
  const out: string[] = [];
  for (const piece of String(raw ?? "").split(",")) {
    const email = piece.trim().toLowerCase();
    if (email && EMAIL.test(email) && !out.includes(email)) out.push(email);
  }
  return out;
}

/** Why a value cannot be stored, or null. Blank is a real answer: everyone. */
export function crashAlertRecipientsProblem(raw: string): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const pieces = text.split(",").map((p) => p.trim());
  if (pieces.some((p) => !EMAIL.test(p))) {
    return "Must be email addresses separated by commas, such as ops@example.org, or blank for every admin and founder.";
  }
  const unique = new Set(pieces.map((p) => p.toLowerCase()));
  if (unique.size !== pieces.length) return "Each address can only be listed once.";
  if (unique.size > CRASH_ALERT_MAX_RECIPIENTS) return `At most ${CRASH_ALERT_MAX_RECIPIENTS} addresses.`;
  return null;
}

/** The slice of a member this needs. */
export interface CrashAlertMember {
  id: string | number;
  role?: string | null;
  email?: string | null;
}

/** Admins and founders: the only accounts a crash alert ever goes to. */
function reachesPanel(m: CrashAlertMember): boolean {
  return m.role === "admin" || m.role === "founder";
}

/**
 * The accounts a crash alert goes to. Only admins and founders, ever. With a
 * list, only those whose email is on it; with no list, or a list that matches
 * none of them, every admin and founder. `narrowed` says which happened, so
 * the server can log a list that matched nobody.
 */
export function crashAlertRecipients<M extends CrashAlertMember>(
  members: readonly M[],
  raw: unknown,
): { recipients: M[]; narrowed: boolean; listMatchedNobody: boolean } {
  const panel = members.filter(reachesPanel);
  const wanted = parseCrashAlertRecipients(raw);
  if (wanted.length === 0) return { recipients: panel, narrowed: false, listMatchedNobody: false };
  const picked = panel.filter((m) => wanted.includes(String(m.email ?? "").trim().toLowerCase()));
  if (picked.length === 0) return { recipients: panel, narrowed: false, listMatchedNobody: true };
  return { recipients: picked, narrowed: true, listMatchedNobody: false };
}
