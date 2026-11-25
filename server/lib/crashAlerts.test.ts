/**
 * THE CRASH ALERT'S SINKS (server/lib/crashAlerts.ts), driven with fakes.
 * Each admin or founder gets one `crash_alert` notice under the shared key
 * suffixed with their id; an address with no account gets one email and no
 * notice, under the shared key suffixed with a digest of the address; the dial
 * chooses who; and the account email is immediate while `payments_alert` keeps
 * exactly the cadence it had.
 */
import { describe, expect, it, vi } from "vitest";
import type { OutgoingEmail, PostResult } from "../../shared/comms/contracts";
import type { PostOfficeDeps } from "./comms/postOffice";
import { CRASH_ALERT_EMAIL_ORIGIN, crashAlertEmailKey, crashAlertMailer, crashAlertNotifier, type CrashAlertEmail } from "./crashAlerts";
import { emailCadenceFor, resolveNotifyPrefs } from "./notify";

const village = [
  { id: "f1", role: "founder", email: "founder@example.org" },
  { id: "a1", role: "admin", email: "ops@example.org" },
  { id: "a2", role: "admin", email: "jess@example.org" },
  { id: "m1", role: "member", email: "member@example.org" },
];

function sink(raw: string | (() => string), emailAddress: (mail: CrashAlertEmail) => Promise<unknown> = async () => undefined) {
  const notify = vi.fn(async () => undefined);
  const email = vi.fn(emailAddress);
  const log = vi.fn();
  const send = crashAlertNotifier({ members: async () => village, notify, recipientsRaw: typeof raw === "function" ? raw : () => raw, emailAddress: email, log });
  const told = () => (notify.mock.calls as unknown as Array<[{ userId: string }]>).map(([n]) => n.userId);
  const emailed = () => email.mock.calls.map(([m]) => m.to);
  return { send, notify, email, log, told, emailed };
}

describe("crashAlertNotifier", () => {
  it("with no list, tells every admin and founder under crash_alert, one notice each", async () => {
    const s = sink("");
    await s.send("Something broke in browser on /roles: boom", "error:k");
    expect(s.told()).toEqual(["f1", "a1", "a2"]);
    expect(s.notify).toHaveBeenCalledWith({ userId: "a1", type: "crash_alert", title: "Something broke in browser on /roles: boom", link: "/admin", dedupeKey: "error:k:a1", actorUserId: null });
    expect(s.log).not.toHaveBeenCalled();
  });

  it("with a list, tells only the admins and founders on it", async () => {
    const s = sink("ops@example.org");
    await s.send("t", "error:k");
    expect(s.told()).toEqual(["a1"]);
  });

  it("never tells a member who is not an admin or founder", async () => {
    const s = sink("member@example.org, ops@example.org");
    await s.send("t", "error:k");
    expect(s.told()).toEqual(["a1"]);
  });

  it("an admin's address gets the notice and no plain email: its email rides the account's cadence", async () => {
    const s = sink("ops@example.org");
    await s.send("t", "error:k");
    expect(s.told()).toEqual(["a1"]);
    expect(s.email).not.toHaveBeenCalled();
  });

  it("an address with no account gets one email and no notice", async () => {
    const s = sink("inbox@ops.example");
    await s.send("Something broke in scheduler: boom", "error:k");
    expect(s.notify).not.toHaveBeenCalled();
    expect(s.email).toHaveBeenCalledTimes(1);
    expect(s.email).toHaveBeenCalledWith({ to: "inbox@ops.example", title: "Something broke in scheduler: boom", link: "/admin", idempotencyKey: crashAlertEmailKey("error:k", "inbox@ops.example") });
    expect(s.log).not.toHaveBeenCalled();
  });

  it("a mixed list tells the accounts in the app and emails the plain addresses", async () => {
    const s = sink("jess@example.org, inbox@ops.example, member@example.org, second@ops.example");
    await s.send("t", "error:k");
    expect(s.told()).toEqual(["a2"]);
    expect(s.emailed()).toEqual(["inbox@ops.example", "second@ops.example"]);
  });

  it("a list naming no usable address tells everyone on the panel, emails nobody, and logs why without the address", async () => {
    const s = sink("member@example.org");
    await s.send("t", "error:k");
    expect(s.told()).toEqual(["f1", "a1", "a2"]);
    expect(s.email).not.toHaveBeenCalled();
    expect(s.log).toHaveBeenCalledTimes(1);
    expect(String(s.log.mock.calls[0][0])).not.toContain("@");
  });

  it("a list of only junk reads as blank: everyone, and no email", async () => {
    const s = sink("not-an-email, ;;");
    await s.send("t", "error:k");
    expect(s.told()).toEqual(["f1", "a1", "a2"]);
    expect(s.email).not.toHaveBeenCalled();
  });

  it("one inbox that cannot be written to does not stop the next, and the log line names no address", async () => {
    let first = true;
    const s = sink("broken@ops.example, inbox@ops.example", async () => {
      if (first) {
        first = false;
        throw new Error("ledger down");
      }
    });
    await s.send("t", "error:k");
    expect(s.emailed()).toEqual(["broken@ops.example", "inbox@ops.example"]);
    expect(s.log).toHaveBeenCalledTimes(1);
    expect(String(s.log.mock.calls[0][0])).not.toContain("@");
  });

  it("the email's key is one per crash per address: stable across repeats and case, distinct across crashes and addresses, and never spells the address", () => {
    const k = crashAlertEmailKey("error:k", "inbox@ops.example");
    expect(crashAlertEmailKey("error:k", " INBOX@ops.example ")).toBe(k);
    expect(crashAlertEmailKey("error:other", "inbox@ops.example")).not.toBe(k);
    expect(crashAlertEmailKey("error:k", "second@ops.example")).not.toBe(k);
    expect(k.startsWith("error:k:to:")).toBe(true);
    expect(k).not.toContain("inbox");
  });

  it("a dial that cannot be read yet (a crash before boot loaded it) reads as blank", async () => {
    const s = sink(() => {
      throw new Error("variables not loaded");
    });
    await s.send("t", "error:k");
    expect(s.told()).toEqual(["f1", "a1", "a2"]);
  });
});

