/**
 * THE RATCHET OVER THE SCOREBOARD: nothing arrives open without its name being written down.
 *
 * The scoreboard (shared/gardenScore.ts) counts. This holds each count where it stands, BY IDENTITY: one file
 * (server/gardenScoreboard.ratchet.json) keeps the name of every item that is open under each count (the ledger
 * row, the act's id, the route's method and path, the setting's id, the old address), one to a line, in order.
 *
 * ── THE RULE ───────────────────────────────────────────────────────────────
 *
 * An open item whose name is not on its count's list fails, whatever the totals say. The failure names each one,
 * says why it is open, and says what to add.
 *
 * An item LEAVING the list is always allowed: it found its home, or it was deleted. The file is rewritten to drop
 * it only by the explicit step below, never silently.
 *
 * A count with nothing open is written `full: true`, its list is empty, and it takes nothing open from then on.
 *
 * ── WHY BY NAME, AND NEVER BY NUMBER ───────────────────────────────────────
 *
 * The first two ratchets counted. A count cannot tell one item finding a home from another arriving without one in
 * the same change: the two cancel and the number stands still. Names can. So a newcomer cannot hide behind
 * somebody else's fix, and the control for exactly that is kept as a test (server/gardenScoreboard.test.ts).
 *
 * ── WHEN NOTHING CAN GIVE A NEWCOMER A HOME YET ────────────────────────────
 *
 * Some counts cannot be satisfied by anybody today: no act can be done by the guide until her code exists, and no
 * address lands inside a garden that is not mounted. A new act therefore arrives open there, and this ratchet
 * stops it. That is on purpose. The person adding it writes its name into the file by hand, on its own line, in
 * order, and the reviewer sees that line arrive. Nothing here writes a new name for anybody.
 *
 * ── WHAT STILL RESTS ON A NUMBER ───────────────────────────────────────────
 *
 * A name on the list says an item is open. It does not say WHY, so an item that was open for one reason and is now
 * open for a worse one keeps its name and passes. The parts that hold by construction catch that: each must stay
 * whole (every act has a place and a Find anything entry, every dial its four answers, every old address still
 * reaches its page), and one must read zero (an act naming a route the server no longer registers).
 *
 * ── THE FILE ───────────────────────────────────────────────────────────────
 *
 * One name to a line, sorted by code point, so two lanes that each add or drop a name change different lines and a
 * merge adds lines without rewriting the file.
 *
 *   npx tsx scripts/garden-scoreboard.ts --ratchet    rewrites it: drops every name that is no longer open. It
 *                                                     refuses while any open item is not on the list, and it
 *                                                     never adds a name.
 *
 * Being better than the file is no failure, so a lane does not have to touch it to land an improvement.
 *
 * ── WHAT RESTS ON A RECORDED TABLE ─────────────────────────────────────────
 *
 * This file is a record, and a record only proves the tree agrees with it. Everything it is compared against is
 * measured from code on every run (the route reader, the handlers' own text, the registry, the dial registry, the
 * client's source). The one input that is itself a record is the permission matrix's snapshot, and no count is
 * taken on its word: it labels open routes and nothing else.
 *
 * Pure: no I/O, no clock.
 */
import { COUNT_KEYS, countOf, type Count, type CountKey, type OpenItem, type Scoreboard } from "./gardenScore";

/** What the ratchet file says about itself, written into it. */
export const RATCHET_ABOUT =
  "The ratchet over the Admin Garden scoreboard: the name of every item that is open under each count, one to a line, in order. " +
  "An open item that is not named here fails server/gardenScoreboard.test.ts. A name may always leave. " +
  "`npx tsx scripts/garden-scoreboard.ts --ratchet` drops the names that are no longer open and never adds one. " +
  "A name added by hand is something that arrived without a home, and the reviewer of that line let it through.";

/** One count as the ratchet file holds it. */
export interface CountRatchet {
  /** True once nothing was open. From then on nothing may be. */
  full: boolean;
  /** The name of every open item, sorted: a ledger row, an act's id, a route's method and path, a setting's id, an old address. */
  open: string[];
}

