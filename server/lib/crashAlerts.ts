/**
 * THE CRASH ALERT'S SINKS (shared/crashAlerts.ts says who and why).
 *
 * `wireErrorReporting` (server/lib/errors.ts) is handed this at boot. For each
 * admin or founder the dial reaches it writes one `crash_alert` notice, under
 * the shared dedupe key suffixed with the recipient's id, exactly as
 * `notifyAdmins` did, so "each person hears it once" and "the crash fires
 * once" stay separate concerns. Their email follows from the notice kind
 * (`emailCadenceFor` in notify.ts).
 *
 * An address on the list that belongs to no account, such as a shared
 * operations inbox, has no bell and no cadence. It gets the email alone,
 * through the post office (`crashAlertMailer` below), under the same shared
 * key suffixed with a digest of the address, so a crash emails each address
 * once however many times it is reported.
 *
 * A crash can come before boot has loaded the variables, when the dial reads
 * its default (blank, everyone). Reading the dial must never become a second
 * crash, so a throw there also reads as blank.
 *
 * NO ADDRESS IS EVER LOGGED. The lines here name what happened, never who it
 * happened to.
 */
import crypto from "node:crypto";
import { crashAlertRecipients, type CrashAlertMember } from "../../shared/crashAlerts";
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import { emailKeyOf } from "../../shared/comms/address";
import { post, type PostOfficeDeps } from "./comms/postOffice";
import { emailAccent } from "./emailAccent";
import { DAILY_EMAIL_CAP, emailShell, escapeHtml } from "./notify";
import { numberVar } from "./variables";

/** One crash alert email to an address with no account. */
export interface CrashAlertEmail {
  to: string;
  title: string;
  link: string;
  /** What a person triages from, under the title (a browser crash's page, browser, count and whether it is ours). */
  body?: string;
  /** Stable per crash and address: the post office sends one email per key. */
  idempotencyKey: string;
}

export interface CrashAlertDeps {
  members: () => Promise<readonly CrashAlertMember[]>;
  notify: (input: { userId: string; type: string; title: string; body?: string | null; link: string; dedupeKey: string; actorUserId: null }) => Promise<unknown> | unknown;
  /** The dial's stored value: `stringVar("ops.crash_alert_recipients")`. */
  recipientsRaw: () => string;
  /** Emails one address that has no account (`crashAlertMailer`). Absent: such addresses hear nothing. */
  emailAddress?: (mail: CrashAlertEmail) => Promise<unknown> | unknown;
  log?: (line: string) => void;
}

/** The key one crash's email to one address is sent under. The address goes in as a digest, so the key never spells it. */
export function crashAlertEmailKey(dedupeKey: string, address: string): string {
  const digest = crypto.createHash("sha256").update(emailKeyOf(address)).digest("hex").slice(0, 16);
  return `${dedupeKey}:to:${digest}`;
}

export function crashAlertNotifier(deps: CrashAlertDeps): (title: string, dedupeKey: string, extras?: { body?: string; link?: string }) => Promise<void> {
  return async (title, dedupeKey, extras) => {
    const link = extras?.link || "/admin";
    const body = extras?.body || undefined;
    let raw = "";
    try {
      raw = deps.recipientsRaw();
    } catch {
      raw = "";
    }
    const log = deps.log ?? console.warn;
    const { recipients, addresses, listMatchedNobody } = crashAlertRecipients(await deps.members(), raw);
    if (listMatchedNobody) {
      log("[error] the crash alert list names no admin, founder or outside address, so every admin and founder was told");
    }
    for (const r of recipients) {
      // The literal, so shared/notificationKinds.test.ts sees its producer; it is CRASH_ALERT_TYPE (shared/crashAlerts.test.ts).
      await deps.notify({ userId: String(r.id), type: "crash_alert", title, ...(body ? { body } : {}), link, dedupeKey: `${dedupeKey}:${r.id}`, actorUserId: null });
    }
    if (!deps.emailAddress) return;
    for (const to of addresses) {
      try {
        await deps.emailAddress({ to, title, link, ...(body ? { body } : {}), idempotencyKey: crashAlertEmailKey(dedupeKey, to) });
      } catch {
        // One inbox that cannot be written to must not keep the next one from hearing.
        log("[error] a crash alert email to an address on the list could not be posted");
      }
    }
  };
}

