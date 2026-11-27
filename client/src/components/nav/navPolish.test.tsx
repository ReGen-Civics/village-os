// @vitest-environment jsdom
/**
 * The navigation polish (27 Nov 2026, the lead's "do first" list and small joys): village-named folders, warm on
 * hover, the waiting-on-you count, the firefly and the season's mark. Each piece on its own; the menus that draw them
 * are covered by Layout's and the More sheet's own suites.
 */
import vm from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { NavLink } from "@/config/nav";
import MenuRows from "@/components/nav/MenuRows";
import { MenuFolderNames, folderWord } from "@/components/nav/menuFolders";
import { SEEN_KEY, chooseFirefly, seasonInk } from "@/components/nav/menuJoys";
import { WARM_AFTER_MS, warmOnHover } from "@/lib/warmRoute";
import { routePreloadScript } from "@/lib/routePreload";

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/gameApi", () => ({ authToken: () => "t", gameFetch: fetchMock }));

import WaitingCount, { forgetWaiting, waitingOf } from "@/components/nav/WaitingCount";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("a village's own folder names", () => {
  const LINKS: NavLink[] = [
    { href: "/housing", label: "Housing", sub: "Places and homes" },
    { href: "/stay", label: "Stay", sub: "Places and homes" },
  ];
  const draw = (folders: Record<string, string>) =>
    render(
      <Router hook={memoryLocation({ path: "/" }).hook}>
        <MenuFolderNames.Provider value={folders}>
          <MenuRows links={LINKS} renderLink={(l) => <a href={l.href}>{l.label}</a>} rowClassName="" listClassName="" />
        </MenuFolderNames.Provider>
      </Router>,
    );

  it("draws the village's name for a folder it renamed", () => {
    draw({ "Places and homes": "Where we live" });
    expect(screen.getByRole("button", { name: /Where we live/ })).toBeTruthy();
  });

  it("keeps the platform's word until the village names one", () => {
    draw({});
    expect(screen.getByRole("button", { name: /Places and homes/ })).toBeTruthy();
    expect(folderWord("Tools", undefined)).toBe("Tools");
  });
});

describe("warm the page on hover", () => {
  beforeEach(() => {
    window.__routePreload = vi.fn();
  });

  it("asks the route table for the page after a mouse rests 150 ms", () => {
    vi.useFakeTimers();
    const h = warmOnHover("/quests?x=1#y");
    h.onPointerEnter({ pointerType: "mouse" } as never);
    vi.advanceTimersByTime(WARM_AFTER_MS - 1);
    expect(window.__routePreload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(window.__routePreload).toHaveBeenCalledWith("/quests");
  });

  it("does nothing for a touch, or for a pointer that leaves first", () => {
    vi.useFakeTimers();
    const touch = warmOnHover("/quests");
    touch.onPointerEnter({ pointerType: "touch" } as never);
    const passing = warmOnHover("/forum");
    passing.onPointerEnter({ pointerType: "mouse" } as never);
    passing.onPointerLeave();
    vi.advanceTimersByTime(1000);
    expect(window.__routePreload).not.toHaveBeenCalled();
  });

  it("is served by the build's route-preload script, which hints each file once", () => {
    const added: string[] = [];
    const document = { head: { appendChild: (l: { href: string }) => added.push(l.href) }, createElement: () => ({}) };
    const ctx: Record<string, unknown> = { location: { pathname: "/" }, document, window: {} };
    ctx.window = ctx;
    vm.runInNewContext(routePreloadScript({ files: ["assets/Quests.js"], routes: [["^/quests/?$", [0]]] }, "/"), ctx);
    const warm = (ctx.window as { __routePreload: (p: string) => void }).__routePreload;
    warm("/quests");
    warm("/quests");
    warm("/nowhere");
    expect(added).toEqual(["/assets/Quests.js"]);
  });
});

describe("the waiting-on-you count", () => {
  beforeEach(() => {
    forgetWaiting();
    fetchMock.mockReset();
  });

  it("reads the inbox's waiting count, and nothing else", () => {
    expect(waitingOf({ counts: { waiting: 3 } })).toBe(3);
    expect(waitingOf({ counts: { waiting: -1 } })).toBeNull();
    expect(waitingOf(null)).toBeNull();
  });

  it("asks once for every dot on the page, and shows nothing at zero", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ counts: { waiting: 4 } }), { status: 200 }));
    render(
      <>
        <WaitingCount who="u1" variant="dot" />
        <WaitingCount who="u1" />
      </>,
    );
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-waiting-dot]")?.textContent).toBe("4");
    expect(document.querySelector("[data-waiting-count]")?.textContent).toBe("4");
    cleanup();
    forgetWaiting();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ counts: { waiting: 0 } }), { status: 200 }));
    render(<WaitingCount who="u2" variant="dot" />);
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0));
    });
    expect(document.querySelector("[data-waiting-dot]")).toBeNull();
  });

  it("reads again when the window comes back after a minute away", async () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ counts: { waiting: 1 } }), { status: 200 }));
    render(<WaitingCount who="u3" />);
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0));
    });
    fireEvent.focus(window);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now += 61_000;
    fireEvent.focus(window);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
});

describe("the firefly", () => {
  beforeEach(() => window.localStorage.removeItem(SEEN_KEY));

  it("shows none on the first look, and remembers every entry then", () => {
    expect(chooseFirefly(["/a", "/b"], "/")).toBeNull();
    expect(chooseFirefly(["/a", "/b"], "/")).toBeNull();
  });

  it("lights one new entry, and leaves once its page is opened", () => {
    chooseFirefly(["/a"], "/");
    expect(chooseFirefly(["/a", "/b", "/c"], "/")).toBe("/b");
    expect(chooseFirefly(["/a", "/b", "/c"], "/b")).toBe("/c");
    expect(chooseFirefly(["/a", "/b", "/c"], "/")).toBe("/c");
  });

  it("leaves after a fortnight unopened", () => {
    chooseFirefly(["/a"], "/", 0);
    expect(chooseFirefly(["/a", "/b"], "/", 1)).toBe("/b");
    expect(chooseFirefly(["/a", "/b"], "/", 15 * 86_400_000)).toBeNull();
  });
});

describe("the season's mark", () => {
  it("takes one of the palette's own inks for each quarter of the year", () => {
    const inks = [0, 3, 6, 9].map((m) => seasonInk(new Date(2026, m, 15)));
    expect(new Set(inks).size).toBe(4);
    for (const i of inks) expect(i).toMatch(/^bg-(teal-deep|open|notice|coral)$/);
  });
});
