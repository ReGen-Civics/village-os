// @vitest-environment jsdom
/**
 * MORE, THE PHONE'S ONE MENU (phone doors v4). The tiles come from the account
 * entries Layout already gated, Pay shows once credits are in use
 * (shared/payGate.ts), the sixth tile is the member's own most visited page,
 * and Roles never appears: it is a tab.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { NavGroup, NavLink } from "@/config/nav";
import { TASK_BOARD_PATH } from "@shared/taskMenu";

const session = vi.hoisted(() => ({
  user: null as null | { id: string; name: string },
  pay: null as null | object,
  recent: null as null | object,
  most: null as null | string,
  phone: true,
  modules: [] as { id: string; lifecycle: string }[],
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: session.user, logout: vi.fn() }) }));
vi.mock("@/lib/gameApi", () => ({
  gameFetch: vi.fn(async (path: string) => {
    const body = path === "/api/pay" ? session.pay : path === "/api/pay/recent" ? session.recent : null;
    return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response("{}", { status: 404 });
  }),
}));
vi.mock("@/lib/navVisits", () => ({ personalFor: () => session.most }));
vi.mock("@/modules/ModuleProvider", () => ({ useModules: () => ({ modules: session.modules, loaded: true, failed: false }) }));
vi.mock("@/lib/newcomer", () => ({ useNewcomer: () => false }));
vi.mock("@/i18n/LanguagePicker", () => ({ LanguagePicker: () => <span>language</span> }));
vi.mock("@/components/ThemeSwitch", () => ({ default: () => <span>mode</span> }));
vi.mock("@/components/tasks/TaskCountBadge", () => ({ default: () => <span>3</span> }));
vi.mock("@/components/messages/MessageCountBadge", () => ({ default: () => <span>1</span> }));

import MoreSheet from "./MoreSheet";

const ACCOUNT = [
  { href: "/profile", label: "My Profile" },
  { href: "/journal", label: "Journal" },
  { href: "/messages", label: "Messages", count: "messages" as const },
  { href: TASK_BOARD_PATH, label: "My tasks", count: "tasks" as const },
  { href: "/badges", label: "Badges" },
];
const EVENTS: NavLink = { href: "/events", label: "Events" };
const COMMUNITY: NavGroup = { label: "Community", items: [EVENTS] } as NavGroup;

async function draw() {
  window.matchMedia = ((q: string) => ({ matches: session.phone, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  const { hook } = memoryLocation({ path: "/quests" });
  const r = render(
    <Router hook={hook}>
      <MoreSheet entries={[COMMUNITY]} itemsOf={(g) => g.items as NavLink[]} account={ACCOUNT} onClose={() => {}} />
    </Router>,
  );
  await act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
  return r;
}

const tiles = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLElement>("[data-more-tile]")).map((t) => t.getAttribute("data-more-tile"));

beforeEach(() => {
  session.user = { id: "u1", name: "Ana" };
  session.pay = { tokens: [{ balance: 4 }] };
  session.recent = { people: [] };
  session.most = null;
  session.phone = true;
  session.modules = [];
});
afterEach(cleanup);

describe("the More sheet", () => {
  it("draws the tiles in order: Profile, Pay, Messages, My tasks, Journal", async () => {
    const { container } = await draw();
    expect(tiles(container)).toEqual(["/profile", "/pay", "/messages", TASK_BOARD_PATH, "/journal"]);
  });

  it("keeps Pay away until credits are in use for this member", async () => {
    session.pay = { tokens: [{ balance: 0 }] };
    session.recent = { people: [] };
    const { container } = await draw();
    expect(tiles(container)).not.toContain("/pay");
  });

  it("adds the member's most visited page as the sixth tile, named from the menu", async () => {
    session.most = "/events";
    const { container } = await draw();
    expect(tiles(container).at(-1)).toBe("/events");
    expect(screen.getByText("you visit most")).toBeInTheDocument();
  });

  it("lists the other account entries under the tiles, and never Roles", async () => {
    await draw();
    expect(within(screen.getByRole("list", { name: "Also yours" })).getByText("Badges")).toBeInTheDocument();
    expect(screen.queryByText("Roles")).toBeNull();
  });

  it("does not add the hidden map to Also yours: it sits in Village's Maps folder, so it shows once (QA, 27 Nov 2026)", async () => {
    session.modules = [{ id: "hidden-map", lifecycle: "members" }];
    await draw();
    expect(within(screen.getByRole("list", { name: "Also yours" })).queryByText("Hidden map")).toBeNull();
  });

  it("is a modal named More that keeps the night in dark mode, with the foot's language and mode", async () => {
    await draw();
    const sheet = screen.getByRole("dialog", { name: "More" });
    expect(sheet).toHaveAttribute("aria-modal", "true");
    expect(sheet).toHaveAttribute("data-scene");
    expect(within(sheet).getByText("language")).toBeInTheDocument();
    expect(within(sheet).getByText("mode")).toBeInTheDocument();
  });

  it("offers a visitor sign in, and leaves Work With Us to Join's folder, so it shows once (QA, 27 Nov 2026)", async () => {
    session.user = null;
    const { container } = await draw();
    expect(tiles(container)).toEqual(["/login"]);
  });

  it("draws nothing from md up, where the header's drawer answers", async () => {
    session.phone = false;
    const { container } = await draw();
    expect(container.querySelector("[data-more-sheet]")).toBeNull();
  });
});

describe("the branch the page belongs to (the lead's team call, 26 Nov 2026)", () => {
  it("opens with that group expanded, the group and the entry marked", async () => {
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    const { hook } = memoryLocation({ path: "/events/7" });
    render(
      <Router hook={hook}>
        <MoreSheet entries={[COMMUNITY]} itemsOf={(g) => g.items as NavLink[]} account={ACCOUNT} onClose={() => {}} lit={{ group: "Community", href: "/events", exact: false, item: EVENTS }} />
      </Router>,
    );
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0));
    });
    const button = screen.getByRole("button", { name: "Community" });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-current")).toBe("true");
    const link = screen.getByRole("link", { name: /Events/ });
    expect(link.getAttribute("aria-current")).toBe("true");
    expect(link.className).toContain("border-notice");
    // The hooks the Sea chart's look draws on (client/src/seaChart.css).
    expect(button.hasAttribute("data-lit")).toBe(true);
    expect(button.querySelector("[data-lit-dot]")).toBeTruthy();
    expect(link.hasAttribute("data-lit")).toBe(true);
    expect(button.closest('[data-wayfinding="menu"]')).toBeTruthy();
  });

  it("opens with every group closed and nothing marked on a page in no entry", async () => {
    await draw();
    const button = screen.getByRole("button", { name: "Community" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector("[aria-current]")).toBeNull();
  });
});

describe("a top-level entry lit in More (the live check, 27 Nov 2026)", () => {
  it("stands its edge on the text column, with no pull to the left", async () => {
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    const LIBRARY: NavLink = { href: "/modules", label: "Module Library" };
    const { hook } = memoryLocation({ path: "/modules/feed" });
    render(
      <Router hook={hook}>
        <MoreSheet entries={[LIBRARY, COMMUNITY]} itemsOf={(g) => g.items as NavLink[]} account={ACCOUNT} onClose={() => {}} lit={{ group: null, href: "/modules", exact: false, item: LIBRARY }} />
      </Router>,
    );
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0));
    });
    const link = screen.getByRole("link", { name: /Module Library/ });
    expect(link.getAttribute("aria-current")).toBe("true");
    expect(link.className).toContain("border-l-2");
    expect(link.className).not.toContain("-ml-3");
  });
});

describe("each page once in the sheet (the menu's QA, 27 Nov 2026)", () => {
  it("draws every page once, Quests and the roles excepted, with every group and folder open", async () => {
    const { NAV, ACCOUNT_MENU, isGroup } = await vi.importActual<typeof import("@/config/nav")>("@/config/nav");
    session.user = { id: "u-1", name: "Wren Ash" };
    session.modules = [{ id: "hidden-map", lifecycle: "members" }];
    render(
      <Router hook={memoryLocation({ path: "/", static: true }).hook}>
        <MoreSheet entries={NAV} itemsOf={(g) => g.items as NavLink[]} account={ACCOUNT_MENU.filter((l) => !l.door)} onClose={() => {}} />
      </Router>,
    );
    await act(async () => {});
    const sheet = screen.getByRole("dialog", { name: "More" });
    // Open each group in turn, then each folder in it, collecting each link with WHERE it sits (its section, group and
    // folder), so a link drawn again when its folder reopens is the same place, and only a page in two places counts.
    const seen = new Map<string, Set<string>>();
    const placeOf = (a: Element) => {
      const folder = a.closest("[data-nav-folder]")?.getAttribute("data-nav-folder") ?? "";
      const group = a.closest('[data-wayfinding="menu"] > li')?.querySelector("button")?.textContent?.trim() ?? "";
      const list = a.closest("ul[aria-label]")?.getAttribute("aria-label") ?? a.closest("section")?.getAttribute("aria-labelledby") ?? "";
      return `${list}/${group}/${folder}`;
    };
    const collect = () =>
      sheet.querySelectorAll("a[href]").forEach((a) => {
        const h = a.getAttribute("href")!;
        if (!seen.has(h)) seen.set(h, new Set());
        seen.get(h)!.add(placeOf(a));
      });
    // One folder is open at a time: open each in turn and read its links.
    const openFolders = () => {
      for (const f of Array.from(sheet.querySelectorAll<HTMLButtonElement>("[data-nav-folder] > button"))) {
        if (f.getAttribute("aria-expanded") === "false") act(() => f.click());
        collect();
      }
    };
    openFolders();
    collect();
    for (const label of NAV.filter(isGroup).map((g) => g.label)) {
      const group = within(sheet).getAllByRole("button").find((b) => b.textContent?.trim() === label)!;
      act(() => group.click());
      openFolders();
      collect();
    }
    const twice = Array.from(seen).filter(([, places]) => places.size > 1).map(([h]) => h);
    expect(twice.sort()).toEqual(["/quests", "/roles"]);
  });
});