/** Where the mailer writes, and the village's name, link and colour for the email. */
export interface CrashAlertMailerDeps {
  postOffice: PostOfficeDeps;
  origin: () => string;
  projectName: () => string;
  brandColour?: () => string;
  /** The post office's `post`; a test hands in a fake. */
  send?: (deps: PostOfficeDeps, email: OutgoingEmail) => Promise<PostResult>;
}

/** What made it, for Sent mail. Also what the daily cap counts. */
export const CRASH_ALERT_EMAIL_ORIGIN = "ops.crash_alert";

/** Statuses that mean the post office took the email, as the account cap counts `emailed_at`. */
const TAKEN = ["queued", "sending", "sent", "delivered"];

/**
 * THE SAME DAILY CAP AN ACCOUNT HAS. An admin's crash email stops at
 * `notify.daily_email_cap` emails a day (`underDailyCap` in notify.ts). An
 * address with no account has no notifications to count, so its crash emails
 * in the post office's ledger are counted instead, against the same number.
 * A loop of distinct crashes therefore cannot flood an operations inbox
 * either. A count that cannot be read sends: an alarm errs toward ringing.
 */
async function underCap(deps: CrashAlertMailerDeps, address: string): Promise<boolean> {
  try {
    const [rows] = await deps.postOffice
      .getPool()
      .query<any[]>(
        `SELECT COUNT(*) AS n FROM comms_messages WHERE email_key = ? AND origin = ? AND status IN (${TAKEN.map(() => "?").join(",")}) AND created_at >= (NOW() - INTERVAL 1 DAY)`,
        [emailKeyOf(address), CRASH_ALERT_EMAIL_ORIGIN, ...TAKEN],
      );
    return Number(rows?.[0]?.n ?? 0) < Math.max(1, numberVar("notify.daily_email_cap") || DAILY_EMAIL_CAP);
  } catch {
    return true;
  }
}

/**
 * The email sink for an address with no account. ESSENTIAL mail, sent now,
 * like the path hand-off to an inbox with no account (server/lib/comms/pathParts.ts):
 * `notices` are refused for anybody without an account, and the village
 * naming the address on its own crash alert list is the permission. Taking the
 * address off the list is how it stops.
 */
export function crashAlertMailer(deps: CrashAlertMailerDeps): (mail: CrashAlertEmail) => Promise<PostResult | "over_cap"> {
  const send = deps.send ?? post;
  return async (mail) => {
    if (!(await underCap(deps, mail.to))) return "over_cap";
    const name = deps.projectName();
    const accent = emailAccent(deps.brandColour?.());
    const url = deps.origin() + mail.link;
    const why = "This address hears about crashes because it is on the village's crash alert list. An admin or founder can take it off that list.";
    return send(deps.postOffice, {
      idempotencyKey: mail.idempotencyKey,
      kind: "essential",
      origin: CRASH_ALERT_EMAIL_ORIGIN,
      to: { email: mail.to },
      subject: mail.title,
      html: emailShell(
        escapeHtml(name),
        `<h2 style="margin:0 0 8px;font-size:17px">${escapeHtml(mail.title)}</h2>` +
          (mail.body ? `<p style="margin:0 0 14px;color:#4b5563">${escapeHtml(mail.body)}</p>` : "") +
          `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:${accent};color:#fff;border-radius:8px;padding:9px 16px;text-decoration:none;font-weight:600">Open Admin</a></p>` +
          `<p style="color:#9ca3af;font-size:12px;margin-top:18px">${escapeHtml(why)}</p>`,
        accent,
      ),
      text: `${mail.title}\n\n${mail.body ? `${mail.body}\n\n` : ""}Open Admin: ${url}\n\n${why}\n`,
      urgent: true,
    });
  };
}
