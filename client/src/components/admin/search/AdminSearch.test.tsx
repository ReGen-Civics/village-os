// @vitest-environment jsdom
/**
 * Admin search (PR 3): the lead's sentence as a test. Type "mail settings",
 * press Enter, and the address is Mail settings with Send me a test named as
 * the control to focus. Also: the keys that open it, that it never acts, and
 * that it offers only what the gate let through.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CONTROL_ENTRIES, OUTSIDE_ENTRIES } from "@shared/adminSearch";
import { navGroups } from "../adminNavGroups";
import AdminSearch from "./AdminSearch";
import { RECENT_KEY } from "./adminSearchModel";

const GROUPS = navGroups(true);
let served: unknown[];
let calls: Array<{ url: string; method: string }>;
let pops: number;

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/admin?tab=home");
  served = [...CONTROL_ENTRIES, ...OUTSIDE_ENTRIES];
  calls = [];
  pops = 0;
  window.addEventListener("popstate", countPop);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init?: any) => {
      calls.push({ url: String(url), method: String(init?.method ?? "GET") });
      return { ok: true, status: 200, json: async () => ({ entries: served }) };
    }),
  );
});
afterEach(() => {
  cleanup();
  window.removeEventListener("popstate", countPop);
  vi.unstubAllGlobals();
});
function countPop() {
  pops += 1;
}

const open = async () => {
  await userEvent.click(screen.getByRole("button", { name: "Search Admin" }));
  return screen.getByRole("dialog", { name: "Search Admin" });
};

describe("Admin search", () => {
  it("'mail settings' then Enter lands on Mail settings with Send me a test as the control to focus", async () => {
    render(<AdminSearch password="pw" groups={GROUPS} />);
    const dialog = await open();
    await userEvent.type(within(dialog).getByRole("combobox"), "mail settings");
    await waitFor(() => expect(within(dialog).getAllByRole("option")[0].textContent).toContain("Settings"));
    await userEvent.keyboard("{Enter}");
    expect(window.location.pathname + window.location.search).toBe("/admin?tab=comms-settings&setting=comms.test-email");
    expect(pops).toBe(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("'send me a test' finds the button itself first", async () => {
    render(<AdminSearch password="pw" groups={GROUPS} />);
    const dialog = await open();
    await userEvent.type(within(dialog).getByRole("combobox"), "send me a test");
    await waitFor(() => expect(within(dialog).getAllByRole("option")[0].textContent).toContain("Send me a test email"));
  });

  it("opens on / and on Ctrl K, and not on / typed into a field", async () => {
    render(
      <>
        <input aria-label="elsewhere" />
        <AdminSearch password="pw" groups={GROUPS} />
      </>,
    );
    await userEvent.type(screen.getByLabelText("elsewhere"), "/");
    expect(screen.queryByRole("dialog")).toBeNull();
    (document.activeElement as HTMLElement).blur();
    await userEvent.keyboard("/");
    expect(screen.getByRole("dialog", { name: "Search Admin" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("dialog", { name: "Search Admin" })).toBeTruthy();
  });

  it("never acts: the only request it makes is the index read", async () => {
    render(<AdminSearch password="pw" groups={GROUPS} />);
    const dialog = await open();
    await userEvent.type(within(dialog).getByRole("combobox"), "pause email");
    await waitFor(() => expect(within(dialog).getAllByRole("option").length).toBeGreaterThan(0));
    await userEvent.keyboard("{Enter}");
    expect(calls.every((c) => c.method === "GET" && c.url.endsWith("/admin/search-index"))).toBe(true);
    expect(window.location.search).toBe("?tab=comms-settings&setting=comms.pause-all");
  });

  it("offers nothing the gate did not let through", async () => {
    served = OUTSIDE_ENTRIES.filter((e) => e.id !== "page.mint");
    render(<AdminSearch password="pw" groups={GROUPS} />);
    const dialog = await open();
    await userEvent.type(within(dialog).getByRole("combobox"), "test email");
    await waitFor(() => expect(calls.length).toBe(1));
    expect(within(dialog).queryByText("Send me a test email")).toBeNull();
    await userEvent.clear(within(dialog).getByRole("combobox"));
    await userEvent.type(within(dialog).getByRole("combobox"), "mint");
    expect(within(dialog).queryByText("Mint desk")).toBeNull();
  });

  it("leaves out a control whose page the menu does not show", async () => {
    const noComms = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.key.startsWith("comms-")) }));
    render(<AdminSearch password="pw" groups={noComms} />);
    const dialog = await open();
    await userEvent.type(within(dialog).getByRole("combobox"), "send me a test");
    await waitFor(() => expect(calls.length).toBe(1));
    expect(within(dialog).queryByText("Send me a test email")).toBeNull();
  });

  it("moves with the arrows and remembers where you went, on this device", async () => {
    render(<AdminSearch password="pw" groups={GROUPS} />);
    let dialog = await open();
    const box = within(dialog).getByRole("combobox");
    await userEvent.type(box, "sent mail");
    await waitFor(() => expect(within(dialog).getAllByRole("option").length).toBeGreaterThan(1));
    await userEvent.keyboard("{ArrowDown}");
    expect(within(dialog).getAllByRole("option")[1].getAttribute("aria-selected")).toBe("true");
    await userEvent.keyboard("{ArrowUp}{Enter}");
    expect(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")[0].title).toBe("Sent mail");
    dialog = await open();
    expect(within(dialog).getByText("Recent places")).toBeTruthy();
    expect(within(dialog).getByRole("option").textContent).toContain("Sent mail");
  });

  it("says plainly when nothing matches, and offers the guide with the same words", async () => {
    const onHelper = vi.fn();
    render(<AdminSearch password="pw" groups={GROUPS} onHelper={onHelper} />);
    const dialog = await open();
    await userEvent.type(within(dialog).getByRole("combobox"), "zzqx");
    expect(await within(dialog).findByRole("status")).toBeTruthy();
    expect(within(dialog).getByRole("status").textContent).toContain("Nothing in Admin matches");
    await userEvent.click(within(dialog).getByRole("option", { name: /Ask your guide about/ }));
    expect(onHelper).toHaveBeenCalledTimes(1);
  });
});
