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
// The old proposals page's desk is a chunk of its own with its own reads (client/src/pages/ProposedChanges.test.tsx holds it); here a stand-in.
vi.mock("@/pages/ProposedChanges", () => ({ ProposalsDesk: ({ embedded, onDecided }: { embedded?: boolean; onDecided?: () => void }) => <button type="button" data-testid="stub-desk" data-embedded={embedded ? "yes" : "no"} onClick={onDecided}>the desk</button> }));
// The list Sera's row opens is its own chunk with its own reads (client/src/components/review); here it is a stand-in.
vi.mock("@/components/reviewInbox/SeraSheet", () => ({ default: ({ onChanged }: { onChanged: () => void }) => <button type="button" data-testid="stub-sheet" onClick={onChanged}>the list</button> }));

import AdminReview from "./AdminReview";
import { decisionCounts, type InboxItem } from "@shared/reviewInbox";

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

/** The server's answer for these rows: each kind's state and number, as server/routes/reviewInbox.ts sends them. */
function inboxAnswer(items: { source: string; blocked?: unknown }[], over: Record<string, Record<string, unknown>> = {}) {
  const sources = Array.from(new Set([...items.map((i) => i.source), ...Object.keys(over)]));
  const sections = sources.map((source) => {
    const n = items.filter((i) => i.source === source).length;
    return { source, state: "ok", count: n, atLeast: n, blocked: items.filter((i) => i.source === source && i.blocked).length, more: false, ...(over[source] ?? {}) };
  });
  const waiting = sections.reduce((sum, s) => sum + Number((s.count as number | null) ?? s.atLeast), 0);
  // The one count, by the server's own definition, over the rows this answer lists (a kind that says it holds more
  // than it lists adds those to the decisions, as the server's count of every row would).
  const counts = decisionCounts(items as unknown as InboxItem[], sections as never);
  return { sections, items, counts: { ...counts, decisions: counts.decisions + (waiting - items.length), waiting } };
}

