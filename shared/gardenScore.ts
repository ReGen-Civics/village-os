/**
 * THE SCOREBOARD OF THE ADMIN GARDEN: seven counts that say how much of the Game is governed from the garden.
 *
 * A founder's words, 28 Nov 2026: "keep going until we have a fully complete journey to launch and admin control
 * center for the whole game and every endpoint, setting, control and function is integrated into this new build."
 * Complete is seven counts, and each is measured here, by code, never by hand:
 *
 *   Functions    every row of the parity ledger works in its garden place, or carries the founder's ruling as cut
 *   Acts         every act has a place, a Find anything entry, a consequence line where it changes something, and
 *                a tier for the guide
 *   Endpoints    every route the server registers is an act's, or sits in a named family that is not admin's
 *   Settings     every dial, key and shipped control has a home place, a plain name, what it changes, who may
 *                change it, and its path by the village's highest vote
 *   The road     the fourteen stones of the road to launch (not built, so not measured)
 *   Three ways   every act can be done by click, by Find anything and by asking the guide
 *   Old doors    every old address lands inside the garden
 *
 * ── THE RULE ABOVE EVERY OTHER: DERIVE, NEVER HAND-KEEP ────────────────────
 *
 * Every list read here comes from code that already decides behaviour: the route reader, the permission matrix, the
 * registry's computed class, the dial registry, the tab table. Nothing in this file holds a number. Where a person's
 * judgement is unavoidable it lives in one named list with a reason on every entry and a test over it
 * (shared/notAdminRoutes.ts, and the two lists of shared/gardenMounts.ts).
 *
 * An item this file cannot account for from code stays OPEN and is named. A count that cannot be measured says so
 * and never reads as zero done.
 *
 * `scoreGarden` takes everything as input, so the script (scripts/garden-scoreboard.ts), the ratchet
 * (server/gardenScoreboard.test.ts) and the unit tests (shared/gardenScore.test.ts) run the same code.
 *
 * Pure: no I/O, no clock.
 */
import { PERSON_ONLY_LISTS, actClass, actConsequence, actHref, actReason, actSearchEntry, type PersonOnlyLists } from "./adminActs";
import { DIAL_ROUTE } from "./adminActs/derived";
import type { AdminAct } from "./adminActs/types";
import { ADMIN_PLACES, type AdminTabEntry } from "./adminTabs";
import { STAGE_UNLOCKS, type Capability } from "./capabilities";
import { MOVED_TO_SECRET_SENTENCE, applyTimingOf, criticalityOf, ringOf, validateVariable, type VariableDef } from "./gameVariables";
import { barePath, gardenPlaceOf, type CutByRuling, type GardenMount } from "./gardenMounts";
import { notAdminFamily, type NotAdminFamily, type NotAdminKind } from "./notAdminRoutes";

// ── What comes in ──────────────────────────────────────────────────────────

/** One route the server registers: its method in capitals and its path as Express registers it. */
export interface ScoreRoute {
  method: string;
  path: string;
  file?: string;
  line?: number;
  /** Its own handler asks whether the caller is an admin (server/testkit/routeDoors.ts). Absent: not read. */
  asksAdmin?: boolean;
  /** Every capability key its own handler names. Absent: not read. */
  powers?: readonly string[];
}

/** A registration whose path the route reader could not read. It is always open. */
export interface UnreadRoute {
  method: string;
  file: string;
  line: number;
  text: string;
}

/** The permission matrix as its snapshot holds it (server/permissionMatrix.snapshot.json). */
export interface MatrixSnapshot {
  identities: readonly string[];
  routes: Readonly<Record<string, ReadonlyArray<number | string>>>;
}

/** The parity ledger (shared/adminActs/ledger.ts). */
export interface LedgerInput {
  /** Every row: its id and the function it names. */
  rows: Readonly<Record<string, string>>;
  /** Rows an act covers, with a part that has no act yet. */
  stillOpen: Readonly<Record<string, string>>;
  /** Rows no page draws today. */
  neverDrawn: Readonly<Record<string, string>>;
}

/** The old addresses the client still answers (client/src/components/admin/adminTabAliases.ts), and its router. */
export interface OldAddresses {
  /** An old tab key that opens another Admin tab. */
  movedTabs: Readonly<Record<string, { tab: string }>>;
  /** An old tab key that opens a page outside Admin. */
  leftAdmin: Readonly<Record<string, string>>;
  /** Every path pattern the client's router draws a page for (client/src/App.tsx). */
  clientRoutes: readonly string[];
}