/** The ratchet file. A count the scoreboard cannot measure yet is written as the words "not measured". */
export interface Ratchet {
  about: string;
  counts: Record<CountKey, CountRatchet | "not measured">;
}

/** Whether something read from disk is a ratchet in this shape: every count is the words "not measured" or a list of names. */
export function isRatchet(value: unknown): value is Ratchet {
  if (!value || typeof value !== "object") return false;
  const counts = (value as { counts?: unknown }).counts;
  if (!counts || typeof counts !== "object") return false;
  return COUNT_KEYS.every((key) => {
    const held = (counts as Record<string, unknown>)[key];
    if (held === "not measured") return true;
    if (!held || typeof held !== "object") return false;
    const { full, open } = held as { full?: unknown; open?: unknown };
    return typeof full === "boolean" && Array.isArray(open) && open.every((name) => typeof name === "string");
  });
}

/** What to add when something arrives without a home, count by count. */
export const WHAT_TO_ADD: Readonly<Record<CountKey, string>> = {
  functions: "Mount its tab or page in its place (shared/gardenMounts.ts), give the missing part an act, or record the founder's ruling that cuts it (CUT_BY_RULING, with the date and the words).",
  acts: "Give the act a route that was read, so its tier is settled, and a power its catalog holds a consequence line for (shared/adminActs/, shared/draftKinds.ts). Never write the line on the act.",
  endpoints:
    "Give the route a home: an act that calls it (shared/adminActs/, one row in the file of its place), a page that reads it (run `npx tsx scripts/garden-reads.ts --write`), or a family in shared/notAdminRoutes.ts, with its reason, for a route that belongs to a member, a visitor or a machine.",
  settings: "Give the setting what it is missing: a label and a description of its own (shared/gameVariables.ts), a door that was read, or a path by a vote.",
  road: "Nothing to add here yet.",
  threeWays: "An act is open here until the guide's code can do it. A dial she may not prepare is open by the lists that say so (shared/adminHelper.ts, shared/proposedChanges.ts).",
  oldDoors: "Make the address land: keep its tab in shared/adminTabs.ts or its alias in client/src/components/admin/adminTabAliases.ts, and mount what it lands on (shared/gardenMounts.ts).",
};

/** The last line of every failure: the one way through when nothing can give the newcomer a home yet. */
export const BY_HAND =
  "If nothing can give it a home yet, write its name into server/gardenScoreboard.ratchet.json by hand, on its own line under this count, in order. The reviewer sees that line arrive.";

/**
 * The parts of a count that hold by construction and must stay whole: each names a number that has to equal its
 * total. A name on the list cannot see an item getting worse, and these can.
 */
export const MUST_BE_WHOLE: Readonly<Partial<Record<CountKey, readonly string[]>>> = {
  acts: ["has a place", "has a Find anything entry"],
  settings: ["dials: a home place", "dials: a plain name", "dials: what it changes", "dials: who may change it"],
  threeWays: ["by click", "by Find anything"],
  oldDoors: ["still reaches its page today"],
};

/** The parts of a count that must read zero. */
export const MUST_BE_ZERO: Readonly<Partial<Record<CountKey, readonly string[]>>> = {
  endpoints: ["registrations whose path could not be read", "routes an act names that the server does not register"],
  functions: ["no act carries it"],
};

