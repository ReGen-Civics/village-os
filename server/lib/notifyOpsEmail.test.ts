/**
 * The operations-report email preference (`opsEmail` in server/lib/notify.ts).
 *
 * The daily failed-actions report goes to every admin and founder. A founder
 * whose seat is not operational could only stop it with `emailsOff`, which
 * also stopped everything else. `opsEmail` governs that report's email alone,
 * defaults to daily so nobody's mail changed when it arrived, and leaves the
 * steward window pin and the immediate ops alerts exactly where they were.
 */
import { describe, expect, it } from "vitest";
import { emailCadenceFor, resolveNotifyPrefs } from "./notify";

describe("opsEmail: the failed-actions report's email", () => {
  it("defaults to the daily digest, so nobody's mail changes until they choose", () => {
    expect(resolveNotifyPrefs({}).opsEmail).toBe("daily");
    expect(resolveNotifyPrefs(null).opsEmail).toBe("daily");
    expect(emailCadenceFor("failed_action", resolveNotifyPrefs({}))).toBe("daily");
  });

  it("off keeps the report to the bell", () => {
    const prefs = resolveNotifyPrefs({ notify: { opsEmail: "off" } });
    expect(prefs.opsEmail).toBe("off");
    expect(emailCadenceFor("failed_action", prefs)).toBe("off");
  });

  it("a junk value degrades to daily", () => {
    expect(resolveNotifyPrefs({ notify: { opsEmail: "immediate" } }).opsEmail).toBe("daily");
    expect(resolveNotifyPrefs({ notify: { opsEmail: true } }).opsEmail).toBe("daily");
  });

  it("governs the report only: every other kind reads the same with it off", () => {
    const on = resolveNotifyPrefs({});
    const off = resolveNotifyPrefs({ notify: { opsEmail: "off" } });
    for (const type of [
      "payments_alert",
      "village_export",
      "signing_key_rotated",
      "session_record_ready",
      "session_task_unheld",
      "gratitude",
      "ballot_opened",
      "veto_window_opened",
      "veto_window_halfway",
      "veto_window_closing",
    ]) {
      expect(emailCadenceFor(type, off), type).toBe(emailCadenceFor(type, on));
    }
  });

  it("the steward window notices stay pinned immediate whatever opsEmail says", () => {
    const off = resolveNotifyPrefs({ notify: { opsEmail: "off", emailsOff: true } });
    for (const type of ["veto_window_opened", "veto_window_halfway", "veto_window_closing"]) {
      expect(emailCadenceFor(type, off)).toBe("immediate");
    }
  });

  it("the global switch still wins over a daily opsEmail", () => {
    expect(emailCadenceFor("failed_action", resolveNotifyPrefs({ notify: { emailsOff: true } }))).toBe("off");
  });
});
