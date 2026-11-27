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
import { isGroup, NAV } from "@/config/nav";
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
  /** The picker's group: the menu's own group name as the reader sees it, or "Yours". */
  group: string;
  /** The same group by the menu's own untranslated name ("Village", "Govern", "Yours"), for its glyph (glyphs.ts). */
  groupKey: string;
  /** The folder it sits in inside its group, for the picker's second line (config/navNest.ts). */
  sub?: string;
}

/**
 * A REGISTERED CARD: one that is not a menu row. `useShown` is a hook, called once per sheet for each registered
 * card in a fixed order (SpeedCards.tsx renders one probe per card), and answers whether this member sees it now.
 * Absent means always. Answer null while it is not known yet: the sheet holds the card's default slot quietly
 * until the answer comes, so a card never flashes "+" and then fills.
 */
export interface SpeedCardDef extends Omit<SpeedCard, "group" | "groupKey"> {
  /** The picker group it sits in. Absent: "Yours". */
  group?: string;
  useShown?: () => boolean | null;
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

/**
 * A group's own name in config/nav.ts, whatever the reader sees it called: Layout hands the sheet each group with its
 * label translated or renamed by the village and its `items` untouched, so the items find the group in NAV.
 */
export function groupKeyOf(group: NavGroup): string {
  const own = NAV.find((e) => isGroup(e) && (e.items === group.items || e.label === group.label));
  return own && isGroup(own) ? own.label : group.label;
}

export function buildRegistry({ entries, itemsOf, account, registered, words, short }: RegistryInput): Registry {
  const fromLink = (l: NavLink, group: string, groupKey: string): SpeedCard => ({
    id: l.href,
    label: l.label,
    href: l.href,
    icon: l.icon,
    count: l.count,
    group,
    groupKey,
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
    if (isGroup(e)) {
      const key = groupKeyOf(e);
      for (const l of itemsOf(e)) put(fromLink(l, e.label, key));
    } else put(fromLink(e, words.more, "More"));
  }
  for (const a of account) put({ ...fromLink(a, words.yours, "Yours"), label: short?.[a.href] ?? a.label });
  for (const d of registered) {
    const { useShown: _shown, defaultAfter: _after, ...card } = d;
    put({ ...card, group: d.group ?? words.yours, groupKey: "Yours" });
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
export function defaultSlots(reg: Registry, registered: readonly SpeedCardDef[], pending: ReadonlySet<string> = new Set()): SpeedCardSlots {
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
  // A registered card still waiting on its rule keeps its place (`pending`): the sheet draws it as a quiet slot.
  const slots: SpeedCardSlots = order.filter((id) => reg.byId.has(id) || pending.has(id)).slice(0, SPEED_CARD_SLOTS);
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

/** True when `a` becomes `b` by one letter added, dropped or changed, or two neighbours swapped (a typo), or they are equal. */
function withinOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    // One letter changed, or two neighbours swapped ("qeusts" for "quests"): both count as one typo.
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** A typed word found in the text: as written, or (four letters or more) one typo away from the start of a word in it. */
function wordFound(word: string, hay: string, tokens: readonly string[]): boolean {
  if (hay.includes(word)) return true;
  if (word.length < 4) return false;
  return tokens.some((tok) => [word.length - 1, word.length, word.length + 1].some((n) => n <= tok.length && withinOne(word, tok.slice(0, n))));
}

/** Cards matching a search: every word of it, in the label, its folder or its group, any case, forgiving one typo a word. */
export function searchCards(reg: Registry, query: string): SpeedCard[] {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const all = reg.groups.flatMap((g) => g.cards);
  if (!words.length) return all;
  return all.filter((c) => {
    const hay = `${c.label} ${c.sub ?? ""} ${c.group}`.toLocaleLowerCase();
    const tokens = hay.split(/[^a-z0-9À-ɏ]+/).filter(Boolean);
    return words.every((w) => wordFound(w, hay, tokens));
  });
}
