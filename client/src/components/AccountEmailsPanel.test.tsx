// @vitest-environment jsdom
/**
 * Your email addresses (0430): the panel shows what the server answers, sends
 * the code to the new address, attaches only through the code, and the
 * delivery choice follows the server's answer.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AccountEmailsPanel from "@/components/AccountEmailsPanel";
import type { AccountEmails } from "@shared/memberEmails";

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fetchMock = vi.fn();
let account: AccountEmails;

beforeEach(() => {
  account = { main: "lead@home.test", mainVerified: true, extras: [], delivery: "main", deliversTo: ["lead@home.test"], pending: null };
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url === "/api/me/email-addresses" && (!init?.method || init.method === "GET")) return reply(200, account);
    if (url === "/api/me/email-addresses" && init?.method === "POST") {
      if (body.email === "taken@else.test") return reply(409, { error: "That address already has its own account here." });
      return reply(200, { success: true, emailed: true, pending: { email: body.email, expiresAt: "2026-11-24T12:00:00.000Z" } });
    }
    if (url === "/api/me/email-addresses/confirm") {
      account = { ...account, extras: [{ email: "ops@village.test", verifiedAt: "2026-11-24T11:50:00.000Z", getsMail: false }], pending: null };
      return reply(200, { success: true, emails: account });
    }
    if (url === "/api/me/email-addresses/delivery") {
      account = { ...account, delivery: body.delivery, deliversTo: body.delivery === "other" ? ["ops@village.test"] : ["lead@home.test"] };
      return reply(200, { success: true, emails: account });
    }
    return reply(404, {});
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("your email addresses", () => {
  it("adds an address only through the code sent to it, then lets the member send mail there", async () => {
    render(<AccountEmailsPanel />);
    expect(await screen.findByText("lead@home.test")).toBeTruthy();
    // With no other address, only "main" can be chosen.
    expect((screen.getByLabelText("My other address only") as HTMLInputElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Add an email address"), { target: { value: "ops@village.test" } });
    fireEvent.click(screen.getByText("Send a code"));
    expect(await screen.findByText("We sent a code to ops@village.test. Enter it below.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Enter the code we sent to ops@village.test"), { target: { value: "12 34 56" } });
    fireEvent.click(screen.getByText("Confirm the code"));
    expect(await screen.findByText("ops@village.test")).toBeTruthy();
    expect(JSON.parse(String(fetchMock.mock.calls.find((c) => c[0] === "/api/me/email-addresses/confirm")![1].body))).toEqual({ code: "123456" });

    fireEvent.click(screen.getByLabelText("My other address only"));
    await waitFor(() => expect((screen.getByLabelText("My other address only") as HTMLInputElement).checked).toBe(true));
    expect(screen.getByText(/Village email goes to ops@village\.test\./)).toBeTruthy();
  });

  it("says the server's refusal in its own words and attaches nothing", async () => {
    render(<AccountEmailsPanel />);
    fireEvent.change(await screen.findByLabelText("Add an email address"), { target: { value: "taken@else.test" } });
    fireEvent.click(screen.getByText("Send a code"));
    expect(await screen.findByText("That address already has its own account here.")).toBeTruthy();
    expect(screen.queryByText("Confirm the code")).toBeNull();
  });

  it("an account whose main address is unproved is asked to confirm it first, and offered no add field", async () => {
    account = { ...account, mainVerified: false };
    render(<AccountEmailsPanel />);
    expect(await screen.findByText("Send a confirmation email")).toBeTruthy();
    expect(screen.queryByLabelText("Add an email address")).toBeNull();
  });
});
