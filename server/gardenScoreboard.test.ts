/**
 * THE RATCHET OVER THE ADMIN GARDEN SCOREBOARD, run against this repository.
 *
 * The scoreboard counts seven things (shared/gardenScore.ts). This file holds each count where it stands
 * (shared/gardenScoreRatchet.ts says how, and why it counts what is open and never sets a floor under what is done):
 *
 *   a count that is not full   may not go backward. A newcomer may arrive open, and nothing that had a home may
 *                              lose it.
 *   a count that is full       takes nothing open, and a newcomer without a home fails by name with what to add.
 *                              server/gardenScoreboard.ratchet.json says which way each count is held.
 *   what holds by construction must stay whole today: an act with no place, a dial with no description, an old
 *                              address that lands nowhere, a route whose path cannot be read, each fail by name.
 *
 * It measures the tree on every run with the same two functions the command uses (`gatherScoreInputs`,
 * `scoreGarden`), so `npx tsx scripts/garden-scoreboard.ts` and this file cannot disagree.
 *
 * THE CONTROLS ARE KEPT, NOT RUN ONCE. Each ratchet is proved below by handing the scoreboard this repository with
 * one thing broken and reading the failure for that thing's own name. A ratchet that stopped firing would fail its
 * control.
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
import { NOT_ADMIN_ROUTES } from "../shared/notAdminRoutes";
import { ratchetDrift, ratchetFailures, ratchetNow, rewritten, type CountRatchet, type Ratchet } from "../shared/gardenScoreRatchet";
import { walkCsv, walkMarkdown, walkOf } from "../shared/gardenWalk";
import { gatherScoreInputs } from "./testkit/gardenInputs";

const ROOT = path.resolve(__dirname, "..");
const FILE = path.join(ROOT, "server", "gardenScoreboard.ratchet.json");
const inputs = gatherScoreInputs(ROOT);
const board = scoreGarden(inputs);
const ratchet = JSON.parse(fs.readFileSync(FILE, "utf8")) as Ratchet;

/** The failures of this repository with one thing changed, against a ratchet (the committed one unless another is given). */
const brokenBy = (change: Partial<ScoreInputs>, held: Ratchet = ratchet): string => ratchetFailures(scoreGarden({ ...inputs, ...change }), held).join("\n\n");

/** The committed ratchet with some counts switched to take nothing open, the way a full count is held. */
function strict(...keys: Array<keyof Ratchet["counts"]>): Ratchet {
  const counts = { ...ratchet.counts };
  for (const key of keys) {
    const held = counts[key];
    if (held !== "not measured") counts[key] = { ...held, arrivals: "need a home" };
  }
  return { ...ratchet, counts };
}

const heldOf = (key: keyof Ratchet["counts"]): CountRatchet => {
  const held = ratchet.counts[key];
  if (held === "not measured") throw new Error(`${key} is not measured`);
  return held;
};

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

describe("nothing that has a home may lose it", () => {
  it("no count has gone backward, and every part that holds by construction is whole", () => {
    const failures = ratchetFailures(board, ratchet);
    expect(failures, `\n${failures.join("\n\n")}\n`).toEqual([]);
  });

  it("the ratchet file names every count, says how each is held, and its numbers are whole and never negative", () => {
    for (const key of COUNT_KEYS) {
      const held = ratchet.counts[key];
      expect(held, key).toBeDefined();
      if (held === "not measured") continue;
      expect(typeof held.full, key).toBe("boolean");
      expect(["may be open", "need a home"], key).toContain(held.arrivals);
      expect(Number.isInteger(held.total) && held.total >= 0, key).toBe(true);
      for (const [heading, n] of Object.entries(held.open)) expect(Number.isInteger(n) && n >= 0, `${key}, ${heading}: ${n}`).toBe(true);
      // A count written as full takes nothing open, and is held that way.
      if (held.full) expect([held.arrivals, Object.values(held.open).filter((n) => n > 0)], key).toEqual(["need a home", []]);
    }
  });

  it("a count the code cannot measure is written as not measured, and never as zero", () => {
    expect(countOf(board, "road").measured).toBe(false);
    expect(ratchet.counts.road).toBe("not measured");
    expect(ratchetNow(board).road).toBe("not measured");
  });

  it("says where the numbers have moved since the file was written, without failing for it", () => {
    const moved = ratchetDrift(board, ratchet);
    if (moved.length) console.log(`\n[garden ratchet] the numbers have moved. Run \`npx tsx scripts/garden-scoreboard.ts --ratchet\` to record them:\n  ${moved.join("\n  ")}\n`);
    expect(Array.isArray(moved)).toBe(true);
  });
});

