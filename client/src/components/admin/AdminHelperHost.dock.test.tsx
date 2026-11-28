// @vitest-environment jsdom
/**
 * WHICH SURFACE THE HOST MOUNTS (AdminHelperHost.tsx). The village's dial
 * `platform.admin_guide_dock` ships off, and off is the helper panel exactly as
 * it was. On, the guide's dock takes its place, with the same shortcut, the
 * same `?helper=open`, and the same one save bar.
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
const STATUS = { on: true, guide: "Sol", off: null, provider: "anthropic", available: ["anthropic"], names: { anthropic: "Sol" } };
const ANSWER: HelperAnswer = {
  reply: "I can switch that for you.",
  open: null,
  proposal: { key: "feed.show_birthdays", label: "Show birthdays", category: "Feed", from: "false", to: "true", why: "", applyPath: "/api/admin/variables/feed.show_birthdays" },
  refused: null,
  consulted: [],
};

let calls: Array<{ url: string; method: string; init: any }>;
let dockDial: boolean;
beforeEach(() => {
  calls = [];
  dockDial = false;
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: any = {}) => {
    const method = init.method ?? "GET";
    calls.push({ url, method, init });
    const ok = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as any;
    if (method === "GET" && url === "/api/admin/helper") return ok(200, dockDial ? { ...STATUS, dock: true } : STATUS);
    if (method === "POST" && url === "/api/admin/helper/ask") return ok(200, ANSWER);
    if (method === "PUT" && url === "/api/admin/variables/feed.show_birthdays") return ok(200, { success: true });
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

const statusReads = () => calls.filter((c) => c.method === "GET" && c.url === "/api/admin/helper").length;

describe("the dial off", () => {
  it("mounts the helper panel, exactly as before, and leaves no trace of the dock", async () => {
    render(<Host />);
    const panel = await screen.findByTestId("admin-helper");
    // The panel's own words and its own answerer line, which the dock does not use.
    expect(await within(panel).findByText("Answers come from Claude, on your village's own Anthropic key.")).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Close the helper" })).toBeTruthy();
    expect(screen.queryByTestId("guide-dock")).toBeNull();
    expect(screen.queryByRole("group", { name: "Suggested next steps" })).toBeNull();
    // One read of the status, the panel's own, and nothing remembered about a dock.
    expect(statusReads()).toBe(1);
    expect(Object.keys(localStorage).filter((k) => k.startsWith("guide-dock"))).toEqual([]);
  });

  it("reads the status afresh on every open, as it always did", async () => {
    render(<Host />);
    await screen.findByText("Answers come from Claude, on your village's own Anthropic key.");
    await userEvent.click(screen.getByRole("button", { name: "toggle guide" }));
    await userEvent.click(screen.getByRole("button", { name: "toggle guide" }));
    await screen.findByText("Answers come from Claude, on your village's own Anthropic key.");
    expect(statusReads()).toBe(2);
    expect(screen.queryByTestId("guide-dock")).toBeNull();
  });
});

describe("the dial on", () => {
  beforeEach(() => {
    dockDial = true;
  });

  it("puts the guide's dock in the panel's place, on the status the panel already read", async () => {
    render(<Host />);
    const dock = await screen.findByTestId("guide-dock");
    expect(screen.queryByTestId("admin-helper")).toBeNull();
    expect(within(dock).getByRole("heading", { name: "Sol" })).toBeTruthy();
    expect(within(dock).getByRole("group", { name: "Suggested next steps" })).toBeTruthy();
    // Beside Admin it offers the helper and the organizing guide.
    expect(within(dock).getByRole("button", { name: "Admin" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(dock).getByRole("button", { name: "Organizing" })).toBeTruthy();
    expect(statusReads()).toBe(1);
    expect(localStorage.getItem("guide-dock:on")).toBe("1");
  });

  it("goes straight to the dock the next time, and the shortcut still toggles it", async () => {
    localStorage.setItem("guide-dock:on", "1");
    render(<Host startOpen={false} />);
    expect(screen.queryByTestId("guide-dock")).toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", ctrlKey: true }));
    });
    expect(await screen.findByTestId("guide-dock")).toBeTruthy();
    expect(screen.queryByTestId("admin-helper")).toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", ctrlKey: true }));
    });
    await waitFor(() => expect(screen.queryByTestId("guide-dock")).toBeNull());
  });

  it("opens on /admin?helper=open and takes the word out of the address", async () => {
    localStorage.setItem("guide-dock:on", "1");
    window.history.replaceState({}, "", "/admin?tab=home&helper=open");
    render(<Host startOpen={false} />);
    expect(await screen.findByTestId("guide-dock")).toBeTruthy();
    expect(window.location.search).toBe("?tab=home");
  });

  it("keeps the one save bar: Review and save in the dock waits there, and only a person's Save writes it", async () => {
    render(<Host />);
    const dock = await screen.findByTestId("guide-dock");
    await userEvent.type(within(dock).getByRole("textbox", { name: "Your question" }), "show birthdays{Enter}");
    await userEvent.click(await within(dock).findByRole("button", { name: "Review and save" }));
    expect(await screen.findByText("1 change not saved yet")).toBeTruthy();
    expect(calls.filter((c) => c.method === "PUT")).toEqual([]);
    // Closing the dock keeps the waiting change, and opening it wide lists it under Say yes.
    await userEvent.click(screen.getByRole("button", { name: "toggle guide" }));
    expect(screen.getByText("1 change not saved yet")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "toggle guide" }));
    await userEvent.click(await screen.findByRole("button", { name: "Open the guide wide" }));
    expect(within(screen.getByRole("region", { name: "Say yes" })).getByText("Show birthdays")).toBeTruthy();
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    await waitFor(() => expect(calls.filter((c) => c.method === "PUT")).toHaveLength(1));
    expect(calls.find((c) => c.method === "PUT")!.url).toBe("/api/admin/variables/feed.show_birthdays");
  });
});

describe("the dial turned off again", () => {
  it("gives the panel back: the dock reads the status too, and this browser forgets its hint", async () => {
    localStorage.setItem("guide-dock:on", "1");
    dockDial = false;
    render(<Host />);
    expect(await screen.findByTestId("admin-helper")).toBeTruthy();
    expect(screen.queryByTestId("guide-dock")).toBeNull();
    expect(localStorage.getItem("guide-dock:on")).toBe("0");
    expect(statusReads()).toBe(1);
  });
});