export interface ScoreInputs {
  routes: readonly ScoreRoute[];
  unresolved: readonly UnreadRoute[];
  matrix: MatrixSnapshot;
  acts: readonly AdminAct[];
  dials: readonly VariableDef[];
  tabs: readonly AdminTabEntry[];
  ledger: LedgerInput;
  mounts: readonly GardenMount[];
  cuts: readonly CutByRuling[];
  notAdmin: readonly NotAdminFamily[];
  old: OldAddresses;
  /** The lists a class is computed from. A test hands in its own. */
  lists?: PersonOnlyLists;
}

// ── What goes out ──────────────────────────────────────────────────────────

export const COUNT_KEYS = ["functions", "acts", "endpoints", "settings", "road", "threeWays", "oldDoors"] as const;
export type CountKey = (typeof COUNT_KEYS)[number];

/** One thing still open, by the name a person would look for it by. */
export interface OpenItem {
  name: string;
  /** Why it is open, in plain words. */
  why: string;
  /** The heading the report lists it under. */
  group: string;
}

/** A number inside a count that a reader will ask for. */
export interface CountPart {
  name: string;
  value: number;
  /** Out of how many, where that helps. */
  of?: number;
}

export interface Count {
  key: CountKey;
  title: string;
  /** What one item must be for it to count as done. */
  doneMeans: string;
  /** False when nothing in the code can be counted yet. Then `total` and `done` are null, never zero. */
  measured: boolean;
  /** Why it is not measured. */
  notMeasured?: string;
  total: number | null;
  done: number | null;
  open: OpenItem[];
  parts: CountPart[];
  notes: string[];
}

export interface Scoreboard {
  counts: Count[];
}

/** One count of a scoreboard, by its key. */
export function countOf(board: Scoreboard, key: CountKey): Count {
  const found = board.counts.find((c) => c.key === key);
  if (!found) throw new Error(`The scoreboard has no count named ${key}`);
  return found;
}

// ── Small readers shared by the counts ─────────────────────────────────────

const own = <T>(table: Readonly<Record<string, T>>, key: string): T | undefined => (Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined);

/** A route's name on every list here: its method in capitals, a space, its path. */
export const routeKey = (method: string, path: string): string => `${method.toUpperCase()} ${path}`;

/** The first two segments of a path, which is how the open routes are grouped. */
export function routeGroup(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return `/${parts.slice(0, 2).join("/")}`;
}

const refused = (cell: number | string | undefined): boolean => cell === 401 || cell === 403 || cell === "refused";

/**
 * What the permission matrix says about a route. "admin": a signed-out visitor and a plain member are both refused,
 * and somebody above them is let in. "open": the matrix holds the route and it does not read that way. "absent": the
 * matrix does not hold it, which is every route outside its scope.
 */
export function matrixVerdict(matrix: MatrixSnapshot, key: string): "admin" | "open" | "absent" {
  const row = own(matrix.routes, key);
  if (!row) return "absent";
  const cell = (who: string) => row[matrix.identities.indexOf(who)];
  const above = matrix.identities.filter((who) => who !== "signedOut" && who !== "member");
  return refused(cell("signedOut")) && refused(cell("member")) && above.some((who) => !refused(cell(who))) ? "admin" : "open";
}

/** Whether a router pattern (`/forum/:id`) draws a page for a path. */
export function routeMatches(pattern: string, path: string): boolean {
  const want = pattern.split("/").filter(Boolean);
  const got = path.split("/").filter(Boolean);
  if (want.length !== got.length) return false;
  return want.every((part, i) => part.startsWith(":") || part === got[i]);
}

const isDialAct = (a: Pick<AdminAct, "route">): boolean => a.route?.path === DIAL_ROUTE;

/** The tab or the page an act opens on: its tab when it has one, otherwise its path. */
const landing = (a: Pick<AdminAct, "tab" | "path">): { tab?: string; path?: string } => (a.tab ? { tab: a.tab } : { path: a.path });

const where = (a: Pick<AdminAct, "tab" | "path">): string => (a.tab ? `the ${a.tab} tab` : a.path ? `the page ${barePath(a.path)}` : "no address");

const unique = <T>(list: readonly T[]): T[] => Array.from(new Set(list));

