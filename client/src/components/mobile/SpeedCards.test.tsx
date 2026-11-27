// @vitest-environment jsdom
/**
 * YOUR SPEED CARDS (SpeedCards.tsx): the six at the top of More, the member's own to choose. A "+" opens a picker
 * of the pages their menu offers them; a hold, a right-click or the Edit button opens edit mode, where cards keep
 * their size, are removed, picked and moved by the strip's arrows or by drag, and Done saves them to the member's
 * own prefs on the server. QA round 1's findings each have a test here: the swallowed finger-lift, the steady edge,
 * focus after adding, Escape from anywhere, a link mid-edit saving, and the quiet slots while answers are pending.
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
  /** While set, the GET of the cards waits for this to resolve (a slow first answer on a new device). */
  hold: null as null | Promise<void>,
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
      if (session.hold) await session.hold;
      return new Response(JSON.stringify({ slots: session.server[who] ?? null }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  }),
}));
vi.mock("@/lib/navVisits", () => ({ mostVisited: () => session.most }));
vi.mock("@/components/tasks/TaskCountBadge", () => ({ default: () => <span>3</span> }));
vi.mock("@/components/messages/MessageCountBadge", () => ({ default: () => <span>1</span> }));
// The registered cards, as the Pull a card lane adds its own: one with a rule this test turns on, off, or leaves
// unanswered (null, the way Pay's credits check reads before it answers).
const lens = vi.hoisted(() => ({ on: false as boolean | null }));
vi.mock("@/lib/speedCards/registered", () => ({
  cardLabel: (c: { label: { message: string } }) => c.label.message,
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

import SpeedCards, { HOLD_MS, QUIET_MS } from "./SpeedCards";

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

function mount(onClose: () => void = () => {}) {
  media();
  const { hook } = memoryLocation({ path: "/quests" });
  return render(
    <Router hook={hook}>
      <SpeedCards who={session.user!.id} entries={[VILLAGE, GOVERN]} itemsOf={itemsOf} account={ACCOUNT} onClose={onClose} />
      {/* A link elsewhere in the sheet, the way the village menu sits under the cards. */}
      <a href="/forum">Forum</a>
    </Router>,
  );
}

async function draw() {
  const r = mount();
  await settle();
  return r;
}

async function settle() {
  await act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
}

/** The six slots, as ids: "+" for an open one, "~" for a quiet one still waiting. */
const slots = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLElement>("[data-slot]")).map((li) =>
    li.querySelector("[data-speed-wait]") ? "~" : (li.querySelector<HTMLElement>("[data-speed-card]")?.dataset.speedCard ?? "+"),
  );

/** This browser already holds the member's cards, so the first paint needs no answer. */
const cached = (who = "u1", list: (string | null)[] = ["/profile", "/messages", TASK_BOARD_PATH, "/journal", null, null]) =>
  window.localStorage.setItem(`village-speed-cards:${who}`, JSON.stringify(list));

beforeEach(() => {
  session.user = { id: "u1", name: "Ana" };
  session.server = {};
  session.puts = [];
  session.reduce = false;
  session.most = [];
  session.hold = null;
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
    // Each open slot names its place for a screen reader.
    expect(screen.getAllByRole("button", { name: /^Add a card, place / }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Add a card, place 5 of 6",
      "Add a card, place 6 of 6",
    ]);
  });

  it("with either on: Pull a card fifth, one open slot", async () => {
    lens.on = true;
    const { container } = await draw();
    expect(slots(container)).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", "pull-a-card", "+"]);
  });

  it("holds a registered card's slot quietly while its rule has not answered, never flashing +", async () => {
    lens.on = null;
    const { container, rerender } = await draw();
    expect(slots(container)).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", "~", "+"]);
    expect(container.querySelector("ul")?.getAttribute("aria-busy")).toBe("true");
    lens.on = true;
    const { hook } = memoryLocation({ path: "/quests" });
    rerender(
      <Router hook={hook}>
        <SpeedCards who="u1" entries={[VILLAGE, GOVERN]} itemsOf={itemsOf} account={ACCOUNT} onClose={() => {}} />
      </Router>,
    );
    await settle();
    expect(slots(container)).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", "pull-a-card", "+"]);
  });

  it("carries the member's own counts on Messages and My tasks", async () => {
    await draw();
    expect(within(screen.getByRole("link", { name: /Messages/ })).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /My tasks/ })).getByText("3")).toBeInTheDocument();
  });
});

