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
 *  - A village dial, `ops.crash_alert_recipients`, names the addresses that
 *    hear about a crash. Blank is every admin and founder, which is what every
 *    village had before this existed.
 *
 * AN ADDRESS ON THE LIST IS ONE OF THREE THINGS (the lead, 24 Nov 2026: "my
 * sign in email is one address but I want crash emails to go to the shared
 * operations inbox"):
 *
 *  - An admin or founder's account: the notice in the app, and the email the
 *    account's own cadence sends.
 *  - No account at all, such as a shared operations inbox: the email only,
 *    one per crash (server/lib/crashAlerts.ts sends it).
 *  - Any other account, a member who is neither: nothing. A crash goes to the
 *    people responsible for the village, and listing a member does not make
 *    them one. Their address counts as junk for the fallback below.
 *
 * A list that names no usable address falls back to every admin and founder.
 * An alarm that reaches no one is the failure this whole spine exists to
 * prevent, and a typo or a departed address would otherwise produce exactly
 * that, silently.
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

/** Admins and founders: the only accounts a crash alert ever goes to. Other addresses get the email alone. */
function reachesPanel(m: CrashAlertMember): boolean {
  return m.role === "admin" || m.role === "founder";
}

/** What one crash alert reaches, worked out from the members and the dial. */
export interface CrashAlertAudience<M> {
  /** Admins and founders, each told in the app and by email per their own cadence. */
  recipients: M[];
  /** Addresses that belong to no account: each gets the email only. */
  addresses: string[];
  /** True when the list chose who hears, false when everyone on the panel does. */
  narrowed: boolean;
  /** True when the list named addresses and none of them was usable, so everyone on the panel was told. */
  listMatchedNobody: boolean;
}

/**
 * Who a crash alert reaches. With no list, every admin and founder. With a
 * list, the admins and founders it names (`recipients`) plus the addresses
 * that match no account at all (`addresses`). A list that yields neither
 * falls back to every admin and founder, and `listMatchedNobody` says so, so
 * the server can log it.
 */
export function crashAlertRecipients<M extends CrashAlertMember>(members: readonly M[], raw: unknown): CrashAlertAudience<M> {
  const panel = members.filter(reachesPanel);
  const wanted = parseCrashAlertRecipients(raw);
  if (wanted.length === 0) return { recipients: panel, addresses: [], narrowed: false, listMatchedNobody: false };
  const emailOf = (m: CrashAlertMember) => String(m.email ?? "").trim().toLowerCase();
  const picked = panel.filter((m) => wanted.includes(emailOf(m)));
  const known = new Set(members.map(emailOf).filter(Boolean));
  const addresses = wanted.filter((e) => !known.has(e));
  if (picked.length === 0 && addresses.length === 0) return { recipients: panel, addresses: [], narrowed: false, listMatchedNobody: true };
  return { recipients: picked, addresses, narrowed: true, listMatchedNobody: false };
}
