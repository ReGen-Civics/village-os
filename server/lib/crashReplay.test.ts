/**
 * The replay (server/lib/crashReplay.ts) over a MADE-UP export shaped like Admin, Comms: the noise kinds that have
 * emailed before this (a wallet extension, an in-app browser's bridge, Firefox iOS, dropped connections, tabs from
 * before a deploy) and one real bug, each sent to three admins. It is not production's data; the real 7 days are
 * replayed with scripts/crash-replay.ts once exported.
 */
import { describe, expect, it } from "vitest";
import { parseRow, replay, rowsFromExport } from "./crashReplay";

const T0 = Date.parse("2026-11-20T10:00:00Z");
const ADMINS = 3;
const sent = (minutes: number, subject: string) =>
  Array.from({ length: ADMINS }, () => ({ subject, origin: "notify.immediate", sent_at: new Date(T0 + minutes * 60_000).toISOString() }));

const EXPORT = [
  ...sent(0, "Something broke in browser on /: Cannot read properties of undefined (reading 'ethereum')"),
  ...sent(30, "Something broke in browser on /apply: undefined is not an object (evaluating 'window.webkit.messageHandlers')"),
  ...sent(95, "Something broke in browser on /roles: Can't find variable: __firefox__"),
  ...sent(200, "Something broke in browser on /roles: copy part kxi1ofHr6p0P: 404"),
  ...sent(260, "Something broke in browser on /team: Failed to fetch dynamically imported module: https://example.test/assets/Team-B6yHa53f.js"),
  ...sent(300, "Something broke in browser on /apply: Load failed"),
  // One real bug, hit by four visitors inside an hour, and again the next day.
  ...sent(400, "Something broke in browser on /propose-a-role: Cannot access uninitialized variable."),
  ...sent(410, "Something broke in browser on /propose-a-role: Cannot access uninitialized variable."),
  ...sent(420, "Something broke in browser on /propose-a-role: Cannot access uninitialized variable."),
  ...sent(430, "Something broke in browser on /propose-a-role: Cannot access uninitialized variable."),
  ...sent(400 + 26 * 60, "Something broke in browser on /propose-a-role: Cannot access uninitialized variable."),
  { subject: "Your role starts on Monday", origin: "notify.immediate", sent_at: new Date(T0).toISOString() },
];

describe("the replay", () => {
  it("collapses the copies sent to each admin, drops the noise, and gives the range that would have emailed", () => {
    const r = replay(rowsFromExport(JSON.stringify(EXPORT)));
    expect(r.rows).toBe(EXPORT.length);
    expect(r.notCrashes).toBe(1);
    expect(r.crashes).toBe(11);
    expect(r.droppedAsNoise).toBe(4);
    expect(r.droppedAsStaleBuild).toBe(2);
    expect(r.signatures).toBe(1);
    expect(r.bySignature[0]).toMatchObject({ message: "Cannot access uninitialized variable.", reports: 5, atMost: 2, atLeast: 1 });
    expect([r.wouldEmailAtLeast, r.wouldEmailAtMost]).toEqual([1, 2]);
  });

  it("reads a CSV export with quoted subjects", () => {
    const csv = 'subject,origin,sent_at\n"Something broke in browser on /apply: Load failed",notify.immediate,2026-11-20T10:00:00Z\n"Something broke in browser on /x: a, b and ""c""",notify.immediate,2026-11-20T10:01:00Z\n';
    const rows = rowsFromExport(csv);
    expect(rows.map((r) => r.text)).toEqual(["Something broke in browser on /apply: Load failed", 'Something broke in browser on /x: a, b and "c"']);
  });

  it("reads an audit-trail crash line as well as an email subject", () => {
    expect(parseRow("TypeError: n is null (on /apply, Safari 17 iOS, build 2026-11-24 abc1234, index-B6yHa53f)")).toEqual({ message: "n is null", page: "/apply" });
    expect(parseRow("Something broke in scheduler: boom")).toBeNull();
  });
});
