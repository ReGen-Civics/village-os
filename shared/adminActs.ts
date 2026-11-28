/**
 * THE REGISTRY OF ACTS: one entry for every admin function (the Admin Garden's frame, item 3).
 *
 * A founder's words: a full search for admin, "to help find all the various functions in admin and what we need to
 * do and settings to change", with the village's guide beside it. A button, the search (Ctrl K) and the guide all
 * read this one list, so all three name the same act and land on the same control.
 *
 * ── WHAT ONE ENTRY SAYS ───────────────────────────────────────────────────
 *
 *   id         a stable address. It never changes once shipped: a rename breaks every link to it.
 *   place      where it lives on the grounds (the Fire, the Hall, the Gate and the rest: shared/adminTabs.ts)
 *   title, help, synonyms   the words a founder would type
 *   tab / path where its control lives today. `adminSearchHref` (shared/adminSearch.ts) makes the address, so every
 *              old link still lands where it did
 *   power      what its own server door asks: a capability key, "admin" or "founder" (and `holder`, where a holder
 *              of a power passes that door beside an admin)
 *   route      the method and path it calls, exactly as Express registers it. Absent: a reading page
 *   fields     the inputs it takes, by the key its route reads
 *   parity     the rows of the Admin Garden's parity ledger it covers (shared/adminActs/parity.ts), so the count
 *              of what the registry covers is read off the entries themselves
 *   partial    registered and real, with its route or its fields still to finish
 *
 * ── WHAT IS NEVER TYPED ON AN ENTRY ───────────────────────────────────────
 *
 *   its class        `actClass`: "read" when it calls no write route. "person-only" when NEVER_PROPOSED
 *                    (shared/proposedChanges.ts) names its route, when the connector's list (ALWAYS_A_PERSON,
 *                    shared/agentAdmin.ts) names it with mode "always", or when it is a dial the helper may not
 *                    propose (shared/adminHelper.ts). Otherwise "prepare": the guide fills the real control or
 *                    files a proposal, and a person presses. `actReason` says which list and which rule decided.
 *                    Change a list and the class changes with it; nothing here can disagree with the lists.
 *   its consequence  `actConsequence`: the line the catalogs already hold. A key reads its seed's line
 *                    (shared/guilds.ts); everything else reads the line of the power it needs
 *                    (CAPABILITY_CONSEQUENCE, shared/draftKinds.ts). Where no catalog holds a line it is empty.
 *                    Money, pay and votes never get wording made up here.
 *
 * ── WHAT THIS FILE NEVER DOES ─────────────────────────────────────────────
 *
 * It never acts and it is never a gate. It DESCRIBES powers and routes. Nothing on the server may decide access by
 * reading it: every route keeps its own door, and a search that reads it asks the one capability gate what a person
 * may see (server/routes/adminSearch.ts). An entry is data and survives a JSON round trip.
 *
 * ── ADDING AN ACT ─────────────────────────────────────────────────────────
 *
 *   1. Open the file of its place under shared/adminActs/ and add one row. Name it `<place>.<thing>.<verb>`.
 *   2. Read the route's handler and write what it really asks: the capability it hands the gate, or "admin" when it
 *      asks only `isAdmin`. If server/lib/operatorRoutes.ts names the route, that power is its `holder`.
 *   3. List the body keys the handler reads as `fields`. If you have not read them, leave `fields` out and say
 *      `partial: true`. An entry that claims a route nobody verified is worse than a missing one.
 *   4. Say which ledger row it covers (`parity`). An act on a tab covers that tab's row without saying so.
 *   5. Add its id to the frozen list in shared/adminActs/frozenIds.ts. From then on the id is an address.
 *   6. Run shared/adminActs.test.ts and shared/adminActsCoverage.test.ts. They prove the route exists, that the
 *      handler names the power, that each field key is read there, that the act is found by its own title, and
 *      they print how much of the ledger the registry covers.
 *
 * A new tab or a new dial needs none of this: it is an act the day it joins shared/adminTabs.ts or
 * shared/gameVariables.ts (shared/adminActs/derived.ts).
 *
 * Only the server reads this file. The browser is handed its own list by the search routes. It grows from
 * shared/adminSearch.ts and imports nothing of the site-wide search, so it stands by itself.
 *
 * Pure: no I/O, no clock.
 */