function stub(opts: { changes?: unknown[]; connector?: "ok" | "refused"; find?: { status: number; body: unknown }; extra?: unknown[]; decide?: Record<string, unknown>; preview?: number; inbox?: (url: string) => unknown } = {}) {
  const changes = (opts.changes ?? [OPT_1, OPT_2, PAGE]) as any[];
  const calls: Call[] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url === "/api/admin/review/inbox" || url.startsWith("/api/admin/review/inbox?")) {
        if (opts.inbox) return json(200, opts.inbox(url));
        const ok = opts.connector !== "refused";
        const items = [...(ok ? changes.map(item) : []), ...(opts.extra ?? [])] as { source: string }[];
        // Refused by the connector, and still a reader of another queue (finished work), so the page is theirs.
        return json(200, inboxAnswer(items, ok ? {} : { connector: { state: "refused" }, claim: {} }));
      }
      if (url.startsWith("/api/admin/review/find")) return opts.find ? json(opts.find.status, opts.find.body) : json(404, { error: "not_found", code: null });
      if (url === "/api/admin/proposals" && method === "GET") return json(200, { timezone: "UTC", batches: [], changes, decided: [DECIDED] });
      if (url === "/api/admin/proposals/held") return json(200, { held: HELD });
      if (url === "/api/admin/proposals/check") return json(200, { results: [{ id: JSON.parse(String(init!.body)).items[0].id, ok: true }] });
      if (url === "/api/admin/proposals/accept") return json(200, { results: [{ id: JSON.parse(String(init!.body)).items[0].id, ok: true, otherChosen: ["pc_1"] }] });
      if (url.startsWith("/api/admin/proposals/held/")) return json(200, { success: true });
      if (/^\/api\/org\/drafts\/[^/]+\/decide$/.test(url)) return json(200, { status: "open", changes: 2, blocked: 0, blockedLines: [], youMayPublish: false, adminMayPublish: false, youMayPutToVillage: false, ballot: null, ...(opts.decide ?? {}) });
      if (/^\/api\/admin\/org\/drafts\/[^/]+\/preview$/.test(url))
        return opts.preview === 401 ? json(401, { error: "auth_required" }) : json(200, { lines: [{ changeId: "c1", reads: "Make the role Seed Keeper in the Garden circle", blocked: null }, { changeId: "c2", reads: "Give Seed Keeper one seat", blocked: null }], blocked: 0 });
      if (url.includes("/publish") || url.endsWith("/put-to-village") || url.endsWith("/withdraw")) return json(200, { success: true });
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
    expect(screen.getByRole("status").textContent).toBe("3 decisions waiting on you. 2 held.");
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

  it("a link with ?find= lands with the search made, the door the old proposals page sends people through", async () => {
    stub({ find: { status: 404, body: { error: "not_found", code: "B-5" } } });
    window.history.replaceState(null, "", "/admin/review?find=b5");
    render(<AdminReview />);
    expect((await screen.findByTestId("found-decided")).textContent).toContain("B-5 was decided");
    expect((screen.getByLabelText("Find by code") as HTMLInputElement).value).toBe("b5");
    window.history.replaceState(null, "", "/admin/review");
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

describe("every row says what it is and what deciding it does (lane 4c)", () => {
  const draft = { key: "structure:dr_1", source: "structure", kind: "org_draft", code: null, summary: "Add a Seed Keeper role", filedAt: null, batch: null, decideAt: "/admin?tab=org-chart", touchesPerson: false };
  const claim = { key: "claim:c1", source: "claim", kind: "quest.finished", code: null, summary: "Mend the east fence", filedAt: "2026-11-22T16:00:00.000Z", batch: null, decideAt: "/review", touchesPerson: false };

  it("a row names its kind, says what deciding it does, and its door says its verb, never a bare Open", async () => {
    stub({ changes: [PAGE], extra: [claim] });
    render(<AdminReview />);
    const row = await screen.findByTestId("row-claim:c1");
    expect(row.textContent).toContain("Finished work");
    expect(row.textContent).toContain("Mend the east fence");
    expect(row.textContent).toContain("Witnessing it records the work as done.");
    expect(within(row).getByRole("link").textContent).toBe("Witness it");
    expect(screen.queryByRole("link", { name: "Open" })).toBeNull();
  });

  it("groups the rows by kind with their counts, and lists the kinds at the top", async () => {
    stub({ changes: [PAGE], extra: [claim, draft] });
    render(<AdminReview />);
    const kinds = await screen.findByTestId("kinds");
    expect(within(kinds).getAllByRole("button").map((a) => a.textContent)).toEqual(["Org chart drafts · 1", "Proposed changes · 1", "Finished work to witness · 1"]);
    expect(screen.getByRole("heading", { name: "Org chart drafts 1" })).toBeTruthy();
  });

  it("an org chart draft shows what it does, line by line, and Publish publishes exactly the lines read, by the holder's door", async () => {
    const calls = stub({ changes: [], extra: [draft], decide: { youMayPublish: true } });
    render(<AdminReview />);
    const row = await screen.findByTestId("row-structure:dr_1");
    expect(row.textContent).toContain("An org chart draft");
    expect(row.textContent).toContain("Publishing it changes the org chart now.");
    expect((await within(row).findByTestId("draft-lines-dr_1")).textContent).toContain("Make the role Seed Keeper in the Garden circle");
    fireEvent.click(within(row).getByTestId("draft-publish-dr_1"));
    expect(row.textContent).toContain("Publish this draft? Its 2 changes go onto the org chart now.");
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    fireEvent.click(within(row).getByTestId("draft-yes-dr_1"));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")).toMatchObject({ url: "/api/org/drafts/dr_1/publish-by-power", body: { expectedChanges: ["c1", "c2"] } }));
    expect((await screen.findByTestId("row-notice")).textContent).toBe("Published. The org chart has changed.");
  });

  it("an admin before launch publishes by the admin panel's door; somebody who may only put it to the village gets that", async () => {
    const calls = stub({ changes: [], extra: [draft], decide: { adminMayPublish: true } });
    render(<AdminReview />);
    const row = await screen.findByTestId("row-structure:dr_1");
    fireEvent.click(await within(row).findByTestId("draft-publish-dr_1"));
    fireEvent.click(within(row).getByTestId("draft-yes-dr_1"));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")?.url).toBe("/api/admin/org/drafts/dr_1/publish"));
    cleanup();
    const calls2 = stub({ changes: [], extra: [draft], decide: { youMayPutToVillage: true }, preview: 401 });
    render(<AdminReview />);
    const row2 = await screen.findByTestId("row-structure:dr_1");
    expect(within(row2).queryByTestId("draft-publish-dr_1")).toBeNull();
    fireEvent.click(await within(row2).findByTestId("draft-put-dr_1"));
    fireEvent.click(within(row2).getByTestId("draft-yes-dr_1"));
    await waitFor(() => expect(calls2.find((c) => c.method === "POST")?.url).toBe("/api/org/drafts/dr_1/put-to-village"));
  });

  it("a draft this person may not decide, or one under a vote, keeps only its door to be read", async () => {
    stub({ changes: [], extra: [draft], decide: { youMayPublish: true, ballot: { id: "b1", closesAt: "2026-11-30T12:00:00.000Z" } } });
    render(<AdminReview />);
    const row = await screen.findByTestId("row-structure:dr_1");
    expect((await within(row).findByText(/The village is voting on this draft/)).textContent).toBe("The village is voting on this draft. The vote closes Nov 30.");
    expect(within(row).queryByTestId("draft-publish-dr_1")).toBeNull();
    expect(within(row).getByRole("link").textContent).toBe("Read the draft");
  });

  it("a decider may withdraw a draft, after a confirm, and is told when another open draft changes the same role", async () => {
    const calls = stub({ changes: [], extra: [draft], decide: { adminMayPublish: true, youMayWithdraw: true, otherOpenDrafts: 1 } });
    render(<AdminReview />);
    const row = await screen.findByTestId("row-structure:dr_1");
    expect((await within(row).findByTestId("draft-overlap-dr_1")).textContent).toBe(
      "Another open draft also changes this role. Read both before you publish, and withdraw the one that is out of date.",
    );
    fireEvent.click(within(row).getByTestId("draft-withdraw-dr_1"));
    expect(row.textContent).toContain("Withdraw this draft? It is kept on record, and it can no longer be published. Nothing on the org chart changes.");
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    fireEvent.click(within(row).getByTestId("draft-yes-dr_1"));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")?.url).toBe("/api/admin/org/drafts/dr_1/withdraw"));
    expect((await screen.findByTestId("row-notice")).textContent).toBe("Withdrawn. It can no longer be published.");
  });

  it("control: somebody who may not decide gets no Withdraw and no overlap line", async () => {
    stub({ changes: [], extra: [draft], decide: {} });
    render(<AdminReview />);
    const row = await screen.findByTestId("row-structure:dr_1");
    await within(row).findByRole("link");
    expect(within(row).queryByTestId("draft-withdraw-dr_1")).toBeNull();
    expect(within(row).queryByTestId("draft-overlap-dr_1")).toBeNull();
  });

  it("?kind= shows one kind, says so, and offers everything back", async () => {
    stub({ changes: [PAGE], extra: [claim, draft] });
    window.history.replaceState(null, "", "/admin/review?kind=structure");
    render(<AdminReview />);
    expect((await screen.findByTestId("only-kind")).textContent).toBe("Showing only Org chart drafts. The count above is of everything, whatever is shown. Show everything");
    expect(screen.getByTestId("row-structure:dr_1")).toBeTruthy();
    expect(screen.queryByTestId("row-claim:c1")).toBeNull();
    // The tags stay in reach, so the filter can be changed where it is.
    expect(screen.getByTestId("tag-structure").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("tag-claim").getAttribute("aria-pressed")).toBe("false");
  });
});

describe("the hall relief (27 Nov 2026): one Sera row, pages per kind, the order said, Blocked, unknown", () => {
  const claimRow = (n: number) => ({ key: `claim:c${n}`, source: "claim", kind: "quest.finished", code: null, summary: `Quest ${n}`, filedAt: `2026-11-${String(n + 1).padStart(2, "0")}T00:00:00.000Z`, batch: null, decideAt: "/review", touchesPerson: false });
  const sera = { key: "sera:differences", source: "sera", kind: "difference_list", code: null, summary: "159 differences Sera noticed", filedAt: "2026-11-10T00:00:00.000Z", batch: null, decideAt: "/review", touchesPerson: false, holds: 159 };

  it("Sera's differences are ONE row that says how many wait, and opens their list in place", async () => {
    const calls = stub({ changes: [], extra: [sera] });
    render(<AdminReview />);
    const row = await screen.findByTestId("row-sera:differences");
    expect(screen.getAllByTestId(/^row-sera:/)).toHaveLength(1);
    expect(within(row).getByTestId("sera-holds").textContent).toBe("159 differences wait, as one list.");
    // Pay and new roles are Sera's to suggest and a person's to confirm (Rye, 27 Nov 2026): the row says both.
    expect(row.textContent).toContain("Sera's suggestions for pay and for new roles are in the list too.");
    // True to today: a pay suggestion is never taken from the list; its row opens the role's own pay setter.
    // And ticked by hand (Rye, 28 Nov 2026: "Can manually select multiple").
    expect(row.textContent).toContain("You tick a new role or a pay suggestion yourself: Tick all shown leaves them alone.");
    expect(row.textContent).toContain("Anything else marked Check first is taken on its own.");
    expect(row.textContent).toContain("Pay is set in the role's own pay setter, one role at a time, by the people who set pay.");
    // One row counts once at the top and in its kind, whatever it holds.
    expect(screen.getByTestId("inbox-status").textContent).toBe("1 decision waiting on you.");
    expect(screen.getByTestId("count-sera").textContent).toBe("1");
    expect(screen.queryByTestId("sera-list")).toBeNull();
    fireEvent.click(within(row).getByTestId("sera-open"));
    const list = await screen.findByTestId("sera-list");
    expect(within(row).getByTestId("sera-open").getAttribute("aria-expanded")).toBe("true");
    // An answer inside the list reads the page's numbers again, behind the list: it stays open.
    const before = calls.filter((c) => c.url.startsWith("/api/admin/review/inbox")).length;
    fireEvent.click(await within(list).findByTestId("stub-sheet"));
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith("/api/admin/review/inbox")).length).toBe(before + 1));
    expect(screen.getByTestId("sera-list")).toBeTruthy();
    expect(screen.queryByText("Reading what is waiting.")).toBeNull();
  });

  it("a kind shows its first rows with the server's number, and Show more asks the server for the next page", async () => {
    const all = Array.from({ length: 23 }, (_, n) => claimRow(n));
    const calls = stub({
      changes: [],
      inbox: (url) => {
        const rows = Number(/claim%3A(\d+)/.exec(url)?.[1] ?? 10);
        return inboxAnswer(all.slice(0, rows), { claim: { count: 23, atLeast: 23, more: rows < 23 } });
      },
    });
    render(<AdminReview />);
    await screen.findByTestId("row-claim:c0");
    expect(screen.getAllByTestId(/^row-claim:/)).toHaveLength(10);
    // 23 wait: the number is the server's, never a count of the ten rows sent.
    expect(screen.getByTestId("inbox-status").textContent).toBe("23 decisions waiting on you.");
    expect(screen.getByTestId("count-claim").textContent).toBe("23");
    expect(screen.getByTestId("showing-claim").textContent).toBe("Showing 10 of 23.");
    fireEvent.click(screen.getByTestId("more-claim"));
    await waitFor(() => expect(screen.getAllByTestId(/^row-claim:/)).toHaveLength(20));
    expect(calls.some((c) => c.url === "/api/admin/review/inbox?rows=claim%3A20")).toBe(true);
    fireEvent.click(screen.getByTestId("more-claim"));
    await waitFor(() => expect(screen.getAllByTestId(/^row-claim:/)).toHaveLength(23));
    expect(screen.queryByTestId("more-claim")).toBeNull();
  });

  it("says the order of the list on the page", async () => {
    stub({ changes: [], extra: [claimRow(1)] });
    render(<AdminReview />);
    expect((await screen.findByTestId("inbox-order")).textContent).toBe("In each kind: what is blocked comes first, then what lapses soonest, then the oldest. What carries no date comes last, in the order its own queue keeps.");
  });

  it("a queue that did not load reads unknown, never zero, and the number at the top becomes a floor", async () => {
    stub({ changes: [], inbox: () => inboxAnswer([claimRow(1)], { quest: { state: "failed", count: null, atLeast: 0 } }) });
    render(<AdminReview />);
    await screen.findByTestId("row-claim:c1");
    expect(screen.getByTestId("inbox-status").textContent).toBe("At least 1 decision waiting on you. 1 queue did not load, so its number is unknown.");
    expect(screen.getByTestId("count-quest").textContent).toBe("unknown");
    expect(screen.getByTestId("unknown-quest").textContent).toBe("This queue did not load, so how many wait here is unknown. It may hold something.");
    expect(within(screen.getByTestId("kinds")).getAllByRole("button").map((a) => a.textContent)).toEqual(["Quest ideas · unknown", "Finished work to witness · 1"]);
    // And it is still named in the alert, with a way to try again.
    expect(screen.getByRole("alert").textContent).toContain("Some of what waits did not load: Quest ideas.");
  });

  it("a row that cannot be applied as the village stands says Blocked and why, and is counted", async () => {
    const blocked = { count: 2, reads: "Retire the Water Steward", why: "That role no longer exists" };
    const agentDraft = { key: "structure:dr_9", source: "agent", kind: "role_change", code: null, summary: "An agent's role change", filedAt: null, batch: null, decideAt: "/governance/decisions/drafts/dr_9", touchesPerson: false, blocked };
    stub({ changes: [], extra: [agentDraft, { key: "structure:dr_1", source: "structure", kind: "org_draft", code: null, summary: "Rest the old council", filedAt: null, batch: null, decideAt: "/x", touchesPerson: false, blocked }] });
    render(<AdminReview />);
    const row = await screen.findByTestId("row-structure:dr_9");
    expect(within(row).getByTestId("blocked-chip").textContent).toBe("Blocked");
    expect(within(row).getByTestId("blocked-why").textContent).toBe("It cannot be applied as the village stands. Retire the Water Steward: That role no longer exists. 1 more of its changes is blocked.");
    // Blocked rows are said beside the count and are not in it.
    expect(screen.getByTestId("inbox-status").textContent).toBe("0 decisions waiting on you. 2 blocked.");
    expect(screen.getByRole("heading", { name: "Org chart drafts 1 1 blocked" })).toBeTruthy();
    // The draft's own row carries the chip too, before its lines are read.
    expect(within(screen.getByTestId("row-structure:dr_1")).getByTestId("blocked-chip")).toBeTruthy();
  });
});

