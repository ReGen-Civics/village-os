/**
 * THE SPEED CARDS ARE THE MENU (registry.ts). The cards a member may keep are exactly the links Layout already
 * filtered for them, so the picker can never offer a page their menu would not; a new member's six are Profile,
 * Messages, My tasks, Journal, then Pull a card when it is registered and shown, then open slots.
 */
import { describe, expect, it } from "vitest";
import type { NavGroup, NavLink } from "@/config/nav";
import { TASK_BOARD_PATH } from "@shared/taskMenu";
import { parseSpeedCardSlots, readSpeedCards } from "@shared/speedCards";
import { buildRegistry, defaultSlots, moveSlot, placeAt, PULL_A_CARD_ID, removeAt, resolveSlots, searchCards, type SpeedCardDef } from "./registry";

const ACCOUNT = [
  { href: "/profile", label: "My Profile" },
  { href: "/messages", label: "Messages", count: "messages" as const },
  { href: TASK_BOARD_PATH, label: "My tasks", count: "tasks" as const },
  { href: "/journal", label: "Journal", sub: "Your things" },
  { href: "/badges", label: "Badges", sub: "Your things" },
];
const VILLAGE: NavGroup = {
  label: "Village",
  items: [
    { href: "/map", label: "Living Map" },
    { href: "/quests", label: "Quests" },
    { href: "/library", label: "Library", sub: "Shared things" },
  ],
};
const GOVERN: NavGroup = { label: "Governance", items: [{ href: "/governance", label: "Now" }, { href: "/admin/review", label: "Review", roles: ["admin"] }] };
/** What Layout hands the sheet: here, a reader who may not open the admin's Review. */
const visible = (l: NavLink) => !l.roles;
const itemsOf = (g: NavGroup) => g.items.filter(visible);
const words = { yours: "Yours", more: "More" };
const PULL: SpeedCardDef = { id: PULL_A_CARD_ID, label: "Pull a card", action: () => undefined, defaultAfter: "/journal" };

const reg = (registered: SpeedCardDef[] = []) => buildRegistry({ entries: [VILLAGE, GOVERN], itemsOf, account: ACCOUNT, registered, words });

describe("the speed-card registry", () => {
  it("holds every page the menu offers this reader, grouped as the menu groups them, Yours last", () => {
    const r = reg([PULL]);
    expect(r.groups.map((g) => g.label)).toEqual(["Village", "Governance", "Yours"]);
    expect(r.groups[0].cards.map((c) => c.id)).toEqual(["/map", "/quests", "/library"]);
    expect(r.groups[2].cards.map((c) => c.id)).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", "/badges", PULL_A_CARD_ID]);
  });

  it("never offers a page the menu filtered out for this reader", () => {
    const r = reg();
    expect(r.byId.has("/admin/review")).toBe(false);
    expect(searchCards(r, "review")).toEqual([]);
  });

  it("carries the counts for Messages and My tasks, and nobody else's", () => {
    const r = reg();
    expect(r.byId.get("/messages")?.count).toBe("messages");
    expect(r.byId.get(TASK_BOARD_PATH)?.count).toBe("tasks");
    expect(r.byId.get("/journal")?.count).toBeUndefined();
  });
});

describe("a new member's six", () => {
  it("with Human Design or Gene Keys on: Profile, Messages, My tasks, Journal, Pull a card, then one open slot", () => {
    const r = reg([PULL]);
    expect(defaultSlots(r, [PULL])).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", PULL_A_CARD_ID, null]);
  });

  it("with both off: the four, then two open slots", () => {
    const r = reg();
    expect(defaultSlots(r, [])).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", null, null]);
  });

  it("leaves out a default whose page this member cannot open, and the slot stays open", () => {
    const r = buildRegistry({ entries: [VILLAGE], itemsOf, account: ACCOUNT.filter((a) => a.href !== "/messages"), registered: [], words });
    expect(defaultSlots(r, [])).toEqual(["/profile", TASK_BOARD_PATH, "/journal", null, null, null]);
  });

  it("places two registered defaults in their order: Pull a card, then Pay after it", () => {
    const PAY: SpeedCardDef = { id: "/pay", href: "/pay", label: "Pay", defaultAfter: PULL_A_CARD_ID };
    expect(defaultSlots(reg([PAY, PULL]), [PAY, PULL])).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", PULL_A_CARD_ID, "/pay"]);
    expect(defaultSlots(reg([PAY]), [PAY])).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", "/pay", null]);
  });
});