describe("a new device", () => {
  it("keeps the slots quiet while the server answers, then draws the member's own cards", async () => {
    session.server.u1 = ["/library", null, null, null, null, null];
    let answer!: () => void;
    session.hold = new Promise((r) => (answer = r));
    const { container } = mount();
    expect(slots(container)).toEqual(["~", "~", "~", "~", "~", "~"]);
    expect(screen.getByRole("button", { name: "Edit your cards" })).toBeDisabled();
    await act(async () => answer());
    await settle();
    expect(slots(container)).toEqual(["/library", "+", "+", "+", "+", "+"]);
  });

  it("waits no longer than QUIET_MS before drawing the defaults", async () => {
    vi.useFakeTimers();
    session.hold = new Promise(() => undefined);
    const { container } = mount();
    expect(slots(container)[0]).toBe("~");
    act(() => {
      vi.advanceTimersByTime(QUIET_MS);
    });
    expect(slots(container)).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", "+", "+"]);
  });
});

describe("the picker", () => {
  it("offers only pages the menu offers this member, in the menu's groups, each with a glyph row", async () => {
    await draw();
    fireEvent.click(screen.getAllByRole("button", { name: /^Add a card, place / })[0]);
    const picker = await screen.findByRole("dialog", { name: "Add a card" });
    expect(within(picker).getByText("Your quick cards")).toBeInTheDocument();
    expect(within(picker).getByRole("region", { name: "Village" })).toBeInTheDocument();
    expect(within(picker).getByRole("region", { name: "Governance" })).toBeInTheDocument();
    expect(within(picker).getByRole("region", { name: "Yours" })).toBeInTheDocument();
    expect(within(picker).queryByText("Village Settings")).toBeNull();
    // A page already on the cards cannot be added twice.
    expect(within(picker).getByRole("button", { name: /Journal/ })).toBeDisabled();
  });

  it("finds a page by search, forgives a typo, and says so when nothing matches", async () => {
    await draw();
    fireEvent.click(screen.getAllByRole("button", { name: /^Add a card, place / })[0]);
    const picker = await screen.findByRole("dialog", { name: "Add a card" });
    const ids = () => Array.from(picker.querySelectorAll("[data-speed-pick]")).map((b) => b.getAttribute("data-speed-pick"));
    fireEvent.change(within(picker).getByRole("searchbox"), { target: { value: "libr" } });
    expect(ids()).toEqual(["/library"]);
    fireEvent.change(within(picker).getByRole("searchbox"), { target: { value: "libary" } });
    expect(ids()).toEqual(["/library"]);
    fireEvent.change(within(picker).getByRole("searchbox"), { target: { value: "settings" } });
    expect(within(picker).getByText("Nothing matches. Try another word.")).toBeInTheDocument();
  });

  it("puts the pages this device opens most first, as tiles, only those the member may keep", async () => {
    session.most = ["/library", "/admin"];
    await draw();
    fireEvent.click(screen.getAllByRole("button", { name: /^Add a card, place / })[0]);
    const picker = await screen.findByRole("dialog", { name: "Add a card" });
    await settle();
    const first = within(picker).getByRole("region", { name: "You open most" });
    expect(Array.from(first.querySelectorAll("[data-speed-pick]")).map((b) => b.getAttribute("data-speed-pick"))).toEqual(["/library"]);
  });

  it("adds the tapped page into the slot, saves it, and puts focus on the new card", async () => {
    const { container } = await draw();
    fireEvent.click(screen.getAllByRole("button", { name: /^Add a card, place / })[1]);
    const picker = await screen.findByRole("dialog", { name: "Add a card" });
    fireEvent.click(within(picker).getByRole("button", { name: /Living Map/ }));
    await settle();
    expect(slots(container)).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", "+", "/map"]);
    expect(session.puts.at(-1)).toEqual({ who: "u1", body: { slots: ["/profile", "/messages", TASK_BOARD_PATH, "/journal", null, "/map"] } });
    expect(screen.getByRole("link", { name: /Living Map/ })).toHaveFocus();
  });
});