/** A number with its noun: "1 dial", "3 dials". */
const some = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? "" : "s"}`;

// ── 1. Functions ───────────────────────────────────────────────────────────

function functionsCount(i: ScoreInputs): Count {
  const ids = Object.keys(i.ledger.rows);
  const cuts = new Map(i.cuts.filter((c) => c.date.trim() && c.words.trim()).map((c) => [c.row, c]));
  const open: OpenItem[] = [];
  let inPlace = 0;
  let cut = 0;
  let oldTab = 0;
  let neverDrawn = 0;
  let missing = 0;
  let partOpen = 0;

  for (const id of ids) {
    const name = `${id} ${i.ledger.rows[id]}`;
    if (cuts.has(id)) {
      cut++;
      continue;
    }
    const acts = i.acts.filter((a) => a.parity?.includes(id));
    if (!acts.length) {
      const why = own(i.ledger.neverDrawn, id);
      if (why) {
        neverDrawn++;
        open.push({ name, why: `No page draws it today: ${why}. It waits on a ruling about the component itself.`, group: "no page draws it" });
      } else {
        missing++;
        open.push({ name, why: "No act in the registry carries it.", group: "no act carries it" });
      }
      continue;
    }
    const outside = acts.filter((a) => gardenPlaceOf(landing(a), i.mounts) !== a.place);
    const part = own(i.ledger.stillOpen, id);
    if (outside.length) {
      oldTab++;
      const places = unique(outside.map((a) => `${where(a)} (${a.place})`));
      const shown = places.slice(0, 3).join(", ") + (places.length > 3 ? `, and ${places.length - 3} more` : "");
      open.push({ name, why: `Still in the old tab: ${outside.length} of its ${acts.length} acts open outside the garden, on ${shown}.`, group: "still in the old tab" });
    } else if (part) {
      partOpen++;
      open.push({ name, why: `Its acts open in the garden, and one part of it has no act yet: ${part}.`, group: "in the garden, with a part no act carries" });
    } else {
      inPlace++;
    }
  }

  const strayCuts = i.cuts.filter((c) => !own(i.ledger.rows, c.row) || !c.date.trim() || !c.words.trim());
  const notes = [
    "A row works in its garden place when every act that carries it opens on a tab or a page the garden mounts, in the place the act names (shared/gardenMounts.ts).",
    i.mounts.length ? `The garden mounts ${i.mounts.reduce((n, m) => n + m.tabs.length + m.pages.length, 0)} tabs and pages.` : "The garden mounts nothing yet, so no row can be in its place. The running garden lane fills the mount list.",
    `Rows with a part that has no act yet: ${Object.keys(i.ledger.stillOpen).length}. Such a row stays open after its tab is mounted.`,
  ];
  if (strayCuts.length) notes.push(`Ignored: ${some(strayCuts.length, "cut")} naming no ledger row, or carrying no date or no words (${strayCuts.map((c) => c.row).join(", ")}).`);

  return {
    key: "functions",
    title: "Functions",
    doneMeans: "The row works in its garden place, or carries the founder's ruling as cut.",
    measured: true,
    total: ids.length,
    done: inPlace + cut,
    open,
    parts: [
      { name: "works in its garden place", value: inPlace },
      { name: "cut by ruling", value: cut },
      { name: "still in the old tab", value: oldTab },
      { name: "in the garden, with a part no act carries", value: partOpen },
      { name: "no page draws it (reported apart)", value: neverDrawn },
      { name: "no act carries it", value: missing },
    ],
    notes,
  };
}

// ── 2. Acts ────────────────────────────────────────────────────────────────

/** What the four questions of the Acts count answer for one act. */
export interface ActFacts {
  place: boolean;
  entry: boolean;
  /** Whether it changes something: it calls a write route. A dial is one of these. */
  writes: boolean;
  consequence: boolean;
  /** False when nothing says whether it reads or writes: it is marked partial and names no route. */
  tierSettled: boolean;
}

export function actFacts(a: AdminAct, lists: PersonOnlyLists = PERSON_ONLY_LISTS): ActFacts {
  const entry = actSearchEntry(a);
  const cls = actClass(a, lists);
  const writes = cls !== "read";
  const unread = !!a.partial && !a.route;
  return {
    place: (ADMIN_PLACES as readonly string[]).includes(a.place),
    entry: entry.id === a.id && !!entry.title.trim(),
    writes,
    consequence: !writes || !!actConsequence(a),
    tierSettled: !unread && (cls !== "person-only" || !!actReason(a, lists)),
  };
}

function actsCount(i: ScoreInputs): Count {
  const lists = i.lists ?? PERSON_ONLY_LISTS;
  const open: OpenItem[] = [];
  const n = { place: 0, entry: 0, writes: 0, consequence: 0, unsettled: 0, read: 0, prepare: 0, person: 0, partial: 0, done: 0 };

  for (const a of i.acts) {
    const f = actFacts(a, lists);
    const cls = actClass(a, lists);
    if (f.place) n.place++;
    if (f.entry) n.entry++;
    if (f.writes) n.writes++;
    if (f.writes && f.consequence) n.consequence++;
    if (!f.tierSettled) n.unsettled++;
    if (a.partial) n.partial++;
    if (cls === "read") n.read++;
    else if (cls === "prepare") n.prepare++;
    else n.person++;

    const why: Array<{ group: string; words: string }> = [];
    if (!f.place) why.push({ group: "no place", words: `Its place, ${a.place}, is not one the garden has.` });
    if (!f.entry) why.push({ group: "no Find anything entry", words: "Find anything has no entry for it." });
    if (!f.tierSettled) why.push({ group: "tier not settled", words: "Its route was never read, so nothing says whether it only reads or changes something, and its tier is a guess." });
    if (!f.consequence) why.push({ group: "needs a consequence line", words: `It changes something (${a.route?.method} ${a.route?.path}) and no catalog holds a line for what its door asks, ${a.holder ?? a.power}.` });
    if (why.length) open.push({ name: `${a.id} ${a.title}`, why: why.map((w) => w.words).join(" "), group: why[0].group });
    else n.done++;
  }

  return {
    key: "acts",
    title: "Acts",
    doneMeans: "The act has a place, a Find anything entry, a consequence line where it changes something, and a settled tier.",
    measured: true,
    total: i.acts.length,
    done: n.done,
    open,
    parts: [
      { name: "has a place", value: n.place, of: i.acts.length },
      { name: "has a Find anything entry", value: n.entry, of: i.acts.length },
      { name: "changes something, and has its consequence line", value: n.consequence, of: n.writes },
      { name: "tier settled", value: i.acts.length - n.unsettled, of: i.acts.length },
      { name: "tier: reads only", value: n.read },
      { name: "tier: the guide prepares, a person presses", value: n.prepare },
      { name: "tier: a person's alone", value: n.person },
      { name: "marked partial (a route or fields still to finish)", value: n.partial },
    ],
    notes: [
      "A place holds by construction: an act's type requires one of the twelve places, and the count checks each value against that list.",
      "A Find anything entry holds by construction: the list search reads is made from the list of acts, one entry each (ADMIN_ACT_ENTRIES, shared/adminActs.ts).",
      "A consequence line is asked only of an act that calls a write route. The line is the catalog's own (a key's seed, or the power its door asks) and is never written here.",
      "The tier is computed (actClass, shared/adminActs.ts). A person's alone is always read from the server's own lists, with the rule that decided it.",
      "An act marked partial that names no route computes as a read only because no route is known. It is counted as not settled.",
    ],
  };
}

// ── 3. Endpoints ───────────────────────────────────────────────────────────

/** Who answers for one route. */
export type RouteOwner =
  | { by: "act"; acts: string[] }
  | { by: "reads"; acts: string[] }
  | { by: "not-admin"; family: string; kind: NotAdminKind }
  /** `overruled`: a family holds its path, and what its own handler asks says it is a steward's all the same. */
  | { by: "nobody"; overruled?: { family: string; why: string } };

/** The powers a route's handler names that only a role gives: no stage unlocks them (STAGE_UNLOCKS, shared/capabilities.ts). */
export function rolePowers(route: Pick<ScoreRoute, "powers">): string[] {
  return (route.powers ?? []).filter((p) => !STAGE_UNLOCKS[p as Capability]);
}

/** Why a route can never be counted as not admin's, read off its own handler, or null. */
export function stewardsByItsHandler(route: Pick<ScoreRoute, "asksAdmin" | "powers">): string | null {
  if (route.asksAdmin) return "its handler asks whether the caller is an admin";
  const powers = rolePowers(route);
  return powers.length ? `its handler names a power only a role gives (${powers.join(", ")})` : null;
}

/** The routes the acts name: the one each calls, and the ones each page reads. */
export function actRoutes(acts: readonly AdminAct[]): { calls: Map<string, string[]>; reads: Map<string, string[]> } {
  const calls = new Map<string, string[]>();
  const reads = new Map<string, string[]>();
  const add = (map: Map<string, string[]>, key: string, id: string) => map.set(key, [...(map.get(key) ?? []), id]);
  for (const a of acts) {
    if (a.route) add(calls, routeKey(a.route.method, a.route.path), a.id);
    for (const p of a.reads ?? []) add(reads, routeKey("GET", p), a.id);
  }
  return { calls, reads };
}

/** Who answers for a route: an act that calls it, an act whose page reads it, a family that is not admin's, or nobody. */
export function routeOwner(route: ScoreRoute, named: ReturnType<typeof actRoutes>, families: readonly NotAdminFamily[]): RouteOwner {
  const key = routeKey(route.method, route.path);
  const calls = named.calls.get(key);
  if (calls) return { by: "act", acts: calls };
  const reads = named.reads.get(key);
  if (reads) return { by: "reads", acts: reads };
  const family = notAdminFamily(route.method, route.path, families);
  if (!family) return { by: "nobody" };
  const stewards = stewardsByItsHandler(route);
  if (stewards) return { by: "nobody", overruled: { family: family.key, why: stewards } };
  return { by: "not-admin", family: family.key, kind: family.kind };
}

function endpointsCount(i: ScoreInputs): Count {
  const distinct = new Map<string, ScoreRoute>();
  for (const r of i.routes) if (!distinct.has(routeKey(r.method, r.path))) distinct.set(routeKey(r.method, r.path), r);
  const named = actRoutes(i.acts);
  const open: OpenItem[] = [];
  const n = { act: 0, reads: 0, public: 0, member: 0, machine: 0, openAdminByMatrix: 0, openUnderAdmin: 0, overruled: 0, openAsksAdmin: 0, openRolePower: 0 };

  for (const [key, r] of Array.from(distinct)) {
    const owner = routeOwner(r, named, i.notAdmin);
    if (owner.by === "act") n.act++;
    else if (owner.by === "reads") n.reads++;
    else if (owner.by === "not-admin") n[owner.kind]++;
    else {
      const verdict = matrixVerdict(i.matrix, key);
      const stewards = stewardsByItsHandler(r);
      if (verdict === "admin") n.openAdminByMatrix++;
      if (r.path.startsWith("/api/admin/")) n.openUnderAdmin++;
      if (owner.overruled) n.overruled++;
      if (r.asksAdmin) n.openAsksAdmin++;
      else if (stewards) n.openRolePower++;
      const why = owner.overruled
        ? `Its path is in the family ${owner.overruled.family}, and ${owner.overruled.why}. It stays open until an act names it.`
        : verdict === "admin"
          ? "The permission matrix shows it is admin's, and no act names it."
          : stewards
            ? `No act names it, and ${stewards}.`
            : verdict === "open"
              ? "The permission matrix holds it, no act names it, and no family of routes that are not admin's holds it."
              : "No act names it, and no family of routes that are not admin's holds it. Nothing read here says whose it is.";
      open.push({ name: key, why, group: routeGroup(r.path) });
    }
  }
  for (const u of i.unresolved) {
    open.push({ name: `${u.method} at ${u.file}:${u.line}`, why: `The route reader could not read its path (${u.text}), so nobody can say whose it is.`, group: "(path not read)" });
  }

  const staleCalls = Array.from(named.calls.keys()).filter((k) => !distinct.has(k));
  const staleReads = Array.from(named.reads.keys()).filter((k) => !distinct.has(k));
  const notes = [
    "A route is accounted for when an act calls it (method and path, exactly as Express registers them), when an act's page reads it, or when a named family of routes that are not admin's holds it (shared/notAdminRoutes.ts).",
    i.notAdmin.length ? `Families of routes that are not admin's: ${i.notAdmin.length}.` : "The list of routes that are not admin's is empty, so every route no act names is open.",
    `The permission matrix holds ${Object.keys(i.matrix.routes).length} of these routes. A route outside its scope reads as absent there, which says nothing about whose it is.`,
    "What a route's own handler asks overrules the families: one that asks the admin question, or names a power only a role gives, is never counted as not admin's (server/testkit/routeDoors.ts says what that reader cannot see).",
  ];
  if (staleCalls.length) notes.push(`Acts name ${some(staleCalls.length, "route")} the server does not register: ${staleCalls.join(", ")}.`);
  if (staleReads.length) notes.push(`Acts name ${some(staleReads.length, "read")} the server does not register: ${staleReads.join(", ")}.`);

  const total = distinct.size + i.unresolved.length;
  return {
    key: "endpoints",
    title: "Endpoints",
    doneMeans: "An act calls the route, an act's page reads it, or a named family of routes that are not admin's holds it.",
    measured: true,
    total,
    done: total - open.length,
    open,
    parts: [
      { name: "an act calls it", value: n.act },
      { name: "an act's page reads it", value: n.reads },
      { name: "not admin's: public", value: n.public },
      { name: "not admin's: a member's own side", value: n.member },
      { name: "not admin's: machine", value: n.machine },
      { name: "open", value: open.length },
      { name: "open, under /api/admin/", value: n.openUnderAdmin },
      { name: "open, and the permission matrix shows it is admin's", value: n.openAdminByMatrix },
      { name: "open, and its handler asks whether the caller is an admin", value: n.openAsksAdmin },
      { name: "open, and its handler names a power only a role gives", value: n.openRolePower },
      { name: "open, in a family that is not admin's and overruled by its own handler", value: n.overruled },
      { name: "registrations whose path could not be read", value: i.unresolved.length },
      { name: "routes an act names that the server does not register", value: staleCalls.length + staleReads.length },
    ],
    notes,
  };
}

