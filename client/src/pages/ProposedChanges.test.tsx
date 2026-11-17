// @vitest-environment jsdom
/**
 * /admin/proposals, as cards (16 Nov 2026). Pinned:
 *   1. A batch is a card: its title, who proposed it, how many changes, the kinds; the newest waiting batch is open.
 *   2. Each kind reads as before and after: page words word by word, a variable before and after, an event as a
 *      small card, season goals row by row with a reorder and a rewording, a whole document with a field taken out.
 *   3. Flags come off the route: whole document, public page, money words, a calendar event, priorities.
 *   4. Edit words opens today's editor, and an edit saves as a draft.
 *   5. Accept checks first; a problem shows on its card and nothing is accepted. Accept sends the edited body.
 *   6. Accept all and Discard all ask once on the card, then act on every change in the batch.
 *   7. A failure keeps its reason on its card; an accept that did not finish says so.
 *   8. The filters narrow by status, kind, page and proposer.
 *   9. The history shows who decided, what went live, the reader's edits and a reason a change did not land.
 *  10. An accepted change offers "Propose putting it back" when it kept what was live before, which files a new
 *      proposal; otherwise one plain line says why. A waiting put-back says what it is.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/components/Layout", () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/contexts/AuthContext", () => ({ useOptionalAuth: () => ({ loading: false, user: { id: "u1" } }) }));
vi.mock("@/lib/gameApi", () => ({ authToken: () => "t" }));

import ProposedChanges from "./ProposedChanges";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const base = { draft: null, status: "proposed", error: null, by: "Sera Companion", byKind: "agent", at: "2026-11-12T10:00:00.000Z", target: {}, labels: {} };
const ROLE = {
  ...base,
  id: "pc_role",
  batchId: "pcb_1",
  kind: "role_card",
  target: { roleId: "fin" },
  targetLabel: "Lead Finance Steward card",
  route: { method: "POST", path: "/api/org/role-edit/fin" },
  summary: "Give the card a clearer aim.",
  body: { words: { aim: "Hold the money.", accountabilities: ["Books each moon"] } },
  live: { words: { aim: "Keep the books.", accountabilities: ["Pay bills"] } },
  labels: { "words.aim": "Aim", "words.accountabilities": "What you can count on me for" },
  where: { label: "Roles page", href: "/roles?seat=fin" },
};
const PAGE = {
  ...base,
  id: "pc_page",
  batchId: "pcb_1",
  kind: "page_content",
  target: { section: "page-home" },
  targetLabel: "Home page",
  route: { method: "PUT", path: "/api/admin/content/page-home" },
  summary: "Reword the headline.",
  body: { hero: { headline: "A home for families", badge: "Open" } },
  live: { hero: { headline: "Welcome home", badge: "Open" } },
  labels: { "hero.headline": "Top: Headline", "hero.badge": "Top: Badge" },
  where: { label: "Home page", href: "/" },
};
const DIAL = {
  ...base,
  id: "pc_dial",
  batchId: "pcb_2",
  kind: "variable",
  target: { key: "org.applicant_reply_days" },
  targetLabel: "Reply within",
  route: { method: "PUT", path: "/api/admin/variables/org.applicant_reply_days" },
  summary: "Promise a reply within ten days.",
  body: { value: "10" },
  live: { value: "14" },
  labels: { value: "Reply within" },
  where: { label: "Admin, Variables", href: "/admin?tab=variables" },
};
const EVENT = {
  ...base,
  id: "pc_event",
  batchId: "pcb_2",
  kind: "setting",
  target: { method: "POST", path: "/api/admin/events" },
  targetLabel: "/api/admin/events",
  route: { method: "POST", path: "/api/admin/events" },
  summary: "Put the land tour on the calendar.",
  body: { title: "Land tour", startsAt: "2026-11-20T15:00:00.000Z", endsAt: "2026-11-20T17:00:00.000Z", recurrence: { freq: "weekly", byWeekday: [5] }, link: "https://example.test/tour", status: "scheduled" },
  live: null,
  where: { label: "Calendar", href: "/events" },
};
const GOALS = {
  ...base,
  id: "pc_goals",
  batchId: "pcb_2",
  kind: "season_goals",
  target: { seasonId: "s1" },
  targetLabel: "Autumn goals",
  route: { method: "PUT", path: "/api/admin/seasons" },
  summary: "Put the food forest first and sharpen the school goal.",
  body: { goals: [{ text: "Plant the food forest" }, { text: "Water for every home" }, { text: "Open the village land school" }] },
  live: { goals: [{ text: "Water for every home", done: false }, { text: "Open the land school", done: false }, { text: "Plant the food forest", done: false }] },
  where: { label: "Season", href: "/admin?tab=season" },
};
const INVESTOR = {
  ...base,
  id: "pc_inv",
  batchId: "pcb_2",
  kind: "setting",
  target: { method: "PUT", path: "/api/admin/investor-summary" },
  targetLabel: "/api/admin/investor-summary",
  route: { method: "PUT", path: "/api/admin/investor-summary" },
  summary: "Rewrite the investor summary.",
  body: { headline: "A village on the land" },
  live: { headline: "An invitation", footnote: "Figures are estimates." },
  where: { label: "Investor page", href: "/investor" },
};

const BATCHES = [
  { id: "pcb_1", title: "Phase A content", by: "Sera Companion", byKind: "agent", at: "2026-11-12T10:00:00.000Z" },
  { id: "pcb_2", title: "Season and calendar", by: "Fern", byKind: "person", at: "2026-11-14T10:00:00.000Z" },
];
const DECIDED = [
  {
    id: "pc_old1", batchId: "pcb_0", batchTitle: "Last week's words", kind: "page_content", target: { section: "page-steward" }, targetLabel: "Steward page",
    route: { method: "PUT", path: "/api/admin/content/page-steward" }, summary: "Warm up the steward intro.", body: { intro: { lede: "Join the team that will build it." } },
    accepted: { intro: { lede: "Join the team that will build the village." } }, labels: {}, where: { label: "Steward page", href: "/steward" }, status: "accepted", error: null,
    proposedBy: "Sera Companion", proposedByKind: "agent", proposedAt: "2026-11-01T10:00:00.000Z", by: "Fern", at: "2026-11-02T10:00:00.000Z", edited: 1,
  },
  {
    id: "pc_old2", batchId: "pcb_0", batchTitle: "Last week's words", kind: "variable", target: { key: "x" }, targetLabel: "A dial", route: { method: "PUT", path: "/api/admin/variables/x" },
    summary: "Turn a dial.", body: { value: "3" }, accepted: null, labels: {}, where: { label: "Admin, Variables", href: "/admin?tab=variables" }, status: "discarded",
    error: "This needs the power to turn the village's dials.", proposedBy: "Sera Companion", proposedByKind: "agent", by: "Fern", at: "2026-11-02T09:00:00.000Z", edited: 0,
  },
];

function stub(opts: { changes?: unknown[]; check?: unknown[]; accept?: unknown[]; acceptBroken?: boolean; decided?: unknown[] } = {}) {
  const calls: Array<{ url: string; method: string; body: any }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url: String(url), method, body: init?.body ? JSON.parse(String(init.body)) : null });
      const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b });
      if (url === "/api/admin/proposals" && method === "GET") return json({ timezone: "America/Costa_Rica", batches: BATCHES, changes: opts.changes ?? [ROLE, PAGE], decided: opts.decided ?? [] });
      if (String(url).endsWith("/check")) return json({ results: opts.check ?? [] });
      if (String(url).endsWith("/accept")) return opts.acceptBroken ? { ok: false, status: 500, json: async () => ({ error: "Internal error" }) } : json({ results: opts.accept ?? [] });
      if (String(url).endsWith("/discard")) return json({ results: [] });
      return json({ success: true });
    }),
  );
  return calls;
}

const openBatch = (id: string) => fireEvent.click(screen.getByTestId(`batch-toggle-${id}`));

describe("a batch is a card", () => {
  it("names the batch, who proposed it, how many changes and the kinds, and opens the newest", async () => {
    stub({ changes: [ROLE, PAGE, DIAL, EVENT] });
    render(<ProposedChanges />);
    const older = await screen.findByTestId("batch-pcb_1");
    const newer = screen.getByTestId("batch-pcb_2");
    // Waiting first, newest batch first.
    expect(newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(older).getByRole("heading", { name: "Phase A content" })).toBeTruthy();
    expect(within(older).getByTestId("batch-summary").textContent).toMatch(/2 changes, landing on Roles page and Home page/);
    expect(within(older).getByTestId("batch-facts").textContent).toContain("Sera Companion, an agent");
    expect(within(older).getByTestId("batch-kinds").textContent).toMatch(/Role card.*Page words/);
    // The newest batch is open; the older one lists its changes in one line each until opened.
    expect(within(newer).getByTestId("proposal-pc_dial")).toBeTruthy();
    expect(within(older).queryByTestId("proposal-pc_role")).toBeNull();
    expect(within(older).getByTestId("row-pc_role").textContent).toContain("Give the card a clearer aim.");
    openBatch("pcb_1");
    expect(within(older).getByTestId("proposal-pc_role")).toBeTruthy();
  });
});

describe("each kind reads as before and after", () => {
  it("page words: the changed field only, old words struck and new words lit, a door to the page, no JSON until asked", async () => {
    stub();
    render(<ProposedChanges />);
    const card = await screen.findByTestId("proposal-pc_page");
    expect(within(card).getByTestId("change-kind").textContent).toBe("Page words");
    const diffs = within(card).getByTestId("field-diffs");
    expect(diffs.querySelectorAll("[data-field-diff]").length).toBe(1);
    expect(diffs.querySelector("del")?.textContent).toBe("Welcome");
    expect(diffs.querySelector("ins")?.textContent).toContain("A");
    expect(within(card).getByTestId("see-live").getAttribute("href")).toBe("/");
    expect(card.textContent).not.toContain("{");
    fireEvent.click(within(card).getByRole("button", { name: /Show everything/ }));
    expect(diffs.querySelectorAll("[data-field-diff]").length).toBe(2);
    fireEvent.click(within(card).getByRole("button", { name: /Show JSON/ }));
    expect(card.textContent).toContain('"headline"');
  });

  it("a village setting reads before and after", async () => {
    stub({ changes: [DIAL] });
    render(<ProposedChanges />);
    const card = await screen.findByTestId("proposal-pc_dial");
    expect(within(card).getByTestId("change-kind").textContent).toBe("Village setting");
    expect(card.querySelector("del")?.textContent).toBe("14");
    expect(card.querySelector("ins")?.textContent).toBe("10");
  });

  it("a calendar event is a small card in village time, flagged as creating an event", async () => {
    stub({ changes: [EVENT] });
    render(<ProposedChanges />);
    const card = await screen.findByTestId("proposal-pc_event");
    expect(within(card).getByTestId("change-kind").textContent).toBe("Calendar event");
    const ev = within(card).getByTestId("event-card");
    expect(ev.textContent).toContain("Land tour");
    expect(ev.textContent).toContain("Every week on Friday");
    expect(ev.textContent).toContain("https://example.test/tour");
    expect(ev.textContent).toContain("On the calendar");
    // 15:00 UTC is 9:00 in Costa Rica.
    expect(ev.textContent).toMatch(/9:00/);
    expect(within(card).getByTestId("change-flags").textContent).toContain("Creates a calendar event");
  });

  it("season goals read row by row: a reorder and a rewording", async () => {
    stub({ changes: [GOALS] });
    render(<ProposedChanges />);
    const card = await screen.findByTestId("proposal-pc_goals");
    expect(within(card).getByTestId("change-kind").textContent).toBe("Season priorities");
    const rows = Array.from(within(card).getByTestId("goals-diff").querySelectorAll("[data-row-op]"));
    expect(rows.map((r) => r.getAttribute("data-row-op"))).toEqual(["moved", "same", "reworded"]);
    expect(rows[0].textContent).toContain("Moved up from 3");
    expect(rows[2].querySelector("ins")?.textContent).toContain("village");
    expect(within(card).getByTestId("change-flags").textContent).toContain("Changes priorities and their links");
  });

  it("a whole document says so, and shows a field it leaves out as taken out", async () => {
    stub({ changes: [INVESTOR] });
    render(<ProposedChanges />);
    const card = await screen.findByTestId("proposal-pc_inv");
    expect(within(card).getByTestId("change-kind").textContent).toBe("Admin setting");
    const flags = within(card).getByTestId("change-flags").textContent ?? "";
    expect(flags).toContain("Replaces the whole document");
    expect(flags).toContain("Public page");
    expect(flags).toContain("Affects money words");
    const taken = card.querySelector('[data-field-diff="footnote"]')!;
    expect(taken.textContent).toContain("Taken out");
    expect(taken.querySelector("del")?.textContent).toContain("Figures are estimates.");
  });
});

describe("acting on one change", () => {
  it("Edit words opens today's editor, and an edit saves as a draft", async () => {
    const calls = stub();
    render(<ProposedChanges />);
    const card = await screen.findByTestId("proposal-pc_role");
    fireEvent.click(within(card).getByTestId("edit-pc_role"));
    expect(within(card).getByText("Keep the books.")).toBeTruthy();
    const box = within(card).getByLabelText("Aim") as HTMLTextAreaElement;
    expect(box.value).toBe("Hold the money.");
    fireEvent.change(box, { target: { value: "Hold the village's money with care." } });
    await waitFor(() => expect(calls.some((c) => c.method === "PUT" && c.url.endsWith("/pc_role/draft"))).toBe(true), { timeout: 3000 });
    expect(calls.find((c) => c.method === "PUT")!.body.body.words.aim).toBe("Hold the village's money with care.");
  });

  it("Accept checks first: a problem shows on its card and nothing is accepted", async () => {
    const calls = stub({ changes: [PAGE], check: [{ id: "pc_page", ok: false, error: "A headline is needed.", field: "hero.headline" }] });
    render(<ProposedChanges />);
    const card = await screen.findByTestId("proposal-pc_page");
    fireEvent.click(within(card).getByTestId("accept-pc_page"));
    expect(await within(card).findByText("A headline is needed.")).toBeTruthy();
    expect(calls.some((c) => c.url.endsWith("/accept"))).toBe(false);
  });

  it("Accept sends exactly the edited body of that one change", async () => {
    const calls = stub({ changes: [ROLE], check: [{ id: "pc_role", ok: true }], accept: [{ id: "pc_role", ok: true }] });
    render(<ProposedChanges />);
    const card = await screen.findByTestId("proposal-pc_role");
    fireEvent.click(within(card).getByTestId("edit-pc_role"));
    fireEvent.change(within(card).getByLabelText("Aim"), { target: { value: "Edited aim." } });
    fireEvent.click(within(card).getByTestId("accept-pc_role"));
    await screen.findByTestId("accept-outcome");
    const acc = calls.find((c) => c.url.endsWith("/accept"))!;
    expect(acc.body.items).toEqual([{ id: "pc_role", body: { words: { aim: "Edited aim.", accountabilities: ["Books each moon"] } } }]);
  });

  it("Discard puts that one change aside", async () => {
    const calls = stub({ changes: [PAGE] });
    render(<ProposedChanges />);
    const card = await screen.findByTestId("proposal-pc_page");
    fireEvent.click(within(card).getByTestId("discard-pc_page"));
    await waitFor(() => expect(calls.find((c) => c.url.endsWith("/discard"))?.body).toEqual({ ids: ["pc_page"] }));
  });

  it("a change that did not land keeps its reason on its card", async () => {
    stub({ changes: [{ ...PAGE, status: "failed", error: "This needs a power you do not hold." }] });
    render(<ProposedChanges />);
    const card = await screen.findByTestId("proposal-pc_page");
    expect(within(card).getByTestId("last-try").textContent).toContain("Last try did not land: This needs a power you do not hold.");
  });
});

describe("acting on a batch", () => {
  it("Accept all asks once on the card, then accepts every change; one that fails says why on its card", async () => {
    const calls = stub({ check: [{ id: "pc_role", ok: true }, { id: "pc_page", ok: true }], accept: [{ id: "pc_role", ok: true }, { id: "pc_page", ok: false, error: "This needs a power you do not hold.", field: null }] });
    render(<ProposedChanges />);
    const batch = await screen.findByTestId("batch-pcb_1");
    fireEvent.click(within(batch).getByTestId("batch-accept-all"));
    expect(within(batch).getByTestId("batch-confirm").textContent).toContain("Accept all 2 changes?");
    expect(calls.some((c) => c.url.endsWith("/check"))).toBe(false);
    fireEvent.click(within(batch).getByTestId("batch-confirm-yes"));
    await screen.findByTestId("accept-outcome");
    expect(calls.find((c) => c.url.endsWith("/accept"))!.body.items.map((i: any) => i.id)).toEqual(["pc_role", "pc_page"]);
    expect(screen.getByTestId("accept-outcome").textContent).toMatch(/1 accepted, 1 did not land/);
    const card = await screen.findByTestId("proposal-pc_page");
    expect(within(card).getByText("This needs a power you do not hold.")).toBeTruthy();
  });

  it("Not yet takes the question back, and Discard all asks before putting every change aside", async () => {
    const calls = stub();
    render(<ProposedChanges />);
    const batch = await screen.findByTestId("batch-pcb_1");
    fireEvent.click(within(batch).getByTestId("batch-discard-all"));
    fireEvent.click(within(batch).getByTestId("batch-confirm-no"));
    expect(within(batch).queryByTestId("batch-confirm")).toBeNull();
    fireEvent.click(within(batch).getByTestId("batch-discard-all"));
    expect(within(batch).getByTestId("batch-confirm").textContent).toContain("Discard all 2 changes?");
    fireEvent.click(within(batch).getByTestId("batch-confirm-yes"));
    await waitFor(() => expect(calls.find((c) => c.url.endsWith("/discard"))?.body).toEqual({ ids: ["pc_role", "pc_page"] }));
  });

  it("an accept that did not finish says so, and never reads as nothing landed", async () => {
    stub({ check: [{ id: "pc_role", ok: true }, { id: "pc_page", ok: true }], acceptBroken: true });
    render(<ProposedChanges />);
    const batch = await screen.findByTestId("batch-pcb_1");
    fireEvent.click(within(batch).getByTestId("batch-accept-all"));
    fireEvent.click(within(batch).getByTestId("batch-confirm-yes"));
    expect(await screen.findByText(/The accept did not finish/)).toBeTruthy();
    expect(screen.queryByTestId("accept-outcome")).toBeNull();
  });
});

describe("filters", () => {
  it("narrows by kind, page and proposer, and by waiting or decided", async () => {
    stub({ changes: [ROLE, PAGE, DIAL, EVENT], decided: DECIDED });
    render(<ProposedChanges />);
    await screen.findByTestId("batch-pcb_1");
    fireEvent.change(screen.getByTestId("filter-kind"), { target: { value: "calendar_event" } });
    expect(screen.queryByTestId("batch-pcb_1")).toBeNull();
    expect(within(screen.getByTestId("batch-pcb_2")).queryByTestId("proposal-pc_dial")).toBeNull();
    expect(screen.getByTestId("proposal-pc_event")).toBeTruthy();
    fireEvent.change(screen.getByTestId("filter-kind"), { target: { value: "" } });
    fireEvent.change(screen.getByTestId("filter-page"), { target: { value: "Home page" } });
    expect(screen.queryByTestId("batch-pcb_2")).toBeNull();
    // The only batch left is now the newest waiting one, so it is open.
    expect(screen.getByTestId("proposal-pc_page")).toBeTruthy();
    expect(screen.queryByTestId("proposal-pc_role")).toBeNull();
    fireEvent.change(screen.getByTestId("filter-page"), { target: { value: "" } });
    fireEvent.change(screen.getByTestId("filter-who"), { target: { value: "Fern" } });
    expect(screen.queryByTestId("batch-pcb_1")).toBeNull();
    expect(screen.getByTestId("batch-pcb_2")).toBeTruthy();
    fireEvent.change(screen.getByTestId("filter-who"), { target: { value: "" } });
    fireEvent.change(screen.getByTestId("filter-status"), { target: { value: "decided" } });
    expect(screen.queryByTestId("batch-pcb_1")).toBeNull();
    expect(screen.getByTestId("history-batch")).toBeTruthy();
    fireEvent.change(screen.getByTestId("filter-status"), { target: { value: "waiting" } });
    expect(screen.queryByTestId("history-batch")).toBeNull();
  });
});

describe("the history", () => {
  it("shows who decided, the reader's edits as before and after, and the reason a change did not land", async () => {
    stub({ changes: [], decided: DECIDED });
    render(<ProposedChanges />);
    const one = await screen.findByTestId("decided-pc_old1");
    expect(within(one).getByTestId("decided-status").textContent).toBe("Accepted by Fern");
    expect(one.textContent).toContain("Edited before it went live");
    expect(one.querySelector("ins")?.textContent).toContain("the village");
    const two = screen.getByTestId("decided-pc_old2");
    expect(within(two).getByTestId("decided-status").textContent).toBe("Discarded by Fern");
    expect(within(two).getByTestId("decided-error").textContent).toContain("This needs the power to turn the village's dials.");
    expect(screen.getByTestId("history-batch").textContent).toContain("Last week's words");
  });
});

describe("propose putting it back", () => {
  const accepted = DECIDED[0];
  const kept = { ...accepted, id: "pc_kept", putBack: { can: true } };
  const event = { ...accepted, id: "pc_ev", kind: "setting", target: { method: "POST", path: "/api/admin/events" }, route: { method: "POST", path: "/api/admin/events" }, putBack: { can: false, reason: "made_new" } };
  const old = { ...accepted, id: "pc_before" }; // an older server, or a change accepted before this release: no putBack

  it("offers it where a before value was kept, files a new proposal, and applies nothing", async () => {
    const calls = stub({ changes: [], decided: [kept] });
    render(<ProposedChanges />);
    const card = await screen.findByTestId("decided-pc_kept");
    fireEvent.click(within(card).getByTestId("put-back-pc_kept"));
    await waitFor(() => expect(screen.getByTestId("put-back-filed")).toBeTruthy());
    const posts = calls.filter((c) => c.method === "POST");
    expect(posts.map((c) => c.url)).toEqual(["/api/admin/proposals/pc_kept/put-back"]);
    // The page reloads, so the new proposal shows up waiting.
    expect(calls.filter((c) => c.url === "/api/admin/proposals" && c.method === "GET").length).toBe(2);
  });

  it("says why in one plain line where it is not offered, and offers nothing on a discarded change", async () => {
    stub({ changes: [], decided: [event, old, DECIDED[1]] });
    render(<ProposedChanges />);
    const ev = await screen.findByTestId("decided-pc_ev");
    expect(within(ev).queryByTestId("put-back-pc_ev")).toBeNull();
    expect(within(ev).getByTestId("put-back-none").textContent).toBe("This change made something new. Taking it away is its own change, on its own page.");
    const before = screen.getByTestId("decided-pc_before");
    expect(within(before).getByTestId("put-back-none").getAttribute("data-reason")).toBe("not_kept");
    expect(within(before).getByTestId("put-back-none").textContent).toContain("nothing to put back");
    const discarded = screen.getByTestId("decided-pc_old2");
    expect(within(discarded).queryByTestId("put-back-none")).toBeNull();
  });

  it("a waiting proposal that puts a change back says so", async () => {
    stub({ changes: [{ ...DIAL, reverts: "pc_old" }] });
    render(<ProposedChanges />);
    const card = await screen.findByTestId("proposal-pc_dial");
    expect(within(card).getByTestId("puts-back").textContent).toBe("Puts back an earlier change");
  });
});
