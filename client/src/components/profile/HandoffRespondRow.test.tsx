// @vitest-environment jsdom
/**
 * A task handed to a role, as its holder and its sender see it on the profile
 * (shared/roleTaskHandoff.ts): the holder's row in Waiting on you carries
 * Accept, Suggest a change and Decline, a decline needs a reason, and the
 * sender's Sent row says where it stands. Every person and role is invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ReactNode } from "react";
import { HANDOFFS_WAITING_URL, handoffRespondUrl, type SentHandoff, type WaitingHandoff } from "@shared/roleTaskHandoff";
import { WAITING_URL } from "@shared/waitingOnYou";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import HandoffRespondRow from "./HandoffRespondRow";
import WaitingOnYou from "./WaitingOnYou";
import { SentRow } from "@/components/yourList/RoleHandoffs";

i18n.loadAndActivate({ locale: "en", messages: {} });
const wrap = (ui: ReactNode) => render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const ROW: WaitingHandoff = {
  id: "rq-00000000-0000-0000-0000-000000000001", roleId: "seat-finance", role: "Finance steward", circle: "Operations circle",
  title: "Reconcile the receipts", note: "The box is in the office.", dueOn: "2099-01-31", from: "Oona", sentOn: "2026-11-16", via: "holder", edited: false,
};

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", (url: unknown, init?: unknown) => fetchMock(String(url), init));
});
afterEach(() => vi.unstubAllGlobals());

describe("a task handed to a role the reader holds", () => {
  it("names the role, the task, the sender's first name and the note, and accepts with one press", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { status: "accepted", taskId: "mt-1" }));
    const answered = vi.fn();
    wrap(<HandoffRespondRow h={ROW} onAnswered={answered} />);
    expect(screen.getByText("For Finance steward: Reconcile the receipts")).toBeTruthy();
    expect(screen.getByText(/From Oona/)).toBeTruthy();
    expect(screen.getByText("The box is in the office.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(answered).toHaveBeenCalledWith(ROW.id, null));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(handoffRespondUrl(ROW.id));
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ action: "accept" });
  });

  it("asks for a reason before it declines, and sends it", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { status: "declined", taskId: null }));
    const answered = vi.fn();
    wrap(<HandoffRespondRow h={ROW} onAnswered={answered} />);
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    const send = screen.getByRole("button", { name: "Decline" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Why? They'll read this."), { target: { value: "That sits with the Land circle." } });
    fireEvent.click(send);
    await waitFor(() => expect(answered).toHaveBeenCalledWith(ROW.id, null));
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ action: "decline", reason: "That sits with the Land circle." });
  });

  it("sends a suggested change and keeps the row, marked changed", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { status: "waiting", taskId: null }));
    const answered = vi.fn();
    wrap(<HandoffRespondRow h={ROW} onAnswered={answered} />);
    fireEvent.click(screen.getByRole("button", { name: "Suggest a change" }));
    fireEvent.change(screen.getByLabelText("Task"), { target: { value: "Reconcile the moon's receipts" } });
    fireEvent.click(screen.getByRole("button", { name: "Send the change" }));
    await waitFor(() => expect(answered).toHaveBeenCalled());
    expect(answered.mock.calls[0][1]).toMatchObject({ title: "Reconcile the moon's receipts", edited: true });
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({ action: "suggest", title: "Reconcile the moon's receipts" });
  });

  it("says so when someone in the role answered first", async () => {
    fetchMock.mockResolvedValueOnce(reply(409, { error: "Someone in the role answered it already." }));
    wrap(<HandoffRespondRow h={ROW} onAnswered={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Someone in the role answered it already.");
  });

  it("shows in Waiting on you under its own heading, with governance closed", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === HANDOFFS_WAITING_URL ? reply(200, { waiting: [ROW] }) : url === WAITING_URL ? reply(404, { error: "not_found" }) : reply(404, {}),
    );
    wrap(<WaitingOnYou />);
    expect(await screen.findByText("Handed to your roles")).toBeTruthy();
    expect(screen.getByText("For Finance steward: Reconcile the receipts")).toBeTruthy();
  });
});

describe("what the sender sees", () => {
  const sent = (over: Partial<SentHandoff>): SentHandoff => ({
    id: "rq-00000000-0000-0000-0000-000000000002", roleId: "seat-finance", role: "Finance steward", title: "Pay the well digger",
    note: null, dueOn: null, status: "waiting", reason: null, edited: false, sentOn: "2026-11-16", ...over,
  });

  it("says where each one stands, with the reason on a decline and Take it back only while it waits", () => {
    const { rerender } = wrap(<SentRow h={sent({})} onChanged={vi.fn()} />);
    expect(screen.getByText("Waiting for Finance steward")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Take it back" })).toBeTruthy();
    rerender(<I18nProvider i18n={i18n}><SentRow h={sent({ status: "accepted" })} onChanged={vi.fn()} /></I18nProvider>);
    expect(screen.getByText("Accepted by Finance steward")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Take it back" })).toBeNull();
    rerender(<I18nProvider i18n={i18n}><SentRow h={sent({ status: "declined", reason: "That sits with the Land circle." })} onChanged={vi.fn()} /></I18nProvider>);
    expect(screen.getByText("Declined by Finance steward")).toBeTruthy();
    expect(screen.getByText("Why: That sits with the Land circle.")).toBeTruthy();
    rerender(<I18nProvider i18n={i18n}><SentRow h={sent({ status: "done" })} onChanged={vi.fn()} /></I18nProvider>);
    expect(screen.getByText("Done by Finance steward")).toBeTruthy();
  });
});
