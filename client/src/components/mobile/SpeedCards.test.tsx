// @vitest-environment jsdom
/**
 * YOUR SPEED CARDS (SpeedCards.tsx): the six at the top of More, the member's own to choose. A "+" opens a picker
 * of the pages their menu offers them; a hold, a right-click or the Edit button opens edit mode, where cards are
 * removed, moved by drag or by keyboard, and Done saves them to the member's own prefs on the server.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type { NavGroup, NavLink } from "@/config/nav";
import { TASK_BOARD_PATH } from "@shared/taskMenu";

const session = vi.hoisted(() => ({
  user: { id: "u1", name: "Ana" } as null | { id: string; name: string },
  /** What the server holds for this member, by member id. */
  server: {} as Record<string, unknown>,
  puts: [] as { who: string; body: any }[],
  reduce: false,
  most: [] as string[],
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: session.user, logout: vi.fn() }) }));
vi.mock("@/lib/gameApi", () => ({
  gameFetch: vi.fn(async (path: string, init: RequestInit = {}) => {
    const who = session.user?.id ?? "";
    if (path === "/api/profile/speed-cards") {
      if (init.method === "PUT") {
        const body = JSON.parse(String(init.body));
        session.puts.push({ who, body });
        session.server[who] = body.slots;
        return new Response(JSON.stringify({ slots: body.slots }), { status: 200 });
      }
      return new Response(JSON.stringify({ slots: session.server[who] ?? null }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  }),
}));
vi.mock("@/lib/navVisits", () => ({ mostVisited: () => session.most }));
vi.mock("@/components/tasks/TaskCountBadge", () => ({ default: () => <span>3</span> }));
vi.mock("@/components/messages/MessageCountBadge", () => ({ default: () => <span>1</span> }));
// The registered cards, as the Pull a card lane will add its own: one with a rule this test turns on and off.
const lens = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/speedCards/registered", () => ({
  REGISTERED_CARDS: [
    {
      id: "pull-a-card",
      label: { id: "pull", message: "Pull a card" },
      action: () => undefined,
      defaultAfter: "/journal",
      useShown: () => lens.on,
    },
  ],
}));

import SpeedCards, { HOLD_MS } from "./SpeedCards";

const ACCOUNT = [
  { href: "/profile", label: "My Profile" },
  { href: "/messages", label: "Messages", count: "messages" as const },
  { href: TASK_BOARD_PATH, label: "My tasks", count: "tasks" as const },
  { href: "/journal", label: "Journal" },
  { href: "/badges", label: "Badges" },
];
const VILLAGE: NavGroup = { label: "Village", items: [{ href: "/map", label: "Living Map" }, { href: "/library", label: "Library" }] };
const GOVERN: NavGroup = { label: "Governance", items: [{ href: "/governance", label: "Now" }, { href: "/admin", label: "Village Settings", roles: ["admin"] }] };
/** Layout's filter for a plain member: the admin's page is not theirs. */
const itemsOf = (g: NavGroup) => g.items.filter((l: NavLink) => !l.roles);

function media() {
  window.matchMedia = ((q: string) => ({
    matches: q.includes("reduced-motion") ? session.reduce : true,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

async function draw() {
  media();
  const { hook } = memoryLocation({ path: "/quests" });
  const r = render(
    <Router hook={hook}>
      <SpeedCards who={session.user!.id} entries={[VILLAGE, GOVERN]} itemsOf={itemsOf} account={ACCOUNT} onClose={() => {}} />
    </Router>,
  );
  await settle();
  return r;
}

async function settle() {
  await act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
}

/** The six slots, as ids, "+" for an open one. */
const slots = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLElement>("[data-slot]")).map((li) => li.querySelector<HTMLElement>("[data-speed-card]")?.dataset.speedCard ?? "+");

beforeEach(() => {
  session.user = { id: "u1", name: "Ana" };
  session.server = {};
  session.puts = [];
  session.reduce = false;
  session.most = [];
  lens.on = false;
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the defaults", () => {
  it("without Human Design or Gene Keys: Profile, Messages, My tasks, Journal and two open slots", async () => {
    const { container } = await draw();
    expect(slots(container)).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", "+", "+"]);
    expect(screen.getAllByRole("button", { name: "Add a card" })).toHaveLength(2);
  });

  it("with either on: Pull a card fifth, one open slot", async () => {
    lens.on = true;
    const { container } = await draw();
    expect(slots(container)).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", "pull-a-card", "+"]);
  });

  it("carries the member's own counts on Messages and My tasks", async () => {
    await draw();
    expect(within(screen.getByRole("link", { name: /Messages/ })).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /My tasks/ })).getByText("3")).toBeInTheDocument();
  });
});

