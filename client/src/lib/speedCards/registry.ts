/**
 * THE SPEED CARDS A MEMBER MAY KEEP (the lead, 27 Nov 2026: the six cards at the top of More, "customizable ...
 * to add a card for any of the menu items or pages at all with a drop down and a search bar to find it").
 *
 * There is no second list of pages here. The cards ARE the menu: every link Layout already filtered for this
 * reader (modules, roles, the brochure switch, the front door, the treasury's doors, the village's own hidden
 * entries and renames), grouped the way the menu groups them, then the account entries as "Yours". So a member can
 * never pin a page their menu would not show them, and a page the menu gains is a card the same day.
 *
 * On top of the menu sit the REGISTERED cards (registered.ts): things that are not a menu row, each with its own
 * rule for when it shows (Pay once credits are in use, Pull a card once Human Design or Gene Keys is on).
 *
 * Pure: no React. The sheet hands in what Layout filtered, and what the registered cards' rules answered.
 */
import type { ComponentType } from "react";
import type { NavEntry, NavGroup, NavLink } from "@/config/nav";
import { isGroup } from "@/config/nav";
import { SPEED_CARD_SLOTS, type SpeedCardSlots } from "@shared/speedCards";
import { TASK_BOARD_PATH } from "@shared/taskMenu";

export type SpeedCardIcon = ComponentType<{ className?: string }>;

/** One card a member may keep. */
export interface SpeedCard {
  /** The page's address for a menu entry; the registered card's own name otherwise. */
  id: string;
  label: string;
  /** Drawn where the page icons (config/routeIcons.ts) have none for `href`. */
  icon?: SpeedCardIcon;
  /** Where a tap goes. A card with no `href` runs `action` instead. */
  href?: string;
  /** For a card that opens something in place. It is handed the sheet's close. */
  action?: (close: () => void) => void;
  /** A count beside the label, read for this member alone and hidden at zero (config/nav.ts, `count`). */
  count?: "tasks" | "messages";
  /** The picker's group: the menu's own group name, or "Yours". */
  group: string;
  /** The folder it sits in inside its group, for the picker's second line (config/navNest.ts). */
  sub?: string;
}

/**
 * A REGISTERED CARD: one that is not a menu row. `useShown` is a hook, called once per sheet for each registered
 * card in a fixed order (SpeedCards.tsx renders one probe per card), and answers whether this member sees it now.
 * Absent means always. Answer false while it is unknown, so a card never flashes in and out.
 */
export interface SpeedCardDef extends Omit<SpeedCard, "group"> {
  /** The picker group it sits in. Absent: "Yours". */
  group?: string;
  useShown?: () => boolean;
  /**
   * Where it stands in a new member's six: the place among the defaults it fills when shown (DEFAULT_ORDER).
   * Absent: never a default, only in the picker.
   */
  defaultAfter?: string;
}

/** The id the Pull a card lane registers (speed-cards-shared.md); a default once Human Design or Gene Keys is on. */
export const PULL_A_CARD_ID = "pull-a-card";

/** A new member's cards, in order: Profile, Messages, My tasks, Journal. Registered defaults slot in after these. */
export const DEFAULT_ORDER: readonly string[] = ["/profile", "/messages", TASK_BOARD_PATH, "/journal"];

export interface Registry {
  /** Every card this member may keep, by id. */
  byId: ReadonlyMap<string, SpeedCard>;
  /** The picker's groups, in the menu's order, Yours last. */
  groups: readonly { label: string; cards: readonly SpeedCard[] }[];
}

export interface RegistryInput {
  /** The menu, as Layout filtered it. */
  entries: readonly NavEntry[];
  itemsOf: (group: NavGroup) => NavLink[];
  /** The account entries, as Layout filtered them. */
  account: readonly (NavLink & { count?: "tasks" | "messages" })[];
  /** The registered cards whose rule said yes for this member. */
  registered: readonly SpeedCardDef[];
  /** The translated words for the groups the menu does not name. */
  words: { yours: string; more: string; sub?: (folder: string) => string };
  /** A shorter name a card wears than its menu row, by id: the menu's "My Profile" is the card "Profile". */
  short?: Readonly<Record<string, string>>;
}