describe("the Batches view: /admin/proposals folded into this page (the accepted cut C8, 27 Nov 2026)", () => {
  it("a person who may read the connector gets a Batches view that draws the old page's desk, and a decision there re-reads the list behind it", async () => {
    const calls = stub();
    window.history.replaceState(null, "", "/admin/review?view=batches");
    render(<AdminReview />);
    const view = await screen.findByTestId("batches-view");
    expect(screen.getByTestId("tab-batches").getAttribute("aria-current")).toBe("page");
    const desk = await within(view).findByTestId("stub-desk");
    // The desk is drawn inside this page: no second page frame, no second header.
    expect(desk.getAttribute("data-embedded")).toBe("yes");
    // Waiting's own cards are not drawn on this view.
    expect(screen.queryByTestId("conflict-card-pc_1")).toBeNull();
    const before = calls.filter((c) => c.url.startsWith("/api/admin/review/inbox")).length;
    fireEvent.click(desk);
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith("/api/admin/review/inbox")).length).toBe(before + 1));
    expect(screen.getByTestId("batches-view")).toBeTruthy();
  });

  it("a person who may not read the connector gets no Batches view, even by its address", async () => {
    stub({ connector: "refused" });
    window.history.replaceState(null, "", "/admin/review?view=batches");
    render(<AdminReview />);
    await screen.findByText("Nothing is waiting on you.");
    expect(screen.queryByTestId("tab-batches")).toBeNull();
    expect(screen.queryByTestId("batches-view")).toBeNull();
  });
});

describe("a change under Waiting names its batch and links to it in the Batches view", () => {
  it("says which batch it is part of, with a door to that batch, and stays one decision", async () => {
    stub({ changes: [PAGE] });
    render(<AdminReview />);
    const line = await screen.findByTestId("batch-of-pc_3");
    expect(line.textContent).toBe("Part of batch B-3. See the whole batch");
    // And it carries its tag, as every row does: where it came from.
    expect(screen.getByTestId("tag-of-pc_3").textContent).toBe("A proposed change");
    expect(within(line).getByRole("link").getAttribute("href")).toBe("/admin/review?view=batches&find=B-3");
    // The change is drawn here and in the Batches view; the count is the server's one row for it, said once.
    expect(screen.getByTestId("inbox-status").textContent).toContain("1 decision waiting on you.");
  });
});
