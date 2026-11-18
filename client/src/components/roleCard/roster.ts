/**
 * THE ROSTER: the roles held now, one card per person (Rye, 17 Nov 2026, approved mockup
 * https://claude.ai/artifact/FACiWjD7FWeNuDGKxFA6bM: "have it woven into what's already existing").
 *
 * A person who holds several roles shows once, with every role they hold as their positions.
 * The page knows a holder only by the first name the village shows this reader, so the first
 * name is the key: two people who share a first name share a card, which is the same thing the
 * old "Role (Rick, Jessica)" label already did with a repeated name.
 *
 * Three kinds of card, never merged across kinds:
 *   - a named person, keyed by first name;
 *   - an agent, one card per role, marked as an agent (never one "An agent" card for many agents);
 *   - a role the village shows no names for, one card per role with no name.
 *
 * ORDER SAYS NOTHING. Named people sort alphabetically by first name, so no order reads as a
 * ranking; nameless and agent cards follow in the order the roles came. No numbers, no stats.
 */
import { holderFirstName } from "@shared/roleHolderLabel";
import { SHEET_WORDS } from "@shared/roleSheetWords";

export interface RosterRole {
  id: string;
  name: string;
  /** Held and still recruiting: more players welcome, with an Apply (the lead, 17 Nov 2026). */
  recruiting?: true;
}

export interface RosterEntry {
  /** Stable within one render: "p:<first name>", "a:<role id>" or "r:<role id>". */
  key: string;
  /** The first name as the village shows it to this reader, or null when it shows none. */
  name: string | null;
  agent: boolean;
  roles: RosterRole[];
}

export function rosterOf(filled: readonly { id: string; name: string; holders: readonly string[]; recruiting?: boolean }[]): RosterEntry[] {
  const people = new Map<string, RosterEntry>();
  const rest: RosterEntry[] = [];
  for (const f of filled) {
    const role: RosterRole = f.recruiting === true ? { id: f.id, name: f.name, recruiting: true } : { id: f.id, name: f.name };
    const names: string[] = [];
    let agent = false;
    for (const h of f.holders ?? []) {
      if (h === SHEET_WORDS.agent) {
        agent = true;
        continue;
      }
      const n = holderFirstName(h);
      if (n && !names.includes(n)) names.push(n);
    }
    for (const n of names) {
      const entry = people.get(n) ?? { key: `p:${n}`, name: n, agent: false, roles: [] };
      if (!entry.roles.some((r) => r.id === role.id)) entry.roles.push(role);
      people.set(n, entry);
    }
    if (agent) rest.push({ key: `a:${f.id}`, name: null, agent: true, roles: [role] });
    if (names.length === 0 && !agent) rest.push({ key: `r:${f.id}`, name: null, agent: false, roles: [role] });
  }
  const named = Array.from(people.values()).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }));
  return [...named, ...rest];
}