describe("a count that is not full may not go backward", () => {
  it("Endpoints: a route that loses its family fails by its own name, with what to add", () => {
    const said = brokenBy({ notAdmin: NOT_ADMIN_ROUTES.filter((f) => f.key !== "health") });
    expect(said).toContain("Endpoints:");
    expect(said).toContain("so 1 that had a home is open again");
    expect(said).toContain("/health: 1 open. Nothing was open under this heading.");
    expect(said).toContain("GET /health");
    expect(said).toContain("What to add: Give the route a home");
    expect(said).toContain("shared/notAdminRoutes.ts");
  });

  it("Endpoints: a route a page stopped answering for fails by name", () => {
    const tab = inputs.acts.find((a) => a.id === "tab.ledger")!;
    const said = brokenBy({ acts: inputs.acts.map((a) => (a === tab ? { ...a, reads: undefined } : a)) });
    expect(said).toContain("GET /api/admin/ledger/reconciliation");
    expect(said).toContain("garden-reads.ts --write");
  });

  it("Acts: an act that loses the route that was read for it fails by its id", () => {
    const act = inputs.acts.find((a) => a.id === "comms.delivery-reports")!;
    const said = brokenBy({ acts: inputs.acts.map((a) => (a === act ? { ...a, route: undefined, partial: true as const } : a)) });
    expect(said).toContain("Acts:");
    expect(said).toContain("tier not settled: 4 open. It held 3.");
    expect(said).toContain("comms.delivery-reports");
  });

  it("a newcomer may arrive open: a new route nobody claims, and a new act the guide cannot do yet, both pass", () => {
    expect(brokenBy({ routes: [...inputs.routes, { method: "POST", path: "/api/admin/zz-control/new", asksAdmin: true, powers: [] }] })).toBe("");
    const act: AdminAct = { id: "tab.zz-control", kind: "page", place: "fire", tab: "home", title: "A control page", help: "", synonyms: [], power: "admin" };
    expect(brokenBy({ acts: [...inputs.acts, act] })).toBe("");
  });

  it("a newcomer does not hide a loss: one arrives open and another loses its home, and the loss still fails", () => {
    const said = brokenBy({
      routes: [...inputs.routes, { method: "POST", path: "/api/admin/zz-control/new", asksAdmin: true, powers: [] }],
      notAdmin: NOT_ADMIN_ROUTES.filter((f) => f.key !== "health"),
    });
    expect(said).toContain("and 1 arrived since, so 1 that had a home is open again");
    expect(said).toContain("GET /health");
    expect(said).toContain("POST /api/admin/zz-control/new");
  });

  it("deleting is no step backward: a route that had a home, and one that had none, may both go", () => {
    const open = countOf(board, "endpoints").open[0].name;
    expect(brokenBy({ routes: inputs.routes.filter((r) => routeKey(r.method, r.path) !== open) })).toBe("");
    expect(brokenBy({ routes: inputs.routes.filter((r) => r.path !== "/health") })).toBe("");
  });
});