describe("the picker", () => {
  it("offers only pages the menu offers this member, in the menu's groups", async () => {
    await draw();
    fireEvent.click(screen.getAllByRole("button", { name: "Add a card" })[0]);
    const picker = await screen.findByRole("dialog", { name: "Add a card" });
    expect(within(picker).getByRole("region", { name: "Village" })).toBeInTheDocument();
    expect(within(picker).getByRole("region", { name: "Governance" })).toBeInTheDocument();
    expect(within(picker).getByRole("region", { name: "Yours" })).toBeInTheDocument();
    expect(within(picker).queryByText("Village Settings")).toBeNull();
    // A page already on the cards cannot be added twice.
    expect(within(picker).getByRole("button", { name: /Journal/ })).toBeDisabled();
  });

  it("finds a page by search, and says so when nothing matches", async () => {
    await draw();
    fireEvent.click(screen.getAllByRole("button", { name: "Add a card" })[0]);
    const picker = await screen.findByRole("dialog", { name: "Add a card" });
    fireEvent.change(within(picker).getByRole("searchbox"), { target: { value: "libr" } });
    expect(Array.from(picker.querySelectorAll("[data-speed-pick]")).map((b) => b.getAttribute("data-speed-pick"))).toEqual(["/library"]);
    fireEvent.change(within(picker).getByRole("searchbox"), { target: { value: "settings" } });
    expect(within(picker).getByText("Nothing matches. Try another word.")).toBeInTheDocument();
  });

  it("puts the pages this device opens most first, only those the member may keep", async () => {
    session.most = ["/library", "/admin"];
    await draw();
    fireEvent.click(screen.getAllByRole("button", { name: "Add a card" })[0]);
    const picker = await screen.findByRole("dialog", { name: "Add a card" });
    await settle();
    const first = within(picker).getByRole("region", { name: "You open most" });
    expect(Array.from(first.querySelectorAll("[data-speed-pick]")).map((b) => b.getAttribute("data-speed-pick"))).toEqual(["/library"]);
  });

  it("adds the tapped page into the slot, and saves it for the member", async () => {
    const { container } = await draw();
    fireEvent.click(screen.getAllByRole("button", { name: "Add a card" })[1]);
    const picker = await screen.findByRole("dialog", { name: "Add a card" });
    fireEvent.click(within(picker).getByRole("button", { name: /Living Map/ }));
    await settle();
    expect(slots(container)).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", "+", "/map"]);
    expect(session.puts.at(-1)).toEqual({ who: "u1", body: { slots: ["/profile", "/messages", TASK_BOARD_PATH, "/journal", null, "/map"] } });
  });
});

