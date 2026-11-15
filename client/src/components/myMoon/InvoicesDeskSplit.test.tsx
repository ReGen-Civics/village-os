// @vitest-environment jsdom
/**
 * THE TREASURER CONFIRMS A SPLIT (Rye, 14 Nov 2026, answer A). An invoice whose
 * pay lines were scaled by the member's split of their time shows, for each
 * scaled line, the base pay, the share and the scaled amount, and a button to
 * confirm them. Confirm posts to the confirm-split door. A confirmed invoice,
 * or one the split never touched, shows no button.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MOON_ROUTES, SPLIT_PAY_WORDS, type InvoiceLine, type LineSplit } from "@shared/moonRecap";
import { InvoicesDeskView } from "./InvoicesDesk";
import type { QueueData, QueueRowView } from "./moonApi";
import { invoice, item } from "./myMoon.fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const line = (key: string, role: string, split: LineSplit | undefined): InvoiceLine => ({
  key, applicationId: key, firstSeatId: `seat-${key}`, kind: "pay", roleIds: [role], roleNames: [role], basis: "per_moon", listedAs: null,
  currency: "USD", termsMinor: 100000, per: "moon", range: null, proposedMinor: null, finalMinor: null, daysInMoon: 30, daysHeld: 30,
  amountMinor: split ? split.scaledMinor : 100000, basisLine: "per moon", approvedItemIds: [], cashOwedId: null, held: false, split,
});
const SPLIT = (sharePct: number, confirmedAt: string | null = null): LineSplit => ({ sharePct, baseMinor: 100000, scaledMinor: sharePct * 1000, confirmedBy: confirmedAt ? "m-fin" : null, confirmedAt });

function row(lines: InvoiceLine[]): QueueRowView {
  return {
    recapId: "mr-1", userId: "m-wren", name: "Wren", status: "waiting", waitingOn: "invoice", dueOn: null, selfApproved: false,
    workApprovers: ["Ops holder"], invoiceApprovers: ["Finance holder"], roles: [{ roleId: "Hosting", name: "Hosting", itemCount: 1 }], outsideMyRoles: 0,
    hash: "h".repeat(64), items: [item()],
    invoice: { ...invoice({ id: "mv-1", status: "waiting", statusLine: "Waiting on Finance", lines, totalMinor: 100000 }), routeCheck: null, taxFormValid: true, authorityNote: null, queueNote: null, hash: "h".repeat(64) },
  } as unknown as QueueRowView;
}
const data = (rows: QueueRowView[]): QueueData => ({
  moon: { cycleId: "lunar-2026-10", firstDay: "2026-10-10", lastDay: "2026-11-08", periodWords: "10 October to 8 November 2026", endOfMoonFriday: "2026-11-05", sendBy: "2026-11-09", halfwayDay: "2026-10-25" },
  rows, rolesWithNoItems: [], noEligible: [],
} as unknown as QueueData);

describe("the Finance desk and a member's split", () => {
  it("shows base, share and scaled for each scaled line, and confirms through the confirm-split door", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ confirmed: "mv-1" }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const reload = vi.fn(async () => undefined);
    render(<InvoicesDeskView data={data([row([line("app-1", "Hosting", SPLIT(60)), line("app-2", "Garden", SPLIT(40))])])} init={{}} reload={reload} />);

    const box = screen.getByTestId("split-confirm");
    expect(box.textContent).toContain(SPLIT_PAY_WORDS.base);
    expect(box.textContent).toContain("60%");
    expect(box.textContent).toContain("40%");
    expect(box.textContent).toContain("600.00");
    expect(box.textContent).toContain(SPLIT_PAY_WORDS.waiting);

    fireEvent.click(screen.getByRole("button", { name: SPLIT_PAY_WORDS.confirm }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain(MOON_ROUTES.confirmSplit.replace(":id", "mv-1"));
  });

  it("offers no confirm once the split is confirmed, or when no line was scaled", () => {
    render(<InvoicesDeskView data={data([row([line("app-1", "Hosting", SPLIT(60, "2026-11-14T10:00:00Z")), line("app-2", "Garden", SPLIT(40, "2026-11-14T10:00:00Z"))])])} init={{}} reload={async () => undefined} />);
    expect(screen.queryByTestId("split-confirm")).toBeNull();
    cleanup();
    render(<InvoicesDeskView data={data([row([line("app-1", "Hosting", undefined)])])} init={{}} reload={async () => undefined} />);
    expect(screen.queryByTestId("split-confirm")).toBeNull();
  });
});
