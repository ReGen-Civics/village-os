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
import { SEASON_RINGS, SEEN_KEY, chooseFirefly, seasonRing } from "@/components/nav/menuJoys";
import { WARM_AFTER_MS, warmOnHover } from "@/lib/warmRoute";
import { routePreloadScript, routePreloadTable } from "@/lib/routePreload";

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/gameApi", () => ({ authToken: () => "t", gameFetch: fetchMock, useSeason: () => null }));

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

  it("asks the route table for the page's own chunk after a mouse rests 150 ms", () => {
    vi.useFakeTimers();
    const h = warmOnHover("/quests?x=1#y");
    h.onPointerEnter({ pointerType: "mouse" } as never);
    vi.advanceTimersByTime(WARM_AFTER_MS - 1);
    expect(window.__routePreload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(window.__routePreload).toHaveBeenCalledWith("/quests", true);
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

  it("is served by the build's route-preload script: a hover hints the page's own chunk alone, each file once", () => {
    const added: string[] = [];
    const document = { head: { appendChild: (l: { href: string }) => added.push(l.href) }, createElement: () => ({}) };
    const ctx: Record<string, unknown> = { location: { pathname: "/" }, document, window: {} };
    ctx.window = ctx;
    const table = { files: ["assets/Quests.js", "assets/QuestCard.js", "assets/Forum.js"], routes: [["^/quests/?$", [0, 1]], ["^/forum/?$", [2]]] as Array<[string, number[]]> };
    vm.runInNewContext(routePreloadScript(table, "/"), ctx);
    const warm = (ctx.window as { __routePreload: (p: string, own?: boolean) => void }).__routePreload;
    warm("/quests", true);
    warm("/quests", true);
    warm("/nowhere", true);
    expect(added).toEqual(["/assets/Quests.js"]);
    // The first visit to a page still hints its imports too.
    warm("/quests");
    expect(added).toEqual(["/assets/Quests.js", "/assets/QuestCard.js"]);
  });

  it("finds a page packed into a shared group through that group's chunk (the QA's /forum, /powers, /quests)", () => {
    const t = routePreloadTable(
      [{ path: "/forum", module: "pages/Forum" }],
      [
        { fileName: "assets/index.js", imports: [], isEntry: true, isDynamicEntry: false, facadeModuleId: "/r/client/src/main.tsx", css: [] },
        { fileName: "assets/pages-2.js", imports: [], isEntry: false, isDynamicEntry: true, facadeModuleId: null, css: [], modules: ["/r/client/src/pages/Forum.tsx", "/r/client/src/pages/Quests.tsx"] },
      ],
    );
    expect(t.routes).toEqual([["^/forum/?$", [0]]]);
    expect(t.files).toEqual(["assets/pages-2.js"]);
  });
});

describe("the waiting-on-you count", () => {
  beforeEach(() => {
    forgetWaiting();
    fetchMock.mockReset();
  });

  /* The menu's QA, round 1: a member with two ballots saw "2" on a row that opens /governance/work, which lists none. */
  it("counts only what the page it opens lists: items decided on /governance/work (or /review, its old address)", () => {
    const items = [
      { decideAt: "/decisions/7" },
      { decideAt: "/governance/work#approvals" },
      { decideAt: "/review" },
      { decideAt: "/governance/treasury#end-of-moon" },
      { decideAt: "/reviewers" },
    ];
    expect(waitingOf({ items })).toBe(2);
    expect(waitingOf({ items: [{ decideAt: "/decisions/1" }, { decideAt: "/decisions/2" }] })).toBe(0);
    expect(waitingOf({ counts: { waiting: 3 } })).toBeNull();
    expect(waitingOf(null)).toBeNull();
  });

  /* The inbox pages its items and counts on the server first (`byDoor`): its QA saw 20 where 37 were waiting. */
  it("reads the server's own count by door when the reply carries one, and the items when it does not", () => {
    expect(waitingOf({ byDoor: { "/governance/work": 30, "/review": 7, "/decisions": 12 } })).toBe(37);
    expect(waitingOf({ byDoor: { "/governance/work": 4 } })).toBe(4);
    expect(waitingOf({ byDoor: { "/decisions": 12 } })).toBe(0);
    expect(waitingOf({ byDoor: {} })).toBe(0);
    // Both shapes: the server's count wins, even when the page of items holds fewer rows (or more).
    const page = Array.from({ length: 20 }, () => ({ decideAt: "/governance/work" }));
    expect(waitingOf({ items: page, byDoor: { "/governance/work": 30, "/review": 7 } })).toBe(37);
    expect(waitingOf({ items: page, byDoor: { "/governance/work": 3 } })).toBe(3);
    // Numbers only: anything else counts as nothing.
    expect(waitingOf({ byDoor: { "/governance/work": "30", "/review": 2 } })).toBe(2);
    expect(waitingOf({ byDoor: { "/governance/work": null, "/review": Number.NaN } })).toBe(0);
    expect(waitingOf({ byDoor: { "/governance/work": -4, "/review": { n: 1 } } })).toBe(0);
    // A byDoor that is no object is no count: the items are read, as on a server without it.
    expect(waitingOf({ items: page, byDoor: null })).toBe(20);
    expect(waitingOf({ items: page, byDoor: [5] })).toBe(20);
    expect(waitingOf({ items: page, byDoor: "37" })).toBe(20);
  });

  it("shows the server's count on the dot, from the one shared read", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ items: [{ decideAt: "/review" }], byDoor: { "/governance/work": 5, "/review": 1 } }), { status: 200 }));
    render(
      <>
        <WaitingCount who="u7" variant="dot" />
        <WaitingCount who="u7" />
      </>,
    );
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-waiting-dot]")?.textContent).toBe("6");
    expect(document.querySelector("[data-waiting-count]")?.textContent).toBe("6");
  });

  it("asks once for every dot on the page, and shows nothing at zero", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ items: Array.from({ length: 4 }, () => ({ decideAt: "/review" })) }), { status: 200 }));
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
    // A host with another name hears what the number counts; a row named "Waiting on you" hears just the number.
    expect(document.querySelector("[data-waiting-count]")?.nextElementSibling?.textContent).toBe(", 4 waiting on you");
    cleanup();
    render(<WaitingCount who="u1" bare />);
    expect(document.querySelector("[data-waiting-count]")?.nextElementSibling?.textContent).toBe(", 4");
    cleanup();
    forgetWaiting();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ items: [{ decideAt: "/decisions/9" }] }), { status: 200 }));
    render(<WaitingCount who="u2" variant="dot" />);
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0));
    });
    expect(document.querySelector("[data-waiting-dot]")).toBeNull();
  });

  it("reads again when the window comes back after a minute away", async () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ items: [{ decideAt: "/review" }] }), { status: 200 }));
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
  it("takes its ring's colour from the village's own season, steady for that season, never the brand or the gold", () => {
    expect(seasonRing("s-dry-2026")).toBe(seasonRing("s-dry-2026"));
    const rings = new Set(["a", "b", "c", "d", "e", "f"].map((id) => seasonRing(id)));
    expect(rings.size).toBeGreaterThan(1);
    for (const r of SEASON_RINGS) expect(r).not.toMatch(/teal-deep|notice|gold/);
  });
});