describe("edit mode", () => {
  it("opens on a held press, with a ring while it fills, and the hold never opens the page", async () => {
    vi.useFakeTimers();
    media();
    const { hook } = memoryLocation({ path: "/quests" });
    const nav = vi.fn();
    const { container } = render(
      <Router hook={hook}>
        <SpeedCards who="u1" entries={[VILLAGE]} itemsOf={itemsOf} account={ACCOUNT} onClose={nav} />
      </Router>,
    );
    const journal = screen.getByRole("link", { name: /Journal/ });
    fireEvent.pointerDown(journal, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    expect(journal.querySelector("[data-hold-ring]")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(HOLD_MS - 50);
    });
    expect(container.querySelector("[data-editing]")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(container.querySelector("[data-editing]")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Done" })).toHaveFocus();
    expect(nav).not.toHaveBeenCalled();
  });

  it("does not open when the press moves (a scroll), or lets go early (a tap)", async () => {
    vi.useFakeTimers();
    media();
    const { hook } = memoryLocation({ path: "/quests" });
    const { container } = render(
      <Router hook={hook}>
        <SpeedCards who="u1" entries={[VILLAGE]} itemsOf={itemsOf} account={ACCOUNT} onClose={() => {}} />
      </Router>,
    );
    const journal = screen.getByRole("link", { name: /Journal/ });
    fireEvent.pointerDown(journal, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(journal, { clientX: 10, clientY: 40, pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(HOLD_MS + 50);
    });
    expect(container.querySelector("[data-editing]")).toBeNull();
    fireEvent.pointerDown(journal, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(journal, { pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(HOLD_MS + 50);
    });
    expect(container.querySelector("[data-editing]")).toBeNull();
  });

  it("opens on a right-click (a desktop's long press)", async () => {
    const { container } = await draw();
    fireEvent.contextMenu(screen.getByRole("link", { name: /Journal/ }));
    expect(container.querySelector("[data-editing]")).toBeTruthy();
  });

  it("opens from the Edit button too, so nobody depends on a long press", async () => {
    const { container } = await draw();
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    expect(container.querySelector("[data-editing]")).toBeTruthy();
    // Every card shows its remove badge and its arrows; the open slots stay.
    expect(screen.getByRole("button", { name: "Remove Journal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Journal left" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add a card" })).toHaveLength(2);
  });

  it("reorders by keyboard, keeps focus on the moved card, and saves on Done", async () => {
    const { container } = await draw();
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Journal left" }));
    expect(slots(container)).toEqual(["/profile", "/messages", "/journal", TASK_BOARD_PATH, "+", "+"]);
    expect(screen.getByRole("button", { name: "Move Journal left" })).toHaveFocus();
    expect(screen.getByText("Journal moved to place 3 of 6.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Move Profile right" }));
    expect(slots(container)).toEqual(["/messages", "/profile", "/journal", TASK_BOARD_PATH, "+", "+"]);
    // Nothing is saved until Done.
    expect(session.puts).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await settle();
    expect(container.querySelector("[data-editing]")).toBeNull();
    expect(session.puts).toEqual([{ who: "u1", body: { slots: ["/messages", "/profile", "/journal", TASK_BOARD_PATH, null, null] } }]);
    expect(screen.getByRole("button", { name: "Edit your cards" })).toHaveFocus();
  });

  it("removes a card, and the slot it leaves is a +", async () => {
    const { container } = await draw();
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Messages" }));
    expect(slots(container)).toEqual(["/profile", "+", TASK_BOARD_PATH, "/journal", "+", "+"]);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await settle();
    expect(session.puts.at(-1)?.body.slots).toEqual(["/profile", null, TASK_BOARD_PATH, "/journal", null, null]);
  });

  it("leaves without saving on Escape, and Reset puts the defaults back", async () => {
    session.server.u1 = ["/map", "/profile", null, null, null, null];
    const { container } = await draw();
    expect(slots(container)).toEqual(["/map", "/profile", "+", "+", "+", "+"]);
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Living Map" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Done" }), { key: "Escape" });
    expect(slots(container)).toEqual(["/map", "/profile", "+", "+", "+", "+"]);
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await settle();
    expect(session.puts.at(-1)?.body.slots).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", null, null]);
  });

  it("wiggles once as it opens, and with reduced motion wears outlines and never moves", async () => {
    const animate = vi.fn();
    (HTMLElement.prototype as any).animate = animate;
    let r = await draw();
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    expect(r.container.querySelector("[data-speed-cards]")?.getAttribute("data-motion")).toBe("moves");
    expect(animate).toHaveBeenCalled();
    expect(animate.mock.calls[0][1].iterations ?? 1).toBe(1);
    expect(animate.mock.calls[0][1].duration).toBeLessThanOrEqual(600);
    cleanup();
    animate.mockClear();
    session.reduce = true;
    r = await draw();
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    expect(r.container.querySelector("[data-speed-cards]")?.getAttribute("data-motion")).toBe("still");
    expect(animate).not.toHaveBeenCalled();
    expect(r.container.querySelector("[data-edit-card]")?.className).toContain("outline-dashed");
    delete (HTMLElement.prototype as any).animate;
  });
});

describe("kept for the member", () => {
  it("round-trips through the server: a save on one device is the cards on the next", async () => {
    let r = await draw();
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Journal" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await settle();
    cleanup();
    // A new device: nothing cached, the server's copy draws.
    window.localStorage.clear();
    r = await draw();
    expect(slots(r.container)).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "+", "+", "+"]);
  });

  it("paints from this browser's copy before the server answers, and never shows one member another's cards", async () => {
    window.localStorage.setItem("village-speed-cards:u1", JSON.stringify(["/library", null, null, null, null, null]));
    session.server.u1 = ["/library", null, null, null, null, null];
    media();
    const { hook } = memoryLocation({ path: "/quests" });
    const first = render(
      <Router hook={hook}>
        <SpeedCards who="u1" entries={[VILLAGE]} itemsOf={itemsOf} account={ACCOUNT} onClose={() => {}} />
      </Router>,
    );
    // Before any answer: the cached cards are already drawn.
    expect(slots(first.container)).toEqual(["/library", "+", "+", "+", "+", "+"]);
    await settle();
    cleanup();
    session.user = { id: "u2", name: "Bo" };
    const r = await draw();
    expect(slots(r.container)).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", "+", "+"]);
  });
});