// ── 4. Settings ────────────────────────────────────────────────────────────

export const SETTING_FACETS = ["home", "name", "changes", "who", "vote"] as const;
export type SettingFacet = (typeof SETTING_FACETS)[number];

export const FACET_WORDS: Readonly<Record<SettingFacet, string>> = {
  home: "a home place",
  name: "a plain name",
  changes: "what it changes",
  who: "who may change it",
  vote: "its path by the highest vote",
};

export type SettingKind = "dial" | "key" | "control";

/** One setting and what is missing from it, facet by facet. A facet absent from `missing` is answered. */
export interface SettingFacts {
  kind: SettingKind;
  name: string;
  missing: Partial<Record<SettingFacet, string>>;
}

/** A value no dial ships as its default, to ask the dial's own validator whether any new value may be written. */
const anotherValue = (def: VariableDef): string => `${def.default}~`;

/**
 * A dial, read off what already decides it: its act's place, its label, its description, its ring (who may govern
 * it) and whether any write path, a passed vote included, may give it a new value.
 */
export function dialFacts(def: VariableDef, act: AdminAct | undefined): SettingFacts {
  const missing: SettingFacts["missing"] = {};
  if (!act) missing.home = "No act carries this dial, so it has no place.";
  else if (!(ADMIN_PLACES as readonly string[]).includes(act.place)) missing.home = `Its place, ${act.place}, is not one the garden has.`;
  if (!def.label.trim() || def.label === def.key) missing.name = "It has no label of its own, so it shows its key.";
  if (!String(def.description ?? "").trim()) missing.changes = "It has no description.";
  // `ringOf` always answers: "open" (the village governs it) or "founder" (whoever runs the deployment holds it).
  if (!act || !ringOf(def)) missing.who = "No door is named for it.";
  // When it applies and how much of the village must agree always answer too (`applyTimingOf`, `criticalityOf`).
  // What can be missing is the path itself: a dial whose value moved into the sealed store refuses every new value.
  if (validateVariable(def, anotherValue(def)) === MOVED_TO_SECRET_SENTENCE || !applyTimingOf(def) || !criticalityOf(def)) {
    missing.vote = "Its value is kept in the sealed store, and every write path refuses a new one, a passed vote included.";
  }
  return { kind: "dial", name: `dial.${def.key} ${def.label}`, missing };
}

