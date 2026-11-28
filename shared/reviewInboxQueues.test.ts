/**
 * THE QUEUES THAT SAT ON PAGES OF THEIR OWN (the running garden, 27 Nov 2026): reports on forum threads and messages,
 * reports on photographs of places, departures and invitation requests. Each is read as its own route answers the
 * person, and each row says what kind of thing waits and when, never who it is about or what was said.
 */
import { describe, expect, it } from "vitest";
import { decisionCounts, fromExits, fromForumReports, fromInviteRequests, fromMessageReports, fromPlaceReports, INBOX_READS, mergeSections } from "./reviewInbox";
import { INBOX_ORDER, INBOX_SOURCES } from "./reviewInboxSources";

const FORUM = [
  { id: "17", threadId: "t1", threadTitle: "Who left the gate open", severity: "soft", reason: "It names a neighbour", status: "open", alreadyHidden: false, reporter: "Rhea Reporter", at: "2026-11-20T10:00:00.000Z" },
  { id: "18", threadId: "t2", threadTitle: "(deleted thread)", severity: "hard", reason: null, status: "open", reporter: "a member", at: "2026-11-22T10:00:00.000Z" },
  { id: "19", threadId: "t3", threadTitle: "Closed already", severity: "soft", status: "resolved", reporter: "Rhea Reporter", at: "2026-11-01T10:00:00.000Z" },
];
const MESSAGES = [
  { id: 4, conversationId: "c1", conversationKind: "direct", conversationName: "Ana and Ben", messageId: "m1", body: "The private words of a message", deleted: false, authorId: "u9", reporter: "Ana Member", reason: "Unkind", status: "open", at: "2026-11-21T08:00:00.000Z" },
  { id: 5, body: "Another private message", reporter: "Ben Member", status: "dismissed", at: "2026-11-02T08:00:00.000Z" },
];
const PLACES = { status: "open", reports: [
  { id: "pr1", photoId: "ph1", structureKey: "pump-house", kind: "wrong-place", reason: "This is the old barn", status: "open", reporter: "Cy Member", url: "/uploads/x.webp", at: "2026-11-19T09:00:00.000Z" },
] };
const EXITS = { policy: { notice: 30 }, exits: [
  { id: "e1", userId: "u1", userName: "Dana Leaving", kind: "voluntary", status: "open", openedBy: "u1", noticeEndsAt: "2026-12-20T00:00:00.000Z", resolution: null, openedAt: "2026-11-18T00:00:00.000Z" },
  { id: "e2", userId: "u2", userName: "Eli Leaving", kind: "involuntary", status: "settling", openedBy: "u7", resolution: "The private terms of a departure", openedAt: "2026-11-10T00:00:00.000Z" },
  { id: "e3", userId: "u3", userName: "Fay Gone", kind: "voluntary", status: "resolved", openedAt: "2026-10-01T00:00:00.000Z" },
  { id: "e4", userId: "u4", userName: "Gus Stayed", kind: "voluntary", status: "cancelled", openedAt: "2026-10-02T00:00:00.000Z" },
] };
const INVITES = { requests: [
  { visitorId: "v1", name: "Hana Visitor", email: "hana@example.org", note: "I would love to join", requestedAt: "2026-11-23T12:00:00.000Z", interest: "gardening", applications: 2, hasAccount: false },
  { visitorId: "v2", name: "Ivo Visitor", email: "ivo@example.org", note: null, requestedAt: "2026-11-24T12:00:00.000Z" },
] };

