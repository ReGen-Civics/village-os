/**
 * THE CRASH ALERT'S IN-APP SINK (server/lib/crashAlerts.ts), driven with fakes.
 * Each recipient gets one `crash_alert` notice under the shared key suffixed
 * with their id; the dial narrows who; and its email is immediate while
 * `payments_alert` keeps exactly the cadence it had.
 */
import { describe, expect, it, vi } from "vitest";
import { crashAlertNotifier } from "./crashAlerts";
import { emailCadenceFor, resolveNotifyPrefs } from "./notify";

const village = [
  { id: "f1", role: "founder", email: "founder@example.org" },
  { id: "a1", role: "admin", email: "ops@example.org" },
  { id: "a2", role: "admin", email: "jess@example.org" },
  { id: "m1", role: "member", email: "member@example.org" },
];

function sink(raw: string | (() => string)) {
  const notify = vi.fn(async () => undefined);
  const log = vi.fn();
  const send = crashAlertNotifier({ members: async () => village, notify, recipientsRaw: typeof raw === "function" ? raw : () => raw, log });
  const told = () => (notify.mock.calls as unknown as Array<[{ userId: string }]>).map(([n]) => n.userId);
  return { send, notify, log, told };
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

  it("a list naming nobody on the panel tells everyone on it, and logs why", async () => {
    const s = sink("gone@example.org");
    await s.send("t", "error:k");
    expect(s.told()).toEqual(["f1", "a1", "a2"]);
    expect(s.log).toHaveBeenCalledTimes(1);
  });

  it("a dial that cannot be read yet (a crash before boot loaded it) reads as blank", async () => {
    const s = sink(() => {
      throw new Error("variables not loaded");
    });
    await s.send("t", "error:k");
    expect(s.told()).toEqual(["f1", "a1", "a2"]);
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
