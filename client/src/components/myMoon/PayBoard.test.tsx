// @vitest-environment jsdom
/**
 * THE TREASURER'S PAY BOARD AND THE MEMBER'S TOKEN PAY (Rye, 15 Nov 2026).
 *
 *   board    per member: cash owed against sent, each line's status, the
 *            transfer's reference once sent from escrow; the token lines with
 *            a change's reason and the member's answer
 *   review   a waiting line carries a checkbox and a Change button for a
 *            reviewer, and Approve posts the picked keys; a viewer who may not
 *            review sees neither
 *   launch   before launch the board says approved pay issues at launch
 *   member   the member reads a changed line's reason and answers it once
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PAY_BOARD_ROUTES, type PayBoard, type PayBoardTokenLine } from "@shared/moonRewardReview";
import { PayBoardView } from "./PayBoard";
import MyTokenPay from "./MyTokenPay";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const token = (over: Partial<PayBoardTokenLine> = {}): PayBoardTokenLine => ({
  key: "k-1", title: "Water keeper, October moon", token: "earned-equity", sharedUnits: 2600, units: 2600, ceiling: 7800,
  status: "waiting", review: "waiting", change: null, approvedBy: null, approvedAt: null, approvedAlone: false, memberReply: null,
  refusal: null, noApprover: false, createdAt: "2026-11-10T12:00:00.000Z", ...over,
});

const board = (over: Partial<PayBoard> = {}, tokens: PayBoardTokenLine[] = [token()]): PayBoard => ({
  month: "2026-11", launched: true, mayReview: true, viewerId: "m-treas", truncated: false,
  members: [{
    userId: "m-wren", name: "Wren",
    cash: [
      { id: "c-1", title: "Water keeper", workKind: "role", amountMinor: 390_000, currency: "USD", status: "sent", owedAt: "2026-11-10T12:00:00.000Z", claimedAt: null, sentAt: "2026-11-12T12:00:00.000Z", sentBy: "Treas", reference: "Bank transfer on 2026-11-12, reference ESCROW-77" },
      { id: "c-2", title: "Garden quest", workKind: "quest", amountMinor: 5_000, currency: "USD", status: "claimed", owedAt: "2026-11-11T12:00:00.000Z", claimedAt: "2026-11-11T12:00:00.000Z", sentAt: null, sentBy: null, reference: null },
    ],
    tokens,
    cashTotals: [{ currency: "USD", owedMinor: 5_000, sentMinor: 390_000 }],
    tokenTotals: [{ token: "earned-equity", waiting: 2600, approved: 0, issued: 0 }],
  }],
  ...over,
});

describe("the Treasurer's pay board", () => {
  it("reads each member's cash owed against sent, with the reference once it went out from escrow", () => {
    render(<PayBoardView board={board()} init={{}} reload={async () => undefined} />);
    expect(screen.getByTestId("cash-totals").textContent).toContain("Owed $50.00, sent $3,900.00");
    const lines = screen.getAllByTestId("cash-line");
    expect(lines[0].textContent).toContain("Sent from escrow");
    expect(lines[0].textContent).toContain("ESCROW-77");
    expect(lines[0].textContent).toContain("by Treas");
    expect(lines[1].textContent).toContain("Claimed, ready to send");
    expect(screen.getByTestId("token-totals").textContent).toContain("Earned Equity: 2,600 waiting, 0 approved, 0 issued");
  });

  it("lets a reviewer pick a waiting line and approve it through the approve door", async () => {
    const fetchMock = vi.fn(async () => json({ approved: [{ key: "k-1", outcome: "issued" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const reload = vi.fn(async () => undefined);
    render(<PayBoardView board={board()} init={{}} reload={reload} />);
    const approve = screen.getByRole("button", { name: "Approve and issue selected" });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Earned Equity, Water keeper, October moon" }));
    fireEvent.click(approve);
    await waitFor(() => expect(reload).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(PAY_BOARD_ROUTES.approve);
    expect(JSON.parse(String(init.body))).toEqual({ keys: ["k-1"] });
    expect(screen.getByRole("status").textContent).toBe("Approved and issued.");
  });

  it("changes a line with a new amount and a reason through the adjust door", async () => {
    const fetchMock = vi.fn(async () => json({ key: "k-1", units: 3000 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PayBoardView board={board()} init={{}} reload={async () => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Change the amount" }));
    const form = screen.getByTestId("token-change-form");
    expect(form.textContent).toContain("at most 7,800");
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "3000" } });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A bonus for the filter rebuild." } });
    fireEvent.click(screen.getByRole("button", { name: "Save the change" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(PAY_BOARD_ROUTES.adjust);
    expect(JSON.parse(String(init.body))).toEqual({ key: "k-1", units: "3000", reason: "A bonus for the filter rebuild." });
  });

  it("shows a change's reason, the member's answer and a marked self-approval", () => {
    const changed = token({ units: 3000, status: "issued", review: "approved", change: { by: "Fin", reason: "A bonus.", at: null }, memberReply: { text: "Thank you.", at: null }, approvedBy: "Fin", approvedAlone: true });
    render(<PayBoardView board={board({}, [changed])} init={{}} reload={async () => undefined} />);
    const line = screen.getByTestId("token-line").textContent ?? "";
    expect(line).toContain("3,000 Earned Equity, changed from 2,600");
    expect(line).toContain("Changed by Fin: A bonus.");
    expect(line).toContain("Their answer: Thank you.");
    expect(line).toContain("who changed it and was the only one who could");
    expect(line).toContain("Issued to their account");
  });

  it("shows no checkbox and no change to a viewer who may not review, and says approved pay issues at launch before it", () => {
    render(<PayBoardView board={board({ mayReview: false, launched: false })} init={{}} reload={async () => undefined} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Change the amount" })).toBeNull();
    expect(screen.getByText(/Approved token pay issues to each account at launch/)).toBeTruthy();
  });
});

describe("when the board cannot do its whole job", () => {
  it("names the fallback on a line only its own member could approve, and says when a month's list is cut", () => {
    render(<PayBoardView board={board({ truncated: true }, [token({ noApprover: true })])} init={{}} reload={async () => undefined} />);
    expect(screen.getByTestId("no-approver").textContent).toContain("The stewards can seat another Treasurer");
    expect(screen.getByRole("status").textContent).toContain("The first 2,000 lines of each kind are here.");
  });
});

describe("the member's own token pay", () => {
  it("reads a changed line's reason and sends an answer once", async () => {
    const changed = token({ units: 3000, change: { by: "Fin", reason: "A bonus for the filter rebuild.", at: null } });
    const fetchMock = vi.fn(async (url: string) => (String(url).includes(PAY_BOARD_ROUTES.reply) ? json({ key: "k-1" }) : json({ launched: false, lines: [changed] })));
    vi.stubGlobal("fetch", fetchMock);
    render(<MyTokenPay />);
    const line = await screen.findByTestId("my-token-line");
    expect(line.textContent).toContain("3,000 Earned Equity, changed from 2,600");
    expect(line.textContent).toContain("Why it changed: A bonus for the filter rebuild.");
    expect(line.textContent).toContain("Waiting for the Treasurer's approval");
    expect(screen.getByText(/Approved lines issue to your account when the village launches/)).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Thank you." } });
    fireEvent.click(screen.getByRole("button", { name: "Send your answer" }));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).includes(PAY_BOARD_ROUTES.reply))).toBe(true));
    const reply = fetchMock.mock.calls.find((c) => String(c[0]).includes(PAY_BOARD_ROUTES.reply)) as unknown as [string, RequestInit];
    expect(JSON.parse(String(reply[1].body))).toEqual({ key: "k-1", text: "Thank you." });
  });

  it("draws nothing for a member with no token pay", async () => {
    const fetchMock = vi.fn(async () => json({ launched: true, lines: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<MyTokenPay />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });
});