describe("edit mode", () => {
  it("opens on a held press, with a ring while it fills, and the hold never opens the page", async () => {
    vi.useFakeTimers();
    cached();
    const nav = vi.fn();
    const { container } = mount(nav);
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
    // The held card is the one picked for the strip.
    expect(screen.getByRole("button", { name: "Journal" })).toHaveAttribute("aria-pressed", "true");
    expect(nav).not.toHaveBeenCalled();
    // The finger lifts; the swallow lets go a moment later.
    fireEvent.pointerUp(document.body, { pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
  });

  it("swallows the finger lifting after a hold (a touch), so it never taps what edit mode drew under it", async () => {
    vi.useFakeTimers();
    cached();
    const { container } = mount();
    const journal = screen.getByRole("link", { name: /Journal/ });
    fireEvent.pointerDown(journal, { button: 0, clientX: 10, clientY: 10, pointerId: 1, pointerType: "touch" });
    act(() => {
      vi.advanceTimersByTime(HOLD_MS + 10);
    });
    // The lift, then the click it makes, on whatever is under the finger now.
    const under = screen.getByRole("button", { name: "Remove Journal" });
    fireEvent.pointerUp(under, { pointerId: 1, pointerType: "touch" });
    fireEvent.click(under);
    fireEvent.click(screen.getByRole("button", { name: "Move Journal left" }));
    expect(slots(container)).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", "+", "+"]);
    // A moment later the next tap is the member's own, and works.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.click(screen.getByRole("button", { name: "Move Journal left" }));
    expect(slots(container)).toEqual(["/profile", "/messages", "/journal", TASK_BOARD_PATH, "+", "+"]);
  });

  it("keeps every card's size: the arrows live in a strip under the grid, not inside the cards", async () => {
    const { container } = await draw();
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    expect(container.querySelector("[data-edit-card] [data-dir]")).toBeNull();
    expect(container.querySelector("[data-move-strip] [data-dir='left']")).toBeTruthy();
    expect(container.querySelector("[data-speed-face]")?.className).toContain("min-h-[calc(4.5rem-2px)]");
  });

  it("keeps the paper: the skin sits on a box (the light skin skips buttons), with a clear button filling it", async () => {
    const { container } = await draw();
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    const paper = container.querySelector<HTMLElement>("[data-speed-paper]")!;
    expect(paper.tagName).toBe("DIV");
    expect(paper.className.split(" ")).toEqual(expect.arrayContaining(["bg-muted", "border", "rounded-xl"]));
    const face = paper.querySelector<HTMLElement>("[data-speed-face]")!;
    expect(face.className).toContain("bg-transparent");
    expect(face.className).not.toMatch(/(^| )bg-muted( |$)/);
    // The dashed edge in full gold (3:1 or better), drawn clear of the paper's torn edge.
    const edge = face.querySelector<HTMLElement>("[data-speed-edge]")!;
    expect(edge.className.split(" ")).toEqual(expect.arrayContaining(["border-dashed", "border-notice", "inset-2.5"]));
  });

  it("does not open when the press moves (a scroll), or lets go early (a tap)", async () => {
    vi.useFakeTimers();
    cached();
    const { container } = mount();
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

  it("opens on a right-click, and never eats the next click (Windows Chrome fires contextmenu after mouseup)", async () => {
    const { container } = await draw();
    // The right button is already up when contextmenu arrives: no press is down.
    fireEvent.contextMenu(screen.getByRole("link", { name: /Journal/ }));
    expect(container.querySelector("[data-editing]")).toBeTruthy();
    // The very next click is the member's own.
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(container.querySelector("[data-editing]")).toBeNull();
  });

  it("guards the lift when contextmenu arrives while a press is down (Android's long press)", async () => {
    const { container } = await draw();
    const journal = screen.getByRole("link", { name: /Journal/ });
    fireEvent.pointerDown(journal, { button: 0, clientX: 10, clientY: 10, pointerId: 1, pointerType: "touch" });
    fireEvent.contextMenu(journal);
    expect(container.querySelector("[data-editing]")).toBeTruthy();
    const under = screen.getByRole("button", { name: "Remove Journal" });
    fireEvent.pointerUp(under, { pointerId: 1 });
    fireEvent.click(under);
    expect(slots(container)).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", "+", "+"]);
    // A moment later the guard has let go, so the next test starts clean.
    await act(async () => {
      await new Promise((done) => setTimeout(done, 80));
    });
  });

  it("opens from the Edit button too, so nobody depends on a long press, with its hint in words", async () => {
    const { container } = await draw();
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    expect(container.querySelector("[data-editing]")).toBeTruthy();
    // Every card shows its remove badge; the first card is picked; the open slots stay.
    expect(screen.getByRole("button", { name: "Remove Journal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Profile right" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Profile left" })).toBeDisabled();
    expect(screen.getByText("Drag a card, or use its arrows.")).toBeVisible();
    expect(screen.getAllByRole("button", { name: /^Add a card, place / })).toHaveLength(2);
  });

  it("reorders by keyboard, keeps focus on the arrow, and saves on Done", async () => {
    const { container } = await draw();
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    fireEvent.click(screen.getByRole("button", { name: "Journal" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Journal left" }));
    expect(slots(container)).toEqual(["/profile", "/messages", "/journal", TASK_BOARD_PATH, "+", "+"]);
    expect(screen.getByRole("button", { name: "Move Journal left" })).toHaveFocus();
    expect(screen.getByText("Journal moved to place 3 of 6.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
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

  it("moves focus to the other arrow when a card reaches the end", async () => {
    await draw();
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    fireEvent.click(screen.getByRole("button", { name: "Messages" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Messages left" }));
    expect(screen.getByRole("button", { name: "Move Messages left" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Messages right" })).toHaveFocus();
  });

  it("removes a card, the slot it leaves is a +, and focus lands on it", async () => {
    const { container } = await draw();
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Messages" }));
    expect(slots(container)).toEqual(["/profile", "+", TASK_BOARD_PATH, "/journal", "+", "+"]);
    expect(container.querySelector('[data-speed-open="1"]')).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await settle();
    expect(session.puts.at(-1)?.body.slots).toEqual(["/profile", null, TASK_BOARD_PATH, "/journal", null, null]);
  });

  it("leaves without saving on Escape wherever focus is, and Reset puts the defaults back", async () => {
    session.server.u1 = ["/map", "/profile", null, null, null, null];
    const { container } = await draw();
    expect(slots(container)).toEqual(["/map", "/profile", "+", "+", "+", "+"]);
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Living Map" }));
    // Focus outside the cards altogether.
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(container.querySelector("[data-editing]")).toBeNull();
    expect(slots(container)).toEqual(["/map", "/profile", "+", "+", "+", "+"]);
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await settle();
    expect(session.puts.at(-1)?.body.slots).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", null, null]);
  });

  it("saves first when a link in the sheet is tapped mid-edit", async () => {
    const { container } = await draw();
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Journal" }));
    fireEvent.click(screen.getByRole("link", { name: "Forum" }));
    await settle();
    expect(container.querySelector("[data-editing]")).toBeNull();
    expect(session.puts.at(-1)?.body.slots).toEqual(["/profile", "/messages", TASK_BOARD_PATH, null, null, null]);
  });

  it("wears a steady dashed gold edge for everyone, wiggles once as it opens, and never moves with reduced motion", async () => {
    const animate = vi.fn();
    (HTMLElement.prototype as any).animate = animate;
    let r = await draw();
    fireEvent.click(screen.getByRole("button", { name: "Edit your cards" }));
    expect(r.container.querySelector("[data-speed-cards]")?.getAttribute("data-motion")).toBe("moves");
    expect(r.container.querySelector("[data-speed-face] [data-speed-edge]")?.className).toContain("border-dashed");
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
    expect(r.container.querySelector("[data-speed-face] [data-speed-edge]")?.className).toContain("border-dashed");
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
    cached("u1", ["/library", null, null, null, null, null]);
    session.server.u1 = ["/library", null, null, null, null, null];
    const first = mount();
    // Before any answer: the cached cards are already drawn.
    expect(slots(first.container)).toEqual(["/library", "+", "+", "+", "+", "+"]);
    await settle();
    cleanup();
    session.user = { id: "u2", name: "Bo" };
    const r = await draw();
    expect(slots(r.container)).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", "+", "+"]);
  });
});
