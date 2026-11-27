// @vitest-environment jsdom
/**
 * The approval inbox (role journey L13). Pinned:
 *   1. A card says who proposed it and shows the before and after.
 *   2. Approve and Decline post to that proposal's own door; nothing is posted by opening the inbox.
 *   3. Several can be ticked and approved together in one request.
 *   4. A refusal from the route is shown as the route said it.
 *   5. A person the inbox is not for is told so, and a failed read says so.
 *   6. An approved card that can be put back offers it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ApprovalInbox from "./ApprovalInbox";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  toast.success.mockClear();
  toast.error.mockClear();
});

const A = { id: "prop_a", kind: "setting", title: "Set Start after open to 14", by: "Ana", at: "2026-12-01T10:00:00.000Z", expiresAt: "2026-12-08T10:00:00.000Z", words: { what: "Start after open", before: "7", after: "14" }, canRevert: true, decision: null, state: "waiting" };
const B = { ...A, id: "prop_b", title: "Change the words on home", words: { what: "Page words: home", before: "Welcome home", after: "Welcome back" } };
const DONE = { ...A, id: "prop_c", title: "Public proposals for this moon", state: "approved", decision: { state: "approved", by: "u1", at: "2026-12-02T10:00:00.000Z" } };

function stub(opts: { status?: number; waiting?: unknown[]; postStatus?: number; postBody?: unknown } = {}) {
  const calls: Array<{ url: string; method: string; body: any }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url: String(url), method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (method === "GET") return { ok: (opts.status ?? 200) === 200, status: opts.status ?? 200, json: async () => ({ waiting: opts.waiting ?? [A, B], decided: [DONE] }) };
    return { ok: (opts.postStatus ?? 200) < 300, status: opts.postStatus ?? 200, json: async () => opts.postBody ?? { success: true } };
  }));
  return calls;
}

describe("the approval inbox", () => {
  it("shows who, the before and the after, and posts nothing by opening", async () => {
    const calls = stub();
    render(<ApprovalInbox headers={() => ({})} />);
    expect(await screen.findByText("Set Start after open to 14")).toBeTruthy();
    expect(screen.getAllByText(/Proposed by Ana/)).toHaveLength(2);
    expect(screen.getByText("Welcome back")).toBeTruthy();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("approves and declines one through its own door", async () => {
    const calls = stub();
    render(<ApprovalInbox headers={() => ({})} />);
    await screen.findByText("Set Start after open to 14");
    const card = screen.getByTestId("inbox-prop_a");
    fireEvent.click(card.querySelectorAll("button")[0]);
    await waitFor(() => expect(calls.some((c) => c.url === "/api/approval-inbox/prop_a/approve")).toBe(true));
    fireEvent.click(screen.getByTestId("inbox-prop_b").querySelectorAll("button")[1]);
    await waitFor(() => expect(calls.some((c) => c.url === "/api/approval-inbox/prop_b/decline")).toBe(true));
  });

  it("approves the ticked ones together in one request", async () => {
    const calls = stub({ postBody: { results: [{ id: "prop_a", ok: true }, { id: "prop_b", ok: true }] } });
    render(<ApprovalInbox headers={() => ({})} />);
    await screen.findByText("Set Start after open to 14");
    fireEvent.click(screen.getByLabelText("Set Start after open to 14"));
    fireEvent.click(screen.getByLabelText("Change the words on home"));
    fireEvent.click(screen.getByText(/Approve 2 selected/));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/approval-inbox/approve-batch")).toBe(true));
    expect(calls.find((c) => c.url.endsWith("approve-batch"))?.body.ids).toEqual(["prop_a", "prop_b"]);
  });

  it("shows the route's own refusal", async () => {
    stub({ postStatus: 409, postBody: { message: "That needs a power you do not hold." } });
    render(<ApprovalInbox headers={() => ({})} />);
    await screen.findByText("Set Start after open to 14");
    fireEvent.click(screen.getByTestId("inbox-prop_a").querySelectorAll("button")[0]);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("That needs a power you do not hold."));
  });

  it("offers to put an approved one back", async () => {
    const calls = stub();
    render(<ApprovalInbox headers={() => ({})} />);
    fireEvent.click(await screen.findByText("Put it back"));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/approval-inbox/prop_c/revert")).toBe(true));
  });

  it("tells a person it is not for them, and says when the read fails", async () => {
    stub({ status: 401 });
    const { unmount } = render(<ApprovalInbox headers={() => ({})} />);
    expect(await screen.findByTestId("inbox-refused")).toBeTruthy();
    unmount();
    stub({ status: 500 });
    render(<ApprovalInbox headers={() => ({})} />);
    expect(await screen.findByTestId("inbox-failed")).toBeTruthy();
  });

  it("reads oldest first, by arrival alone, whatever order the server sends (decider calm)", async () => {
    const newer = { ...A, id: "prop_new", title: "The newer one", at: "2026-12-05T10:00:00.000Z" };
    const older = { ...A, id: "prop_old", title: "The older one", at: "2026-11-20T10:00:00.000Z" };
    stub({ waiting: [newer, older] });
    render(<ApprovalInbox headers={() => ({})} />);
    const first = await screen.findByText("The older one");
    const second = screen.getByText("The newer one");
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("closes a seating already made by hand through its own route, and names it Done by hand", async () => {
    const seat = { ...A, id: "prop_s", kind: "seating", title: "Seat Ana in Kitchen from 2026-12-01", canRevert: false };
    const done = { ...seat, id: "prop_t", title: "Seat Bo in Water", state: "taken", decision: null };
    const calls: Array<{ url: string; method: string; body: any }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url: String(url), method, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (method === "GET") return { ok: true, status: 200, json: async () => ({ waiting: [seat, B], decided: [done] }) };
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    }));
    render(<ApprovalInbox headers={() => ({})} />);
    await screen.findByText("Seat Ana in Kitchen from 2026-12-01");
    // Only a seating offers it.
    expect(screen.getAllByRole("button", { name: "Already seated by hand" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Already seated by hand" }));
    await waitFor(() => expect(calls.some((c) => c.url === "/api/agent-proposals/prop_s/resolve")).toBe(true));
    expect(calls.find((c) => c.url.endsWith("/resolve"))).toMatchObject({ method: "POST", body: { status: "taken" } });
    // Nothing was approved or declined on the way.
    expect(calls.some((c) => c.url.includes("/api/approval-inbox/prop_s/"))).toBe(false);
    expect(within(screen.getByTestId("decided-prop_t")).getByText("Done by hand")).toBeTruthy();
  });

  it("shows a connector role change's count and its draft, and offers no Approve for an empty draft", async () => {
    const full = { ...A, id: "draft:d1", kind: "role_change", title: "Kitchen Steward, new words", at: null, expiresAt: null, changes: 2 };
    const empty = { ...full, id: "draft:d2", title: "Asks on the Water role", changes: 0 };
    stub({ waiting: [full, empty] });
    render(<ApprovalInbox headers={() => ({})} />);
    await screen.findByText("Kitchen Steward, new words");
    const one = screen.getByTestId("inbox-draft:d1");
    expect(within(one).getByTestId("draft-changes-draft:d1").textContent).toBe("2 changes");
    expect(within(one).getByRole("link", { name: /Read the draft/ }).getAttribute("href")).toBe("/governance/decisions/drafts/d1");
    expect(within(one).getByRole("button", { name: "Approve" })).toBeTruthy();
    const two = screen.getByTestId("inbox-draft:d2");
    expect(within(two).queryByRole("button", { name: "Approve" })).toBeNull();
    expect(within(two).getByRole("button", { name: "Decline" })).toBeTruthy();
  });

  it("lights one gold act: a card's Approve is edged when several wait, gold when it is the only one", async () => {
    stub();
    const { unmount } = render(<ApprovalInbox headers={() => ({})} />);
    await screen.findByText("Set Start after open to 14");
    for (const b of screen.getAllByRole("button", { name: "Approve" })) expect(b.className).toContain("border-notice");
    unmount();
    stub({ waiting: [A] });
    render(<ApprovalInbox headers={() => ({})} />);
    await screen.findByText("Set Start after open to 14");
    expect(screen.getByRole("button", { name: "Approve" }).className).toContain("bg-notice");
  });
});
