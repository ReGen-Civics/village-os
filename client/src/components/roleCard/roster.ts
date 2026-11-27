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
  /** Their published portrait, where the village sent one (the first found across their roles); else null. */
  face: string | null;
  agent: boolean;
  roles: RosterRole[];
}

export function rosterOf(
  filled: readonly { id: string; name: string; holders: readonly string[]; faces?: readonly (string | null)[]; recruiting?: boolean }[],
  /** The word an agent holder arrives as: the page's own translated "An agent" (orgHolderName). */
  agentWord: string = SHEET_WORDS.agent,
): RosterEntry[] {
  const people = new Map<string, RosterEntry>();
  const rest: RosterEntry[] = [];
  for (const f of filled) {
    const role: RosterRole = f.recruiting === true ? { id: f.id, name: f.name, recruiting: true } : { id: f.id, name: f.name };
    const names: string[] = [];
    const faceBy = new Map<string, string>();
    let agent = false;
    (f.holders ?? []).forEach((h, i) => {
      if (h === agentWord || h === SHEET_WORDS.agent) {
        agent = true;
        return;
      }
      const n = holderFirstName(h);
      if (!n) return;
      if (!names.includes(n)) names.push(n);
      const face = f.faces?.[i];
      if (face && !faceBy.has(n)) faceBy.set(n, face);
    });
    for (const n of names) {
      const entry = people.get(n) ?? { key: `p:${n}`, name: n, face: null, agent: false, roles: [] };
      if (!entry.face) entry.face = faceBy.get(n) ?? null;
      if (!entry.roles.some((r) => r.id === role.id)) entry.roles.push(role);
      people.set(n, entry);
    }
    if (agent) rest.push({ key: `a:${f.id}`, name: null, face: null, agent: true, roles: [role] });
    if (names.length === 0 && !agent) rest.push({ key: `r:${f.id}`, name: null, face: null, agent: false, roles: [role] });
  }
  const named = Array.from(people.values()).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }));
  return [...named, ...rest];
}
