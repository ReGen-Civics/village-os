// @vitest-environment jsdom
/**
 * CHANGE REQUESTS AS A KIND OF DECISION (the lead, 27 Nov 2026). The section of Decisions that was the /changes list.
 * Pinned: each row opens the change request under Decisions and names its step; the start form waits behind one
 * button and lands on the new change request; the route's own refusal is said; a failed read is never an empty list.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router } from "wouter";

vi.mock("@/lib/gameApi", () => ({ authToken: () => "a-token" }));
vi.mock("@/components/voice/VoiceArea", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

import ChangeRequestsSection from "./ChangeRequestsSection";

const MINE = { id: "cr1", title: "Shorter quiet hours", state: "gathering", changes: 2, author: "Ana", yours: true, updatedAt: "2026-11-20T10:00:00.000Z" };
const OPEN = { id: "cr2", title: "A longer vote", state: "in_review", changes: 1, author: "Bo", yours: false, updatedAt: "2026-11-21T10:00:00.000Z" };

function serve(list: [number, unknown], post?: [number, unknown]) {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url: String(url), method, body: init?.body ? JSON.parse(String(init.body)) : null });
      const [status, body] = method === "GET" ? list : (post ?? [200, { id: "cr9" }]);
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    }),
  );
  return calls;
}

const show = () =>
  render(
    <Router>
      <ChangeRequestsSection />
    </Router>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the Change requests section of Decisions", () => {
  it("opens each change request under Decisions, with the step it stands on", async () => {
    serve([200, { mine: [MINE], open: [OPEN] }]);
    show();
    const mine = await screen.findByTestId("cr-row-cr1");
    expect(mine.getAttribute("href")).toBe("/governance/decisions/changes/cr1");
    // The step is a word in a chip, never a counter (fold QA round 1).
    expect(mine.textContent).toContain("Gathering");
    expect(mine.textContent).not.toMatch(/of 4/);
    expect(screen.getByTestId("cr-row-cr2").textContent).toContain("In review");
    // The heading counts what the reader can open from here, theirs and everyone's in review, once each.
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Change requests(2)");
    expect(screen.getByTestId("cr-row-cr2").textContent).toContain("Started by Bo");
    expect(document.getElementById("changes")).toBeTruthy();
  });

  it("keeps the start form behind one button, and lands on the new change request", async () => {
    const calls = serve([200, { mine: [], open: [] }]);
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    show();
    expect(await screen.findByText(/You have none yet/)).toBeTruthy();
    expect(screen.queryByLabelText("Name")).toBeNull();
    const toggle = screen.getByRole("button", { name: "Start a change request" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Quiet hours" } });
    fireEvent.change(screen.getByLabelText("Why"), { target: { value: "Sleep" } });
    fireEvent.click(screen.getByRole("button", { name: "Start it" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/governance/decisions/changes/cr9"));
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ title: "Quiet hours", why: "Sleep" });
  });

  it("says the route's own refusal when a member may not start one", async () => {
    serve([200, { mine: [], open: [] }], [403, { message: "Proposing a change opens at Co-creator." }]);
    show();
    await screen.findByText(/You have none yet/);
    fireEvent.click(screen.getByRole("button", { name: "Start a change request" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Quiet hours" } });
    fireEvent.change(screen.getByLabelText("Why"), { target: { value: "Sleep" } });
    fireEvent.click(screen.getByRole("button", { name: "Start it" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Proposing a change opens at Co-creator.");
  });

  it("says a failed read failed, and never shows it as nothing waiting", async () => {
    serve([500, {}]);
    show();
    expect(await screen.findByText(/did not load/)).toBeTruthy();
    expect(screen.queryByText("Nothing is being weighed right now.")).toBeNull();
  });
});
