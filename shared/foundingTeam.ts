/**
 * THE FOUNDING TEAM SECTION (phase A, lane A3, build list 2.1 and 2.3).
 *
 * A village that is hiring its paid founding roles turns on
 * `org.founding_team` and writes the role ids in `org.founding_team_roles`.
 * The Roles and Circles page then opens on "Join the founding team": those
 * roles, in the order written, each with its full card and one Apply act.
 *
 * Which roles show is decided here and nowhere else. A role the village has
 * unlisted, ended or keeps as an example never shows, whatever the setting
 * says, so the setting can never put a hidden role in front of a visitor.
 *
 * Pure: no pool, no clock, no Node builtins.
 */
import { isListed } from "./roleListing";

/** The ids written in the setting, in order, each once. Commas, spaces or new lines separate them. */
export function foundingRoleIds(setting: string): string[] {
  const out: string[] = [];
  for (const raw of String(setting ?? "").split(/[\s,;]+/)) {
    const id = raw.trim();
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

export interface FoundingCandidate {
  id: string;
  listed?: boolean | null;
  active?: boolean;
  isExample?: boolean;
}

/** The roles the section features, in the setting's order. Empty when the section is off. */
export function foundingRoles<R extends FoundingCandidate>(on: boolean, setting: string, roles: readonly R[]): R[] {
  if (!on) return [];
  const byId = new Map(roles.map((r) => [r.id, r]));
  const out: R[] = [];
  for (const id of foundingRoleIds(setting)) {
    const r = byId.get(id);
    if (!r || r.active === false || r.isExample === true || !isListed(r)) continue;
    out.push(r);
  }
  return out;
}

/**
 * HIRING THE FOUNDING TEAM FIRST (Rye, 14 Nov 2026): "make it clear that we're
 * going to hire those people first, but... we still have a lot of other roles
 * to fill." While the founding team is featured, every other listed role opens
 * after it: it can be read and applied for now, and its applicant is told the
 * reply waits until the founding team is in place.
 *
 * True when the founding team has roles and none of `roleIds` is one of them.
 */
export function opensAfterFounding(foundingIds: readonly string[], roleIds: readonly string[]): boolean {
  if (foundingIds.length === 0 || roleIds.length === 0) return false;
  return !roleIds.some((id) => foundingIds.includes(id));
}

/**
 * THE `{foundingRoles}` WORD, for page words that speak of the founding team
 * (the steward page's "Join the founding team" band, lead, 12 Nov 2026: "text
 * like this seems very temporary... we can't have text like this that will
 * become outdated quickly"). The roles come from the same read as the Roles
 * page's founding section, so the words follow whatever the village opens or
 * closes there.
 *
 * CamelCase on purpose: `fillVars` fills lowercase words only, so the village's
 * other words pass this one through untouched and it is filled here, once the
 * live list has arrived.
 */
export const FOUNDING_ROLES_WORD = "{foundingRoles}";

/** "the Finance Steward, the Land Lead and the Cook": each name once, "the" unless the name has it already. */
export function foundingRoleList(names: readonly string[]): string {
  const said = names
    .map((n) => String(n ?? "").trim())
    .filter((n, i, all) => n !== "" && all.indexOf(n) === i)
    .map((n) => (/^the\s/i.test(n) ? n : `the ${n}`));
  if (said.length <= 1) return said.join("");
  return `${said.slice(0, -1).join(", ")} and ${said[said.length - 1]}`;
}

/**
 * A paragraph with `{foundingRoles}` filled from the live roles. With no
 * founding role open (the section off, or every named role closed), each
 * sentence carrying the word is left out, so the paragraph still says only
 * what is true and never an empty list.
 */
export function withFoundingRoles(text: string, names: readonly string[]): string {
  if (!text.includes(FOUNDING_ROLES_WORD)) return text;
  const list = foundingRoleList(names);
  if (list) return text.split(FOUNDING_ROLES_WORD).join(list);
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !sentence.includes(FOUNDING_ROLES_WORD))
    .join(" ")
    .trim();
}

/** A seating as the team view reads it. */
export interface TeamSeating {
  orgRoleId: string;
  userId: string | null;
  displayName: string | null;
  isExample: boolean;
  isAgent: boolean;
  endedAt?: Date | string | null;
  lapsed?: boolean;
}

export interface TeamCandidate extends FoundingCandidate {
  name: string;
  circleId: string | null;
}

/** One role of the current team: its name, and its holders' first names when the village shows names. */
export interface FilledTeamRole {
  id: string;
  name: string;
  holders: string[];
}

/**
 * THE CURRENT TEAM BESIDE THE OPEN ROLES (Rye, 14 Nov 2026: "we can show this to anyone so they can
 * see the current team").
 *
 * The roles someone holds now in the circles the founding roles sit in, each named with its
 * holders' first names, in the chart's order. A filled role shows here even when the village keeps it
 * out of the open-roles listing, because "listed" is about finding a role to apply for and this is
 * the team as it stands. Never an example, an ended role, an ended or lapsed seating, or a role only
 * a software agent holds. `firstNameOf` answers null when the village keeps names hidden from this
 * reader; the role is still shown, with no names.
 */
export function foundingTeamFilled(
  featured: readonly Pick<TeamCandidate, "id" | "circleId">[],
  roles: readonly TeamCandidate[],
  seatings: readonly TeamSeating[],
  firstNameOf: (s: TeamSeating) => string | null,
): FilledTeamRole[] {
  const circles = new Set(featured.map((f) => f.circleId).filter((c): c is string => !!c));
  const featuredIds = new Set(featured.map((f) => f.id));
  const live = seatings.filter((s) => !s.isExample && !s.endedAt && !s.lapsed);
  const out: FilledTeamRole[] = [];
  for (const r of roles) {
    if (featuredIds.has(r.id) || !r.circleId || !circles.has(r.circleId) || r.active === false || r.isExample === true) continue;
    const people = live.filter((s) => s.orgRoleId === r.id && !s.isAgent);
    if (people.length === 0) continue;
    const holders: string[] = [];
    for (const s of people) {
      const n = firstNameOf(s);
      if (n && !holders.includes(n)) holders.push(n);
    }
    out.push({ id: r.id, name: r.name, holders });
  }
  return out;
}