const NO_VOTE_PATH = "Nothing in the registry ties it to a kind of change a ballot can carry, so its path by a vote is not known.";

/** A key a village plants (a sealed slot), or a control admin search shipped, read off its act. */
export function actSettingFacts(a: AdminAct, kind: Exclude<SettingKind, "dial">): SettingFacts {
  const missing: SettingFacts["missing"] = {};
  if (!(ADMIN_PLACES as readonly string[]).includes(a.place)) missing.home = `Its place, ${a.place}, is not one the garden has.`;
  if (!a.title.trim()) missing.name = "It has no title.";
  const changes = kind === "key" ? actConsequence(a) : a.help;
  if (!changes.trim()) missing.changes = kind === "key" ? "Its seed holds no consequence line." : "It has no line saying what it is.";
  if (a.partial) missing.who = "Its door was never read, so the power it names is the search entry's and is not confirmed.";
  missing.vote = NO_VOTE_PATH;
  return { kind, name: `${a.id} ${a.title}`, missing };
}

function settingsCount(i: ScoreInputs): Count {
  const byId = new Map(i.acts.map((a) => [a.id, a]));
  const facts: SettingFacts[] = [
    ...i.dials.map((d) => dialFacts(d, byId.get(`dial.${d.key}`))),
    ...i.acts.filter((a) => a.seed).map((a) => actSettingFacts(a, "key")),
    ...i.acts.filter((a) => a.kind === "control").map((a) => actSettingFacts(a, "control")),
  ];
  const open: OpenItem[] = [];
  for (const f of facts) {
    const gaps = SETTING_FACETS.filter((facet) => f.missing[facet]);
    if (!gaps.length) continue;
    open.push({ name: f.name, why: gaps.map((g) => f.missing[g]).join(" "), group: `${f.kind}: no ${gaps.map((g) => FACET_WORDS[g].replace(/^(a|its) /, "")).join(", no ")}` });
  }

  const parts: CountPart[] = [];
  const kinds: Array<{ kind: SettingKind; words: string }> = [
    { kind: "dial", words: "dials" },
    { kind: "key", words: "keys" },
    { kind: "control", words: "shipped controls" },
  ];
  for (const { kind, words } of kinds) {
    const of = facts.filter((f) => f.kind === kind);
    parts.push({ name: `${words}: all five answered`, value: of.filter((f) => !Object.keys(f.missing).length).length, of: of.length });
    for (const facet of SETTING_FACETS) parts.push({ name: `${words}: ${FACET_WORDS[facet]}`, value: of.filter((f) => !f.missing[facet]).length, of: of.length });
  }

  const dialPlaces = unique(i.dials.map((d) => byId.get(`dial.${d.key}`)?.place).filter((p): p is AdminAct["place"] => !!p));
  const notes = [
    "A dial's five answers are read off what decides it: the place of its act, its label, its description, its ring (ringOf: the village governs it, or whoever runs the deployment holds it), and whether any write path may give it a new value.",
    dialPlaces.length === 1
      ? `Every dial carries the same place, ${dialPlaces[0]}: one tab holds them all. No dial is shown in the place it governs.`
      : `The dials sit in ${dialPlaces.length} places: ${dialPlaces.join(", ")}.`,
    "Keys and shipped controls cannot answer their path by the highest vote yet: nothing in the registry ties one to a kind of change a ballot can carry.",
    "A shipped control marked partial cannot answer who may change it: its door was never read.",
  ];

  return {
    key: "settings",
    title: "Settings",
    doneMeans: "The setting has a home place, a plain name, what it changes, who may change it, and its path by the village's highest vote.",
    measured: true,
    total: facts.length,
    done: facts.length - open.length,
    open,
    parts,
    notes,
  };
}

