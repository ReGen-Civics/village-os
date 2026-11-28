// @vitest-environment jsdom
/**
 * FIND ANYTHING in the browser: Ctrl K and Cmd K open it from anywhere, Escape closes it and the focus goes back,
 * the button opens it, a typo still finds the page, arrows and Enter open a result, and with no key the guide is
 * never offered and the results stay with a gentle line. Invented places only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FindAnything, FindAnythingRoot, isFindShortcut } from "./FindAnything";
import SearchSlot from "./SearchSlot";
import { forgetFindIndex } from "./FindAnythingDialog";
import { FIND_ANYTHING_READY_EVENT, MENU_OPEN_EVENT, openFindAnything, useFindAnythingReady } from "./findAnythingDoor";

/**
 * The nav lane's Layout exactly as #1881 (840ed132) does it, nothing imported: on mount the window flag and a plain
 * "village:open-menu-ready" event; on unmount the flag deleted, with no event. The search must follow both.
 */
function shellMenu(ready: boolean): void {
  if (ready) {
    (window as any).__openMenuReady = true;
    window.dispatchEvent(new Event("village:open-menu-ready"));
  } else delete (window as any).__openMenuReady;
}
import type { FindIndex } from "@shared/findAnything";

let index: FindIndex;
let guideReply: unknown;
let guideStatus = 200;
let calls: Array<{ url: string; method: string; body?: string }>;