describe("changing the six", () => {
  const six = ["/profile", "/messages", TASK_BOARD_PATH, "/journal", null, null];

  it("moves a card and closes the others up around it", () => {
    expect(moveSlot(six, 3, 0)).toEqual(["/journal", "/profile", "/messages", TASK_BOARD_PATH, null, null]);
    expect(moveSlot(six, 0, 1)).toEqual(["/messages", "/profile", TASK_BOARD_PATH, "/journal", null, null]);
    expect(moveSlot(six, 0, -1)).toEqual(six);
  });

  it("removes a card, leaving an open slot in its place", () => {
    expect(removeAt(six, 1)).toEqual(["/profile", null, TASK_BOARD_PATH, "/journal", null, null]);
  });

  it("adds a card into the slot asked for, and a card already kept moves there instead of showing twice", () => {
    expect(placeAt(six, 4, "/map")).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", "/map", null]);
    expect(placeAt(six, 5, "/profile")).toEqual([null, "/messages", TASK_BOARD_PATH, "/journal", null, "/profile"]);
  });

  it("draws a saved card this member can no longer open as an open slot", () => {
    const r = reg();
    expect(resolveSlots(["/admin/review", "/map"], r).map((c) => c?.id ?? null)).toEqual([null, "/map", null, null, null, null]);
  });
});

describe("search", () => {
  it("matches every word, any case, in the name, its folder or its group", () => {
    const r = reg();
    expect(searchCards(r, "LIB").map((c) => c.id)).toEqual(["/library"]);
    expect(searchCards(r, "shared").map((c) => c.id)).toEqual(["/library"]);
    expect(searchCards(r, "village map").map((c) => c.id)).toEqual(["/map"]);
    expect(searchCards(r, "your things").map((c) => c.id)).toEqual(["/journal", "/badges"]);
    expect(searchCards(r, "nothing like this")).toEqual([]);
  });

  it("forgives one typo a word of four letters or more, and never on a short word", () => {
    const r = reg();
    expect(searchCards(r, "libary").map((c) => c.id)).toEqual(["/library"]);
    expect(searchCards(r, "quets").map((c) => c.id)).toEqual(["/quests"]);
    expect(searchCards(r, "jornal").map((c) => c.id)).toEqual(["/journal"]);
    // Two neighbours swapped count as one typo.
    expect(searchCards(r, "qeusts").map((c) => c.id)).toEqual(["/quests"]);
    expect(searchCards(r, "lbirary").map((c) => c.id)).toEqual(["/library"]);
    expect(searchCards(r, "mao")).toEqual([]);
    expect(searchCards(r, "librxyz")).toEqual([]);
  });
});

describe("a registered default still waiting on its rule", () => {
  it("keeps its place among the defaults, so the sheet can hold it quietly", () => {
    const r = reg();
    expect(defaultSlots(r, [PULL], new Set([PULL_A_CARD_ID]))).toEqual(["/profile", "/messages", TASK_BOARD_PATH, "/journal", PULL_A_CARD_ID, null]);
  });
});

describe("what the server keeps (shared/speedCards.ts)", () => {
  it("takes six slots of ids or nulls, pads a short list, and clears with null", () => {
    expect(parseSpeedCardSlots(["/map", null])).toEqual({ ok: true, value: ["/map", null, null, null, null, null] });
    expect(parseSpeedCardSlots(null)).toEqual({ ok: true, value: null });
  });

  it("refuses seven, a card twice, a non-list and an id that is not an address or a name", () => {
    expect(parseSpeedCardSlots(["a", "b", "c", "d", "e", "f", "g"])).toEqual({ ok: false, problem: "too_many_slots" });
    expect(parseSpeedCardSlots(["/map", "/map"])).toEqual({ ok: false, problem: "card_twice" });
    expect(parseSpeedCardSlots("/map")).toEqual({ ok: false, problem: "slots_not_a_list" });
    expect(parseSpeedCardSlots(["<script>"])).toEqual({ ok: false, problem: "bad_card_id" });
    expect(parseSpeedCardSlots([{ href: "/map" }])).toEqual({ ok: false, problem: "bad_card_id" });
  });

  it("reads a member's prefs, and reads junk as never chosen", () => {
    expect(readSpeedCards({ speedCards: ["/map"] })).toEqual(["/map", null, null, null, null, null]);
    expect(readSpeedCards({ speedCards: "junk" })).toBeNull();
    expect(readSpeedCards(null)).toBeNull();
  });
});