// ── 5. The road ────────────────────────────────────────────────────────────

function roadCount(): Count {
  return {
    key: "road",
    title: "The road",
    doneMeans: "Each of the fourteen stones is done in place, and every launch requirement, setup seed, module need and wizard field maps to a stone.",
    measured: false,
    notMeasured: "The fourteen stones are the road to launch lane's work and are not built. The code holds no list of stones to count, so this is not measured. It is not zero done.",
    total: null,
    done: null,
    open: [],
    parts: [],
    notes: [],
  };
}

// ── 6. Three ways ──────────────────────────────────────────────────────────

/** Whether the guide can do this act for a person today: it is a dial she may prepare, and its tier agrees. */
export function guideCanToday(a: AdminAct, defs: ReadonlyMap<string, VariableDef>, lists: PersonOnlyLists = PERSON_ONLY_LISTS): boolean {
  if (!isDialAct(a)) return false;
  const def = defs.get(a.route?.params?.key ?? "");
  return !!def && lists.proposalRefusal(def) === null && actClass(a, lists) === "prepare";
}

function threeWaysCount(i: ScoreInputs): Count {
  const lists = i.lists ?? PERSON_ONLY_LISTS;
  const defs = new Map(i.dials.map((d) => [d.key, d]));
  const open: OpenItem[] = [];
  const n = { click: 0, find: 0, guide: 0, all: 0 };
  const disagree: string[] = [];

  for (const a of i.acts) {
    const click = !!actHref(a);
    const find = actFacts(a, lists).entry;
    const guide = guideCanToday(a, defs, lists);
    if (click) n.click++;
    if (find) n.find++;
    if (guide) n.guide++;
    if (click && find && guide) {
      n.all++;
      continue;
    }
    const def = isDialAct(a) ? defs.get(a.route?.params?.key ?? "") : undefined;
    if (def && lists.proposalRefusal(def) === null && actClass(a, lists) !== "prepare") disagree.push(a.id);
    const lacks = [click ? "" : "It has no address to click.", find ? "" : "Find anything has no entry for it."].filter(Boolean);
    if (!guide) {
      if (!isDialAct(a)) lacks.push("The guide can prepare a dial today and nothing else. No code lets her do this one.");
      else if (!def) lacks.push("It writes a dial the registry of dials does not hold.");
      else lacks.push(`The guide may not prepare this dial: ${actReason(a, lists)?.words ?? lists.proposalRefusal(def) ?? "its tier is not one to prepare."}`);
    }
    const group = !click ? "no address" : !find ? "no Find anything entry" : isDialAct(a) ? "a dial the guide may not prepare" : `not by the guide yet: ${a.kind === "outside" ? "page beside Admin" : a.kind}`;
    open.push({ name: `${a.id} ${a.title}`, why: lacks.join(" "), group });
  }

  const notes = [
    "By click: the act has an address (actHref). By Find anything: it has an entry. Both hold by construction, and the count checks each one.",
    "By asking the guide counts only what her code can do today: prepare a change to a dial she may propose (mayPropose, shared/adminHelper.ts), where the act's tier is also one to prepare. Everything else waits for the code that lets her do it.",
    "Whether the three ways leave the same record is not measured here.",
  ];
  if (disagree.length) notes.push(`Two lists disagree on ${some(disagree.length, "dial")}: the helper would prepare each today, and the registry's tier says a person's alone (${disagree.join(", ")}). None is counted.`);

  return {
    key: "threeWays",
    title: "Three ways",
    doneMeans: "The act can be done by click, by Find anything and by asking the guide.",
    measured: true,
    total: i.acts.length,
    done: n.all,
    open,
    parts: [
      { name: "by click", value: n.click, of: i.acts.length },
      { name: "by Find anything", value: n.find, of: i.acts.length },
      { name: "by asking the guide", value: n.guide, of: i.acts.length },
      { name: "all three", value: n.all, of: i.acts.length },
    ],
    notes,
  };
}