import { proposalRefusal } from "./adminHelper";
import { ALWAYS_A_PERSON } from "./agentAdmin";
import { CONTROL_ENTRIES, OUTSIDE_ENTRIES, adminSearchHref, type AdminSearchEntry } from "./adminSearch";
import { TAB_MODULE, TAB_MODULES } from "./adminTabModules";
import type { Capability } from "./capabilities";
import { CAPABILITY_CONSEQUENCE } from "./draftKinds";
import { VARIABLES_BY_KEY, type VariableDef } from "./gameVariables";
import { SEEDS_BY_ID } from "./guilds";
import { neverProposed, variableNever } from "./proposedChanges";
import { CONTROL_ACTS, DIAL_ACTS, DIAL_ROUTE, OUTSIDE_ACTS, SEED_ACTS, TAB_ACTS } from "./adminActs/derived";
import { CEIBA_ACTS } from "./adminActs/ceiba";
import { FIRE_ACTS } from "./adminActs/fire";
import { FRAME_ACTS } from "./adminActs/frame";
import { GATE_ACTS } from "./adminActs/gate";
import { GREENHOUSE_ACTS } from "./adminActs/greenhouse";
import { HALL_ACTS } from "./adminActs/hall";
import { LIBRARY_ACTS } from "./adminActs/library";
import { GUIDE_ACTS } from "./adminActs/guide";
import { SPRING_ACTS } from "./adminActs/spring";
import { STAGE_ACTS } from "./adminActs/stage";
import { STORE_ACTS } from "./adminActs/store";
import { TOWER_ACTS } from "./adminActs/tower";
import type { ActPower, ActRoute, AdminAct } from "./adminActs/types";

export type { ActField, ActFieldKind, ActMethod, ActPower, ActRoute, AdminAct, AdminPlace } from "./adminActs/types";
export { ADMIN_PLACES } from "./adminTabs";

/** The acts somebody wrote by hand, place by place. Their ids are frozen in the test. */
export const WRITTEN_ACTS: readonly AdminAct[] = [
  ...FIRE_ACTS,
  ...HALL_ACTS,
  ...GATE_ACTS,
  ...LIBRARY_ACTS,
  ...GREENHOUSE_ACTS,
  ...STORE_ACTS,
  ...TOWER_ACTS,
  ...SPRING_ACTS,
  ...STAGE_ACTS,
  ...CEIBA_ACTS,
  ...GUIDE_ACTS,
  ...FRAME_ACTS,
];

/** Every admin act: the tabs, the pages beside Admin, the shipped controls, the written acts, the keys and the dials. */
export const ADMIN_ACTS: readonly AdminAct[] = [...TAB_ACTS, ...OUTSIDE_ACTS, ...CONTROL_ACTS, ...WRITTEN_ACTS, ...SEED_ACTS, ...DIAL_ACTS];

const BY_ID = new Map(ADMIN_ACTS.map((a) => [a.id, a]));
const SHIPPED = new Map([...CONTROL_ENTRIES, ...OUTSIDE_ENTRIES].map((e) => [e.id, e]));

/** One act by its address, or undefined. */
export function adminAct(id: string): AdminAct | undefined {
  return BY_ID.get(id);
}

/** The address an act lands on: the same one admin search makes, so an old link and a new one agree. */
export function actHref(a: Pick<AdminAct, "id" | "kind" | "tab" | "path">): string {
  return adminSearchHref(a);
}

/** The path a call to this act's route names, with its own values in place of the `:name` parts it fixes. */
export function actPath(a: Pick<AdminAct, "route">): string | null {
  if (!a.route) return null;
  const params = a.route.params ?? {};
  return a.route.path.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (whole, name: string) => params[name] ?? whole);
}

// ── The class, computed from the lists that own the rules ──────────────────

/**
 * "read": it calls no write route. "prepare": the guide fills the real control or files a proposal, and a person
 * presses. "person-only": the guide may explain it, suggest in words and take the person to the control, no more.
 */
export type ActClass = "read" | "prepare" | "person-only";

