// @vitest-environment jsdom
/**
 * /governance, the Now view (Governance brief step 3): signed out it asks nothing and offers the sign-in; a guest sees
 * how the village decides and the door to membership; a member sees what waits for their voice soonest first, what
 * closes within two days, Your voice with what they cannot do yet and the rung that opens it, and what they brought.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";

let token: string | null = "t";
vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/lib/gameApi", () => ({ authToken: () => token, useGameConfig: () => ({ stages: [{ id: "co-creator", name: "Co-creator" }] }) }));
let guestLine: { hidden: boolean; fields: { line: string } } = { hidden: false, fields: { line: "This village is held by the people who live and work here." } };
vi.mock("@/hooks/usePageContent", () => ({ usePageContent: () => ({ guests: guestLine }) }));

import GovernanceNow from "./GovernanceNow";

const soon = new Date(Date.now() + 5 * 3_600_000).toISOString();
const later = new Date(Date.now() + 6 * 86_400_000).toISOString();
const item = (kind: string, id: string, title: string, closesAt: string | null, state: string | null = null) => ({ id, kind, title, state, closesAt, href: `/x/${id}` });
const ANSWER = {
  waiting: [item("vote", "b1", "Quiet hours from nine at night", soon, "running"), item("change", "c1", "A shared tool library", later, "voting"), item("tension", "t1", "Water Steward", null)],
  closingSoon: [item("vote", "b1", "Quiet hours from nine at night", soon, "running")],
  yours: [item("change", "c2", "Longer seed library hours", null, "in_review")],
  voice: { mode: "equal", weighedBy: null, rights: [{ right: "ballot.vote", held: true, opensAt: null }, { right: "mechanics.propose", held: true, opensAt: null }, { right: "proposal.open", held: false, opensAt: "co-creator" }] },
  reads: [{ name: "ballots", state: "ok" }, { name: "changes", state: "ok" }, { name: "hands", state: "ok" }, { name: "waiting", state: "ok" }],
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
  guestLine = { hidden: false, fields: { line: "This village is held by the people who live and work here." } };
});

describe("/governance, the Now view", () => {
  it("signed out: asks nothing, offers the sign-in and how we decide", async () => {
    token = null;
    const f = answer(200, ANSWER);
    render(<GovernanceNow />);
    const box = await screen.findByTestId("governance-newcomer");
    expect(within(box).getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    expect(within(box).getByRole("link", { name: "How we work together" }).getAttribute("href")).toBe("/governance/how");
    expect(f).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Your work" })).toBeNull();
  });

  it("a guest reads the village's own line first", async () => {
    answer(403, { error: "members_only" });
    render(<GovernanceNow />);
    expect((await screen.findByTestId("governance-guest-line")).textContent).toBe("This village is held by the people who live and work here.");
  });

  it("a guest sees the door to membership, and nothing that is for members", async () => {
    answer(403, { error: "members_only" });
    render(<GovernanceNow />);
    const box = await screen.findByTestId("governance-newcomer");
    expect(within(box).getByRole("link", { name: "How to become a member" })).toBeTruthy();
    expect(screen.queryByTestId("governance-now")).toBeNull();
  });

  it("a member sees what waits for their voice soonest first, with what closes within two days marked", async () => {
    answer(200, ANSWER);
    render(<GovernanceNow />);
    await screen.findByTestId("governance-now");
    expect(screen.getByRole("heading", { name: "Waiting for your voice · 3" })).toBeTruthy();
    expect(screen.getByTestId("closing-soon").textContent).toBe("One closes within two days.");
    const rows = screen.getAllByRole("listitem").filter((li) => li.dataset.testid?.startsWith("now-"));
    expect(rows.map((r) => r.dataset.testid)).toEqual(["now-vote-b1", "now-change-c1", "now-tension-t1", "now-change-c2"]);
    expect(screen.getByTestId("now-vote-b1").textContent).toMatch(/Closes in [45] hours/);
    expect(within(screen.getByTestId("now-vote-b1")).getByRole("link").textContent).toBe("Vote");
    expect(within(screen.getByTestId("now-tension-t1")).getByRole("link").textContent).toBe("Answer it");
    expect(screen.getByRole("heading", { name: "What you brought" })).toBeTruthy();
  });

  it("Your voice says what a vote counts, what they can do, and the rung that opens what they cannot yet", async () => {
    answer(200, ANSWER);
    render(<GovernanceNow />);
    const voice = await screen.findByTestId("your-voice");
    expect(voice.textContent).toContain("Your vote counts 1 on every village vote.");
    const rights = within(voice).getByTestId("your-rights").textContent ?? "";
    expect(rights).toContain("Vote on village decisions");
    expect(rights).toContain("Open a village vote yourselfOpens at Co-creator.");
    expect(voice.textContent).toContain("never bought, sold or traded");
  });

  it("names the weighing token only when the village weighs by one", async () => {
    answer(200, { ...ANSWER, voice: { ...ANSWER.voice, mode: "token", weighedBy: "gratitude" } });
    render(<GovernanceNow />);
    expect((await screen.findByTestId("your-voice")).textContent).toContain("Your vote counts your gratitude balance when each vote opens.");
  });

  it("nothing waiting says so, and a read that failed is named so an empty list is never read as nothing", async () => {
    answer(200, { ...ANSWER, waiting: [], closingSoon: [], reads: [...ANSWER.reads.slice(0, 3), { name: "waiting", state: "failed" }] });
    render(<GovernanceNow />);
    expect(await screen.findByText("Nothing is waiting for your voice right now.")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("what waits on your role");
  });

  it("a whole read that failed, or a body of the wrong shape, says it did not load", async () => {
    answer(200, { waiting: "no" });
    render(<GovernanceNow />);
    expect((await screen.findByRole("alert")).textContent).toContain("This did not load");
  });

  it("offers the five views, Your work and Treasury only signed in", async () => {
    answer(200, ANSWER);
    render(<GovernanceNow />);
    await screen.findByTestId("governance-now");
    const views = screen.getByRole("navigation", { name: "Governance views" });
    expect(within(views).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/governance", "/governance/decisions", "/governance/work", "/governance/treasury", "/governance/how"]);
  });
});