describe("what holds by construction must stay whole today", () => {
  it("Endpoints: a registration whose path cannot be read fails, and so does an act that names a route that is gone", () => {
    expect(brokenBy({ unresolved: [{ method: "GET", file: "server/routes/zz.ts", line: 7, text: "pathOf(thing)" }] })).toContain("server/routes/zz.ts:7");
    const called = inputs.acts.find((a) => a.route && a.kind === "act")!;
    const without = inputs.routes.filter((r) => routeKey(r.method, r.path) !== routeKey(called.route!.method, called.route!.path));
    const said = brokenBy({ routes: without });
    expect(said).toContain("routes an act names that the server does not register");
    expect(said).toContain(routeKey(called.route!.method, called.route!.path));
  });

  it("Acts: an act in a place the garden does not have fails by its id", () => {
    const act = { id: "tab.zz-control", kind: "page", place: "attic", tab: "home", title: "A control page", help: "", synonyms: [], power: "admin" } as unknown as AdminAct;
    const said = brokenBy({ acts: [...inputs.acts, act] });
    expect(said).toContain('"has a place" reads');
    expect(said).toContain("tab.zz-control");
  });

  it("Settings: a new dial with no description of its own fails by its key", () => {
    const dial = { ...inputs.dials[0], key: "zz.control_dial", label: "A control dial", description: "" };
    const said = brokenBy({ dials: [...inputs.dials, dial], acts: [...inputs.acts, dialAct(dial)] });
    expect(said).toContain('"dials: what it changes" reads');
    expect(said).toContain("dial.zz.control_dial");
  });

  it("Settings: a dial that arrives with no act at all fails as having no home", () => {
    const dial = { ...inputs.dials[0], key: "zz.homeless_dial", label: "A control dial" };
    const said = brokenBy({ dials: [...inputs.dials, dial] });
    expect(said).toContain('"dials: a home place" reads');
    expect(said).toContain("dial.zz.homeless_dial");
  });

  it("Old doors: an old address that lands nowhere fails by the address", () => {
    const said = brokenBy({ old: { ...inputs.old, leftAdmin: { ...inputs.old.leftAdmin, "zz-control": "/zz-nowhere" } } });
    expect(said).toContain('"still reaches its page today" reads');
    expect(said).toContain("/admin?tab=zz-control");
    expect(said).toContain("reaches nothing today");
  });

  it("Functions: a ledger row no act carries fails by its id", () => {
    const said = brokenBy({ ledger: { ...inputs.ledger, rows: { ...inputs.ledger.rows, Z1: "A control row" } } });
    expect(said).toContain('"no act carries it" reads 1 and must read 0');
    expect(said).toContain("Z1 A control row");
  });
});

describe("a count held as full takes nothing open, and names the newcomer", () => {
  it("Endpoints: a new admin route no act names fails by its own name, with what to add", () => {
    const said = brokenBy({ routes: [...inputs.routes, { method: "POST", path: "/api/admin/zz-control/new", asksAdmin: true, powers: [] }] }, strict("endpoints"));
    expect(said).toContain("Endpoints: This count takes no new open items.");
    expect(said).toContain(`/api/admin: ${heldOf("endpoints").open["/api/admin"] + 1} open. It held ${heldOf("endpoints").open["/api/admin"]}.`);
    expect(said).toContain("POST /api/admin/zz-control/new");
    expect(said).toContain("What to add: Give the route a home");
  });

  it("Endpoints: a route under a prefix nobody has seen fails, though the file never named that heading", () => {
    const said = brokenBy({ routes: [...inputs.routes, { method: "GET", path: "/api/zz-control/list", asksAdmin: false, powers: [] }] }, strict("endpoints"));
    expect(said).toContain("/api/zz-control: 1 open. Nothing was open under this heading.");
    expect(said).toContain("GET /api/zz-control/list");
  });

  it("Endpoints: a new route inside a family passes, unless its own handler says it is a steward's", () => {
    expect(brokenBy({ routes: [...inputs.routes, { method: "GET", path: "/api/me/zz-control", asksAdmin: false, powers: [] }] }, strict("endpoints"))).toBe("");
    const said = brokenBy({ routes: [...inputs.routes, { method: "GET", path: "/api/me/zz-control", asksAdmin: true, powers: [] }] }, strict("endpoints"));
    expect(said).toContain("GET /api/me/zz-control");
    expect(said).toContain("member-own-records");
  });

  it("Acts: a new act that changes something, with no consequence line, fails by its id", () => {
    const real = inputs.routes.find((r) => r.method === "POST" && r.path.startsWith("/api/admin/"))!;
    const act: AdminAct = { id: "frame.zz-control.press", kind: "act", place: "frame", tab: "home", title: "A control act", help: "Pressed by a test.", synonyms: ["control"], power: "admin", route: { method: "POST", path: real.path } };
    const said = brokenBy({ acts: [...inputs.acts, act] }, strict("acts"));
    expect(said).toContain("needs a consequence line");
    expect(said).toContain("frame.zz-control.press");
  });

  it("a count written as full fails on the first open item, by name", () => {
    const full: Ratchet = { ...ratchet, counts: { ...ratchet.counts, acts: { full: true, arrivals: "need a home", total: heldOf("acts").total, open: {} } } };
    const said = ratchetFailures(board, full).join("\n");
    expect(said).toContain("Acts: This count was full, so nothing may be open.");
    expect(said).toContain(countOf(board, "acts").open[0].name);
  });
});