/** Names in the one order the file keeps: by code point, the same on every machine. */
export function inOrder(names: readonly string[]): string[] {
  return Array.from(new Set(names)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The name of every open item of a count, in order. */
export function openNames(count: Pick<Count, "open">): string[] {
  return inOrder(count.open.map((item) => item.id));
}

/** Today's open items in the ratchet's own shape. A count the earlier file wrote as full stays written as full. */
export function ratchetNow(board: Scoreboard, earlier?: Ratchet | null): Ratchet["counts"] {
  const out = {} as Ratchet["counts"];
  for (const key of COUNT_KEYS) {
    const count = countOf(board, key);
    if (!count.measured) {
      out[key] = "not measured";
      continue;
    }
    const held = earlier?.counts[key];
    const wasFull = !!held && held !== "not measured" && held.full;
    out[key] = { full: wasFull || count.open.length === 0, open: openNames(count) };
  }
  return out;
}

/** The open items of a count that its list does not name: what arrived without a home. */
export function newcomers(count: Pick<Count, "open">, held: CountRatchet): OpenItem[] {
  const known = new Set(held.full ? [] : held.open);
  return count.open.filter((item) => !known.has(item.id)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Every way a scoreboard is worse than the ratchet allows, each naming what arrived without a home. Empty when it holds. */
export function ratchetFailures(board: Scoreboard, ratchet: Ratchet): string[] {
  const failures: string[] = [];
  for (const key of COUNT_KEYS) {
    const count = countOf(board, key);
    const held = ratchet.counts[key];
    if (!count.measured) {
      if (held !== "not measured") failures.push(`${count.title} was measured when the ratchet was written and is not measured now. A count never goes back to unmeasured.`);
      continue;
    }
    if (held === undefined || held === "not measured") {
      failures.push(`${count.title} is measured now and the ratchet holds no list for it. Run \`npx tsx scripts/garden-scoreboard.ts --ratchet\` and commit the file.`);
      continue;
    }
    const arrived = newcomers(count, held);
    if (arrived.length) {
      const why = held.full ? "This count was full, so nothing may be open." : "The ratchet does not name them, so each arrived without a home.";
      const lines = arrived.map((item) => `    ${item.id}: ${item.why}${item.name !== item.id ? ` (${item.name})` : ""}`).join("\n");
      failures.push(`${count.title}: ${arrived.length} open ${arrived.length === 1 ? "item is" : "items are"} new. ${why}\n${lines}\n  What to add: ${WHAT_TO_ADD[key]}\n  ${BY_HAND}`);
    }
    for (const name of MUST_BE_WHOLE[key] ?? []) {
      const part = count.parts.find((p) => p.name === name);
      if (!part) failures.push(`${count.title} no longer reports "${name}", which the ratchet holds whole.`);
      else if (part.of !== undefined && part.value !== part.of) {
        failures.push(`${count.title}: "${name}" reads ${part.value} of ${part.of}. It holds by construction and must stay whole. The open items of this count say which entry slipped, each under its heading.\n  What to add: ${WHAT_TO_ADD[key]}`);
      }
    }
    for (const name of MUST_BE_ZERO[key] ?? []) {
      const part = count.parts.find((p) => p.name === name);
      if (!part) failures.push(`${count.title} no longer reports "${name}", which the ratchet holds at zero.`);
      else if (part.value !== 0) {
        const said = count.notes.filter((n) => n.includes("does not register")).join(" ");
        failures.push(`${count.title}: "${name}" reads ${part.value} and must read 0.${said ? ` ${said}` : ""}`);
      }
    }
  }
  return failures;
}

/** The names on the list that are no longer open, count by count: what the rewrite step would drop. */
export function ratchetLeft(board: Scoreboard, ratchet: Ratchet): Array<{ key: CountKey; title: string; names: string[] }> {
  const left: Array<{ key: CountKey; title: string; names: string[] }> = [];
  for (const key of COUNT_KEYS) {
    const count = countOf(board, key);
    const held = ratchet.counts[key];
    if (!count.measured || held === undefined || held === "not measured") continue;
    const open = new Set(count.open.map((item) => item.id));
    const names = held.open.filter((name) => !open.has(name));
    if (names.length) left.push({ key, title: count.title, names });
  }
  return left;
}

/**
 * The ratchet rewritten to today: every name that is no longer open is dropped, and no name is ever added. While
 * any open item is not on its list it returns the failures and no file. With no earlier file it records today's
 * open items as they stand.
 */
export function rewritten(board: Scoreboard, earlier: Ratchet | null, about: string): { ratchet: Ratchet } | { failures: string[] } {
  if (earlier) {
    const failures = ratchetFailures(board, earlier);
    if (failures.length) return { failures };
  }
  return { ratchet: { about, counts: ratchetNow(board, earlier) } };
}

/** The file as it is written: plain JSON, one name to a line. */
export function ratchetText(ratchet: Ratchet): string {
  return `${JSON.stringify(ratchet, null, 1)}\n`;
}
