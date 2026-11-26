/**
 * What `notifications.words` may hold, and how it is read back (shared/noticeKeys.ts). The read must never throw
 * and must never hand the bell a translation of words a row no longer says.
 */
import { describe, expect, it } from "vitest";
import { NOTICE_KEYS, NOTICE_WORDS_MAX, cleanParams, noticeWordsJson, readNoticeWords } from "./noticeKeys";

const TITLE = "Your season is not filed yet";
const ref = { key: "season_plan.reminder" as const, params: { daysLeft: 3 } };

describe("noticeWordsJson", () => {
  it("stores the key, the values, the village's own parts and the title it was stored with", () => {
    const json = noticeWordsJson("season_plan_reminder", ref, TITLE, ["title", "title"]);
    expect(JSON.parse(json!)).toEqual({ key: "season_plan.reminder", params: { daysLeft: 3 }, own: ["title"], title: TITLE });
  });

  it("stores nothing for no words, an unknown key, another kind of notice, or a value of the wrong kind", () => {
    expect(noticeWordsJson("season_plan_reminder", null, TITLE, [])).toBeNull();
    expect(noticeWordsJson("season_plan_reminder", { key: "nope" as any, params: {} }, TITLE, [])).toBeNull();
    expect(noticeWordsJson("ballot_opened", ref, TITLE, [])).toBeNull();
    expect(noticeWordsJson("season_plan_reminder", { key: "season_plan.reminder", params: { daysLeft: "3" } }, TITLE, [])).toBeNull();
    expect(noticeWordsJson("season_plan_open", { key: "season_plan.open", params: { season: "Harvest", closesOn: "1 Dec" } }, "t", [])).toBeNull();
  });

  it("keeps only the values the key names, and clips a long name", () => {
    const json = noticeWordsJson("season_plan_open", { key: "season_plan.open", params: { season: "x".repeat(500), closesOn: "2026-12-01", extra: "no" } as any }, "t", []);
    const w = JSON.parse(json!);
    expect(Object.keys(w.params).sort()).toEqual(["closesOn", "season"]);
    expect(w.params.season).toHaveLength(200);
  });

  it("stores nothing past the cap", () => {
    expect(noticeWordsJson("season_plan_reminder", ref, "t".repeat(NOTICE_WORDS_MAX), [])).toBeNull();
  });
});

describe("readNoticeWords", () => {
  const stored = noticeWordsJson("season_plan_reminder", ref, TITLE, [])!;

  it("reads back what was stored", () => {
    expect(readNoticeWords(stored, TITLE, "season_plan_reminder")).toEqual({ key: "season_plan.reminder", params: { daysLeft: 3 }, own: [] });
  });

  it("reads nothing once the row's title has changed, as the erasure changes it", () => {
    expect(readNoticeWords(stored, "A member who has left the village", "season_plan_reminder")).toBeNull();
  });

  it("never throws, and reads nothing from a malformed, foreign or oversized value", () => {
    for (const raw of [null, undefined, "", "{", "[]", "null", 42, JSON.stringify({ key: "nope", params: {}, title: TITLE }), "x".repeat(NOTICE_WORDS_MAX + 1)]) {
      expect(readNoticeWords(raw, TITLE, "season_plan_reminder")).toBeNull();
    }
    expect(readNoticeWords(stored, TITLE, "ballot_opened")).toBeNull();
    expect(readNoticeWords(JSON.stringify({ key: "season_plan.reminder", params: { daysLeft: "x" }, own: [], title: TITLE }), TITLE, "season_plan_reminder")).toBeNull();
  });

  it("keeps only the parts a village can own", () => {
    const raw = JSON.stringify({ key: "season_plan.reminder", params: { daysLeft: 1 }, own: ["title", "link", 3], title: TITLE });
    expect(readNoticeWords(raw, TITLE, "season_plan_reminder")?.own).toEqual(["title"]);
  });
});

describe("the registry", () => {
  it("names a notice kind short enough for notifications.type, and only kinds of value it knows", () => {
    for (const [key, def] of Object.entries(NOTICE_KEYS)) {
      expect(def.type.length, key).toBeLessThanOrEqual(32);
      for (const kind of Object.values(def.values)) expect(["text", "count", "day"], key).toContain(kind);
    }
    expect(cleanParams("season_ending.member", { season: "", daysLeft: 1, endsOn: "2026-12-21" })).toEqual({ season: "", daysLeft: 1, endsOn: "2026-12-21" });
  });
});
