// @vitest-environment jsdom
/**
 * AGREED AND DELIVERED ON THE FINANCE DESK (Rye, 14 Nov 2026). The Treasurer
 * reads the member's counts, the sentence and the far-off flag; proposes a
 * different amount with a reason through the adjust door; and confirms a
 * re-sent proposal with the same Confirm as a split. The member reads the
 * same block on their own invoice and can reply before sending again.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MOON_ROUTES, type InvoiceLine } from "@shared/moonRecap";
import { ACCOMPLISHED_WORDS, accomplishedComparison, type LineAdjust } from "@shared/accomplishedReview";
import { InvoicesDeskView } from "./InvoicesDesk";
import InvoicePanel from "./InvoicePanel";
import type { QueueData, QueueRowView } from "./moonApi";
import { invoice, item, myMoon } from "./myMoon.fixture";
import { minorOf } from "./AccomplishedBlock";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ADJ = (confirmedAt: string | null = null): LineAdjust => ({
  baseMinor: 100000, adjustedMinor: 125000, reason: "Covered the kitchen for two weeks.", proposedBy: "m-fin", proposedAt: "2026-11-20T10:00:00Z",
  reply: "Thank you, it took most of a week.", confirmedBy: confirmedAt ? "m-treas" : null, confirmedAt,
});
const line = (adjust?: LineAdjust): InvoiceLine => ({
  key: "app-1", applicationId: "app-1", firstSeatId: "seat-1", kind: "pay", roleIds: ["r-host"], roleNames: ["Hosting"], basis: "per_moon", listedAs: null,
  currency: "USD", termsMinor: 100000, per: "moon", range: null, proposedMinor: null, finalMinor: null, daysInMoon: 30, daysHeld: 30,
  amountMinor: adjust ? adjust.adjustedMinor : 100000, basisLine: "per moon", approvedItemIds: [], cashOwedId: null, held: false, adjust,
});
const view = (lines: InvoiceLine[]) => accomplishedComparison({
  lines, roles: [{ roleId: "r-host", name: "Hosting" }], farOffPct: 25,
  goals: [{ status: "done" }, { status: "carried" }, { status: "carried" }],
  items: [{ state: "kept", taskStatus: "done", roleId: "r-host" }, { state: "kept", taskStatus: "done", roleId: null }],
});

function row(lines: InvoiceLine[]): QueueRowView {
  return {
    recapId: "mr-1", userId: "m-wren", name: "Wren", status: "waiting", waitingOn: "invoice", dueOn: null, selfApproved: false,
    workApprovers: ["Ops holder"], invoiceApprovers: ["Finance holder"], roles: [{ roleId: "r-host", name: "Hosting", itemCount: 1 }], outsideMyRoles: 1,
    hash: "h".repeat(64), items: [item()],
    invoice: { ...invoice({ id: "mv-1", status: "waiting", statusLine: "Waiting on Finance", lines, totalMinor: lines[0].amountMinor }), accomplished: view(lines), routeCheck: null, taxFormValid: true, authorityNote: null, queueNote: null, hash: "h".repeat(64) },
  } as unknown as QueueRowView;
}
const data = (rows: QueueRowView[]): QueueData => ({
  moon: { cycleId: "lunar-2026-10", firstDay: "2026-10-10", lastDay: "2026-11-08", periodWords: "10 October to 8 November 2026", endOfMoonFriday: "2026-11-05", sendBy: "2026-11-09", halfwayDay: "2026-10-25" },
  rows, rolesWithNoItems: [], noEligible: [],
} as unknown as QueueData);
const ok = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));

describe("the Finance desk: agreed and delivered", () => {
  it("shows the counts, the sentence and the far-off flag", () => {
    render(<InvoicesDeskView data={data([row([line()])])} init={{}} reload={async () => undefined} />);
    const box = screen.getByTestId("accomplished");
    expect(box.textContent).toContain(ACCOMPLISHED_WORDS.heading);
    expect(screen.getByTestId("accomplished-sentence").textContent).toBe("Agreed: US$1,000 for 3 goals. Delivered: 1 of 3 goals done, plus 2 other tasks (1 outside your roles).");
    expect(screen.getByTestId("far-off").textContent).toContain(ACCOMPLISHED_WORDS.under(75));
    expect(screen.getByTestId("far-off").textContent).toContain(ACCOMPLISHED_WORDS.over(1, 2));
  });

  it("sends a proposal with an amount and a reason to the adjust door", async () => {
    const fetchMock = ok({ voided: "mv-1" });
    vi.stubGlobal("fetch", fetchMock);
    const reload = vi.fn(async () => undefined);
    render(<InvoicesDeskView data={data([row([line()])])} init={{}} reload={reload} />);
    fireEvent.click(screen.getByRole("button", { name: ACCOMPLISHED_WORDS.propose }));
    const form = screen.getByTestId("propose-amount");
    const [amount, reason] = [form.querySelector("input")!, form.querySelector("textarea")!];
    fireEvent.change(amount, { target: { value: "1,250.00" } });
    fireEvent.change(reason, { target: { value: "Covered the kitchen for two weeks." } });
    fireEvent.click(screen.getByRole("button", { name: ACCOMPLISHED_WORDS.send }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toContain(MOON_ROUTES.adjustPay.replace(":id", "mv-1"));
    expect(JSON.parse(String(init.body))).toEqual({ applicationId: "app-1", amountMinor: 125000, reason: "Covered the kitchen for two weeks." });
  });

  it("confirms a re-sent proposal with the one Confirm, and shows the member's reply first", async () => {
    const fetchMock = ok({ confirmed: "mv-1" });
    vi.stubGlobal("fetch", fetchMock);
    const reload = vi.fn(async () => undefined);
    render(<InvoicesDeskView data={data([row([line(ADJ())])])} init={{}} reload={reload} />);
    const box = screen.getByTestId("split-confirm");
    expect(box.textContent).toContain(ACCOMPLISHED_WORDS.confirmHint);
    expect(box.textContent).toContain("Thank you, it took most of a week.");
    expect(box.textContent).toContain(ACCOMPLISHED_WORDS.waiting);
    fireEvent.click(screen.getByRole("button", { name: ACCOMPLISHED_WORDS.confirm }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain(MOON_ROUTES.confirmSplit.replace(":id", "mv-1"));
  });

  it("offers no confirm once the proposal is confirmed", () => {
    render(<InvoicesDeskView data={data([row([line(ADJ("2026-11-21T10:00:00Z"))])])} init={{}} reload={async () => undefined} />);
    expect(screen.queryByTestId("split-confirm")).toBeNull();
  });
});

describe("the member's own invoice", () => {
  it("shows the same block, the proposal and its reason, and a place to reply before sending again", () => {
    const lines = [line({ ...ADJ(), reply: null })];
    const inv = { ...invoice({ status: "draft", lines, totalMinor: 125000 }), accomplished: view(lines) };
    render(<InvoicePanel data={myMoon({ invoice: inv as any })} cycleId="lunar-2026-10" editable reload={async () => undefined} />);
    expect(screen.getByTestId("accomplished")).toBeTruthy();
    expect(screen.getByTestId("line-adjust").textContent).toContain("Covered the kitchen for two weeks.");
    expect(screen.getByTestId("adjust-reply")).toBeTruthy();
  });
});

describe("reading a typed amount", () => {
  it("turns a figure into minor units and refuses anything else", () => {
    expect(minorOf("1,250.50", "USD")).toBe(125050);
    expect(minorOf("1250", "USD")).toBe(125000);
    expect(minorOf("12.345", "USD")).toBeNull();
    expect(minorOf("abc", "USD")).toBeNull();
    expect(minorOf("-5", "USD")).toBeNull();
  });
});
