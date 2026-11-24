/**
 * THE CRASH ALERT'S IN-APP SINK (shared/crashAlerts.ts says who and why).
 *
 * `wireErrorReporting` (server/lib/errors.ts) is handed this at boot. It
 * writes one `crash_alert` notice per recipient, under the shared dedupe key
 * suffixed with the recipient's id, exactly as `notifyAdmins` did, so "each
 * person hears it once" and "the crash fires once" stay separate concerns.
 * The email follows from the notice kind (`emailCadenceFor` in notify.ts).
 *
 * A crash can come before boot has loaded the variables, when the dial reads
 * its default (blank, everyone). Reading the dial must never become a second
 * crash, so a throw there also reads as blank.
 */
import { crashAlertRecipients, type CrashAlertMember } from "../../shared/crashAlerts";

export interface CrashAlertDeps {
  members: () => Promise<readonly CrashAlertMember[]>;
  notify: (input: { userId: string; type: string; title: string; link: string; dedupeKey: string; actorUserId: null }) => Promise<unknown> | unknown;
  /** The dial's stored value: `stringVar("ops.crash_alert_recipients")`. */
  recipientsRaw: () => string;
  log?: (line: string) => void;
}

export function crashAlertNotifier(deps: CrashAlertDeps): (title: string, dedupeKey: string) => Promise<void> {
  return async (title, dedupeKey) => {
    let raw = "";
    try {
      raw = deps.recipientsRaw();
    } catch {
      raw = "";
    }
    const { recipients, listMatchedNobody } = crashAlertRecipients(await deps.members(), raw);
    if (listMatchedNobody) {
      (deps.log ?? console.warn)("[error] the crash alert list names no admin or founder, so every admin and founder was told");
    }
    for (const r of recipients) {
      // The literal, so shared/notificationKinds.test.ts sees its producer; it is CRASH_ALERT_TYPE (shared/crashAlerts.test.ts).
      await deps.notify({ userId: String(r.id), type: "crash_alert", title, link: "/admin", dedupeKey: `${dedupeKey}:${r.id}`, actorUserId: null });
    }
  };
}
