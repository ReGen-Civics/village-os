/**
 * Follow-ups as one list, the pure part: which group a row lands in, what may be ticked, and the order.
 */
import { describe, expect, it } from "vitest";
import type { TaskBoardPayload, TaskCard } from "@shared/sessionTasks";
import type { AskView } from "@shared/memberAsks";
import type { RaisedAsk } from "@shared/priorities";
import { followUpRows, inGroup } from "./followUpRows";

const TODAY = "2026-11-25";
const task = (over: Partial<TaskCard>): TaskCard =>
  ({ entryId: 1, sessionId: 9, sessionTitle: "Anchor circle", circleId: null, circleName: null, saidOn: "2026-11-20", text: "Send the minutes", status: "open", heldAs: "you", holderName: null, seat: null, dueOn: null, latest: null, inSessionNow: false, canAnswer: true, canReopen: false, canTake: false, recordLink: false, version: 1, ...over }) as TaskCard;
const board = (over: Partial<TaskBoardPayload>): TaskBoardPayload => ({ holding: [], seatsHold: [], circleBack: [], finished: [], earlierCount: 0, today: TODAY, ...over });
const ask = (over: Partial<AskView>): AskView => ({ id: "a1", link: "/docs/x", why: "Read the draft", dueOn: null, blocking: false, status: "open", otherName: "Juno", askedOn: "2026-11-20", handBackNote: null, tier: "whenever", ...over });
const raised: RaisedAsk = { id: "r1", role: "Treasurer", circle: null, text: "Clarify the float", status: "taken", raisedOn: "2026-11-01", place: { position: 2, expectWeek: "2026-12-01" } as never };

describe("followUpRows", () => {
  it("puts what is due, overdue or blocking under Today, the rest of yours under Coming up, and what you wait on under Waiting on others", () => {
    const rows = followUpRows({
      board: board({
        holding: [task({ entryId: 1, dueOn: TODAY }), task({ entryId: 2, dueOn: "2026-11-20", text: "Late one" }), task({ entryId: 3, dueOn: "2026-12-10" }), task({ entryId: 4, status: "done" })],
        seatsHold: [task({ entryId: 5, seat: { id: "s", name: "Steward", holders: [] } })],
      }),
      asks: { waitingOnYou: [ask({ id: "b", blocking: true }), ask({ id: "w" })], yourAsks: [ask({ id: "y" }), ask({ id: "closed", status: "done" })] },
      raised: [raised],
      today: "2000-01-01",
    });
    expect(inGroup(rows, "today").map((r) => r.key)).toEqual(["asked-b", "task-2", "task-1"]);
    expect(inGroup(rows, "later").map((r) => r.key)).toEqual(["task-3", "task-5", "asked-w"]);
    expect(inGroup(rows, "others").map((r) => r.key)).toEqual(["role-r1", "yours-y"]);
    expect(rows.find((r) => r.key === "task-5")?.with).toBe("Steward");
    expect(rows.some((r) => r.key === "task-4" || r.key === "yours-closed")).toBe(false);
  });

  it("ticks only what one call can close, and never a card still in an open session", () => {
    const rows = followUpRows({
      board: board({ holding: [task({ entryId: 1 }), task({ entryId: 2, inSessionNow: true }), task({ entryId: 3, canAnswer: false })] }),
      asks: { waitingOnYou: [ask({ id: "ask1" })], yourAsks: [ask({ id: "y" })] },
      raised: [raised],
      today: TODAY,
    });
    const tick = Object.fromEntries(rows.map((r) => [r.key, r.tick]));
    expect(tick["task-1"]).toEqual({ kind: "task", id: 1 });
    expect(tick["task-2"]).toBeNull();
    expect(tick["task-3"]).toBeNull();
    expect(tick["asked-ask1"]).toEqual({ kind: "ask", id: "ask1" });
    expect(tick["yours-y"]).toBeNull();
    expect(tick["role-r1"]).toBeNull();
  });

  it("links each row to where it lives in full", () => {
    const rows = followUpRows({ board: board({ holding: [task({ entryId: 7 })] }), asks: { waitingOnYou: [ask({ id: "ask1", link: "https://example.org/doc" })], yourAsks: [ask({ id: "y" })] }, raised: [raised], today: TODAY });
    const href = Object.fromEntries(rows.map((r) => [r.key, r.href]));
    expect(href).toEqual({ "task-7": "#task-7", "asked-ask1": "https://example.org/doc", "yours-y": "#waiting", "role-r1": "#roles" });
  });

  it("builds nothing from reads that are closed", () => {
    expect(followUpRows({ board: null, asks: null, raised: null, today: TODAY })).toEqual([]);
  });
});
