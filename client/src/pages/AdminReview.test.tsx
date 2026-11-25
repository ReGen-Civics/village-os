// @vitest-environment jsdom
/**
 * /admin/review, lane 4b (docs/REVIEW_INBOX_PLAN.md): deciding on the page, a conflict card with options, a stale card
 * seen first, Held with its reasons and ages, Decided, and finding a decided code. Each server answer is stubbed; the
 * rules the server holds are tested in server/routes/proposedChanges.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ loading: false, user: { id: "u1" } }) }));
vi.mock("@/lib/gameApi", () => ({ authToken: () => "t" }));

import AdminReview from "./AdminReview";

const base = { draft: null, status: "proposed", error: null, by: "Sera Companion", byKind: "agent", labels: { "words.aim": "Aim" }, target: { roleId: "fin" } };
const role = (id: string, aim: string, at: string, extra: Record<string, unknown> = {}) => ({
  ...base,
  id,
  code: `B-${id.slice(-1)}.1`,
  batchId: `pcb_${id}`,
  batchCode: `B-${id.slice(-1)}`,
  position: 0,
  kind: "role_card",
  targetLabel: "Lead Finance Steward card",
  route: { method: "POST", path: "/api/org/role-edit/fin" },
  summary: `Aim: ${aim}`,
  body: { words: { aim } },
  live: { words: { aim: "Keep the books." } },
  where: { label: "Roles page", href: "/roles?seat=fin" },
  at,
  ...extra,
});
const OPT_1 = role("pc_1", "Hold the money.", "2026-11-12T10:00:00.000Z");
const OPT_2 = { ...role("pc_2", "Tend the money.", "2026-11-13T10:00:00.000Z"), by: "Fern", byKind: "person" };
const PAGE = {
  ...base,
  id: "pc_3",
  code: "B-3.1",
  batchId: "pcb_3",
  batchCode: "B-3",
  kind: "page_content",
  target: { section: "page-home" },
  targetLabel: "Home page",
  route: { method: "PUT", path: "/api/admin/content/page-home" },
  summary: "Reword the headline.",
  body: { hero: { headline: "A home for families" } },
  live: { hero: { headline: "Welcome home" } },
  labels: { "hero.headline": "Top: Headline" },
  where: { label: "Home page", href: "/" },
  at: "2026-11-14T10:00:00.000Z",
};
const DECIDED = {
  id: "pc_old", code: "B-5.1", batchId: "pcb_5", batchCode: "B-5", batchTitle: "Last week's words", kind: "page_content", target: { section: "page-steward" }, targetLabel: "Steward page",
  route: { method: "PUT", path: "/api/admin/content/page-steward" }, summary: "Warm up the steward intro.", body: { intro: { lede: "Join us." } }, accepted: { intro: { lede: "Join us." } },
  labels: {}, where: { label: "Steward page", href: "/steward" }, status: "accepted", error: null, proposedBy: "Sera Companion", proposedByKind: "agent", by: "Fern", at: "2026-11-02T10:00:00.000Z", edited: 0,
};
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000 - 3_600_000).toISOString();
const HELD = [
  { id: "sg_1", kind: "page_content", where: { label: "Home page", href: "/" }, code: "reconsider_waits", fields: { discarded: "B-9.1" }, receivedAt: daysAgo(3), filerKind: "agent", reconsider: { code: "B-9.1" }, released: false },
  { id: "sg_2", kind: "role_card", where: { label: "Roles page", href: "/roles" }, code: "already_live", fields: {}, receivedAt: daysAgo(0), filerKind: "member", reconsider: null, released: false },
];

const item = (c: { id: string; code: string; summary: string; at: string; batchId: string; batchCode: string }) => ({
  key: `connector:${c.id}`, source: "connector", kind: "role_card", code: c.code, summary: c.summary, filedAt: c.at, batch: { key: `batch:${c.batchId}`, code: c.batchCode, title: null }, decideAt: "/admin/proposals", touchesPerson: false,
});

type Call = { url: string; method: string; body: any };

function stub(opts: { changes?: unknown[]; connector?: "ok" | "refused"; find?: { status: number; body: unknown } } = {}) {
  const changes = (opts.changes ?? [OPT_1, OPT_2, PAGE]) as any[];
  const calls: Call[] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url === "/api/admin/review/inbox") {
        const ok = opts.connector !== "refused";
        return json(200, { sections: [{ source: "connector", state: ok ? "ok" : "refused", count: ok ? changes.length : 0 }, { source: "claim", state: "ok", count: 0 }], items: ok ? changes.map(item) : [] });
      }
      if (url.startsWith("/api/admin/review/find")) return opts.find ? json(opts.find.status, opts.find.body) : json(404, { error: "not_found", code: null });
      if (url === "/api/admin/proposals" && method === "GET") return json(200, { timezone: "UTC", batches: [], changes, decided: [DECIDED] });
      if (url === "/api/admin/proposals/held") return json(200, { held: HELD });
      if (url === "/api/admin/proposals/check") return json(200, { results: [{ id: JSON.parse(String(init!.body)).items[0].id, ok: true }] });
      if (url === "/api/admin/proposals/accept") return json(200, { results: [{ id: JSON.parse(String(init!.body)).items[0].id, ok: true, otherChosen: ["pc_1"] }] });
      if (url.startsWith("/api/admin/proposals/held/")) return json(200, { success: true });
      return json(404, {});
    }),
  );
  return calls;
}

beforeEach(() => window.history.replaceState(null, "", "/admin/review"));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("deciding on /admin/review", () => {
  it("gathers two changes to one aim into one card: nothing chosen, one accept, the other named as set aside", async () => {
    const calls = stub();
    render(<AdminReview />);
    const card = await screen.findByTestId("conflict-card-pc_1");
    expect(within(card).getByRole("heading").textContent).toBe("2 suggestions for one thing");
    expect(within(card).getAllByRole("radio").map((r) => (r as HTMLInputElement).checked)).toEqual([false, false]);
    expect((within(card).getByTestId("conflict-accept-pc_1") as HTMLButtonElement).disabled).toBe(true);
    // The change that collides with nothing is its own card, decided on its own.
    expect(screen.getByTestId("proposal-pc_3")).toBeTruthy();
    expect(screen.queryByTestId("proposal-pc_1")).toBeNull();

    fireEvent.click(within(card).getAllByRole("radio")[1]!);
    fireEvent.click(within(card).getByTestId("conflict-accept-pc_1"));
    expect(within(card).getByTestId("conflict-ask-pc_1").textContent).toContain("Accept option 2. The other option is recorded as another option chosen.");
    expect(calls.some((c) => c.url.endsWith("/accept"))).toBe(false);
    fireEvent.click(within(card).getByTestId("conflict-yes-pc_1"));
    await screen.findByTestId("decide-notice");
    expect(calls.find((c) => c.url.endsWith("/accept"))!.body.items).toEqual([{ id: "pc_2", body: OPT_2.body, over: ["pc_1"] }]);
    expect(screen.getByTestId("decide-notice").textContent).toBe("Accepted: Aim: Tend the money. The other options are recorded as another option chosen.");
  });

  it("Discard all options asks once and sends every option", async () => {
    const calls = stub();
    render(<AdminReview />);
    const card = await screen.findByTestId("conflict-card-pc_1");
    fireEvent.click(within(card).getByTestId("conflict-discard-pc_1"));
    expect(within(card).getByTestId("conflict-ask-pc_1").textContent).toContain("Discard all 2 options? Nothing goes live.");
    fireEvent.click(within(card).getByTestId("conflict-yes-pc_1"));
    await waitFor(() => expect(calls.find((c) => c.url.endsWith("/discard"))?.body).toEqual({ ids: ["pc_1", "pc_2"] }));
  });

  it("a stale change shows See what is live now in place of Accept, and its accept carries what was seen", async () => {
    const stale = { ...PAGE, stale: [{ id: "pc_done", summary: "Warmer headline", acceptedAt: "2026-11-15T10:00:00.000Z" }] };
    const calls = stub({ changes: [stale] });
    render(<AdminReview />);
    const card = await screen.findByTestId("proposal-pc_3");
    expect(within(card).queryByTestId("accept-pc_3")).toBeNull();
    fireEvent.click(within(card).getByTestId("see-live-pc_3"));
    fireEvent.click(await within(card).findByTestId("accept-pc_3"));
    await screen.findByTestId("decide-notice");
    expect(calls.find((c) => c.url.endsWith("/accept"))!.body.items[0]).toMatchObject({ id: "pc_3", seen: "pc_done" });
  });

  it("the header counts what waits and what is held, and Held lists each reason with its age and a person's two acts", async () => {
    const calls = stub();
    window.history.replaceState(null, "", "/admin/review?view=held");
    render(<AdminReview />);
    const first = await screen.findByTestId("held-sg_1");
    expect(screen.getByRole("status").textContent).toBe("3 waiting on you. 2 held.");
    expect(screen.getByTestId("tab-held").textContent).toBe("Held 2");
    expect(first.textContent).toContain("Sent again after B-9.1 was discarded, with a reason. Let it through to be read, or clear it.");
    expect(first.textContent).toContain("From an agent · Waiting 3 days");
    const second = screen.getByTestId("held-sg_2");
    expect(second.textContent).toContain("What it asks for is already live.");
    expect(second.textContent).toContain("From a member · Arrived today");
    // Only a reconsider may be let through the window.
    expect(within(second).queryByTestId("held-release-sg_2")).toBeNull();
    fireEvent.click(within(first).getByTestId("held-release-sg_1"));
    fireEvent.click(within(second).getByTestId("held-clear-sg_2"));
    await waitFor(() => expect(calls.filter((c) => c.method === "POST").map((c) => c.url)).toEqual(["/api/admin/proposals/held/sg_1/release", "/api/admin/proposals/held/sg_2/clear"]));
    // Waiting's cards are not drawn on Held.
    expect(screen.queryByTestId("conflict-card-pc_1")).toBeNull();
  });

  it("finds a decided code and says which view holds it", async () => {
    stub({ find: { status: 404, body: { error: "not_found", code: "B-5" } } });
    render(<AdminReview />);
    await screen.findByTestId("conflict-card-pc_1");
    fireEvent.change(screen.getByLabelText("Find by code"), { target: { value: "b5" } });
    fireEvent.submit(screen.getByRole("search"));
    const said = await screen.findByTestId("found-decided");
    expect(said.textContent).toBe("B-5 was decided on Nov 2. It is under Decided. Open Decided");
    expect(within(said).getByRole("link").getAttribute("href")).toBe("/admin/review?view=decided");
  });

  it("Decided lists the history newest first, with putting it back", async () => {
    stub();
    window.history.replaceState(null, "", "/admin/review?view=decided");
    render(<AdminReview />);
    expect((await screen.findByRole("heading", { name: "Decided, newest first" })).textContent).toBe("Decided, newest first");
    expect(screen.getByText("Warm up the steward intro.")).toBeTruthy();
  });

  it("a person who may not read the connector gets no Held or Decided, and the connector's own read is never asked", async () => {
    const calls = stub({ connector: "refused" });
    render(<AdminReview />);
    await waitFor(() => expect(calls.some((c) => c.url === "/api/admin/review/inbox")).toBe(true));
    await screen.findByText("Nothing is waiting on you.");
    expect(screen.queryByTestId("tab-held")).toBeNull();
    expect(screen.queryByTestId("tab-decided")).toBeNull();
    expect(calls.some((c) => c.url.startsWith("/api/admin/proposals"))).toBe(false);
  });
});
