/**
 * THE RATCHET OVER THE SCOREBOARD: nothing that has a home may lose it.
 *
 * The scoreboard (shared/gardenScore.ts) counts. This holds each count where it stands. The plan's rule: "When a
 * count reaches full it becomes a ratchet: CI fails if a new route, act or setting arrives without a home." So a
 * count is held in one of two ways, and one small file (server/gardenScoreboard.ratchet.json) says which:
 *
 *   arrivals "may be open"   the count is not full yet. It may not go BACKWARD: what is open may grow only by as
 *                            many items as arrived. An act added tomorrow may arrive open, because nobody can give
 *                            it a place in a garden that is not mounted, or let the guide do it, yet. A route that
 *                            had a home and lost it fails.
 *   arrivals "need a home"   nothing new may arrive open. No heading may hold more open items than the file says,
 *                            and a heading the file does not name may hold none. A count with nothing open is
 *                            written `full: true` and is held this way from then on. A lane may also switch a
 *                            count to it by hand before it is full, the day the fleet is ready for that.
 *
 * Beside both, the parts that hold BY CONSTRUCTION must stay whole today, whatever the count's state: every act
 * has a place and a Find anything entry, every dial its place, name, description and door, every old address still
 * reaches its page, every registration's path can be read. A newcomer that breaks one of those fails by name now.
 *
 * ── WHY IT COUNTS WHAT IS OPEN, AND NEVER SETS A FLOOR UNDER WHAT IS DONE ──
 *
 * Deleting a route that was accounted for lowers "done" and is no step backward, so a floor under done would fail
 * an honest deletion. Open only grows when something arrives open or something loses its home. The total says how
 * many arrived, so the two can be told apart without keeping a thousand names in a file.
 *
 * What that cannot see: one thing arriving with a home in the same change that takes another's home away. The two
 * cancel, and the count passes. The headings that grew are printed whenever anything fails, and the scoreboard
 * itself names every open item on every run.
 *
 * ── WHAT A FAILURE SAYS ────────────────────────────────────────────────────
 *
 * The count, the headings that grew with their numbers, every open item under those headings by name, and what to
 * add.
 *
 * ── REWRITING THE FILE ─────────────────────────────────────────────────────
 *
 * `npx tsx scripts/garden-scoreboard.ts --ratchet` rewrites the file from today's numbers. It refuses while any
 * count has gone backward, and it never moves a count from "need a home" back to "may be open". Being better than
 * the file is not a failure, so a lane does not have to touch it to land an improvement.
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
import { COUNT_KEYS, countOf, type Count, type CountKey, type Scoreboard } from "./gardenScore";
import { openGroups } from "./gardenScoreReport";

/** What the ratchet file says about itself, written into it. */
export const RATCHET_ABOUT =
  "The ratchet over the Admin Garden scoreboard. For each count: how many items there were, how many were open under each heading, and how it is held. " +
  "`may be open`: a newcomer may arrive open, and nothing that had a home may lose it. `need a home`: nothing may arrive open, and a count written full is held that way for good. " +
  "Held by server/gardenScoreboard.test.ts. Rewrite it with `npx tsx scripts/garden-scoreboard.ts --ratchet`, which refuses while a count has gone backward.";

export type Arrivals = "may be open" | "need a home";

/** One count as the ratchet file holds it. */
export interface CountRatchet {
  /** True once nothing was open. From then on nothing may be. */
  full: boolean;
  arrivals: Arrivals;
  /** How many items the count held when this was written. Growth past it is arrivals. */
  total: number;
  /** How many items were open under each heading. */
  open: Record<string, number>;
}

/** The ratchet file. A count the scoreboard cannot measure yet is written as the words "not measured". */
export interface Ratchet {
  about: string;
  counts: Record<CountKey, CountRatchet | "not measured">;
}

/** What to add when something loses its home or arrives without one, count by count. */
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

/**
 * The parts of a count that hold by construction and must stay whole: each names a number that has to equal its
 * total. A part that slips is a list somebody broke, and the open items of its count say which entry.
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

/** How many items are open under each heading of a count, the headings in order. */
export function openByHeading(count: Pick<Count, "open">): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of openGroups(count).sort((a, b) => (a.group < b.group ? -1 : 1))) out[g.group] = g.items.length;
  return out;
}

const sum = (table: Record<string, number>): number => Object.values(table).reduce((n, v) => n + v, 0);

