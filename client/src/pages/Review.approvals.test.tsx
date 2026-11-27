// @vitest-environment jsdom
/**
 * /approvals IS A VIEW OF YOUR WORK (the lead, 27 Nov 2026). Pinned here:
 *
 *   1. A holder of a key that opens the inbox sees the Approvals section at #approvals, its cards and its count, and
 *      the summary line counts what waits there.
 *   2. A member who holds none of those keys makes no request to the inbox at all (no 401 in the console), and the
 *      page refuses as a whole only when every read did, the approvals among them.
 *   3. A key held for the approvals alone opens the page: the queue and the claims refusing is not a refusal of it.
 *   4. The connector's role changes and seatings are listed once, by the inbox; the card that listed them a second
 *      time is gone, so nothing reads /api/agent-proposals/waiting from this page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { Router } from "wouter";
import type { ReactNode } from "react";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/gameApi", () => ({ authToken: () => "a-token", useGameConfig: () => ({ currency: { names: {} } }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const keys = vi.hoisted(() => ({ held: new Set<string>() }));
vi.mock("@/lib/myCapabilities", () => ({ mayAsk: async (...caps: string[]) => caps.some((c) => keys.held.has(c)) }));

import Review from "./Review";

const EMPTY = { batches: [], quests: [], drops: [], counts: { proposals: 0, quests: 0 } };
const CARD = {
  id: "prop_a",
  kind: "seating",
  title: "Seat Ana in Kitchen from 2026-12-01",
  by: "Sera",
  at: "2026-11-25T10:00:00.000Z",
  expiresAt: "2026-12-02T10:00:00.000Z",
  words: { what: "Who holds Kitchen", before: "No change", after: "Ana holds it from 2026-12-01" },
  canRevert: false,
  decision: null,
  state: "waiting",
};

type Answer = [number, unknown];
function serve(routes: { queue: Answer; claims: Answer; inbox: Answer }) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = String(url);
      calls.push(path);
      const [status, body] = path.startsWith("/api/approval-inbox")
        ? routes.inbox
        : path.startsWith("/api/admin/quest-claims/owed")
          ? [200, []]
          : path.startsWith("/api/admin/quest-claims")
            ? routes.claims
            : routes.queue;
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    }),
  );
  return calls;
}

const show = () =>
  render(
    <Router>
      <Review />
    </Router>,
  );

describe("the Approvals section of Your work", () => {
  beforeEach(() => {
    keys.held = new Set();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a holder the inbox at #approvals, with its count, and the summary line counts it", async () => {
    keys.held = new Set(["org.seat", "intake.moderate"]);
    serve({ queue: [200, EMPTY], claims: [403, { error: "no" }], inbox: [200, { waiting: [CARD], decided: [] }] });
    show();
    expect(await screen.findByText("Seat Ana in Kitchen from 2026-12-01")).toBeTruthy();
    const section = document.getElementById("approvals")!;
    expect(section).toBeTruthy();
    expect(section.hidden).toBe(false);
    expect(within(section).getByRole("heading", { level: 2, name: "Approvals" })).toBeTruthy();
    expect(within(section).getByTestId("approvals-count").textContent).toBe("1 waiting");
    const line = await screen.findByText(/^Waiting for you:/);
    expect(within(line).getByRole("link", { name: "1 approval" }).getAttribute("href")).toBe("#approvals");
    // Something waits, so the page never says nothing does.
    expect(screen.queryByText("Nothing waiting")).toBeNull();
  });

  it("asks the inbox nothing for a member who holds no key that opens it, and refuses only when every read did", async () => {
    const calls = serve({ queue: [403, { error: "no" }], claims: [403, { error: "no" }], inbox: [200, { waiting: [CARD], decided: [] }] });
    show();
    expect(await screen.findByText("This queue is not open to you yet")).toBeTruthy();
    expect(calls.some((c) => c.startsWith("/api/approval-inbox"))).toBe(false);
  });

  it("opens the page for a person who holds an approvals key alone", async () => {
    keys.held = new Set(["story.tell"]);
    serve({ queue: [403, { error: "no" }], claims: [403, { error: "no" }], inbox: [200, { waiting: [CARD], decided: [] }] });
    show();
    expect(await screen.findByText("Seat Ana in Kitchen from 2026-12-01")).toBeTruthy();
    expect(screen.queryByText("This queue is not open to you yet")).toBeNull();
  });

  it("refuses the page when the inbox refuses too, and hides its section meanwhile", async () => {
    keys.held = new Set(["story.tell"]);
    serve({ queue: [403, { error: "no" }], claims: [403, { error: "no" }], inbox: [401, { error: "auth_required" }] });
    show();
    expect(await screen.findByText("This queue is not open to you yet")).toBeTruthy();
    expect(screen.queryByTestId("inbox-refused")).toBeNull();
  });

  it("lists the connector's seatings once, through the inbox, and never reads the card that listed them twice", async () => {
    keys.held = new Set(["org.seat"]);
    const calls = serve({ queue: [200, EMPTY], claims: [403, { error: "no" }], inbox: [200, { waiting: [CARD], decided: [] }] });
    show();
    expect(await screen.findAllByText("Seat Ana in Kitchen from 2026-12-01")).toHaveLength(1);
    await waitFor(() => expect(calls.some((c) => c.startsWith("/api/approval-inbox"))).toBe(true));
    expect(calls.some((c) => c.startsWith("/api/agent-proposals/waiting"))).toBe(false);
    expect(screen.queryByText("Open the approval inbox")).toBeNull();
  });
});
