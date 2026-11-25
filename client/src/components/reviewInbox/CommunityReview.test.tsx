// @vitest-environment jsdom
/**
 * The community face of /review (lane 6): signed out it lists nothing and asks nothing of the server, a visitor is told
 * it is for members, and a member sees what is open for their voice, what waits on their role and what they sent, each
 * a door. A read that failed says so and is never shown as nothing.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

let token: string | null = "t";
vi.mock("@/lib/gameApi", () => ({ authToken: () => token }));

import CommunityReview from "./CommunityReview";

const item = (kind: string, id: string, title: string, state: string | null, href: string, closesAt: string | null = null) => ({ id, kind, title, state, closesAt, href });
const ANSWER = {
  open: [item("vote", "b1", "Give the dial power back to the village", "running", "/decisions/b1", "2026-11-30T12:00:00.000Z"), item("change", "c1", "Shorter quiet hours", "voting", "/changes/c1")],
  waiting: [item("tension", "t1", "Builder", null, "/profile")],
  yours: [item("change", "c2", "My own request", "in_review", "/changes/c2")],
  reads: [
    { name: "ballots", state: "ok" },
    { name: "changes", state: "ok" },
    { name: "hands", state: "ok" },
    { name: "waiting", state: "ok" },
  ],
};

function answer(status: number, body: unknown = {}) {
  const f = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", f);
  return f;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  token = "t";
});

describe("the community face of /review", () => {
  it("signed out: lists nothing, offers the sign-in, and never asks the server", async () => {
    token = null;
    const f = answer(200, ANSWER);
    render(<CommunityReview />);
    expect(await screen.findByTestId("community-signed-out")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in to see it" }).getAttribute("href")).toBe("/login");
    expect(f).not.toHaveBeenCalled();
    expect(screen.queryByText("Shorter quiet hours")).toBeNull();
  });

  it("a visitor is told it is for members, and nothing is listed", async () => {
    answer(403, { error: "members_only" });
    render(<CommunityReview />);
    expect(await screen.findByTestId("community-not-member")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("a member sees each matter by kind, stage and close date, with the door to where they take part", async () => {
    answer(200, ANSWER);
    render(<CommunityReview />);
    await screen.findByTestId("community-review");
    expect(screen.getByRole("heading", { name: "Open for your voice" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Waiting on your role" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "What you sent" })).toBeTruthy();
    const vote = screen.getByTestId("community-vote-b1");
    expect(vote.textContent).toContain("A vote");
    expect(vote.textContent).toContain("Voting now");
    expect(vote.textContent).toContain("Closes");
    expect(vote.querySelector("a")?.getAttribute("href")).toBe("/decisions/b1");
    expect(screen.getByTestId("community-change-c1").querySelector("a")?.textContent).toBe("Take part");
    expect(screen.getByTestId("community-tension-t1").querySelector("a")?.textContent).toBe("Answer it");
    expect(screen.getByTestId("community-change-c2").textContent).toContain("Being read");
    expect(screen.queryByTestId("community-decider-door")).toBeNull();
  });

  it("a stage it does not know shows nothing, never the raw word", async () => {
    answer(200, { ...ANSWER, open: [item("change", "c9", "Odd", "mystery_stage", "/changes/c9")], waiting: [], yours: [] });
    render(<CommunityReview />);
    const row = await screen.findByTestId("community-change-c9");
    expect(row.textContent).not.toContain("mystery_stage");
  });

  it("nothing open and nothing sent each say so, and the waiting section is left out", async () => {
    answer(200, { ...ANSWER, open: [], waiting: [], yours: [] });
    render(<CommunityReview />);
    expect(await screen.findByText("Nothing is open for your voice right now.")).toBeTruthy();
    expect(screen.getByText(/You have not sent anything yet/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Waiting on your role" })).toBeNull();
  });

  it("a read that failed is named, so an empty list is never read as nothing open", async () => {
    answer(200, { ...ANSWER, open: [], reads: [...ANSWER.reads.slice(0, 3), { name: "waiting", state: "failed" }] });
    render(<CommunityReview />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("what waits on your role");
  });

  it("the whole read failing, or a body of the wrong shape, says it did not load and offers a retry", async () => {
    answer(500);
    render(<CommunityReview />);
    expect((await screen.findByRole("alert")).textContent).toContain("This did not load");
    cleanup();
    answer(200, { open: "no" });
    render(<CommunityReview />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy());
  });

  it("someone who also decides is shown the way back to what they decide", async () => {
    answer(200, ANSWER);
    render(<CommunityReview decides />);
    const door = await screen.findByTestId("community-decider-door");
    expect(door.querySelector("a")?.getAttribute("href")).toBe("/review");
  });
});