/** Today's numbers in the ratchet's own shape. `arrivals` is what the earlier file said, or "may be open". */
export function ratchetNow(board: Scoreboard, earlier?: Ratchet | null): Ratchet["counts"] {
  const out = {} as Ratchet["counts"];
  for (const key of COUNT_KEYS) {
    const count = countOf(board, key);
    if (!count.measured) {
      out[key] = "not measured";
      continue;
    }
    const held = earlier?.counts[key];
    const was = held && held !== "not measured" ? held : null;
    const full = count.open.length === 0 || !!was?.full;
    out[key] = { full, arrivals: full || was?.arrivals === "need a home" ? "need a home" : "may be open", total: count.total ?? 0, open: openByHeading(count) };
  }
  return out;
}

/** The headings of a count that hold more open items than the file says, each with every open item under it. */
function grown(count: Count, held: CountRatchet): string[] {
  return openGroups(count)
    .filter((g) => g.items.length > (held.open[g.group] ?? 0))
    .map((g) => {
      const before = held.open[g.group] ?? 0;
      const was = before === 0 ? "Nothing was open under this heading." : `It held ${before}.`;
      return `  ${g.group}: ${g.items.length} open. ${was}\n${g.items.map((item) => `    ${item.name}: ${item.why}`).join("\n")}`;
    });
}

/** Every way a scoreboard is worse than the ratchet allows, each naming what lost its home or arrived without one. Empty when it holds. */
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
      failures.push(`${count.title} is measured now and the ratchet holds nothing for it. Run \`npx tsx scripts/garden-scoreboard.ts --ratchet\` and commit the file.`);
      continue;
    }
    const total = count.total ?? 0;
    const open = count.open.length;
    const heldOpen = sum(held.open);
    const headings = grown(count, held);
    if (held.full || held.arrivals === "need a home") {
      // Nothing may arrive open: every heading is held to its own number.
      if (headings.length) {
        const why = held.full ? "This count was full, so nothing may be open." : "This count takes no new open items.";
        failures.push(`${count.title}: ${why} Something arrived without a home, under:\n${headings.join("\n")}\n  What to add: ${WHAT_TO_ADD[key]}`);
      }
    } else {
      // A newcomer may arrive open. What is open may grow only by as many items as arrived.
      const arrived = Math.max(0, total - held.total);
      if (open > heldOpen + arrived) {
        const lost = open - heldOpen - arrived;
        failures.push(
          `${count.title}: ${open} open of ${total}. The ratchet holds ${heldOpen} open of ${held.total}, and ${arrived} arrived since, so ${lost} that had a home ${lost === 1 ? "is" : "are"} open again. The headings that grew:\n${headings.join("\n")}\n  What to add: ${WHAT_TO_ADD[key]}`,
        );
      }
    }
    for (const name of MUST_BE_WHOLE[key] ?? []) {
      const part = count.parts.find((p) => p.name === name);
      if (!part) failures.push(`${count.title} no longer reports "${name}", which the ratchet holds whole.`);
      else if (part.of !== undefined && part.value !== part.of) {
        failures.push(`${count.title}: "${name}" reads ${part.value} of ${part.of}. It holds by construction and must stay whole. What slipped is among:\n${headings.join("\n") || "  (no heading grew)"}\n  What to add: ${WHAT_TO_ADD[key]}`);
      }
    }
    for (const name of MUST_BE_ZERO[key] ?? []) {
      const part = count.parts.find((p) => p.name === name);
      if (!part) failures.push(`${count.title} no longer reports "${name}", which the ratchet holds at zero.`);
      else if (part.value !== 0) {
        const said = count.notes.filter((n) => n.includes("does not register")).join(" ");
        failures.push(`${count.title}: "${name}" reads ${part.value} and must read 0. ${said}${said ? " " : ""}${headings.length ? `The headings that grew:\n${headings.join("\n")}` : ""}`.trim());
      }
    }
  }
  return failures;
}

/** Where today's numbers differ from the file without failing: what a rewrite would record. */
export function ratchetDrift(board: Scoreboard, ratchet: Ratchet): string[] {
  const drift: string[] = [];
  for (const key of COUNT_KEYS) {
    const count = countOf(board, key);
    const held = ratchet.counts[key];
    if (!count.measured || held === undefined || held === "not measured") continue;
    const open = count.open.length;
    const heldOpen = sum(held.open);
    if (open !== heldOpen || (count.total ?? 0) !== held.total) drift.push(`${count.title}: ${open} open of ${count.total}, the file holds ${heldOpen} open of ${held.total}`);
  }
  return drift;
}

/**
 * The ratchet rewritten to today's numbers. While any count has gone backward it returns the failures and no file.
 * A count held as "need a home", or written full, stays held that way. With no earlier file it records today as
 * it stands.
 */
export function rewritten(board: Scoreboard, earlier: Ratchet | null, about: string): { ratchet: Ratchet } | { failures: string[] } {
  if (earlier) {
    const failures = ratchetFailures(board, earlier);
    if (failures.length) return { failures };
  }
  return { ratchet: { about, counts: ratchetNow(board, earlier) } };
}
