// @vitest-environment jsdom
/**
 * ONE REPORTS QUEUE, AND EVERY ACT EACH OLD TAB HAD (cut C7, 27 Nov 2026).
 *
 * Moderation (the forum's reports) and Message Reports were two tabs. They are
 * one list now. These hold what the fold must not lose:
 *
 *   - both kinds of report are on the one list, newest first;
 *   - a forum card still reads, hides, puts back, locks, and closes either way,
 *     each on the route it always called;
 *   - a message card still closes either way, on its own route, and still
 *     shows one line and no way into the conversation;
 *   - the forum's category editor is still on the page;
 *   - a half whose module is off is neither read nor drawn.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ReportsTab } from "./Admin";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const FORUM = [
  { id: "f1", threadId: "t1", threadTitle: "Compost rota", severity: "soft", reporter: "Ana", at: "2026-11-20T10:00:00Z", replyId: null, reason: "Off topic", status: "open", alreadyHidden: false },
  { id: "f2", threadId: "t2", threadTitle: "Water rights", severity: "hard", reporter: "Ben", at: "2026-11-26T10:00:00Z", replyId: "r9", reason: null, status: "open", alreadyHidden: true },
];
const MESSAGES = [
  { id: "m1", conversationId: "c1", conversationKind: "direct", conversationName: null, messageId: "x1", body: "You are not welcome here.", deleted: false, authorId: "u9", reporter: "Cleo", reason: "Unkind", status: "open", at: "2026-11-24T10:00:00Z" },
];

interface Call { method: string; url: string; body: any }

function stub(opts: { forum?: any[]; messages?: any[] } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init?: any) => {
      const u = String(url);
      const method = String(init?.method ?? "GET");
      calls.push({ method, url: u, body: init?.body ? JSON.parse(init.body) : undefined });
      if (method !== "GET") return { ok: true, status: 200, json: async () => ({ success: true }) };
      if (u.includes("/admin/forum/reports")) return { ok: true, status: 200, json: async () => opts.forum ?? FORUM };
      if (u.includes("/admin/messages/reports")) return { ok: true, status: 200, json: async () => opts.messages ?? MESSAGES };
      // The forum's category editor reads the module's own config.
      if (u.endsWith("/admin/modules")) return { ok: true, status: 200, json: async () => ({ modules: [{ id: "forum", lifecycle: "members", config: { categories: [{ id: "village-life", label: "Village life" }] } }] }) };
      return { ok: true, status: 200, json: async () => ({}) };
    }),
  );
  return calls;
}

const cards = () => Array.from(document.querySelectorAll<HTMLElement>("[data-report]"));
const writes = (calls: Call[]) => calls.filter((c) => c.method !== "GET").map((c) => `${c.method} ${c.url} ${JSON.stringify(c.body)}`);

describe("the Reports queue", () => {
  it("draws forum reports and message reports on one list, newest first", async () => {
    stub();
    render(<ReportsTab password="pw" />);
    expect(await screen.findByText("Compost rota")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Reports" })).toBeTruthy();
    expect(cards().map((c) => c.dataset.report)).toEqual(["forum", "message", "forum"]);
    expect(cards().map((c) => c.querySelector("p")?.textContent)).toEqual(["Water rights", "In a direct thread", "Compost rota"]);
  });

  it("reads both queues for the status chosen, and reads again when the status changes", async () => {
    const calls = stub();
    render(<ReportsTab password="pw" />);
    await screen.findByText("Compost rota");
    const reads = () => calls.filter((c) => c.method === "GET" && c.url.includes("/reports")).map((c) => c.url);
    expect(reads()).toEqual(["/api/admin/forum/reports?status=open", "/api/admin/messages/reports?status=open"]);
    await userEvent.click(screen.getByRole("button", { name: "resolved" }));
    await waitFor(() => expect(reads()).toContain("/api/admin/messages/reports?status=resolved"));
    expect(reads()).toContain("/api/admin/forum/reports?status=resolved");
  });

  it("keeps every act the Moderation tab had, each on its own route", async () => {
    vi.stubGlobal("prompt", vi.fn(() => "Personal attack"));
    const calls = stub();
    render(<ReportsTab password="pw" />);
    await screen.findByText("Compost rota");
    const open = () => cards().find((c) => c.textContent?.includes("Compost rota"))!;
    const hidden = () => cards().find((c) => c.textContent?.includes("Water rights"))!;

    // Read it: a link to the thread itself.
    expect(within(open()).getByRole("link", { name: "Read it" }).getAttribute("href")).toBe("/forum/t1");
    // A thread the village already hid can be put back; one still showing can be hidden, with a reason.
    expect(within(hidden()).getByText("Auto-hidden")).toBeTruthy();
    expect(within(hidden()).queryByRole("button", { name: "Hide it" })).toBeNull();
    expect(within(open()).queryByRole("button", { name: "Put it back" })).toBeNull();

    for (const [card, name] of [[open, "Hide it"], [open, "Lock replies"], [open, "Handled"], [open, "Nothing wrong here"], [hidden, "Put it back"]] as const) {
      const before = writes(calls).length;
      await userEvent.click(within(card()).getByRole("button", { name }));
      await waitFor(() => expect(writes(calls).length).toBe(before + 1));
      await screen.findByText("Compost rota");
    }
    expect(writes(calls)).toEqual([
      'POST /api/forum/threads/t1/moderate {"action":"hide","reason":"Personal attack"}',
      'POST /api/forum/threads/t1/moderate {"action":"lock"}',
      'PUT /api/admin/forum/reports/f1 {"status":"resolved"}',
      'PUT /api/admin/forum/reports/f1 {"status":"dismissed"}',
      'POST /api/forum/threads/t2/moderate {"action":"restore"}',
    ]);
  });

  it("hides nothing when the moderator backs out of the reason", async () => {
    vi.stubGlobal("prompt", vi.fn(() => null));
    const calls = stub();
    render(<ReportsTab password="pw" />);
    await screen.findByText("Compost rota");
    await userEvent.click(within(cards().find((c) => c.textContent?.includes("Compost rota"))!).getByRole("button", { name: "Hide it" }));
    expect(writes(calls)).toEqual([]);
  });

  it("keeps every act the Message Reports tab had, and shows one line with no way into the conversation", async () => {
    const calls = stub();
    render(<ReportsTab password="pw" />);
    await screen.findByText("In a direct thread");
    const card = () => cards().find((c) => c.dataset.report === "message")!;
    expect(within(card()).getByText("You are not welcome here.")).toBeTruthy();
    expect(card().textContent).toContain('Why they flagged it: "Unkind"');
    // Private correspondence: no link, no author, and none of the forum's verbs.
    expect(within(card()).queryByRole("link")).toBeNull();
    expect(card().textContent).not.toContain("u9");
    for (const name of ["Read it", "Hide it", "Put it back", "Lock replies"]) expect(within(card()).queryByRole("button", { name })).toBeNull();
    expect(screen.getByText(/One reported message, and nothing else from the conversation/)).toBeTruthy();

    for (const name of ["Handled", "Nothing wrong here"]) {
      const before = writes(calls).length;
      await userEvent.click(within(card()).getByRole("button", { name }));
      await waitFor(() => expect(writes(calls).length).toBe(before + 1));
      await screen.findByText("In a direct thread");
    }
    expect(writes(calls)).toEqual([
      'PUT /api/admin/messages/reports/m1 {"status":"resolved"}',
      'PUT /api/admin/messages/reports/m1 {"status":"dismissed"}',
    ]);
  });

  it("still offers the forum's category editor", async () => {
    stub();
    render(<ReportsTab password="pw" />);
    await screen.findByText("Compost rota");
    expect(await screen.findByText("Forum categories")).toBeTruthy();
    expect(await screen.findByDisplayValue("Village life")).toBeTruthy();
  });

  it("with messaging off, reads and draws the forum half alone", async () => {
    const calls = stub();
    render(<ReportsTab password="pw" forum messages={false} />);
    await screen.findByText("Compost rota");
    expect(calls.some((c) => c.url.includes("/admin/messages/"))).toBe(false);
    expect(cards().map((c) => c.dataset.report)).toEqual(["forum", "forum"]);
    expect(screen.queryByText(/inside private conversations/)).toBeNull();
    expect(screen.getByText(/Hiding is always reversible/)).toBeTruthy();
  });

  it("with the forum off, reads and draws the messages half alone, with no forum editor", async () => {
    const calls = stub();
    render(<ReportsTab password="pw" forum={false} messages />);
    await screen.findByText("In a direct thread");
    expect(calls.some((c) => c.url.includes("/forum/") || c.url.endsWith("/admin/modules"))).toBe(false);
    expect(cards().map((c) => c.dataset.report)).toEqual(["message"]);
    expect(screen.queryByText("Forum categories")).toBeNull();
    expect(screen.queryByText(/Hiding is always reversible/)).toBeNull();
    expect(screen.getByText(/inside private conversations/)).toBeTruthy();
  });

  it("says the queue is quiet when neither half has a report", async () => {
    stub({ forum: [], messages: [] });
    render(<ReportsTab password="pw" />);
    expect(await screen.findByText("No open reports. A quiet queue is the good outcome.")).toBeTruthy();
    expect(cards()).toEqual([]);
  });
});