export function buildRegistry({ entries, itemsOf, account, registered, words, short }: RegistryInput): Registry {
  const fromLink = (l: NavLink, group: string): SpeedCard => ({
    id: l.href,
    label: l.label,
    href: l.href,
    icon: l.icon,
    count: l.count,
    group,
    sub: l.sub ? (words.sub ? words.sub(l.sub) : l.sub) : undefined,
  });
  const byId = new Map<string, SpeedCard>();
  const groups = new Map<string, SpeedCard[]>();
  const put = (card: SpeedCard) => {
    // A page the menu lists twice (a group and the account) is one card, in the first place it appears.
    if (byId.has(card.id)) return;
    byId.set(card.id, card);
    const list = groups.get(card.group) ?? [];
    list.push(card);
    groups.set(card.group, list);
  };
  for (const e of entries) {
    if (isGroup(e)) for (const l of itemsOf(e)) put(fromLink(l, e.label));
    else put(fromLink(e, words.more));
  }
  for (const a of account) put({ ...fromLink(a, words.yours), label: short?.[a.href] ?? a.label });
  for (const d of registered) {
    const { useShown: _shown, defaultAfter: _after, ...card } = d;
    put({ ...card, group: d.group ?? words.yours });
  }
  // Yours last, whatever order the registered cards arrived in.
  const order = Array.from(groups.keys()).filter((g) => g !== words.yours);
  if (groups.has(words.yours)) order.push(words.yours);
  return { byId, groups: order.map((label) => ({ label, cards: groups.get(label) ?? [] })) };
}

/**
 * A new member's six: DEFAULT_ORDER, each registered default after the card it names (or at the end of the
 * defaults when that card is missing), only the cards this member may keep, then open slots. With Human Design or
 * Gene Keys off that is two open slots: Profile, Messages, My tasks, Journal, +, +.
 */
export function defaultSlots(reg: Registry, registered: readonly SpeedCardDef[]): SpeedCardSlots {
  const order = [...DEFAULT_ORDER];
  const placed = new Map<string, number>();
  for (const d of registered) {
    if (!d.defaultAfter) continue;
    const at = order.indexOf(d.defaultAfter);
    // After the card it names (and after any placed there before it), or at the end when that card is not there.
    const n = placed.get(d.defaultAfter) ?? 0;
    order.splice(at === -1 ? order.length : at + 1 + n, 0, d.id);
    placed.set(d.defaultAfter, n + 1);
  }
  const slots: SpeedCardSlots = order.filter((id) => reg.byId.has(id)).slice(0, SPEED_CARD_SLOTS);
  while (slots.length < SPEED_CARD_SLOTS) slots.push(null);
  return slots;
}

/** Six slots, always: a saved list padded or cut to six. */
export function sixSlots(slots: SpeedCardSlots): SpeedCardSlots {
  const out = slots.slice(0, SPEED_CARD_SLOTS);
  while (out.length < SPEED_CARD_SLOTS) out.push(null);
  return out;
}

/** What each slot draws: the card, or null for an open "+" slot (an empty slot, or a card this member lost). */
export function resolveSlots(slots: SpeedCardSlots, reg: Registry): (SpeedCard | null)[] {
  return sixSlots(slots).map((id) => (id ? (reg.byId.get(id) ?? null) : null));
}

/** The slots with one card moved from one place to another; the others close up around it. */
export function moveSlot(slots: SpeedCardSlots, from: number, to: number): SpeedCardSlots {
  const out = sixSlots(slots);
  if (from === to || from < 0 || to < 0 || from >= out.length || to >= out.length) return out;
  const [card] = out.splice(from, 1);
  out.splice(to, 0, card);
  return out;
}

/** The slots with this one opened. */
export function removeAt(slots: SpeedCardSlots, at: number): SpeedCardSlots {
  const out = sixSlots(slots);
  out[at] = null;
  return out;
}

/** The slots with a card placed in this slot. A card already kept elsewhere moves here, so it never shows twice. */
export function placeAt(slots: SpeedCardSlots, at: number, id: string): SpeedCardSlots {
  const out = sixSlots(slots).map((s) => (s === id ? null : s));
  out[at] = id;
  return out;
}

/** The first open slot, or -1 when all six are held. */
export function firstOpen(slots: SpeedCardSlots, reg: Registry): number {
  return resolveSlots(slots, reg).findIndex((c) => c === null);
}

/** Cards matching a search: every word of it, in the label, its folder or its group, any case. */
export function searchCards(reg: Registry, query: string): SpeedCard[] {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const all = reg.groups.flatMap((g) => g.cards);
  if (!words.length) return all;
  return all.filter((c) => {
    const hay = `${c.label} ${c.sub ?? ""} ${c.group}`.toLocaleLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
