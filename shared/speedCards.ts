/**
 * A MEMBER'S SPEED CARDS, AS STORED (the lead, 27 Nov 2026: "make these top 6 cards customizable").
 *
 * The six quick cards at the top of the phone's More sheet (client/src/components/mobile/SpeedCards.tsx). What a
 * member keeps is a list of six slots, each a card id or `null` for an open "+" slot. A card id is the page's
 * address for a menu entry (`/journal`), which never moves (config/nav.ts says why), or a registered card's own
 * name (`pull-a-card`). The server keeps the list in the member's own `prefs` blob, under `speedCards`, so the
 * cards follow them to every device; no column and no migration.
 *
 * The server cannot know which pages this member may open (that is the menu's audience rules, run in the client),
 * so it checks only the shape. The client draws a saved id only when its menu still offers it to this member: a
 * card for a page they lost sits as an open slot, and comes back if the page does.
 *
 * Pure: no React, no database.
 */

/** How many cards the sheet holds. Three across, two rows. */
export const SPEED_CARD_SLOTS = 6;

/** Where the list lives in `users.prefs`. */
export const SPEED_CARDS_PREF = "speedCards";

/** A card id: an in-app address or a registered card's name. Short, and no spaces or quotes. */
const ID_RE = /^[A-Za-z0-9/_#?=&.:-]{1,120}$/;

export type SpeedCardSlots = (string | null)[];

export type SlotsParse = { ok: true; value: SpeedCardSlots | null } | { ok: false; problem: string };

/**
 * A PUT body's `slots`, checked. `null` clears the member's own list, so they see the defaults again.
 * Otherwise: an array of at most six, each a card id or null, no id twice. Short lists are padded with open slots.
 */
export function parseSpeedCardSlots(input: unknown): SlotsParse {
  if (input === null) return { ok: true, value: null };
  if (!Array.isArray(input)) return { ok: false, problem: "slots_not_a_list" };
  if (input.length > SPEED_CARD_SLOTS) return { ok: false, problem: "too_many_slots" };
  const seen = new Set<string>();
  const out: SpeedCardSlots = [];
  for (const raw of input) {
    if (raw === null) {
      out.push(null);
      continue;
    }
    if (typeof raw !== "string" || !ID_RE.test(raw)) return { ok: false, problem: "bad_card_id" };
    if (seen.has(raw)) return { ok: false, problem: "card_twice" };
    seen.add(raw);
    out.push(raw);
  }
  while (out.length < SPEED_CARD_SLOTS) out.push(null);
  return { ok: true, value: out };
}

/** The member's saved slots, or null when they never chose (or the stored value no longer reads). */
export function readSpeedCards(prefs: unknown): SpeedCardSlots | null {
  const stored = prefs && typeof prefs === "object" ? (prefs as Record<string, unknown>)[SPEED_CARDS_PREF] : undefined;
  if (stored === undefined || stored === null) return null;
  const parsed = parseSpeedCardSlots(stored);
  return parsed.ok ? parsed.value : null;
}
