/**
 * Quest work shows on Today only while some waits for this member's check (the
 * lead, 27 Nov 2026: "If there is submissions that need checking by admins,
 * yes"). The count comes from the consent queue; nothing is a card for a
 * member who may not consent, or for an empty queue.
 */
import { describe, expect, it } from "vitest";
import { todayCards } from "./TodayStrip";

const quiet = { consents: null, tasks: null, messages: null, session: null };

describe("work to check on Today", () => {
  it("is left out with nothing waiting, and for a member who may not consent", () => {
    expect(todayCards({ ...quiet, toCheck: { waiting: 0, newest: null } }).map((c) => c.key)).toEqual([]);
    expect(todayCards({ ...quiet, toCheck: null }).map((c) => c.key)).toEqual([]);
  });

  it("names one piece by its quest, and several by their count, and opens the review page", () => {
    const one = todayCards({ ...quiet, toCheck: { waiting: 1, newest: "Food Forest Tender" } });
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ key: "to-check", title: "Food Forest Tender", href: "/review" });
    const many = todayCards({ ...quiet, toCheck: { waiting: 3, newest: "Food Forest Tender" } });
    expect(many[0].title).toBe("3 quests turned in");
  });
});