/** One rule of the connector's list (ALWAYS_A_PERSON, shared/agentAdmin.ts), as the class reads it. */
export interface AlwaysRule {
  key: string;
  words: string;
  /** "always": never a machine's, for any method. "writes" and "personal": a connector proposes them and a person does them. */
  mode: "always" | "writes" | "personal";
  test(method: string, path: string): boolean;
}

/** The lists a class is read from. A test hands in its own to prove the class follows them. */
export interface PersonOnlyLists {
  /** The connector's list: what an agent account never does directly. */
  always: readonly AlwaysRule[];
  /** What may never even be prepared for a person to accept (NEVER_PROPOSED, shared/proposedChanges.ts). */
  neverProposed(method: string, path: string, body: unknown): { key: string; words: string } | null;
  /** A dial whose value is sealed, or that governs the agents themselves (shared/proposedChanges.ts). */
  variableNever(def: VariableDef | undefined): { key: string; words: string } | null;
  /** Why the helper may not propose a change to this dial, or null when it may (shared/adminHelper.ts). */
  proposalRefusal(def: VariableDef | undefined): string | null;
}

/** The lists as the platform holds them today. */
export const PERSON_ONLY_LISTS: PersonOnlyLists = { always: ALWAYS_A_PERSON, neverProposed, variableNever, proposalRefusal };

/** Which list made an act a person's alone, by which rule, in that rule's own words. */
export interface ActReason {
  list: "never_proposed" | "always_a_person" | "helper_money";
  key: string;
  words: string;
}

/** The key the helper's refusal is recorded under: the helper's list is one rule, with its own sentence for each dial. */
export const HELPER_RULE_KEY = "may_not_propose";

type Routed = Pick<AdminAct, "route">;

/** A call's path as a list reads it: the act's own values where it fixes them, and a plain letter for every other `:name` part. */
const filled = (path: string) => path.replace(/:[A-Za-z][A-Za-z0-9]*/g, "x");

/** The dial an act writes, when it is one. */
function dialOf(a: Routed): VariableDef | undefined {
  return a.route?.path === DIAL_ROUTE ? VARIABLES_BY_KEY[a.route.params?.key ?? ""] : undefined;
}

const isWrite = (a: Routed): a is { route: ActRoute } => !!a.route && a.route.method !== "GET";

/**
 * Every rule of the connector's list that names this act's write, whatever its mode. Empty for a read.
 * An act that is "prepare" with none of these is one a machine could be let to do by itself. That choice is a
 * person's, made elsewhere, and nothing here makes it.
 */
export function actAlwaysRules(a: Routed, lists: PersonOnlyLists = PERSON_ONLY_LISTS): Array<Pick<AlwaysRule, "key" | "words" | "mode">> {
  if (!isWrite(a)) return [];
  const path = filled(actPath(a) ?? "");
  return lists.always.filter((r) => r.test(a.route.method, path)).map(({ key, words, mode }) => ({ key, words, mode }));
}

/**
 * Why an act is a person's alone, or null when it is not. Asked in this order:
 *
 *   1. NEVER_PROPOSED names its route: it is never even prepared. A dial is read the way a proposal reads one, by
 *      the route's own pattern, and then by its definition (`variableNever`).
 *   2. A rule of the connector's list names it with mode "always": erasure, money, voice, comparing, secrets,
 *      accounts and the agents themselves. The modes "writes" and "personal" do NOT make an act a person's alone:
 *      their own words say a connector proposes them and a person does them, which is what "prepare" means.
 *   3. It is a dial the helper may not propose: money, choosing people, a sealed value, its own switch.
 */
export function actReason(a: Routed, lists: PersonOnlyLists = PERSON_ONLY_LISTS): ActReason | null {
  if (!isWrite(a)) return null;
  const { method } = a.route;
  const dial = dialOf(a);
  const never = lists.neverProposed(method, dial ? a.route.path : filled(actPath(a) ?? ""), {}) ?? (dial ? lists.variableNever(dial) : null);
  if (never) return { list: "never_proposed", key: never.key, words: never.words };
  const always = actAlwaysRules(a, lists).find((r) => r.mode === "always");
  if (always) return { list: "always_a_person", key: always.key, words: always.words };
  const refused = dial ? lists.proposalRefusal(dial) : null;
  if (refused) return { list: "helper_money", key: HELPER_RULE_KEY, words: refused };
  return null;
}