// ── 7. Old doors ───────────────────────────────────────────────────────────

/** One old address: what kind it is, and where it settles today. */
export interface OldDoor {
  address: string;
  kind: "tab" | "folded tab" | "control" | "dial" | "page";
  /** Where it lands after every alias: an Admin tab or a page's path. */
  lands: { tab?: string; path?: string };
  /** Whether what it lands on is drawn today: a tab the table has, or a path the router has. */
  reaches: boolean;
  /** Whether what it lands on opens inside the garden. */
  inGarden: boolean;
}

/** Every old address the code knows, each once: the tabs, the folded tabs, and every address an act lands on. */
export function oldDoors(i: Pick<ScoreInputs, "acts" | "tabs" | "old" | "mounts">): OldDoor[] {
  const tabKeys = new Set(i.tabs.map((t) => t.key));
  const settle = (address: string): OldDoor["lands"] => {
    if (!address.startsWith("/admin?")) return { path: address };
    const tab = new URLSearchParams(address.slice(address.indexOf("?") + 1)).get("tab") ?? "home";
    const left = own(i.old.leftAdmin, tab);
    if (left) return { path: left };
    return { tab: own(i.old.movedTabs, tab)?.tab ?? tab };
  };
  const drawn = (lands: OldDoor["lands"]): boolean => (lands.tab ? tabKeys.has(lands.tab) : i.old.clientRoutes.some((p) => routeMatches(p, barePath(lands.path ?? ""))));
  const doors = new Map<string, OldDoor>();
  const add = (address: string, kind: OldDoor["kind"]) => {
    if (doors.has(address)) return;
    const lands = settle(address);
    doors.set(address, { address, kind, lands, reaches: drawn(lands), inGarden: gardenPlaceOf(lands, i.mounts) !== null });
  };
  const tabAddress = (key: string) => `/admin?tab=${encodeURIComponent(key)}`;
  for (const key of [...Object.keys(i.old.movedTabs), ...Object.keys(i.old.leftAdmin)]) add(tabAddress(key), "folded tab");
  for (const t of i.tabs) add(tabAddress(t.key), "tab");
  for (const a of i.acts) add(actHref(a), a.kind === "control" ? "control" : a.kind === "dial" ? "dial" : a.tab ? "tab" : "page");
  return Array.from(doors.values());
}

