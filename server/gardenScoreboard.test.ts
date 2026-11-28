/**
 * THE RATCHET OVER THE ADMIN GARDEN SCOREBOARD, run against this repository.
 *
 * The scoreboard counts seven things (shared/gardenScore.ts). This file holds each count where it stands: no heading
 * may hold more open items than server/gardenScoreboard.ratchet.json says, and a heading that file does not name may
 * hold none. So a route, an act or a dial that arrives without a home fails here by name, with what to add
 * (shared/gardenScoreRatchet.ts says why it is a ceiling on what is open and never a floor under what is done).
 *
 * It measures the tree on every run with the same two functions the command uses (`gatherScoreInputs`,
 * `scoreGarden`), so `npx tsx scripts/garden-scoreboard.ts` and this file cannot disagree.
 *
 * THE CONTROLS ARE KEPT, NOT RUN ONCE. Each ratchet is proved below by handing the scoreboard this repository with
 * one thing broken (a route nobody claims, an act with no consequence line, a dial with no description, an old
 * address that lands nowhere, a ledger row no act carries) and reading the failure for that thing's own name. A
 * ratchet that stopped firing would fail its control.
 *
 * It lives under server/ because it needs the route reader, which reads files. It needs no database.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dialAct } from "../shared/adminActs/derived";
import { LEDGER_TOTAL, PARITY_LEDGER } from "../shared/adminActs/ledger";
import type { AdminAct } from "../shared/adminActs/types";
import { ADMIN_PLACES, ADMIN_TABS } from "../shared/adminTabs";
import { CUT_BY_RULING, GARDEN_MOUNTS } from "../shared/gardenMounts";
import { COUNT_KEYS, countOf, routeKey, routeMatches, scoreGarden, type ScoreInputs } from "../shared/gardenScore";
import { scoreTable } from "../shared/gardenScoreReport";
import { ratchetFailures, ratchetNow, ratchetSlack, tightened, type Ratchet } from "../shared/gardenScoreRatchet";
import { gatherScoreInputs } from "./testkit/gardenInputs";

const ROOT = path.resolve(__dirname, "..");
const FILE = path.join(ROOT, "server", "gardenScoreboard.ratchet.json");
const inputs = gatherScoreInputs(ROOT);
const board = scoreGarden(inputs);
const ratchet = JSON.parse(fs.readFileSync(FILE, "utf8")) as Ratchet;

/** The failures of this repository with one thing changed. */
const brokenBy = (change: Partial<ScoreInputs>): string => ratchetFailures(scoreGarden({ ...inputs, ...change }), ratchet).join("\n\n");

describe("the scoreboard is measured from this repository", () => {
  it("read something of every kind (floors, so an empty read cannot pass as a clean one)", () => {
    expect(inputs.routes.length).toBeGreaterThan(1500);
    expect(inputs.acts.length).toBeGreaterThan(700);
    expect(inputs.dials.length).toBeGreaterThan(300);
    expect(inputs.tabs.length).toBeGreaterThan(50);
    expect(Object.keys(inputs.ledger.rows)).toHaveLength(LEDGER_TOTAL);
    expect(inputs.old.clientRoutes.length).toBeGreaterThan(100);
    expect(inputs.notAdmin.length).toBeGreaterThan(10);
    expect(inputs.routes.filter((r) => r.asksAdmin).length).toBeGreaterThan(300);
  });

  it("prints the seven counts", () => {
    console.log(`\n${scoreTable(board)}\n`);
    for (const key of COUNT_KEYS) expect(countOf(board, key).key).toBe(key);
  });
});

describe("what is open may not grow", () => {
  it("no heading of any count holds more open items than the ratchet allows", () => {
    const failures = ratchetFailures(board, ratchet);
    expect(failures, `\n${failures.join("\n\n")}\n`).toEqual([]);
  });

  it("the ratchet file names every count, and its numbers are whole and never negative", () => {
    for (const key of COUNT_KEYS) {
      const held = ratchet.counts[key];
      expect(held, key).toBeDefined();
      if (held === "not measured") continue;
      expect(typeof held.full, key).toBe("boolean");
      for (const [heading, ceiling] of Object.entries(held.open)) expect(Number.isInteger(ceiling) && ceiling >= 0, `${key}, ${heading}: ${ceiling}`).toBe(true);
      // A count written as full holds no ceilings: nothing may be open under any heading.
      if (held.full) expect(Object.values(held.open).filter((n) => n > 0), key).toEqual([]);
    }
  });

  it("a count the code cannot measure is written as not measured, and never as zero", () => {
    expect(countOf(board, "road").measured).toBe(false);
    expect(ratchet.counts.road).toBe("not measured");
    expect(ratchetNow(board).road).toBe("not measured");
  });

  it("says where a tightening would lock a better number in, without failing for it", () => {
    const slack = ratchetSlack(board, ratchet);
    if (slack.length) console.log(`\n[garden ratchet] ${slack.length} heading(s) are below their ceiling. Run \`npx tsx scripts/garden-scoreboard.ts --ratchet\`:\n  ${slack.join("\n  ")}\n`);
    expect(Array.isArray(slack)).toBe(true);
  });
});

