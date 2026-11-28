// @vitest-environment jsdom
/**
 * THE TAG FILTER on /admin/review (Rye, 28 Nov 2026: "With different tags for the source for filtering").
 * Every row carries a tag saying where it came from, and a person can show only the tags they pick. Filtering changes
 * what is SHOWN and never what is COUNTED: the one count stays the server's, of everything.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ loading: false, user: { id: "u1" } }) }));
vi.mock("@/lib/gameApi", () => ({ authToken: () => "t" }));

import AdminReview from "./AdminReview";
import { searchWithTags, tagsOf } from "@/components/reviewInbox/useReviewInbox";

const row = (source: string, n: number, decideAt: string) => ({ key: `${source}:${n}`, source, kind: source, code: null, summary: `${source} ${n}`, filedAt: `2026-11-${String(10 + n).padStart(2, "0")}T10:00:00.000Z`, batch: null, decideAt, touchesPerson: true });
const ITEMS = [row("form", 1, "/admin?tab=submissions"), row("form", 2, "/admin?tab=submissions"), row("invite", 1, "/admin?tab=portal-visitors"), row("report", 1, "/admin?tab=forum-moderation"), row("exit", 1, "/admin?tab=exits-admin"), row("application", 1, "/role-applications/1")];

function serve() {
  const urls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    urls.push(url);
    if (!url.startsWith("/api/admin/review/inbox")) return new Response("{}", { status: 404 });
    const sources = Array.from(new Set(ITEMS.map((i) => i.source)));
    const body = {
      sections: sources.map((source) => ({ source, state: "ok", count: ITEMS.filter((i) => i.source === source).length, atLeast: ITEMS.filter((i) => i.source === source).length, blocked: 0, more: false })),
      items: ITEMS,
      // Five decisions; the application is listed and not counted.
      counts: { decisions: 5, applications: 1, blocked: 0, unknown: [], waiting: 6 },
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }));
  return urls;
}

const shown = () => screen.queryAllByTestId(/^row-/).map((el) => el.getAttribute("data-testid")!.slice(4));
const COUNT = "5 decisions waiting on you. 1 application is listed, and is not counted.";

beforeEach(() => window.history.replaceState(null, "", "/admin/review"));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the tag filter on /admin/review", () => {
  it("every row carries a tag saying where it came from, in plain words", async () => {
    serve();
    render(<AdminReview />);
    const form = await screen.findByTestId("row-form:1");
    expect(form.textContent).toContain("A form somebody sent");
    expect(screen.getByTestId("row-invite:1").textContent).toContain("A visitor asking to be invited");
    expect(screen.getByTestId("row-report:1").textContent).toContain("A report somebody made");
    expect(screen.getByTestId("row-exit:1").textContent).toContain("A departure");
    expect(screen.getByTestId("row-application:1").textContent).toContain("An application for a role");
  });

  it("pressing tags shows only those, keeps them in the address, and never moves the count", async () => {
    const urls = serve();
    render(<AdminReview />);
    await screen.findByTestId("row-form:1");
    expect(shown()).toHaveLength(6);
    expect(screen.getByTestId("inbox-status").textContent).toBe(COUNT);
    const tags = within(screen.getByTestId("kinds")).getAllByRole("button");
    expect(tags.map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "false", "false", "false", "false"]);

    fireEvent.click(screen.getByTestId("tag-form"));
    await waitFor(() => expect(shown()).toEqual(["form:1", "form:2"]));
    expect(window.location.search).toBe("?tags=form");
    expect(screen.getByTestId("tag-form").getAttribute("aria-pressed")).toBe("true");
    // What is counted is everything, whatever is shown, and the page says so.
    expect(screen.getByTestId("inbox-status").textContent).toBe(COUNT);
    expect(screen.getByTestId("only-kind").textContent).toBe("Showing only Forms to answer. The count above is of everything, whatever is shown. Show everything");

    fireEvent.click(screen.getByTestId("tag-invite"));
    await waitFor(() => expect(shown()).toEqual(["form:1", "form:2", "invite:1"]));
    expect(window.location.search).toBe("?tags=form,invite");
    expect(screen.getByTestId("only-kind").textContent).toContain("Showing only Forms to answer, Visitors asking to be invited.");

    // A tag pressed again comes off; Show everything takes them all off.
    fireEvent.click(screen.getByTestId("tag-form"));
    await waitFor(() => expect(shown()).toEqual(["invite:1"]));
    fireEvent.click(screen.getByTestId("tags-clear"));
    await waitFor(() => expect(shown()).toHaveLength(6));
    expect(window.location.search).toBe("");
    // Filtering is the page's own: it never asks the server again.
    expect(urls.filter((u) => u.startsWith("/api/admin/review/inbox"))).toHaveLength(1);
  });

  it("a link with tags lands filtered, the older ?kind= door is one tag, and a tag with nothing waiting says so", async () => {
    serve();
    window.history.replaceState(null, "", "/admin/review?tags=report,exit,nonsense");
    render(<AdminReview />);
    await screen.findByTestId("row-report:1");
    // In the page's own order of kinds, whatever order the address named them in.
    expect(shown()).toEqual(["report:1", "exit:1"]);
    cleanup();

    window.history.replaceState(null, "", "/admin/review?kind=invite");
    render(<AdminReview />);
    await screen.findByTestId("row-invite:1");
    expect(shown()).toEqual(["invite:1"]);
    cleanup();

    window.history.replaceState(null, "", "/admin/review?tags=vote");
    render(<AdminReview />);
    expect((await screen.findByTestId("tags-empty")).textContent).toBe("Nothing of that kind is waiting on you.");
    expect(shown()).toEqual([]);
    expect(screen.getByTestId("inbox-status").textContent).toBe(COUNT);
  });

  it("the address: only real sources, in the list's own order, and every other part kept", () => {
    expect(tagsOf("?tags=invite,form,nonsense")).toEqual(["form", "invite"]);
    expect(tagsOf("?kind=claim")).toEqual(["claim"]);
    expect(tagsOf("?view=held")).toEqual([]);
    expect(searchWithTags("?view=batches&kind=claim", ["invite", "form"])).toBe("?view=batches&tags=form,invite");
    expect(searchWithTags("?tags=form&find=B-71", [])).toBe("?find=B-71");
    expect(searchWithTags("", [])).toBe("");
  });
});
