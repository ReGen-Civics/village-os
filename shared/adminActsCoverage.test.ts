/**
 * COVERAGE: how many of the 195 admin functions the parity ledger tracks have an entry in the registry of acts.
 *
 * The ledger gives every function an id (A1 to H8), and every act names the ids it covers (`parity`,
 * shared/adminActs/parity.ts). shared/adminActs/ledger.ts holds the 195 ids, each with a short plain phrase, and this
 * file counts them:
 *
 *   registered   an act covers it, and none of the acts covering it is partial
 *   partial      it is covered, and an act covering it is marked partial, or STILL_OPEN names what has no act yet
 *   missing      no act covers it
 *
 * A function the founder ruled out or merged is still counted: the registry describes where it lives today.
 * The test prints the report, section by section, and holds a floor at what was reached, so coverage only goes up.
 */
import { describe, expect, it } from "vitest";
import { ADMIN_ACTS, type AdminAct } from "./adminActs";
import { DIAL_ACTS, SEED_ACTS } from "./adminActs/derived";
import { LEDGER_NEVER_DRAWN as NEVER_DRAWN, LEDGER_SECTION_SIZE as SECTION_SIZE, LEDGER_STILL_OPEN as STILL_OPEN, LEDGER_TOTAL, PARITY_LEDGER as LEDGER } from "./adminActs/ledger";


type State = "registered" | "partial" | "missing" | "never drawn";

const covering = (id: string): AdminAct[] => ADMIN_ACTS.filter((a) => a.parity?.includes(id));

function stateOf(id: string): State {
  const acts = covering(id);
  if (!acts.length) return NEVER_DRAWN[id] ? "never drawn" : "missing";
  return STILL_OPEN[id] || acts.some((a) => a.partial) ? "partial" : "registered";
}

/** What was reached on 27 Nov 2026. A floor: the numbers may go up, never down. */
const FLOOR = { covered: 192, registered: 110 };

describe("how much of the parity ledger the registry covers", () => {
  const ids = Object.keys(LEDGER);
  const states = new Map(ids.map((id) => [id, stateOf(id)]));
  const count = (state: State, section?: string) => ids.filter((id) => states.get(id) === state && (!section || id[0] === section)).length;

  it("holds the whole ledger: 195 ids, each section the size the ledger says", () => {
    expect(ids).toHaveLength(LEDGER_TOTAL);
    for (const [section, size] of Object.entries(SECTION_SIZE)) {
      const got = ids.filter((id) => id[0] === section);
      expect(got, section).toHaveLength(size);
      expect(got, section).toEqual(Array.from({ length: size }, (_, i) => `${section}${i + 1}`));
    }
  });

  it("every id an act names is one the ledger has", () => {
    const known = new Set(ids);
    const unknown = ADMIN_ACTS.flatMap((a) => (a.parity ?? []).filter((id) => !known.has(id)).map((id) => `${a.id}: ${id}`));
    expect(unknown, unknown.join(", ")).toEqual([]);
  });

  it("a row marked still open is one an act covers", () => {
    for (const id of Object.keys(STILL_OPEN)) expect(covering(id).length, id).toBeGreaterThan(0);
  });

  it("prints the report and holds the floor", () => {
    const line = (name: string, total: number, section?: string) =>
      `  ${name.padEnd(8)}${String(total).padStart(5)}${String(count("registered", section)).padStart(12)}${String(count("partial", section)).padStart(9)}${String(count("missing", section)).padStart(9)}`;
    const of = (state: State) => ids.filter((id) => states.get(id) === state);
    const lines = [
      "",
      `Registry of acts: coverage of the parity ledger (${LEDGER_TOTAL} functions)`,
      `  ${"section".padEnd(8)}${"rows".padStart(5)}${"registered".padStart(12)}${"partial".padStart(9)}${"missing".padStart(9)}`,
      ...Object.entries(SECTION_SIZE).map(([section, size]) => line(section, size, section)),
      line("all", LEDGER_TOTAL),
      `  covered (registered or partial): ${count("registered") + count("partial")} of ${LEDGER_TOTAL}`,
      `  missing: ${of("missing").map((id) => `${id} ${LEDGER[id]}`).join("; ") || "none"}`,
      `  never drawn today, left out on purpose: ${of("never drawn").map((id) => `${id} ${LEDGER[id]} (${NEVER_DRAWN[id]})`).join("; ") || "none"}`,
      `  partial: ${of("partial").join(", ")}`,
      `  acts in the registry: ${ADMIN_ACTS.length} (${DIAL_ACTS.length} dials, ${SEED_ACTS.length} keys, ${ADMIN_ACTS.filter((a) => a.partial).length} marked partial)`,
      "",
    ];
    console.log(lines.join("\n"));
    expect(count("registered") + count("partial")).toBeGreaterThanOrEqual(FLOOR.covered);
    expect(count("registered")).toBeGreaterThanOrEqual(FLOOR.registered);
    expect(count("registered") + count("partial") + count("missing") + count("never drawn")).toBe(LEDGER_TOTAL);
    // Nothing is missing: every row is covered, or is one of the three that no page draws.
    expect(of("missing")).toEqual([]);
    // A row named as never drawn that an act now covers is a stale name here: take it off the list.
    for (const id of Object.keys(NEVER_DRAWN)) expect(covering(id), `${id} is on NEVER_DRAWN and has an act`).toEqual([]);
  });
});