describe("each ratchet fires, and names what arrived", () => {
  it("Endpoints: a new admin route no act names fails by its own name, with what to add", () => {
    const said = brokenBy({ routes: [...inputs.routes, { method: "POST", path: "/api/admin/zz-control/new", asksAdmin: true, powers: [] }] });
    expect(said).toContain("Endpoints, /api/admin");
    expect(said).toContain("POST /api/admin/zz-control/new");
    expect(said).toContain("What to add: Give the route a home");
  });

  it("Endpoints: a route under a prefix nobody has seen fails, though the ratchet never named that heading", () => {
    const said = brokenBy({ routes: [...inputs.routes, { method: "GET", path: "/api/zz-control/list", asksAdmin: false, powers: [] }] });
    expect(said).toContain("Endpoints, /api/zz-control: 1 open. Nothing was open under this heading.");
    expect(said).toContain("GET /api/zz-control/list");
  });

  it("Endpoints: a new route inside a family that is not admin's passes, unless its own handler says it is a steward's", () => {
    expect(brokenBy({ routes: [...inputs.routes, { method: "GET", path: "/api/me/zz-control", asksAdmin: false, powers: [] }] })).toBe("");
    const said = brokenBy({ routes: [...inputs.routes, { method: "GET", path: "/api/me/zz-control", asksAdmin: true, powers: [] }] });
    expect(said).toContain("GET /api/me/zz-control");
    expect(said).toContain("member-own-records");
  });

  it("Endpoints: a registration whose path cannot be read fails, and so does an act that names a route that is gone", () => {
    expect(brokenBy({ unresolved: [{ method: "GET", file: "server/routes/zz.ts", line: 7, text: "pathOf(thing)" }] })).toContain("server/routes/zz.ts:7");
    const called = inputs.acts.find((a) => a.route && a.kind === "act")!;
    const without = inputs.routes.filter((r) => routeKey(r.method, r.path) !== routeKey(called.route!.method, called.route!.path));
    expect(brokenBy({ routes: without })).toContain("routes an act names that the server does not register");
  });

  it("Endpoints: deleting a route that had no home is no step backward", () => {
    const open = countOf(board, "endpoints").open[0].name;
    expect(brokenBy({ routes: inputs.routes.filter((r) => routeKey(r.method, r.path) !== open) })).toBe("");
  });

  it("Acts: a new act that changes something, with no consequence line, fails by its id", () => {
    const real = inputs.routes.find((r) => r.method === "POST" && r.path.startsWith("/api/admin/"))!;
    const act: AdminAct = { id: "frame.zz-control.press", kind: "act", place: "frame", tab: "home", title: "A control act", help: "Pressed by a test.", synonyms: ["control"], power: "admin", route: { method: "POST", path: real.path } };
    const said = brokenBy({ acts: [...inputs.acts, act] });
    expect(said).toContain("Acts, needs a consequence line");
    expect(said).toContain("frame.zz-control.press");
  });

  it("Acts: an act in a place the garden does not have fails the part that holds by construction", () => {
    const act = { id: "tab.zz-control", kind: "page", place: "attic", tab: "home", title: "A control page", help: "", synonyms: [], power: "admin" } as unknown as AdminAct;
    const said = brokenBy({ acts: [...inputs.acts, act] });
    expect(said).toContain('"has a place" reads');
    expect(said).toContain("tab.zz-control");
  });

  it("Settings: a new dial with no description of its own fails by its key", () => {
    const dial = { ...inputs.dials[0], key: "zz.control_dial", label: "A control dial", description: "" };
    const said = brokenBy({ dials: [...inputs.dials, dial], acts: [...inputs.acts, dialAct(dial)] });
    expect(said).toContain("dial.zz.control_dial");
    expect(said).toContain('"dials: what it changes" reads');
  });

  it("Settings: a dial that arrives with no act at all fails as having no home", () => {
    const dial = { ...inputs.dials[0], key: "zz.homeless_dial", label: "A control dial" };
    const said = brokenBy({ dials: [...inputs.dials, dial] });
    expect(said).toContain("dial.zz.homeless_dial");
    expect(said).toContain('"dials: a home place" reads');
  });

  it("Old doors: an old address that lands nowhere fails by the address", () => {
    const said = brokenBy({ old: { ...inputs.old, leftAdmin: { ...inputs.old.leftAdmin, "zz-control": "/zz-nowhere" } } });
    expect(said).toContain("Old doors, reaches nothing today");
    expect(said).toContain("/admin?tab=zz-control");
    expect(said).toContain('"still reaches its page today" reads');
  });

  it("Functions: a ledger row no act carries fails by its id", () => {
    const said = brokenBy({ ledger: { ...inputs.ledger, rows: { ...inputs.ledger.rows, Z1: "A control row" } } });
    expect(said).toContain("Functions, no act carries it");
    expect(said).toContain("Z1 A control row");
  });

  it("Three ways: a new act the guide cannot do yet is open by name, since nothing new may arrive open there either", () => {
    const act: AdminAct = { id: "tab.zz-control", kind: "page", place: "fire", tab: "home", title: "A control page", help: "", synonyms: [], power: "admin" };
    expect(brokenBy({ acts: [...inputs.acts, act] })).toContain("Three ways, not by the guide yet: page");
  });

  it("a count written as full fails on the first open item, by name", () => {
    const full: Ratchet = { ...ratchet, counts: { ...ratchet.counts, acts: { full: true, open: {} } } };
    const said = ratchetFailures(board, full).join("\n");
    expect(said).toContain("This count was full, so nothing may be open.");
  });

  it("tightening only lowers: it refuses while anything is over its ceiling, and locks a better number in", () => {
    const worse = scoreGarden({ ...inputs, routes: [...inputs.routes, { method: "POST", path: "/api/admin/zz-control/new" }] });
    expect("failures" in tightened(worse, ratchet, "x")).toBe(true);
    // Every open route under /api/admin/ taken away: the routes acts call and pages read stay.
    const openAdmin = new Set(countOf(board, "endpoints").open.filter((o) => o.group === "/api/admin").map((o) => o.name));
    const better = scoreGarden({ ...inputs, routes: inputs.routes.filter((r) => !openAdmin.has(routeKey(r.method, r.path))) });
    const next = tightened(better, ratchet, "x");
    if (!("ratchet" in next)) throw new Error("a better board was refused");
    const held = next.ratchet.counts.endpoints;
    const before = ratchet.counts.endpoints;
    if (held === "not measured" || before === "not measured") throw new Error("Endpoints is measured");
    expect(held.open["/api/admin"]).toBeUndefined();
    for (const [heading, ceiling] of Object.entries(held.open)) expect(ceiling, heading).toBeLessThanOrEqual(before.open[heading] ?? 0);
  });
});