/** The class of an act, computed: a read calls no write route, a reason makes it a person's alone, and every other write is one to prepare. */
export function actClass(a: Routed, lists: PersonOnlyLists = PERSON_ONLY_LISTS): ActClass {
  if (!isWrite(a)) return "read";
  return actReason(a, lists) ? "person-only" : "prepare";
}

// ── The consequence line, read from the catalogs that hold it ──────────────

const isCapability = (p: ActPower | undefined): p is Capability => !!p && Object.prototype.hasOwnProperty.call(CAPABILITY_CONSEQUENCE, p);

/** The capability whose line describes this act: the one its door asks for, or the one whose holder passes it. */
export function actCapability(a: Pick<AdminAct, "power" | "holder">): Capability | null {
  if (isCapability(a.power)) return a.power;
  return a.holder ?? null;
}

/**
 * What the act changes, in the words the catalogs already hold: a key's line is its seed's, and anything else reads
 * the line of the power it needs. Empty where no catalog holds one. A reading page changes nothing and has none.
 */
export function actConsequence(a: Pick<AdminAct, "power" | "holder" | "seed" | "route">): string {
  if (!a.route) return "";
  if (a.seed) return SEEDS_BY_ID[a.seed]?.consequence ?? "";
  const cap = actCapability(a);
  return cap ? CAPABILITY_CONSEQUENCE[cap] : "";
}

// ── The search face ────────────────────────────────────────────────────────

/** The module an act needs on: its own, or its tab's (shared/adminTabModules.ts). */
export function actModule(a: Pick<AdminAct, "module" | "tab">): string | undefined {
  return a.module ?? (a.tab ? TAB_MODULE[a.tab] : undefined);
}

/** The modules any one of which shows an act: only for an act with no single module, on a tab that follows several. */
export function actModulesAny(a: Pick<AdminAct, "module" | "modulesAny" | "tab">): readonly string[] | undefined {
  if (actModule(a)) return undefined;
  return a.modulesAny ?? (a.tab ? TAB_MODULES[a.tab] : undefined);
}

/**
 * An act as a search entry: words and an address. The key it names is the one its door hands the gate, so a
 * search never offers a control whose route would refuse the person. A door that asks only for an admin names none.
 */
export function actSearchEntry(a: AdminAct): AdminSearchEntry {
  // An entry admin search already shipped keeps its own words and its own key, exactly as it was.
  const shipped = SHIPPED.get(a.id);
  if (shipped) return shipped;
  const module = actModule(a);
  const modulesAny = actModulesAny(a);
  return {
    id: a.id,
    kind: a.kind,
    title: a.title,
    help: a.help,
    synonyms: a.synonyms,
    ...(a.tab ? { tab: a.tab } : {}),
    ...(a.path ? { path: a.path } : {}),
    ...(isCapability(a.power) ? { capability: a.power } : {}),
    ...(module ? { module } : {}),
    ...(modulesAny ? { modulesAny } : {}),
    ...(a.brochure ? { brochure: a.brochure } : {}),
  };
}

/** Every act as a search entry, in registry order: pages first, dials last. */
export const ADMIN_ACT_ENTRIES: readonly AdminSearchEntry[] = ADMIN_ACTS.map(actSearchEntry);


/** What the guide reads about one act: the entry, its address, and the three things computed for it. */
export interface ActCard {
  act: AdminAct;
  href: string;
  actClass: ActClass;
  /** Which list and which rule made it a person's alone, or null. */
  reason: ActReason | null;
  /** Every rule of the connector's list that names it, whatever its mode. */
  alwaysRules: Array<Pick<AlwaysRule, "key" | "words" | "mode">>;
  consequence: string;
}

/** One act with everything computed for it. */
export function actCard(a: AdminAct, lists: PersonOnlyLists = PERSON_ONLY_LISTS): ActCard {
  return { act: a, href: actHref(a), actClass: actClass(a, lists), reason: actReason(a, lists), alwaysRules: actAlwaysRules(a, lists), consequence: actConsequence(a) };
}