beforeEach(() => {
  forgetFindIndex();
  window.history.replaceState({}, "", "/");
  calls = [];
  guideReply = { state: "unavailable", guide: "Sol" };
  guideStatus = 200;
  index = {
    people: false,
    guide: { name: "Sol", available: true },
    entries: [
      { id: "page:/quests", kind: "page", title: "Quests", help: "Work the village needs done.", path: "/quests", synonyms: ["tasks"] },
      { id: "page:/events", kind: "page", title: "Village Calendar", help: "Gatherings.", path: "/events", synonyms: ["calendar"] },
      { id: "role:garden-lead", kind: "role", title: "Garden Lead", help: "Keeps the food forest growing.", path: "/roles/garden-lead" },
    ],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any, init?: any) => {
      calls.push({ url: String(url), method: String(init?.method ?? "GET"), body: init?.body });
      const u = String(url);
      // The guide's name comes from the village's own document, through the name hook, never from the search.
      if (u.endsWith("/api/work-with-us-config")) return { ok: true, status: 200, json: async () => ({ assistantName: "Sol" }) };
      if (u.endsWith("/api/search/guide")) return { ok: guideStatus < 400, status: guideStatus, json: async () => guideReply };
      return { ok: true, status: 200, json: async () => index };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const dialog = () => screen.findByRole("dialog", { name: "Find anything" });

describe("Find anything", () => {
  it("knows its keys: Ctrl K and Cmd K, and nothing else", () => {
    expect(isFindShortcut({ key: "k", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })).toBe(true);
    expect(isFindShortcut({ key: "K", ctrlKey: false, metaKey: true, altKey: false, shiftKey: false })).toBe(true);
    expect(isFindShortcut({ key: "k", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false })).toBe(false);
    expect(isFindShortcut({ key: "k", ctrlKey: true, metaKey: false, altKey: false, shiftKey: true })).toBe(false);
  });

  it("opens on Ctrl K from anywhere, once for two mounts, and Escape closes it with the focus back where it was", async () => {
    render(
      <>
        <input aria-label="Somewhere else" />
        <FindAnything />
        <FindAnything />
      </>,
    );
    const elsewhere = screen.getByLabelText("Somewhere else");
    elsewhere.focus();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const d = await dialog();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await waitFor(() => expect(within(d).getByRole("combobox")).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(elsewhere).toHaveFocus());
  });

  it("opens on Cmd K too, and leaves a key another search already took", async () => {
    render(<FindAnything />);
    const taken = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true });
    taken.preventDefault();
    act(() => void document.dispatchEvent(taken));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(await dialog()).toBeTruthy();
  });

  it("opens from its button, finds a page through a typo, and Enter goes there with the focus back on the button after", async () => {
    render(<FindAnything />);
    const button = screen.getByRole("button", { name: "Find anything" });
    await userEvent.click(button);
    const d = await dialog();
    await userEvent.type(within(d).getByRole("combobox"), "calender");
    await waitFor(() => expect(within(d).getAllByRole("option")[0].textContent).toContain("Village Calendar"));
    expect(within(d).getByRole("status").textContent).toBe("1 result");
    await userEvent.keyboard("{Enter}");
    expect(window.location.pathname).toBe("/events");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(button).toHaveFocus());
  });

  it("moves with the arrows and groups the results", async () => {
    render(<FindAnything />);
    await userEvent.click(screen.getByRole("button", { name: "Find anything" }));
    const d = await dialog();
    await userEvent.type(within(d).getByRole("combobox"), "g");
    await userEvent.type(within(d).getByRole("combobox"), "arden");
    await waitFor(() => expect(within(d).getByRole("group", { name: "Roles" })).toBeTruthy());
    await userEvent.keyboard("{Enter}");
    expect(window.location.pathname).toBe("/roles/garden-lead");
  });

  it("offers the guide when nothing is close, sends only the words, and keeps only places on the reader's own list", async () => {
    guideReply = { state: "answered", guide: "Sol", picks: [{ path: "/roles/garden-lead", title: "Garden Lead", kind: "role", why: "It looks after plants." }, { path: "/not-mine", title: "Nope", kind: "page", why: "x" }] };
    render(<FindAnything />);
    await userEvent.click(screen.getByRole("button", { name: "Find anything" }));
    const d = await dialog();
    await userEvent.type(within(d).getByRole("combobox"), "plantas");
    // Nothing matches, so the guide's row is the first door.
    const ask = await within(d).findByRole("option", { name: "Nothing here matches. Ask Sol where to find it." });
    expect(within(d).getByText("Only the words you typed go to Sol.")).toBeTruthy();
    await userEvent.click(ask);
    const group = await within(d).findByRole("group", { name: "Sol suggests" });
    expect(within(group).getAllByRole("option")).toHaveLength(1);
    expect(within(group).getByText("It looks after plants.")).toBeTruthy();
    const post = calls.find((c) => c.method === "POST");
    expect(JSON.parse(post!.body!)).toEqual({ query: "plantas" });
  });

  it("with no key never offers the guide, and keeps the search's own results with a gentle line", async () => {
    index = { ...index, guide: { name: "Sol", available: false } };
    render(<FindAnything />);
    await userEvent.click(screen.getByRole("button", { name: "Find anything" }));
    const d = await dialog();
    await userEvent.type(within(d).getByRole("combobox"), "plantas");
    await waitFor(() => expect(within(d).getByText("Nothing here matches “plantas”. Try another word.")).toBeTruthy());
    // No shell listens for the menu here, so no button promises one.
    expect(within(d).queryByRole("button", { name: "Open the menu" })).toBeNull();
    expect(within(d).queryByRole("option", { name: /Ask Sol/ })).toBeNull();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    expect(within(d).queryByRole("alert")).toBeNull();
  });

  it("when the guide cannot answer after all, says so gently and keeps the results", async () => {
    render(<FindAnything />);
    await userEvent.click(screen.getByRole("button", { name: "Find anything" }));
    const d = await dialog();
    await userEvent.type(within(d).getByRole("combobox"), "plantas");
    await userEvent.click(await within(d).findByRole("option", { name: /Ask Sol/ }));
    expect(await within(d).findByText("Sol can't answer right now, so these are the search's own results.")).toBeTruthy();
  });

  it("says the guide has rested for today when the day's share is spent, and keeps the results", async () => {
    guideStatus = 429;
    guideReply = { error: "The guide has rested for today. The search still works on its own.", limit: "day" };
    render(<FindAnything />);
    await userEvent.click(screen.getByRole("button", { name: "Find anything" }));
    const d = await dialog();
    await userEvent.type(within(d).getByRole("combobox"), "garden plantas");
    await userEvent.click(await within(d).findByRole("option", { name: /Ask Sol where to find it/ }));
    expect(await within(d).findByText("Sol has rested for today. The search still works on its own.")).toBeTruthy();
    expect(within(d).getByRole("option", { name: /Garden Lead/ })).toBeTruthy();
  });

  it("opens from openFindAnything() anywhere, with the focus in the field and back on the link after", async () => {
    render(
      <>
        <button type="button" onClick={openFindAnything}>Search the village</button>
        <FindAnything />
      </>,
    );
    const link = screen.getByRole("button", { name: "Search the village" });
    await userEvent.click(link);
    const d = await dialog();
    await waitFor(() => expect(within(d).getByRole("combobox")).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(link).toHaveFocus());
  });

  it("says it is ready only while a mount is here, and says so again when the last one goes", async () => {
    function Door() {
      return <p>{useFindAnythingReady() ? "ready" : "not here"}</p>;
    }
    const heard: unknown[] = [];
    const listen = (e: Event) => heard.push((e as CustomEvent).detail);
    window.addEventListener(FIND_ANYTHING_READY_EVENT, listen);
    const door = render(<Door />);
    expect(door.getByText("not here")).toBeTruthy();
    expect(window.__findAnythingReady).toBeUndefined();
    const one = render(<FindAnything />);
    const two = render(<FindAnything />);
    expect(window.__findAnythingReady).toBe(true);
    await waitFor(() => expect(door.getByText("ready")).toBeTruthy());
    one.unmount();
    expect(window.__findAnythingReady).toBe(true);
    two.unmount();
    expect(window.__findAnythingReady).toBeUndefined();
    await waitFor(() => expect(door.getByText("not here")).toBeTruthy());
    // Asking with nothing mounted opens nothing.
    openFindAnything();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(heard).toEqual([true, false]);
    window.removeEventListener(FIND_ANYTHING_READY_EVENT, listen);
  });

  it("opens above the phone's More sheet, and Escape closes it alone: a window listener standing in for the sheet never hears it", async () => {
    let sheetHeard = 0;
    const sheet = (e: KeyboardEvent) => {
      if (e.key === "Escape") sheetHeard += 1;
    };
    window.addEventListener("keydown", sheet);
    render(<FindAnything />);
    const button = screen.getByRole("button", { name: "Find anything" });
    await userEvent.click(button);
    const d = await dialog();
    // Above the sheet's z-[65] scrim and z-[70] panel.
    expect(d.className).toContain("z-[80]");
    await waitFor(() => expect(within(d).getByRole("combobox")).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sheetHeard).toBe(0);
    await waitFor(() => expect(button).toHaveFocus());
    // With the dialog gone, Escape reaches the sheet again.
    await userEvent.keyboard("{Escape}");
    expect(sheetHeard).toBe(1);
    window.removeEventListener("keydown", sheet);
  });

  it("draws a full row with words for the More sheet, 44px or more, and the icon alone for the header", async () => {
    render(
      <>
        <FindAnything variant="row" />
        <FindAnything />
      </>,
    );
    const row = screen.getByRole("button", { name: "Find a page, a role, a quest" });
    expect(row.className).toContain("min-h-12");
    expect(row.getAttribute("data-find-anything")).toBe("row");
    expect(screen.getByRole("button", { name: "Find anything" }).getAttribute("data-find-anything")).toBe("icon");
    await userEvent.click(row);
    expect(await dialog()).toBeTruthy();
  });

  it("offers 'Open the menu' when nothing matches, only while the shell listens, and asks the shell to open it", async () => {
    let opened = 0;
    const shell = () => void (opened += 1);
    expect(MENU_OPEN_EVENT).toBe("village:open-menu");
    window.addEventListener("village:open-menu", shell);
    render(<FindAnything />);
    await userEvent.click(screen.getByRole("button", { name: "Find anything" }));
    let d = await dialog();
    await userEvent.type(within(d).getByRole("combobox"), "plantas");
    await within(d).findByRole("option", { name: /Ask Sol/ });
    expect(within(d).queryByRole("button", { name: "Open the menu" })).toBeNull();
    act(() => shellMenu(true));
    await within(d).findByRole("button", { name: "Open the menu" });
    // The shell leaves with no event (as #1881 does): the next draw reads the flag again and the button goes.
    act(() => shellMenu(false));
    await userEvent.type(within(d).getByRole("combobox"), "s");
    expect(within(d).queryByRole("button", { name: "Open the menu" })).toBeNull();
    act(() => shellMenu(true));
    // The shell's menu takes the focus when it opens; the search must not take it back after.
    const menuButton = document.createElement("button");
    menuButton.textContent = "The menu";
    document.body.appendChild(menuButton);
    const shellOpens = () => menuButton.focus();
    window.addEventListener("village:open-menu", shellOpens);
    await userEvent.click(await within(d).findByRole("button", { name: "Open the menu" }));
    await waitFor(() => expect(opened).toBe(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await new Promise((r) => setTimeout(r, 30));
    expect(menuButton).toHaveFocus();
    window.removeEventListener("village:open-menu", shellOpens);
    menuButton.remove();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    act(() => shellMenu(false));
    await userEvent.click(screen.getByRole("button", { name: "Find anything" }));
    d = await dialog();
    await userEvent.type(within(d).getByRole("combobox"), "plantas");
    await within(d).findByRole("option", { name: /Ask Sol/ });
    expect(within(d).queryByRole("button", { name: "Open the menu" })).toBeNull();
    window.removeEventListener("village:open-menu", shell);
  });

  it("from the App's root alone, the not-found page's button is there and opens the dialog with the focus in its field", async () => {
    // The not-found page draws no shell: no header icon, no sheet row. Its button is the wayfinding lane's, as it reads
    // the search through findAnythingDoor.ts.
    function NotFoundSearch() {
      return useFindAnythingReady() ? (
        <button type="button" onClick={openFindAnything}>
          Search the village
        </button>
      ) : null;
    }
    render(
      <>
        <FindAnythingRoot />
        <NotFoundSearch />
      </>,
    );
    expect(window.__findAnythingReady).toBe(true);
    const link = await screen.findByRole("button", { name: "Search the village" });
    await userEvent.click(link);
    const d = await dialog();
    await waitFor(() => expect(within(d).getByRole("combobox")).toHaveFocus());
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(link).toHaveFocus());
  });

  it("with the root and the header's door both mounted, opens one dialog, and the root keeps Ctrl K", async () => {
    render(
      <>
        <FindAnythingRoot />
        <SearchSlot place="desktop" />
      </>,
    );
    const icon = screen.getByRole("button", { name: "Find anything" });
    await userEvent.click(icon);
    await dialog();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(icon).toHaveFocus());
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(await dialog()).toBeTruthy();
  });

  it("fills the nav lane's slot: the icon on the desktop, the icon from 768px in the phone bar, the row in the sheet", () => {
    render(
      <>
        <SearchSlot place="desktop" />
        <SearchSlot place="phone" />
        <SearchSlot place="sheet" />
      </>,
    );
    const icons = screen.getAllByRole("button", { name: "Find anything" });
    expect(icons).toHaveLength(2);
    // The phone bar's icon is hidden below md (a phone), shown from 768px (a tablet).
    expect(icons[1].parentElement?.className).toBe("hidden md:contents");
    const row = screen.getByRole("button", { name: "Find a page, a role, a quest" });
    // One line at 320px: the words truncate, never wrap.
    expect(row.querySelector(".truncate")?.textContent).toBe("Find a page, a role, a quest");
  });

  it("lays a solid sheet of the panel's own colour under the dialog's words, so no paper or page shows behind the field", async () => {
    render(<FindAnything />);
    await userEvent.click(screen.getByRole("button", { name: "Find anything" }));
    const d = await dialog();
    const solid = d.querySelector("[data-find-solid]");
    expect(solid).toBeTruthy();
    expect(solid!.className).toContain("absolute inset-0 -z-10 bg-popover");
    // Under the field, first in the dialog, and never in the way of a click or a screen reader.
    expect(solid!.getAttribute("aria-hidden")).toBe("true");
    expect(solid!.className).toContain("pointer-events-none");
    expect(d.firstElementChild).toBe(solid);
  });
});
