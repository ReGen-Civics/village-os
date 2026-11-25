// @vitest-environment jsdom
/**
 * Follow-ups, one list (Direction D): the three reads drawn as one grouped list, a filter by source, a tick
 * that closes a row in one call, a failed read said aloud, and nothing at all when nothing waits.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const gameFetch = vi.fn();
vi.mock("@/lib/gameApi", () => ({ gameFetch: (...a: unknown[]) => gameFetch(...a) }));
const announce = vi.fn();
vi.mock("@/lib/profileRefresh", () => ({ announceProfileChange: () => announce(), onProfileRefresh: () => () => {} }));
vi.mock("@/components/profile/TasksWaitingCard", () => ({ readerToday: () => "2026-11-25" }));

import FollowUps from "./FollowUps";

const reply = (status: number, body: unknown) => Promise.resolve({ ok: status < 300, status, json: async () => body });
const BOARD = {
  holding: [{ entryId: 7, sessionTitle: "Anchor circle", text: "Send the minutes", status: "open", dueOn: "2026-11-25", canAnswer: true, inSessionNow: false, seat: null }],
  seatsHold: [],
  circleBack: [],
  finished: [],
  earlierCount: 0,
  today: "2026-11-25",
};
const ASKS = {
  waitingOnYou: [{ id: "a1", link: "/docs/x", why: "Read the draft", dueOn: null, blocking: false, status: "open", otherName: "Juno", tier: "whenever" }],
  yourAsks: [{ id: "y1", link: "/docs/y", why: "Check the budget", dueOn: null, blocking: false, status: "open", otherName: "Kai", tier: "whenever" }],
};
const RAISED = { asks: [{ id: "r1", role: "Treasurer", circle: null, text: "Clarify the float", status: "open", raisedOn: "2026-11-01", place: null }] };

let routes: Record<string, () => Promise<unknown>>;
beforeEach(() => {
  gameFetch.mockReset();
  announce.mockReset();
  routes = {
    "/api/sessions/tasks/mine": () => reply(200, BOARD),
    "/api/asks": () => reply(200, ASKS),
    "/api/role-tensions/raised": () => reply(200, RAISED),
  };
  gameFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === "POST") return reply(200, {});
    const hit = Object.entries(routes).find(([k]) => url.startsWith(k));
    return hit ? hit[1]() : reply(404, {});
  });
});
afterEach(() => cleanup());

const groupKeys = (g: string) => Array.from(document.querySelectorAll(`[data-follow-group="${g}"] [data-follow-row]`)).map((li) => li.textContent ?? "");

describe("FollowUps", () => {
  it("draws every source as one list in three groups, and counts only what is yours to do", async () => {
    render(<FollowUps sessionsOn />);
    expect(await screen.findByRole("heading", { name: "2 things are yours to do" })).toBeTruthy();
    expect(groupKeys("today").join()).toContain("Send the minutes");
    expect(groupKeys("later").join()).toContain("Read the draft");
    expect(groupKeys("later").join()).toContain("From Juno");
    expect(groupKeys("others").join()).toContain("Waiting on Kai");
    expect(groupKeys("others").join()).toContain("With Treasurer");
  });

  it("narrows to one source with the filter", async () => {
    render(<FollowUps sessionsOn />);
    fireEvent.click(await screen.findByRole("button", { name: "Asked of you" }));
    expect(document.querySelectorAll("[data-follow-row]").length).toBe(1);
    expect(screen.getByRole("button", { name: "Asked of you" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("ticks a task done in one call and tells the profile", async () => {
    render(<FollowUps sessionsOn />);
    fireEvent.click(await screen.findByRole("button", { name: "Mark done: Send the minutes" }));
    await waitFor(() => expect(gameFetch).toHaveBeenCalledWith("/api/sessions/tasks/7/done", expect.objectContaining({ method: "POST" })));
    await waitFor(() => expect(announce).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Mark done: Send the minutes" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("ticks an ask of you through the ask's own done", async () => {
    render(<FollowUps sessionsOn />);
    fireEvent.click(await screen.findByRole("button", { name: "Mark done: Read the draft" }));
    await waitFor(() => expect(gameFetch).toHaveBeenCalledWith("/api/asks/a1/done", expect.objectContaining({ method: "POST" })));
  });

  it("does not ask the board when Live Sessions is off", async () => {
    render(<FollowUps sessionsOn={false} />);
    await screen.findByRole("heading", { name: "One thing is yours to do" });
    expect(gameFetch.mock.calls.some(([u]) => String(u).startsWith("/api/sessions/tasks"))).toBe(false);
  });

  it("says a failed read failed, with a retry, and keeps the rows it has", async () => {
    routes["/api/asks"] = () => reply(500, {});
    render(<FollowUps sessionsOn />);
    expect((await screen.findByRole("alert")).textContent).toContain("Some of your follow-ups did not load");
    expect(groupKeys("today").join()).toContain("Send the minutes");
    routes["/api/asks"] = () => reply(200, ASKS);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(groupKeys("later").join()).toContain("Read the draft");
  });

  it("is absent when nothing waits and nothing failed, and when a read is closed", async () => {
    routes = { "/api/asks": () => reply(200, { waitingOnYou: [], yourAsks: [] }) };
    const { container } = render(<FollowUps sessionsOn />);
    await waitFor(() => expect(gameFetch).toHaveBeenCalledTimes(3));
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe("");
  });
});
