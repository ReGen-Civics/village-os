// @vitest-environment jsdom
/**
 * /admin/review and a long queue (QA, 28 Nov 2026: with 238 quest ideas the page stopped at 200 and Show more stayed
 * live doing nothing). Every row can be reached, in one press; and a queue past what one read will ever send says so
 * and gives a door to its own page, with no button that does nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ loading: false, user: { id: "u1" } }) }));
vi.mock("@/lib/gameApi", () => ({ authToken: () => "t" }));

import AdminReview from "./AdminReview";

const quest = (n: number) => ({ key: `quest:q${n}`, source: "quest", kind: "quest.proposed", code: null, summary: `Idea ${n}`, filedAt: null, batch: null, decideAt: "/review", touchesPerson: false });

/** The server's answer for a queue of `total` quest ideas, sending as many rows as were asked for, up to `cap`. */
function serve(total: number, cap: number) {
  const urls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    urls.push(url);
    if (!url.startsWith("/api/admin/review/inbox")) return new Response("{}", { status: 404 });
    const asked = Number(/quest%3A(\d+)/.exec(url)?.[1] ?? 10);
    const shown = Math.min(asked, cap, total);
    const capped = total > shown && shown >= cap;
    const body = {
      sections: [{ source: "quest", state: "ok", count: total, atLeast: total, blocked: 0, more: total > shown && !capped, ...(capped ? { capped: true } : {}) }],
      items: Array.from({ length: shown }, (_, n) => quest(n)),
      counts: { decisions: total, applications: 0, blocked: 0, unknown: [], waiting: total },
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }));
  return urls;
}

beforeEach(() => window.history.replaceState(null, "", "/admin/review"));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("a long queue on /admin/review", () => {
  it("offers every row in one press, and then offers nothing more", async () => {
    const urls = serve(238, 1000);
    render(<AdminReview />);
    await screen.findByTestId("row-quest:q0");
    expect(screen.getAllByTestId(/^row-quest:/)).toHaveLength(10);
    expect(screen.getByTestId("all-quest").textContent).toBe("Show all 238");
    fireEvent.click(screen.getByTestId("all-quest"));
    await waitFor(() => expect(screen.getAllByTestId(/^row-quest:/)).toHaveLength(238));
    expect(urls).toContain("/api/admin/review/inbox?rows=quest%3A238");
    // Nothing is left to ask for, so nothing is offered.
    expect(screen.queryByTestId("more-quest")).toBeNull();
    expect(screen.queryByTestId("all-quest")).toBeNull();
    expect(screen.queryByTestId("capped-quest")).toBeNull();
  });

  it("a queue with only a few more rows than shown offers Show more alone", async () => {
    serve(14, 1000);
    render(<AdminReview />);
    await screen.findByTestId("row-quest:q0");
    expect(screen.getByTestId("more-quest")).toBeTruthy();
    expect(screen.queryByTestId("all-quest")).toBeNull();
  });

  it("past what one read will send, it says the list stops and gives the door to the queue's own page, with no dead button", async () => {
    serve(40, 20);
    render(<AdminReview />);
    await screen.findByTestId("row-quest:q0");
    fireEvent.click(screen.getByTestId("more-quest"));
    await waitFor(() => expect(screen.getAllByTestId(/^row-quest:/)).toHaveLength(20));
    expect(screen.queryByTestId("more-quest")).toBeNull();
    expect(screen.queryByTestId("all-quest")).toBeNull();
    const capped = screen.getByTestId("capped-quest");
    expect(capped.textContent).toBe("Showing 20 of 40. This list stops here. The rest are on this queue's own page. Read the idea");
    expect(capped.querySelector("a")?.getAttribute("href")).toBe("/review");
  });
});
