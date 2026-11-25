/**
 * THE POWERS ON "YOUR PROGRESSION", sorted for reading (Rye, 14 Nov 2026).
 *
 *   "this should show the top items and have the rest under 'show me
 *   everything' and maybe another thought on the design of it."
 *
 * Two pure answers, so the rule can be read and tested in one place:
 *
 *   topPowers     the few shown first. THE RULE, in order:
 *                   1. what your roles and groups hand you (a held power that
 *                      opens by appointment, never by climbing): the powers
 *                      your work actually uses;
 *                   2. then what opened most recently (the newest stage turn
 *                      first, from the progression history);
 *                   3. then the rest, in the village's own catalogue order.
 *                 It orders one member's own powers. It never compares or
 *                 scores people.
 *   powerGroups   every power, grouped by the kind of thing it lets you do,
 *                 for "Show me everything".
 *
 * Keyed by the Capability union, so a new power without a kind fails the
 * compiler instead of falling quietly into "other".
 */
import type { Capability } from "@shared/capabilities";

export const POWER_KINDS = ["talk", "decide", "people", "place", "value", "keep"] as const;
export type PowerKind = (typeof POWER_KINDS)[number];

export const POWER_KIND_OF: Record<Capability, PowerKind> = {
  "forum.post": "talk",
  "forum.moderate": "talk",
  "message.send": "talk",
  "feed.announce": "talk",
  "story.tell": "talk",
  "comms.manage": "talk",
  "companion.use": "talk",
  "brief.private": "talk",
  "proposal.open": "decide",
  "proposal.decide": "decide",
  "ballot.vote": "decide",
  "mechanics.propose": "decide",
  "org.declare": "decide",
  "org.decide": "decide",
  "dial.set": "decide",
  "steward.veto": "decide",
  "power.assign": "decide",
  "module.switch": "decide",
  "member.vouch": "people",
  "member.superVouch": "people",
  "org.seat": "people",
  "org.seatAgent": "people",
  "terms.read": "people",
  "records.confidential": "people",
  "intake.moderate": "people",
  "map.viewPeople": "people",
  "map.contact": "people",
  "map.edit": "place",
  "map.publish": "place",
  "map.photograph": "place",
  "map.curatePhotos": "place",
  "place.tend": "place",
  "place.permit": "place",
  "hiddenmap.keep": "place",
  "hiddenmap.export": "place",
  "stay.member_rate": "place",
  "event.rsvp": "place",
  "event.manage": "place",
  "health.record": "place",
  "library.keep": "place",
  "session.template": "place",
  "quest.consent": "value",
  "quest.approve": "value",
  "exchange.buy": "value",
  "exchange.swap": "value",
  "exchange.manage": "value",
  "redemption.confirm": "value",
  "cash.pay": "value",
  "role.pay": "value",
  "token.mint": "value",
  "pot.steward": "value",
  "moon.approve": "value",
  "moon.approve_alone": "value",
  "moon.approve_own": "value",
  "operator.accounts": "keep",
  "operator.config": "keep",
  "operator.secrets": "keep",
  "operator.recover": "keep",
  "qa.live_view": "keep",
};

/** A key the table does not know (an older server's, or a new one) still has a home. */
export function powerKindOf(key: string): PowerKind {
  return (POWER_KIND_OF as Record<string, PowerKind | undefined>)[key] ?? "keep";
}

/** How many powers show before "Show me everything". */
export const TOP_POWERS = 6;

export interface CatalogueRowLike {
  key: string;
  held: boolean;
  opens?: { via: string } | null;
}

export interface StageTurnLike {
  unlocked?: unknown;
  at?: unknown;
}

/**
 * The powers shown first, by the rule in this file's header. `held` is the
 * member's own list (`capabilities`), `catalogue` says how each one opens,
 * and `history` is the stage turns, newest first as the server sends them.
 */
export function topPowers(held: readonly string[], catalogue: readonly CatalogueRowLike[], history: readonly StageTurnLike[], limit = TOP_POWERS): string[] {
  const mine = new Set(held);
  const out: string[] = [];
  const take = (k: string) => {
    if (out.length < limit && mine.has(k) && !out.includes(k)) out.push(k);
  };
  for (const row of catalogue) if (row.held && row.opens?.via === "appointment") take(row.key);
  const turns = [...history].sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")));
  for (const turn of turns) if (Array.isArray(turn.unlocked)) for (const k of turn.unlocked) if (typeof k === "string") take(k);
  for (const k of held) take(k);
  return out;
}

/** Every held power, grouped by kind in POWER_KINDS order, empty kinds left out. */
export function powerGroups(held: readonly string[]): Array<{ kind: PowerKind; keys: string[] }> {
  const by = new Map<PowerKind, string[]>();
  for (const k of held) {
    const kind = powerKindOf(k);
    const list = by.get(kind) ?? [];
    if (!list.includes(k)) list.push(k);
    by.set(kind, list);
  }
  return POWER_KINDS.filter((k) => by.has(k)).map((kind) => ({ kind, keys: by.get(kind) as string[] }));
}