describe("an alert with its own words", () => {
  it("hands the body and the link to every notice and every plain address", async () => {
    const s = sink("founder@example.org, inbox@ops.example");
    await s.send("Crash on /apply: n is null", "client-crash:abc:1", { body: "Seen 3 times.", link: "/village-health#crash-abc" });
    expect(s.notify).toHaveBeenCalledWith({ userId: "f1", type: "crash_alert", title: "Crash on /apply: n is null", body: "Seen 3 times.", link: "/village-health#crash-abc", dedupeKey: "client-crash:abc:1:f1", actorUserId: null });
    expect(s.email).toHaveBeenCalledWith(expect.objectContaining({ to: "inbox@ops.example", body: "Seen 3 times.", link: "/village-health#crash-abc" }));
  });
});

describe("crash_alert email cadence", () => {
  it("is immediate, honours the global switch, and leaves payments_alert as it was", () => {
    const on = resolveNotifyPrefs({});
    expect(emailCadenceFor("crash_alert", on)).toBe("immediate");
    expect(emailCadenceFor("crash_alert", resolveNotifyPrefs({ notify: { emailsOff: true } }))).toBe("off");
    expect(emailCadenceFor("payments_alert", on)).toBe("immediate");
    expect(emailCadenceFor("crash_alert", resolveNotifyPrefs({ notify: { opsEmail: "off" } }))).toBe("immediate");
  });
});

