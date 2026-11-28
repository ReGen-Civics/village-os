/**
 * THE RATCHET OVER THE SCOREBOARD: what is open may not grow.
 *
 * The scoreboard (shared/gardenScore.ts) counts. This holds each count where it stands, so the garden stays the way
 * the Game is governed after the build ends: a route, an act or a dial that arrives without a home fails CI by
 * name, with what to add.
 *
 * ── WHAT IS KEPT, AND WHY IT IS A CEILING ON WHAT IS OPEN ──────────────────
 *
 * One small file (server/gardenScoreboard.ratchet.json) holds, for each count, how many items are open under each
 * heading the report prints. The rule is one line: no heading may hold more open items than the file says, and a
 * heading the file does not name may hold none.
 *
 * It is a ceiling on OPEN and never a floor under DONE, on purpose. Deleting a route that was accounted for lowers
 * "done" and is no step backward, so a floor under done would fail an honest deletion. What may never happen is a
 * new thing arriving open, and that is exactly what a ceiling on open sees.
 *
 * A count with nothing open is written `full: true`, and from then on it must stay full.
 *
 * ── WHAT A FAILURE SAYS ────────────────────────────────────────────────────
 *
 * The count, the heading, the number against its ceiling, every open item under that heading by name, and what to
 * add. A heading is small on purpose (a route family, one kind of gap), so the newcomer is one of a few names.
 *
 * ── TIGHTENING ─────────────────────────────────────────────────────────────
 *
 * `npx tsx scripts/garden-scoreboard.ts --ratchet` rewrites the file from today's numbers and only ever lowers a
 * ceiling. It refuses to write while anything is over its ceiling. Raising one is a hand edit of the file, which a
 * reviewer sees as a line that went up. A count below its ceiling is not a failure: lanes do not have to touch
 * this file to land an improvement, so it does not make every landing conflict.
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
  "The ratchet over the Admin Garden scoreboard: the most open items each heading of each count may hold. A heading absent here may hold none. " +
  "Held by server/gardenScoreboard.test.ts. Tighten it with `npx tsx scripts/garden-scoreboard.ts --ratchet`, which only lowers a number. " +
  "A number that goes up in a diff is something that arrived without a home, and was let through by hand.";

/** One count as the ratchet file holds it. */
export interface CountRatchet {
  /** True once nothing was open. From then on nothing may be. */
  full: boolean;
  /** The most open items each heading may hold. A heading absent from here may hold none. */
  open: Record<string, number>;
}

/** The ratchet file. A count the scoreboard cannot measure yet is written as the words "not measured". */
export interface Ratchet {
  about: string;
  counts: Record<CountKey, CountRatchet | "not measured">;
}

/** What to add when something arrives open, count by count. */
export const WHAT_TO_ADD: Readonly<Record<CountKey, string>> = {
  functions: "Mount its tab or page in its place (shared/gardenMounts.ts), give the missing part an act, or record the founder's ruling that cuts it (CUT_BY_RULING, with the date and the words).",
  acts: "Give the act a route that was read, so its tier is settled, and a power its catalog holds a consequence line for (shared/adminActs/, shared/draftKinds.ts). Never write the line on the act.",
  endpoints:
    "Give the route a home: an act that calls it (shared/adminActs/, one row in the file of its place), a page that reads it (run `npx tsx scripts/garden-reads.ts --write`), or, when it is not admin's, a family in shared/notAdminRoutes.ts with its reason.",
  settings: "Give the setting what it is missing: a label and a description of its own (shared/gameVariables.ts), a door that was read, or a path by a vote.",
  road: "Nothing to add here yet.",
  threeWays: "A new act is open here until the guide's code can do it. A new dial she may not prepare is open by the lists that say so (shared/adminHelper.ts, shared/proposedChanges.ts).",
  oldDoors: "Make the address land: keep its tab in shared/adminTabs.ts or its alias in client/src/components/admin/adminTabAliases.ts, and mount what it lands on (shared/gardenMounts.ts).",
};

