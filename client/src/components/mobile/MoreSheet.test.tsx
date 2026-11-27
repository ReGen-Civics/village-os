// @vitest-environment jsdom
/**
 * MORE, THE PHONE'S ONE MENU (phone doors v4). The member's six speed cards
 * (SpeedCards.tsx; their own tests are SpeedCards.test.tsx) come from the
 * entries Layout already gated, Pay joins them once credits are in use
 * (shared/payGate.ts), the list under them holds the account entries not on a
 * card, and Roles never appears: it is a tab.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
    const body = path === "/api/pay" ? session.pay : path === "/api/pay/recent" ? session.recent : path === "/api/profile/speed-cards" ? { slots: null } : null;
    return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response("{}", { status: 404 });
  }),
}));
vi.mock("@/lib/navVisits", () => ({ mostVisited: () => (session.most ? [session.most] : []) }));
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
  window.localStorage.clear();
  session.user = { id: "u1", name: "Ana" };
  session.pay = { tokens: [{ balance: 4 }] };
  session.recent = { people: [] };
  session.most = null;
  session.phone = true;
  session.modules = [];
});
afterEach(cleanup);

describe("the More sheet", () => {
  it("draws the cards in order: Profile, Messages, My tasks, Journal, then Pay once credits are in use", async () => {
    const { container } = await draw();
    expect(tiles(container)).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", "/pay"]);
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
  });

  it("keeps Pay away until credits are in use for this member", async () => {
    session.pay = { tokens: [{ balance: 0 }] };
    session.recent = { people: [] };
    const { container } = await draw();
    expect(tiles(container)).not.toContain("/pay");
  });

  it("leaves the open slots as +, and offers the member's most visited page first in the picker", async () => {
    session.pay = { tokens: [{ balance: 0 }] };
    session.most = "/events";
    await draw();
    expect(screen.getAllByRole("button", { name: "Add a card" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Add a card" })[0]);
    const picker = await screen.findByRole("dialog", { name: "Add a card" });
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0));
    });
    expect(within(within(picker).getByRole("region", { name: "You open most" })).getByText("Events")).toBeInTheDocument();
  });

  it("lists the account entries not on a card under them, and never Roles", async () => {
    await draw();
    const also = screen.getByRole("list", { name: "Also yours" });
    expect(within(also).getByText("Badges")).toBeInTheDocument();
    expect(within(also).queryByText("Journal")).toBeNull();
    expect(screen.queryByText("Roles")).toBeNull();
  });

  it("puts a card's page back in the list once the member takes it off the cards", async () => {
    session.pay = { tokens: [{ balance: 0 }] };
    await draw();
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Journal" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0));
    });
    expect(within(screen.getByRole("list", { name: "Also yours" })).getByText("Journal")).toBeInTheDocument();
  });

  it("keeps the sheet open when Escape leaves edit mode, and closes it on the next", async () => {
    const onClose = vi.fn();
    window.matchMedia = ((q: string) => ({ matches: session.phone, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    const { hook } = memoryLocation({ path: "/quests" });
    render(
      <Router hook={hook}>
        <MoreSheet entries={[COMMUNITY]} itemsOf={(g) => g.items as NavLink[]} account={ACCOUNT} onClose={onClose} />
      </Router>,
    );
    await act(async () => {
      await new Promise((done) => setTimeout(done, 0));
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Done" }), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit your cards" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Edit your cards" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the hidden map a tap away while its module is on (the lotus's row, logging a place in the field)", async () => {
    await draw();
    expect(screen.queryByText("Hidden map")).toBeNull();
    cleanup();
    session.modules = [{ id: "hidden-map", lifecycle: "members" }];
    await draw();
    expect(within(screen.getByRole("list", { name: "Also yours" })).getByText("Hidden map").closest("a")).toHaveAttribute("href", "/hidden-map");
  });

  it("is a modal named More that keeps the night in dark mode, with the foot's language and mode", async () => {
    await draw();
    const sheet = screen.getByRole("dialog", { name: "More" });
    expect(sheet).toHaveAttribute("aria-modal", "true");
    expect(sheet).toHaveAttribute("data-scene");
    expect(within(sheet).getByText("language")).toBeInTheDocument();
    expect(within(sheet).getByText("mode")).toBeInTheDocument();
  });

  it("offers a visitor sign in and Work with us", async () => {
    session.user = null;
    const { container } = await draw();
    expect(tiles(container)).toEqual(["/login", "/work-with-us"]);
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