describe("rewriting the file", () => {
  it("refuses while a count has gone backward", () => {
    const worse = scoreGarden({ ...inputs, notAdmin: NOT_ADMIN_ROUTES.filter((f) => f.key !== "health") });
    expect("failures" in rewritten(worse, ratchet, "x")).toBe(true);
  });

  it("records a better number, and a count held as taking nothing open stays held that way", () => {
    // Every open route under /api/admin/ taken away: the routes acts call and pages read stay.
    const openAdmin = new Set(countOf(board, "endpoints").open.filter((o) => o.group === "/api/admin").map((o) => o.name));
    const better = scoreGarden({ ...inputs, routes: inputs.routes.filter((r) => !openAdmin.has(routeKey(r.method, r.path))) });
    const next = rewritten(better, strict("endpoints"), "x");
    if (!("ratchet" in next)) throw new Error("a better board was refused");
    const held = next.ratchet.counts.endpoints;
    if (held === "not measured") throw new Error("Endpoints is measured");
    expect(held.open["/api/admin"]).toBeUndefined();
    expect(held.arrivals).toBe("need a home");
    expect(held.total).toBe(heldOf("endpoints").total - openAdmin.size);
  });

  it("a count that reaches full is written full, and from then on takes nothing open", () => {
    // A board is plain data: the same board with every open act given what it lacks.
    const done = { counts: board.counts.map((c) => (c.key === "acts" ? { ...c, open: [], done: c.total } : c)) };
    const next = rewritten(done, ratchet, "x");
    if (!("ratchet" in next)) throw new Error("a full count was refused");
    expect(next.ratchet.counts.acts).toMatchObject({ full: true, arrivals: "need a home", open: {} });
    // The same board with one open act back fails against that file, by name.
    expect(ratchetFailures(board, next.ratchet).join("\n")).toContain("Acts: This count was full, so nothing may be open.");
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

describe("the walk list is the scoreboard turned to face a person", () => {
  const walk = walkOf(inputs, board);

  it("part 1 holds every act once: the dials in their own table, everything else by place in the garden's order", () => {
    expect(walk.acts.length + walk.dials.length).toBe(inputs.acts.length);
    expect(walk.dials).toHaveLength(inputs.dials.length);
    const ids = walk.acts.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const places = walk.acts.map((a) => a.place).filter((p, i, all) => p !== all[i - 1]);
    expect(places).toEqual((ADMIN_PLACES as readonly string[]).filter((p) => places.includes(p)));
    for (const a of walk.acts) expect(a.opens.startsWith("/"), a.id).toBe(true);
    // A row says its act is yours alone only with the sentence of the list that made it so.
    for (const a of walk.acts) if (a.tier === "yours alone") expect(a.why.length, a.id).toBeGreaterThan(10);
  });

  it("part 2 and the undecided families are the Endpoints count's own open list, split by what an admin can reach", () => {
    const open = new Set(countOf(board, "endpoints").open.map((o) => o.name));
    for (const r of walk.routes) {
      expect(open.has(`${r.method} ${r.path}`), `${r.method} ${r.path}`).toBe(true);
      expect(r.why.length, r.path).toBeGreaterThan(0);
      expect(r.at, r.path).toMatch(/^server\/.+:\d+$/);
    }
    expect(walk.routes.length + walk.undecided.reduce((n, u) => n + u.count, 0)).toBe(open.size);
    // Every open route under /api/admin/ is in part 2, never among the undecided.
    expect(walk.undecided.map((u) => u.family)).not.toContain("/api/admin");
    expect(walk.routes.filter((r) => r.path.startsWith("/api/admin/")).length).toBe(countOf(board, "endpoints").open.filter((o) => o.group === "/api/admin").length);
  });

  it("part 3 is the Settings count's own open list, and the two files say the same rows", () => {
    expect(walk.settings).toHaveLength(countOf(board, "settings").open.length);
    const text = walkMarkdown(walk, board, "Measured on commit abc.");
    expect(text).toContain("Measured on commit abc.");
    for (const heading of ["## How to use this file", "## Part 1: every act", "### The dials", "## Part 2: every route an admin can reach that no act claims", "### Not decided: whose route is this", "## Part 3: every setting with no full home"]) expect(text).toContain(heading);
    const rows = walkCsv(walk).trim().split("\n");
    expect(rows[0].split(",")[0]).toBe("part");
    expect(rows.filter((r) => r.startsWith("1 act,")).length).toBe(walk.acts.length);
    expect(rows.filter((r) => r.startsWith("1 dial,")).length).toBe(walk.dials.length);
    expect(rows.filter((r) => r.startsWith("2 unclaimed route,")).length).toBe(walk.routes.length);
    expect(rows.filter((r) => r.startsWith("3 setting,")).length).toBe(walk.settings.length);
  });
});