function oldDoorsCount(i: ScoreInputs): Count {
  const doors = oldDoors(i);
  const open: OpenItem[] = [];
  for (const d of doors) {
    if (d.inGarden && d.reaches) continue;
    const to = d.lands.tab ? `the ${d.lands.tab} tab` : `the page ${d.lands.path}`;
    if (!d.reaches) open.push({ name: d.address, why: `It lands on ${to}, which nothing draws today.`, group: "reaches nothing today" });
    else open.push({ name: d.address, why: `It still opens ${to}, outside the garden.`, group: `outside the garden: ${d.kind}` });
  }
  const kinds: OldDoor["kind"][] = ["tab", "folded tab", "control", "dial", "page"];
  return {
    key: "oldDoors",
    title: "Old doors",
    doneMeans: "The old address still reaches its control, and what it lands on opens inside the garden.",
    measured: true,
    total: doors.length,
    done: doors.length - open.length,
    open,
    parts: [
      { name: "still reaches its page today", value: doors.filter((d) => d.reaches).length, of: doors.length },
      { name: "lands inside the garden", value: doors.filter((d) => d.inGarden).length, of: doors.length },
      ...kinds.map((kind) => ({ name: `addresses: ${kind}`, value: doors.filter((d) => d.kind === kind).length })),
    ],
    notes: [
      "The addresses are every Admin tab, every folded tab key (client/src/components/admin/adminTabAliases.ts), and every address an act lands on: controls, dials, and the pages beside Admin.",
      "Reaching is checked against the tab table and the client's router. Whether a control's page puts the focus on it is not checked here.",
      "The addresses inside mail templates and notices are not read yet.",
      "Lands inside the garden reads the same mount list as Functions (shared/gardenMounts.ts).",
    ],
  };
}

// ── The seven, together ────────────────────────────────────────────────────

/** The seven counts, measured from what is handed in. */
export function scoreGarden(i: ScoreInputs): Scoreboard {
  return { counts: [functionsCount(i), actsCount(i), endpointsCount(i), settingsCount(i), roadCount(), threeWaysCount(i), oldDoorsCount(i)] };
}
