// @vitest-environment jsdom
/**
 * FIND ANYTHING in the browser: Ctrl K and Cmd K open it from anywhere, Escape closes it and the focus goes back,
 * the button opens it, a typo still finds the page, arrows and Enter open a result, and with no key the guide is
 * never offered and the results stay with a gentle line. Invented places only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FindAnything, isFindShortcut } from "./FindAnything";
import { forgetFindIndex } from "./FindAnythingDialog";
import type { FindIndex } from "@shared/findAnything";

let index: FindIndex;
let guideReply: unknown;
let calls: Array<{ url: string; method: string; body?: string }>;

beforeEach(() => {
  forgetFindIndex();
  window.history.replaceState({}, "", "/");
  calls = [];
  guideReply = { state: "unavailable", guide: "Sol" };
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
      const body = String(url).endsWith("/api/search/guide") ? guideReply : index;
      return { ok: true, status: 200, json: async () => body };
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
    const ask = await within(d).findByRole("option", { name: /Ask Sol where to find it/ });
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
    await waitFor(() => expect(within(d).getByText(/Try another word, or open the menu for every page/)).toBeTruthy());
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
});
