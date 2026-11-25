// @vitest-environment jsdom
/**
 * Today's "Needs you now" is the review lane's one list (the lead, 25 Nov
 * 2026): it shows each kind by the list's own title and count, the first few
 * rows as the list draws them, "See all" for a longer kind, and names a queue
 * that failed so a failure never reads as nothing waiting.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import NeedsYouNow, { ROWS_PER_KIND } from "./NeedsYouNow";

const item = (source: string, n: number) => ({
  key: `${source}:${n}`, source, kind: source, code: null, summary: `${source} number ${n}`,
  filedAt: `2026-11-${String(10 + n).padStart(2, "0")}T10:00:00Z`, batch: null, decideAt: `/decide/${source}/${n}`, touchesPerson: false,
});

let answer: unknown;
beforeEach(() => {
  i18n.loadAndActivate({ locale: "en", messages: {} });
  answer = {
    sections: [
      { source: "vote", state: "ok", count: 1 },
      { source: "application", state: "ok", count: 5 },
      { source: "recap", state: "failed", count: 0 },
    ],
    items: [item("vote", 1), ...[1, 2, 3, 4, 5].map((n) => item("application", n))],
  };
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).endsWith("/api/admin/review/inbox")) return new Response(JSON.stringify(answer), { status: answer ? 200 : 500 });
    return new Response("{}", { status: 404 });
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const show = () => render(<I18nProvider i18n={i18n}><NeedsYouNow /></I18nProvider>);

describe("Needs you now on Today", () => {
  it("reads the review list: every kind, its count, the first rows, and See all", async () => {
    show();
    expect(await screen.findByText("6 things are waiting on you.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Needs you now" })).toBeTruthy();
    // Each item is a row on the list's own terms: its own words and a door to where it is decided.
    expect(screen.getByText("vote number 1")).toBeTruthy();
    const apps = screen.getAllByText(/^application number /);
    expect(apps).toHaveLength(ROWS_PER_KIND);
    expect(apps.map((a) => a.textContent)).toEqual(["application number 1", "application number 2", "application number 3"]);
    const seeAll = screen.getByRole("link", { name: "See all 5" });
    expect(seeAll.getAttribute("href")).toBe("/admin/review?kind=application");
    // A kind with three or fewer has no See all.
    expect(screen.getAllByRole("link", { name: /^See all/ })).toHaveLength(1);
  });

  it("names a queue that failed, so it never reads as nothing waiting", async () => {
    show();
    expect(await screen.findByText(/Could not be read just now, so not counted: /)).toBeTruthy();
  });

  it("says plainly when the whole list did not load, and offers to try again", async () => {
    answer = null;
    show();
    expect(await screen.findByText("The review list did not load, so this cannot say what is waiting.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("says nothing is waiting when the list is empty", async () => {
    answer = { sections: [{ source: "vote", state: "ok", count: 0 }], items: [] };
    show();
    expect(await screen.findByText("Nothing on the review list is waiting on you.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Open the whole review list" })).toBeNull();
  });
});