/**
 * The parts of a count that hold by construction and must stay whole: each names a number that has to equal its
 * total. A part that slips is a list somebody broke, and its open items say which entry.
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

/** How many items are open under each heading of a count. */
export function openByHeading(count: Pick<Count, "open">): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of openGroups(count).sort((a, b) => (a.group < b.group ? -1 : 1))) out[g.group] = g.items.length;
  return out;
}

/** Today's numbers in the ratchet's own shape. */
export function ratchetNow(board: Scoreboard): Ratchet["counts"] {
  const out = {} as Ratchet["counts"];
  for (const key of COUNT_KEYS) {
    const count = countOf(board, key);
    out[key] = count.measured ? { full: count.open.length === 0, open: openByHeading(count) } : "not measured";
  }
  return out;
}

/** Every way a scoreboard is worse than the ratchet allows, each a whole sentence that names what arrived. Empty when it holds. */
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
      failures.push(`${count.title} is measured now and the ratchet holds no ceiling for it. Run \`npx tsx scripts/garden-scoreboard.ts --ratchet\` and commit the file.`);
      continue;
    }
    for (const group of openGroups(count)) {
      const ceiling = held.full ? 0 : held.open[group.group] ?? 0;
      if (group.items.length <= ceiling) continue;
      const names = group.items.map((item) => `    ${item.name}: ${item.why}`).join("\n");
      const was = held.full ? "This count was full, so nothing may be open." : ceiling === 0 ? "Nothing was open under this heading." : `The ceiling is ${ceiling}.`;
      failures.push(`${count.title}, ${group.group}: ${group.items.length} open. ${was} Something arrived without a home. It is one of these:\n${names}\n  What to add: ${WHAT_TO_ADD[key]}`);
    }
    for (const name of MUST_BE_WHOLE[key] ?? []) {
      const part = count.parts.find((p) => p.name === name);
      if (!part) failures.push(`${count.title} no longer reports "${name}", which the ratchet holds whole.`);
      else if (part.of !== undefined && part.value !== part.of) failures.push(`${count.title}: "${name}" reads ${part.value} of ${part.of}. It holds by construction and must stay whole. The open items of this count name what slipped.`);
    }
    for (const name of MUST_BE_ZERO[key] ?? []) {
      const part = count.parts.find((p) => p.name === name);
      if (!part) failures.push(`${count.title} no longer reports "${name}", which the ratchet holds at zero.`);
      else if (part.value !== 0) failures.push(`${count.title}: "${name}" reads ${part.value} and must read 0. ${count.notes.filter((n) => n.includes("does not register")).join(" ")}`.trim());
    }
  }
  return failures;
}

/** Where today's numbers are better than the ratchet, heading by heading: what a tightening would lock in. */
export function ratchetSlack(board: Scoreboard, ratchet: Ratchet): string[] {
  const slack: string[] = [];
  for (const key of COUNT_KEYS) {
    const count = countOf(board, key);
    const held = ratchet.counts[key];
    if (!count.measured || held === undefined || held === "not measured") continue;
    const now = openByHeading(count);
    for (const heading of Object.keys(held.open)) {
      const open = now[heading] ?? 0;
      if (open < held.open[heading]) slack.push(`${count.title}, ${heading}: ${open} open, the ceiling is ${held.open[heading]}`);
    }
  }
  return slack;
}

/**
 * The ratchet tightened to today's numbers. It only ever lowers a ceiling: while anything is over its ceiling it
 * returns the failures and no file. With no earlier ratchet it writes today's numbers as they stand.
 */
export function tightened(board: Scoreboard, earlier: Ratchet | null, about: string): { ratchet: Ratchet } | { failures: string[] } {
  const now = ratchetNow(board);
  if (!earlier) return { ratchet: { about, counts: now } };
  const failures = ratchetFailures(board, earlier);
  if (failures.length) return { failures };
  const counts = {} as Ratchet["counts"];
  for (const key of COUNT_KEYS) {
    const held = earlier.counts[key];
    const today = now[key];
    // A count that was full stays written as full, whatever today's shape is.
    counts[key] = today === "not measured" || held === "not measured" || held === undefined ? today : { full: held.full || today.full, open: today.open };
  }
  return { ratchet: { about, counts } };
}
