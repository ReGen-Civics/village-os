// @vitest-environment jsdom
/**
 * REVIEW AND SAVE (the lead, 25 Nov 2026; Admin evolution). A change the guide
 * proposes is never written by the guide. Review and save puts it on the page's
 * one save bar, and a person's Save writes it through the dial's own admin
 * route, the same route and gate as a hand edit, so a dial this person may not
 * change is refused there, in the server's words, and stays on the bar. The
 * waiting change lives in the host, so closing the guide never loses it.
 * Also: /admin?helper=open opens the guide and leaves the address clean.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { resetUnsavedForTests } from "@/lib/unsavedChanges";
import AdminHelperHost from "./AdminHelperHost";
import type { NavGroup } from "./adminNavGroups";
import type { HelperAnswer } from "@shared/adminHelper";

const GROUPS = [{ title: "Today", items: [{ key: "home", label: "Home", icon: (() => null) as any }] }] as NavGroup[];
const ANSWER: HelperAnswer = {
  reply: "I can switch that for you.",
  open: null,
  proposal: { key: "feed.show_birthdays", label: "Show birthdays", category: "Feed", from: "false", to: "true", why: "", applyPath: "/api/admin/variables/feed.show_birthdays" },
  refused: null,
  consulted: [],
};

let calls: Array<{ url: string; init: any }>;
let refuse: string | null;
beforeEach(() => {
  calls = [];
  refuse = null;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: any = {}) => {
    calls.push({ url, init });
    const method = init.method ?? "GET";
    const ok = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as any;
    if (method === "GET" && url === "/api/admin/helper") return ok(200, { on: true, guide: "Maia", off: null, provider: "anthropic", available: ["anthropic"], names: { anthropic: "Maia" } });
    if (method === "POST" && url === "/api/admin/helper/ask") return ok(200, ANSWER);
    if (method === "PUT" && url === "/api/admin/variables/feed.show_birthdays") return refuse ? ok(403, { error: refuse }) : ok(200, { success: true });
    throw new Error(`unexpected ${method} ${url}`);
  }));
});
afterEach(() => {
  cleanup();
  resetUnsavedForTests();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

function Host({ startOpen = true }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)}>toggle guide</button>
      <AdminHelperHost open={open} setOpen={setOpen} password="pw" groups={GROUPS} tab="home" onOpenTab={vi.fn()} />
    </>
  );
}

const puts = () => calls.filter((c) => c.init.method === "PUT");

async function askAndReview() {
  await userEvent.type(await screen.findByRole("textbox", { name: "Your question" }), "show birthdays{Enter}");
  await userEvent.click(await screen.findByRole("button", { name: "Review and save" }));
}

describe("the guide's Review and save", () => {
  it("puts the proposal on the one save bar, sends nothing until Save, then writes it through the dial's own route", async () => {
    render(<Host />);
    await askAndReview();
    expect(await screen.findByText("1 change not saved yet")).toBeTruthy();
    expect(puts()).toEqual([]);
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].url).toBe("/api/admin/variables/feed.show_birthdays");
    expect(JSON.parse(puts()[0].init.body)).toEqual({ value: "true" });
    expect(puts()[0].init.headers.Authorization).toBe("Bearer pw");
    // Both the bar and the card say so.
    expect(await within(screen.getByTestId("helper-proposal")).findByText("Saved.")).toBeTruthy();
  });

  it("keeps a refused change on the bar in the server's words: the guide never bypasses the gate", async () => {
    refuse = "This needs a village vote";
    render(<Host />);
    await askAndReview();
    await act(async () => {
      await userEvent.click(await screen.findByRole("button", { name: "Save" }));
    });
    expect(await screen.findByText(/This needs a village vote/)).toBeTruthy();
    expect(screen.getByText("1 change not saved yet")).toBeTruthy();
  });

  it("keeps the waiting change when the guide is closed", async () => {
    render(<Host />);
    await askAndReview();
    await userEvent.click(screen.getByRole("button", { name: "toggle guide" }));
    expect(screen.queryByTestId("admin-helper")).toBeNull();
    expect(screen.getByText("1 change not saved yet")).toBeTruthy();
  });

  it("opens on /admin?helper=open and takes the word out of the address", async () => {
    window.history.replaceState({}, "", "/admin?tab=home&helper=open");
    render(<Host startOpen={false} />);
    expect(await screen.findByTestId("admin-helper")).toBeTruthy();
    expect(window.location.search).toBe("?tab=home");
  });
});