describe("the queues that sat on pages of their own", () => {
  it("forum reports: only the open ones, by the thread and its day, each a door to moderation", () => {
    const items = fromForumReports(FORUM);
    expect(items.map((i) => [i.key, i.source, i.kind, i.summary, i.filedAt, i.decideAt])).toEqual([
      ["report:forum:17", "report", "forum_report_soft", "A report on the thread: Who left the gate open", "2026-11-20T10:00:00.000Z", "/admin?tab=forum-moderation"],
      ["report:forum:18", "report", "forum_report_hard", "A report on the thread: (deleted thread)", "2026-11-22T10:00:00.000Z", "/admin?tab=forum-moderation"],
    ]);
  });

  it("message reports: that a message was reported and when, and never one word of the message", () => {
    const items = fromMessageReports(MESSAGES);
    expect(items.map((i) => [i.key, i.source, i.summary, i.filedAt, i.decideAt])).toEqual([["report:message:4", "report", "A reported message", "2026-11-21T08:00:00.000Z", "/admin?tab=message-reports"]]);
  });

  it("place reports, departures and invitation requests: what waits and since when, each with its own door", () => {
    expect(fromPlaceReports(PLACES).map((i) => [i.key, i.source, i.summary, i.filedAt, i.decideAt])).toEqual([["photo:pr1", "photo", "A reported photograph of a place", "2026-11-19T09:00:00.000Z", "/places#reports"]]);
    // Every departure ever is answered; only the open one and the one being settled wait.
    expect(fromExits(EXITS).map((i) => [i.key, i.source, i.kind, i.summary, i.filedAt, i.decideAt])).toEqual([
      ["exit:e1", "exit", "exit_voluntary_open", "A departure waiting to be settled", "2026-11-18T00:00:00.000Z", "/admin?tab=exits-admin"],
      ["exit:e2", "exit", "exit_involuntary_settling", "A departure being settled", "2026-11-10T00:00:00.000Z", "/admin?tab=exits-admin"],
    ]);
    expect(fromInviteRequests(INVITES).map((i) => [i.key, i.source, i.summary, i.filedAt, i.decideAt])).toEqual([
      ["invite:v1", "invite", "A visitor asks to be invited", "2026-11-23T12:00:00.000Z", "/admin?tab=portal-visitors"],
      ["invite:v2", "invite", "A visitor asks to be invited", "2026-11-24T12:00:00.000Z", "/admin?tab=portal-visitors"],
    ]);
  });

  it("NO ROW NAMES A PERSON OR CARRIES WHAT WAS SAID: not the reporter, the member, the visitor, a reason, a note or a message", () => {
    const all = [...fromForumReports(FORUM), ...fromMessageReports(MESSAGES), ...fromPlaceReports(PLACES), ...fromExits(EXITS), ...fromInviteRequests(INVITES)];
    const sent = JSON.stringify(all);
    for (const secret of ["Rhea", "Ana", "Ben", "Cy Member", "Dana", "Eli", "Hana", "Ivo", "example.org", "private words", "Another private", "private terms", "It names a neighbour", "Unkind", "old barn", "love to join", "gardening", "u1", "u9"]) {
      expect(sent, secret).not.toContain(secret);
    }
    // Each is about a person or a person's words, so nothing groups or judges them: they sit where their day puts them.
    expect(all.every((i) => i.touchesPerson && i.batch === null && i.code === null)).toBe(true);
    expect(Object.keys(all[0]).sort()).toEqual(["batch", "code", "decideAt", "filedAt", "key", "kind", "source", "summary", "touchesPerson"]);
  });

  it("every reader answers a body of the wrong shape with nothing, never a crash", () => {
    for (const read of [fromForumReports, fromMessageReports, fromPlaceReports, fromExits, fromInviteRequests]) {
      for (const bad of [null, undefined, 5, "x", [], {}, { reports: "no" }, { exits: 3 }, { requests: {} }, [null, 7, "x", {}]]) expect(read(bad), `${read.name}`).toEqual([]);
    }
  });

  it("each queue is read from its own route, once, and has one place on the page", () => {
    const routes = Object.fromEntries(INBOX_READS.filter((r) => ["report", "photo", "exit", "invite"].some((s) => (r.sources as readonly string[]).includes(s))).map((r) => [r.path, r.sources]));
    expect(routes).toEqual({
      "/api/admin/forum/reports": ["report"],
      "/api/admin/messages/reports": ["report"],
      "/api/places/reports": ["photo"],
      "/api/admin/exits": ["exit"],
      "/api/admin/visitors/invitations": ["invite"],
    });
    for (const s of ["report", "photo", "exit", "invite"] as const) {
      expect(INBOX_SOURCES).toContain(s);
      expect(INBOX_ORDER.filter((o) => o === s)).toHaveLength(1);
    }
  });

  it("forum and message reports are ONE queue, oldest first; and each row is one decision in the one count", () => {
    const merged = mergeSections([{ source: "report", state: "ok", items: [...fromMessageReports(MESSAGES), ...fromForumReports(FORUM)] }]);
    expect(merged.map((i) => i.key)).toEqual(["report:forum:17", "report:message:4", "report:forum:18"]);
    const all = [...merged, ...fromPlaceReports(PLACES), ...fromExits(EXITS), ...fromInviteRequests(INVITES)];
    expect(decisionCounts(all, [])).toEqual({ decisions: 8, applications: 0, blocked: 0, unknown: [] });
  });
});
