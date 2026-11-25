/** Which browser crash emails (server/lib/crashTriage.ts), as pure rules. The SQL is in server/repos/clientCrashes.db.test.ts. */
import { describe, expect, it } from "vitest";
import { CRASH_TRIAGE_DIALS, TRIAGE_DEFAULTS, alertWords, decideEmail, digestWords, readTriageDials, visitorDigest } from "./crashTriage";
import { VARIABLES } from "../../shared/gameVariables";

const NOW = new Date("2026-11-25T04:00:00Z");

describe("decideEmail", () => {
  it("ours emails the first time; not ours needs the visitors", () => {
    expect(decideEmail({ ours: true, visitorsInWindow: 1, emailedAt: null, now: NOW }, TRIAGE_DEFAULTS)).toEqual({ email: true, why: "ours" });
    expect(decideEmail({ ours: false, visitorsInWindow: 2, emailedAt: null, now: NOW }, TRIAGE_DEFAULTS)).toEqual({ email: false, why: "quiet" });
    expect(decideEmail({ ours: false, visitorsInWindow: 3, emailedAt: null, now: NOW }, TRIAGE_DEFAULTS)).toEqual({ email: true, why: "spread" });
  });

  it("one email per signature per window", () => {
    const hourAgo = new Date(NOW.getTime() - 3600_000);
    const dayAgo = new Date(NOW.getTime() - 24 * 3600_000);
    expect(decideEmail({ ours: true, visitorsInWindow: 9, emailedAt: hourAgo, now: NOW }, TRIAGE_DEFAULTS)).toEqual({ email: false, why: "already_told" });
    expect(decideEmail({ ours: true, visitorsInWindow: 9, emailedAt: dayAgo, now: NOW }, TRIAGE_DEFAULTS).email).toBe(true);
  });

  it("follows the dials", () => {
    const dials = { ...TRIAGE_DEFAULTS, spreadVisitors: 1 };
    expect(decideEmail({ ours: false, visitorsInWindow: 1, emailedAt: null, now: NOW }, dials).email).toBe(true);
  });
});

describe("the dials", () => {
  it("are declared in shared/gameVariables.ts with the platform's defaults", () => {
    const byKey = new Map(VARIABLES.map((v: any) => [v.key, v]));
    expect(Number(byKey.get(CRASH_TRIAGE_DIALS.spreadVisitors)?.default)).toBe(TRIAGE_DEFAULTS.spreadVisitors);
    expect(Number(byKey.get(CRASH_TRIAGE_DIALS.spreadMinutes)?.default)).toBe(TRIAGE_DEFAULTS.spreadMinutes);
    expect(Number(byKey.get(CRASH_TRIAGE_DIALS.emailEveryHours)?.default)).toBe(TRIAGE_DEFAULTS.emailEveryHours);
    expect(Number(byKey.get(CRASH_TRIAGE_DIALS.keepDays)?.default)).toBe(TRIAGE_DEFAULTS.keepDays);
  });

  it("read as their defaults when unreadable, and are held to a sane range", () => {
    expect(readTriageDials(() => { throw new Error("not loaded"); })).toEqual(TRIAGE_DEFAULTS);
    expect(readTriageDials(() => Number.NaN)).toEqual(TRIAGE_DEFAULTS);
    expect(readTriageDials((k) => (k === CRASH_TRIAGE_DIALS.spreadVisitors ? 500 : 0))).toEqual({ ...TRIAGE_DEFAULTS, spreadVisitors: 50 });
  });
});

describe("visitorDigest", () => {
  it("tells two addresses apart today, the same address the same today, and never links one day to the next", () => {
    const tomorrow = new Date(NOW.getTime() + 24 * 3600_000);
    expect(visitorDigest("s", "203.0.113.9", NOW)).toBe(visitorDigest("s", "203.0.113.9", NOW));
    expect(visitorDigest("s", "203.0.113.9", NOW)).not.toBe(visitorDigest("s", "203.0.113.10", NOW));
    expect(visitorDigest("s", "203.0.113.9", NOW)).not.toBe(visitorDigest("s", "203.0.113.9", tomorrow));
    expect(visitorDigest("s", "203.0.113.9", NOW)).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("the words", () => {
  it("an alert says the page, the browser kind, the count, first and last seen, whether it is ours, and links its signature", () => {
    const w = alertWords(
      { id: "abcdef0123456789", message: "n is null", topFrame: "render@/assets/Roles.js", ours: true, firstSeenAt: new Date("2026-11-24T09:00:00Z"), lastSeenAt: NOW, seenCount: 4, emailedAt: null, emailsSent: 1, visitorsInWindow: 2, sightingId: "ccs-x" },
      { browser: "WebKit iOS", route: "/apply" },
      "ours",
    );
    expect(w.title).toBe("Crash on /apply: n is null");
    expect(w.link).toBe("/village-health#crash-abcdef0123456789");
    expect(w.body).toBe(
      "Page: /apply. Browser: in-app browser (iOS) (WebKit iOS). Seen 4 times, first 2026-11-24 09:00 UTC, last 2026-11-25 04:00 UTC. Our code: yes, render@/assets/Roles.js. It emailed because a frame is from our own code. One email a day at most for this crash; the rest are counted on Village Health and in the daily digest.",
    );
  });

  it("a digest lists the most frequent first and says how many more there are", () => {
    const groups = Array.from({ length: 27 }, (_, i) => ({ signatureId: `s${i}`, message: `m${i}`, browser: "Safari iOS", route: "/", count: 27 - i }));
    const w = digestWords(groups);
    expect(w.title).toBe(`Crash digest: ${groups.reduce((n, g) => n + g.count, 0)} reports recorded, none emailed`);
    expect(w.body.startsWith("27 x m0 (/, Safari iOS)")).toBe(true);
    expect(w.body).toContain("And 2 more on Village Health.");
  });
});