describe("the two lists a person fills are well formed, so the lane that fills them is told by name", () => {
  it("a cut names a real ledger row once, with the day of the ruling and its words", () => {
    const rows = new Set<string>();
    for (const cut of CUT_BY_RULING) {
      expect(PARITY_LEDGER[cut.row], `${cut.row} is not a ledger row`).toBeTruthy();
      expect(rows.has(cut.row), `${cut.row} is cut twice`).toBe(false);
      rows.add(cut.row);
      expect(cut.date, cut.row).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(cut.words.trim().length, `${cut.row} carries no words of the ruling`).toBeGreaterThan(10);
    }
  });

  it("a mount names a place once, tabs the table has in that same place, and pages the router draws", () => {
    const places = new Set<string>();
    const mounted = new Set<string>();
    for (const m of GARDEN_MOUNTS) {
      expect(ADMIN_PLACES as readonly string[], m.place).toContain(m.place);
      expect(places.has(m.place), `${m.place} is listed twice`).toBe(false);
      places.add(m.place);
      for (const tab of m.tabs) {
        const entry = ADMIN_TABS.find((t) => t.key === tab);
        expect(entry, `${tab} is not an Admin tab`).toBeTruthy();
        expect(entry!.place, `${tab} is mounted in ${m.place} and the tab table says ${entry!.place}`).toBe(m.place);
        expect(mounted.has(`tab ${tab}`), `${tab} is mounted twice`).toBe(false);
        mounted.add(`tab ${tab}`);
      }
      for (const page of m.pages) {
        expect(page, `${page} carries a query or a hash`).not.toMatch(/[?#]/);
        expect(inputs.old.clientRoutes.some((p) => routeMatches(p, page)), `${page} is not a page the router draws`).toBe(true);
        expect(mounted.has(`page ${page}`), `${page} is mounted twice`).toBe(false);
        mounted.add(`page ${page}`);
      }
    }
  });
});
