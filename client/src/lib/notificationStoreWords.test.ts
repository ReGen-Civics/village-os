/**
 * The bell's list arrives in the reader's language: a notice the server hands back with its words is drawn from
 * them, every other one as stored, and an English reader gets the list exactly as sent (notificationStore.ts).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";

vi.mock("@/lib/gameApi", () => ({ authToken: () => "tk" }));

import { getNotifyState, refreshNotifications, resetNotificationStore } from "./notificationStore";
import { NOTICE_KEY_WORDS } from "./noticeWords";

const worded = {
  id: "n1",
  type: "season_plan_reminder",
  title: "Your season is not filed yet",
  body: "3 days left.",
  isRead: false,
  at: "2026-11-26T00:00:00.000Z",
  words: { key: "season_plan.reminder", params: { daysLeft: 3 }, own: [] },
};
const plain = { id: "n2", type: "message", title: "Ana wrote to you", body: null, isRead: false, at: "2026-11-25T00:00:00.000Z", words: null };

function serve() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ unreadCount: 2, unseenCount: 2, notifications: [worded, plain] }) })),
  );
}

afterEach(() => {
  resetNotificationStore();
  vi.unstubAllGlobals();
  i18n.activate("en");
});

describe("the bell's list in the reader's language", () => {
  it("draws a worded notice in Spanish and leaves the rest as stored", async () => {
    const w = NOTICE_KEY_WORDS["season_plan.reminder"];
    i18n.load("es", { [w.title.id]: "Su temporada todavía no está registrada", [w.body!.id]: "{daysLeft, plural, one {Queda # día.} other {Quedan # días.}}" });
    i18n.activate("es");
    serve();
    await refreshNotifications(true);
    const [a, b] = getNotifyState().items;
    expect([a.title, a.body]).toEqual(["Su temporada todavía no está registrada", "Quedan 3 días."]);
    expect(b).toEqual(plain);
  });

  it("hands an English reader the list exactly as the server sent it", async () => {
    i18n.activate("en");
    serve();
    await refreshNotifications(true);
    expect(getNotifyState().items).toEqual([worded, plain]);
  });
});
