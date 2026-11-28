// @vitest-environment jsdom
/**
 * FIND ANYTHING for an admin: people from the Players page's own route, and a review code. A member's dialog asks
 * for neither. Invented people only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FindAnything } from "./FindAnything";
import { forgetFindIndex } from "./FindAnythingDialog";
import type { FindIndex } from "@shared/findAnything";

let index: FindIndex;
let calls: string[];
let rosterStatus = 200;

beforeEach(() => {
  forgetFindIndex();
  window.history.replaceState({}, "", "/");
  calls = [];
  rosterStatus = 200;
  index = {
    people: true,
    admin: true,
    guide: { name: "Sol", available: false },
    entries: [
      { id: "page:/quests", kind: "page", title: "Quests", help: "Work the village needs done.", path: "/quests" },
      { id: "person:ana-example", kind: "person", title: "Ana Example", help: "", path: "/profile/ana-example" },
    ],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: any) => {
      const u = String(url);
      calls.push(u);
      if (u.endsWith("/api/work-with-us-config")) return { ok: true, status: 200, json: async () => ({ assistantName: "Sol" }) };
      if (u.endsWith("/api/admin/players")) {
        return {
          ok: rosterStatus < 400,
          status: rosterStatus,
          json: async () => [
            { id: "u1", name: "Ana Example", email: "ana@example.org", handle: "ana-example", role: "member" },
            { id: "u2", name: "Ben Example", email: "ben@example.org", handle: null, role: "member" },
          ],
        };
      }
      return { ok: true, status: 200, json: async () => index };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function open() {
  render(<FindAnything />);
  await userEvent.click(screen.getByRole("button", { name: "Find anything" }));
  const d = await screen.findByRole("dialog", { name: "Find anything" });
  return { d, box: within(d).getByRole("combobox") };
}

describe("Find anything, for an admin", () => {
  it("finds somebody on the Players page by name and by address, and opens that page", async () => {
    const { d, box } = await open();
    await waitFor(() => expect(calls.some((u) => u.endsWith("/api/admin/players"))).toBe(true));
    await userEvent.type(box, "ben");
    await waitFor(() => expect(within(d).getAllByRole("option")[0].textContent).toContain("Ben Example"));
    expect(within(d).getAllByRole("option")[0].textContent).toContain("On the Players page");
    await userEvent.clear(box);
    await userEvent.type(box, "ben@example.org");
    await waitFor(() => expect(within(d).getAllByRole("option")[0].textContent).toContain("Ben Example"));
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(`${window.location.pathname}${window.location.search}`).toBe("/admin?tab=players"));
  });

  it("keeps an admitted member on their own page, found by their address too", async () => {
    const { d, box } = await open();
    await waitFor(() => expect(calls.some((u) => u.endsWith("/api/admin/players"))).toBe(true));
    await userEvent.type(box, "ana@example.org");
    await waitFor(() => expect(within(d).getAllByRole("option")[0].textContent).toContain("Ana Example"));
    // Listed once: the roster joined the entry the index already held and added no second row for her.
    expect(within(d).getAllByRole("option").filter((o) => o.textContent?.includes("Ana Example"))).toHaveLength(1);
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(window.location.pathname).toBe("/profile/ana-example"));
  });

  it("offers a review code as one row that opens the review page's own lookup", async () => {
    const { d, box } = await open();
    await userEvent.type(box, "b-27.2");
    await waitFor(() => expect(within(d).getAllByRole("option")[0].textContent).toContain("Open B-27.2 in Review"));
    expect(within(d).queryByText(/Nothing here matches/)).toBeNull();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(`${window.location.pathname}${window.location.search}`).toBe("/admin/review?find=B-27.2"));
  });

  it("still searches when the roster cannot be read", async () => {
    rosterStatus = 403;
    const { d, box } = await open();
    await userEvent.type(box, "quests");
    await waitFor(() => expect(within(d).getAllByRole("option")[0].textContent).toContain("Quests"));
    await userEvent.clear(box);
    await userEvent.type(box, "ben");
    await waitFor(() => expect(within(d).queryByText("Ben Example")).toBeNull());
  });
});

describe("Find anything, for a member", () => {
  it("never asks for the roster, and a code is only words", async () => {
    index = { ...index, admin: false };
    const { d, box } = await open();
    await userEvent.type(box, "b-27");
    await waitFor(() => expect(within(d).getByRole("status").textContent).toBe("0 results"));
    expect(within(d).queryByText(/in Review/)).toBeNull();
    await userEvent.clear(box);
    await userEvent.type(box, "ana");
    await waitFor(() => expect(within(d).getAllByRole("option")[0].textContent).toContain("Ana Example"));
    expect(calls.some((u) => u.includes("/api/admin/"))).toBe(false);
  });
});