describe("crashAlertMailer", () => {
  /**
   * A post office that keeps the idempotency rule the real one keeps (one row
   * per key, a second post answers `duplicate`), and a pool that answers the
   * cap's count.
   */
  function office(sentToday = 0) {
    const keys = new Set<string>();
    const posted: OutgoingEmail[] = [];
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return [[{ n: sentToday }]];
      },
    };
    const postOffice = { getPool: () => pool } as unknown as PostOfficeDeps;
    const send = async (_deps: PostOfficeDeps, email: OutgoingEmail): Promise<PostResult> => {
      if (keys.has(email.idempotencyKey)) return { status: "duplicate", messageId: "first" };
      keys.add(email.idempotencyKey);
      posted.push(email);
      return { status: "sent", messageId: `msg${posted.length}` };
    };
    const mailer = crashAlertMailer({ postOffice, origin: () => "https://village.example", projectName: () => "Test <Village>", send });
    return { mailer, posted, queries };
  }

  it("posts one essential email to the address, sent now, with the title as subject and a link to Admin", async () => {
    const o = office();
    const r = await o.mailer({ to: "inbox@ops.example", title: "Something broke in scheduler: <boom>", link: "/admin", idempotencyKey: "error:k:to:abc" });
    expect(r).toEqual({ status: "sent", messageId: "msg1" });
    expect(o.posted).toHaveLength(1);
    const e = o.posted[0];
    expect(e).toMatchObject({ idempotencyKey: "error:k:to:abc", kind: "essential", origin: CRASH_ALERT_EMAIL_ORIGIN, to: { email: "inbox@ops.example" }, subject: "Something broke in scheduler: <boom>", urgent: true });
    expect(e.html).toContain("https://village.example/admin");
    expect(e.html).toContain("Something broke in scheduler: &lt;boom&gt;");
    expect(e.html).toContain("Test &lt;Village&gt;");
    expect(e.text).toContain("https://village.example/admin");
    expect(e.text).toContain("crash alert list");
  });

  it("a browser crash's email carries its triage words and links its signature (25 Nov 2026)", async () => {
    const o = office();
    await o.mailer({ to: "inbox@ops.example", title: "Crash on /apply: n is null", body: "Page: /apply. Browser: <in-app> browser (iOS).", link: "/village-health#crash-abc", idempotencyKey: "client-crash:abc:1:to:x" });
    const e = o.posted[0];
    expect(e.html).toContain("Page: /apply. Browser: &lt;in-app&gt; browser (iOS).");
    expect(e.html).toContain("https://village.example/village-health#crash-abc");
    expect(e.text).toContain("Page: /apply. Browser: <in-app> browser (iOS).");
  });

  it("dedupe: the same crash reported again to the same address is one email", async () => {
    const o = office();
    const notifier = crashAlertNotifier({ members: async () => village, notify: async () => undefined, recipientsRaw: () => "inbox@ops.example", emailAddress: o.mailer });
    await notifier("t", "error:k");
    await notifier("t", "error:k");
    await notifier("t", "error:other");
    expect(o.posted.map((e) => e.to.email)).toEqual(["inbox@ops.example", "inbox@ops.example"]);
    expect(new Set(o.posted.map((e) => e.idempotencyKey)).size).toBe(2);
  });

  it("keeps to the daily email cap an account has, counted from this address's crash emails", async () => {
    const o = office(20);
    const r = await o.mailer({ to: "Inbox@Ops.example", title: "t", link: "/admin", idempotencyKey: "k" });
    expect(r).toBe("over_cap");
    expect(o.posted).toHaveLength(0);
    expect(o.queries[0].sql).toContain("FROM comms_messages");
    expect(o.queries[0].params.slice(0, 2)).toEqual(["inbox@ops.example", CRASH_ALERT_EMAIL_ORIGIN]);
    expect((await office(19).mailer({ to: "inbox@ops.example", title: "t", link: "/admin", idempotencyKey: "k" })) as PostResult).toMatchObject({ status: "sent" });
  });

  it("a cap that cannot be counted still sends: an alarm errs toward ringing", async () => {
    const posted: OutgoingEmail[] = [];
    const postOffice = { getPool: () => ({ query: async () => { throw new Error("no database"); } }) } as unknown as PostOfficeDeps;
    const mailer = crashAlertMailer({ postOffice, origin: () => "https://v.example", projectName: () => "V", send: async (_d, e) => { posted.push(e); return { status: "sent", messageId: "m" }; } });
    await mailer({ to: "inbox@ops.example", title: "t", link: "/admin", idempotencyKey: "k" });
    expect(posted).toHaveLength(1);
  });
});
