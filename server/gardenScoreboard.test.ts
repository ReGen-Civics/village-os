/**
 * THE RATCHET OVER THE ADMIN GARDEN SCOREBOARD, run against this repository.
 *
 * The scoreboard counts seven things (shared/gardenScore.ts). This file holds each count where it stands, BY NAME
 * (shared/gardenScoreRatchet.ts says how and why):
 *
 *   server/gardenScoreboard.ratchet.json keeps the name of every item that is open under each count. An open item
 *   that is not named there fails here, whatever the totals say, with its name, why it is open and what to add.
 *   A name may always leave. A count that is full takes nothing open. What holds by construction must stay whole.
 *
 * It measures the tree on every run with the same two functions the command uses (`gatherScoreInputs`,
 * `scoreGarden`), so `npx tsx scripts/garden-scoreboard.ts` and this file cannot disagree.
 *
 * THE CONTROLS ARE KEPT, NOT RUN ONCE. Each is this repository with one thing changed, and the failure is read for
 * that thing's own name. The first is the one a ratchet that counts cannot pass: in one change, one open item finds
 * a home and a new one arrives with none. The totals stand still, and the new one still fails by name.
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
import { COUNT_KEYS, countOf, routeKey, routeMatches, scoreGarden, stewardsByItsHandler, type ScoreInputs } from "../shared/gardenScore";
import { scoreTable } from "../shared/gardenScoreReport";
import { BY_HAND, inOrder, isRatchet, ratchetFailures, ratchetLeft, ratchetNow, ratchetText, rewritten, type CountRatchet, type Ratchet } from "../shared/gardenScoreRatchet";
import { walkCsv, walkMarkdown, walkOf } from "../shared/gardenWalk";
import { NOT_ADMIN_ROUTES, type NotAdminFamily } from "../shared/notAdminRoutes";
import { gatherScoreInputs } from "./testkit/gardenInputs";

const ROOT = path.resolve(__dirname, "..");
const FILE = path.join(ROOT, "server", "gardenScoreboard.ratchet.json");
const inputs = gatherScoreInputs(ROOT);
const board = scoreGarden(inputs);
const onDisk = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
const ratchet = JSON.parse(onDisk) as Ratchet;

/** The failures of this repository with one thing changed, against a ratchet (the committed one unless another is given). */
const brokenBy = (change: Partial<ScoreInputs>, held: Ratchet = ratchet): string => ratchetFailures(scoreGarden({ ...inputs, ...change }), held).join("\n\n");

const heldOf = (key: keyof Ratchet["counts"]): CountRatchet => {
  const held = ratchet.counts[key];
  if (held === "not measured") throw new Error(`${key} is not measured`);
  return held;
};

/** A route nobody claims, as a newcomer. */
const NEW_ROUTE = { method: "POST", path: "/api/admin/zz-control/new", asksAdmin: true, powers: [] as string[] };
/** An act the guide cannot do yet, on a tab that exists, as a newcomer. */
const NEW_PAGE_ACT: AdminAct = { id: "fire.zz-control.read", kind: "act", place: "fire", tab: "home", title: "A control act", help: "Read by a test.", synonyms: ["control"], power: "admin" };

/** An open route nothing read from the code says is a steward's, and a family that gives it a home. */
const openRoute = inputs.routes.find((r) => !stewardsByItsHandler(r) && !r.path.startsWith("/api/admin/") && heldOf("endpoints").open.includes(routeKey(r.method, r.path)))!;
const homeFor = (key: string): NotAdminFamily => ({ key: "zz-control-home", kind: "member", names: [key], why: "A control: this family gives one open route a home.", test: (m, p) => routeKey(m, p) === key });

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

  it("every open item has a name of its own within its count, which is what the ratchet keeps", () => {
    for (const key of COUNT_KEYS) {
      const ids = countOf(board, key).open.map((o) => o.id);
      expect(ids.filter((id) => !id.trim()), key).toEqual([]);
      expect(new Set(ids).size, key).toBe(ids.length);
    }
  });
});

describe("an open item must be named on the ratchet's list", () => {
  it("no open item is unnamed, and every part that holds by construction is whole", () => {
    const failures = ratchetFailures(board, ratchet);
    expect(failures, `\n${failures.join("\n\n")}\n`).toEqual([]);
  });

  it("the file is in the shape the command writes: every count, one name to a line, in order, none twice", () => {
    expect(isRatchet(ratchet)).toBe(true);
    for (const key of COUNT_KEYS) {
      const held = ratchet.counts[key];
      if (held === "not measured") continue;
      expect(held.open, `${key}: its names are out of order, or one is there twice. Put each name on its own line, in order.`).toEqual(inOrder(held.open));
      // A count written as full holds no names: nothing may be open.
      if (held.full) expect(held.open, key).toEqual([]);
    }
    // Byte for byte what the command writes, so a hand edit keeps one name to a line and a merge only adds lines.
    expect(onDisk, "server/gardenScoreboard.ratchet.json is not laid out the way the command writes it: one name to a line, one space of indent.").toBe(ratchetText(ratchet));
  });

  it("a count the code cannot measure is written as not measured, and never as zero", () => {
    expect(countOf(board, "road").measured).toBe(false);
    expect(ratchet.counts.road).toBe("not measured");
    expect(ratchetNow(board).road).toBe("not measured");
  });

  it("says which names are no longer open and could be dropped, without failing for it", () => {
    const left = ratchetLeft(board, ratchet);
    if (left.length) console.log(`\n[garden ratchet] names no longer open. Run \`npx tsx scripts/garden-scoreboard.ts --ratchet\` to drop them:\n  ${left.map((l) => `${l.title}: ${l.names.join(", ")}`).join("\n  ")}\n`);
    expect(Array.isArray(left)).toBe(true);
  });
});

describe("a newcomer cannot hide behind somebody else's fix", () => {
  it("in one change one open route finds a home and a new one arrives with none: the totals stand still, and the new one fails by name", () => {
    const fixed = routeKey(openRoute.method, openRoute.path);
    const change = { routes: [...inputs.routes, NEW_ROUTE], notAdmin: [...NOT_ADMIN_ROUTES, homeFor(fixed)] };
    const after = countOf(scoreGarden({ ...inputs, ...change }), "endpoints");
    const before = countOf(board, "endpoints");
    // This is the change a ratchet that counts lets through: as many open as before, one more route, one more done.
    expect(after.open.length).toBe(before.open.length);
    expect(after.total).toBe((before.total ?? 0) + 1);
    expect(after.open.map((o) => o.id)).not.toContain(fixed);

    const said = brokenBy(change);
    expect(said).toContain("Endpoints: 1 open item is new. The ratchet does not name them, so each arrived without a home.");
    expect(said).toContain("POST /api/admin/zz-control/new:");
    expect(said).toContain("What to add: Give the route a home");
    // It names the newcomer and nothing else: the route that found its home is not in the failure.
    expect(said).not.toContain(fixed);
    expect(said.split("\n").filter((l) => l.startsWith("    "))).toHaveLength(1);
  });

  it("the same for acts: one open act is made whole and a new one arrives lacking, and the new one fails by its id", () => {
    const open = countOf(board, "acts").open.find((o) => o.group === "needs a consequence line")!;
    const real = inputs.routes.find((r) => r.method === "POST" && r.path.startsWith("/api/admin/"))!;
    const arriving: AdminAct = { id: "frame.zz-control.press", kind: "act", place: "frame", tab: "home", title: "A control act", help: "Pressed by a test.", synonyms: ["control"], power: "admin", route: { method: "POST", path: real.path } };
    // The open act gains a holder whose catalog line exists, which is how an act gets its consequence line.
    const acts = [...inputs.acts.map((a) => (a.id === open.id ? { ...a, holder: "operator.accounts" as const } : a)), arriving];
    const after = countOf(scoreGarden({ ...inputs, acts }), "acts");
    expect(after.open.length).toBe(countOf(board, "acts").open.length);
    const said = brokenBy({ acts });
    expect(said).toContain("Acts: 1 open item is new.");
    expect(said).toContain("frame.zz-control.press:");
    expect(said).not.toContain(`${open.id}:`);
  });
});

describe("whatever arrives open is named, count by count", () => {
  it("Endpoints: a new admin route, and one under a prefix nobody has seen", () => {
    expect(brokenBy({ routes: [...inputs.routes, NEW_ROUTE] })).toContain("POST /api/admin/zz-control/new: No act names it, and its handler asks whether the caller is an admin.");
    const said = brokenBy({ routes: [...inputs.routes, { method: "GET", path: "/api/zz-control/list", asksAdmin: false, powers: [] }] });
    expect(said).toContain("GET /api/zz-control/list: No act names it");
  });

  it("Endpoints: a new route inside a family passes, unless its own handler says it is a steward's", () => {
    expect(brokenBy({ routes: [...inputs.routes, { method: "GET", path: "/api/me/zz-control", asksAdmin: false, powers: [] }] })).toBe("");
    const said = brokenBy({ routes: [...inputs.routes, { method: "GET", path: "/api/me/zz-control", asksAdmin: true, powers: [] }] });
    expect(said).toContain("GET /api/me/zz-control: Its path is in the family member-own-records");
  });

  it("Endpoints: a route that had a home and lost it is named too: a family removed, and a page's read dropped", () => {
    expect(brokenBy({ notAdmin: NOT_ADMIN_ROUTES.filter((f) => f.key !== "health") })).toContain("GET /health: No act names it");
    const tab = inputs.acts.find((a) => a.id === "tab.ledger")!;
    const said = brokenBy({ acts: inputs.acts.map((a) => (a === tab ? { ...a, reads: undefined } : a)) });
    expect(said).toContain("GET /api/admin/ledger/reconciliation:");
    expect(said).toContain("garden-reads.ts --write");
  });

  it("Acts and Settings: an act that loses the route that was read for it is named under both", () => {
    const act = inputs.acts.find((a) => a.id === "comms.delivery-reports")!;
    const said = brokenBy({ acts: inputs.acts.map((a) => (a === act ? { ...a, route: undefined, partial: true as const } : a)) });
    expect(said).toContain("Acts: 1 open item is new.");
    expect(said).toContain("comms.delivery-reports: Its route was never read");
  });

  it("Three ways: a new act the guide cannot do yet fails by its id, and the failure says the one way through", () => {
    const said = brokenBy({ acts: [...inputs.acts, NEW_PAGE_ACT] });
    expect(said).toContain("Three ways: 1 open item is new.");
    expect(said).toContain("fire.zz-control.read: The guide can prepare a dial today and nothing else.");
    expect(said).toContain(BY_HAND);
    // Named by hand in its place, it passes: that line is what a reviewer sees.
    const admitted: Ratchet = { ...ratchet, counts: { ...ratchet.counts, threeWays: { full: false, open: inOrder([...heldOf("threeWays").open, NEW_PAGE_ACT.id]) } } };
    expect(brokenBy({ acts: [...inputs.acts, NEW_PAGE_ACT] }, admitted)).toBe("");
  });

  it("Old doors: a new address fails by the address", () => {
    const said = brokenBy({ old: { ...inputs.old, movedTabs: { ...inputs.old.movedTabs, "zz-control": { tab: "players" } } } });
    expect(said).toContain("Old doors: 1 open item is new.");
    expect(said).toContain("/admin?tab=zz-control: It still opens the players tab, outside the garden.");
  });

  it("Settings: a new dial with no description of its own fails by its key", () => {
    const dial = { ...inputs.dials[0], key: "zz.control_dial", label: "A control dial", description: "" };
    const said = brokenBy({ dials: [...inputs.dials, dial], acts: [...inputs.acts, dialAct(dial)] });
    expect(said).toContain("Settings: 1 open item is new.");
    expect(said).toContain("dial.zz.control_dial: It has no description.");
    expect(said).toContain('"dials: what it changes" reads');
  });

  it("Functions: a ledger row no act carries fails by its id", () => {
    const said = brokenBy({ ledger: { ...inputs.ledger, rows: { ...inputs.ledger.rows, Z1: "A control row" } } });
    expect(said).toContain("Functions: 1 open item is new.");
    expect(said).toContain("Z1: No act in the registry carries it.");
  });
});

describe("a name may always leave the list", () => {
  it("an open item that finds a home passes, and so does one that is deleted", () => {
    const fixed = routeKey(openRoute.method, openRoute.path);
    expect(brokenBy({ notAdmin: [...NOT_ADMIN_ROUTES, homeFor(fixed)] })).toBe("");
    expect(brokenBy({ routes: inputs.routes.filter((r) => routeKey(r.method, r.path) !== fixed) })).toBe("");
    // A route that had a home may go as well: deleting is no step backward.
    expect(brokenBy({ routes: inputs.routes.filter((r) => r.path !== "/health") })).toBe("");
  });

  it("the names that left are reported, so the file can be rewritten to drop them", () => {
    const fixed = routeKey(openRoute.method, openRoute.path);
    const left = ratchetLeft(scoreGarden({ ...inputs, notAdmin: [...NOT_ADMIN_ROUTES, homeFor(fixed)] }), ratchet);
    expect(left).toEqual([{ key: "endpoints", title: "Endpoints", names: [fixed] }]);
  });
});

describe("what holds by construction must stay whole today", () => {
  it("an item that keeps its name and gets worse still fails: a listed address that stops reaching its page", () => {
    // /admin?tab=players is on the list already, as open outside the garden. With the tab gone it is open for a worse reason.
    const said = brokenBy({ tabs: inputs.tabs.filter((t) => t.key !== "players") });
    expect(said).toContain('"still reaches its page today" reads');
    expect(said).not.toContain("/admin?tab=players: ");
  });

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
    expect(said).toContain("tab.zz-control: Its place, attic, is not one the garden has.");
  });

  it("Settings: a dial that arrives with no act at all fails as having no home", () => {
    const dial = { ...inputs.dials[0], key: "zz.homeless_dial", label: "A control dial" };
    const said = brokenBy({ dials: [...inputs.dials, dial] });
    expect(said).toContain('"dials: a home place" reads');
    expect(said).toContain("dial.zz.homeless_dial: No act carries this dial, so it has no place.");
  });

  it("Old doors: an old address that lands nowhere fails by the address", () => {
    const said = brokenBy({ old: { ...inputs.old, leftAdmin: { ...inputs.old.leftAdmin, "zz-control": "/zz-nowhere" } } });
    expect(said).toContain('"still reaches its page today" reads');
    expect(said).toContain("/admin?tab=zz-control: It lands on the page /zz-nowhere, which nothing draws today.");
  });
});

describe("a count that is full takes nothing open", () => {
  it("a count written as full fails on every open item, by name, whatever its list once held", () => {
    const full: Ratchet = { ...ratchet, counts: { ...ratchet.counts, acts: { full: true, open: [] } } };
    const said = ratchetFailures(board, full).join("\n");
    expect(said).toContain("This count was full, so nothing may be open.");
    for (const item of countOf(board, "acts").open) expect(said).toContain(`${item.id}:`);
    // A full count with names left in its file by mistake is still full.
    const stray: Ratchet = { ...ratchet, counts: { ...ratchet.counts, acts: { full: true, open: heldOf("acts").open } } };
    expect(ratchetFailures(board, stray).join("\n")).toContain("This count was full, so nothing may be open.");
  });

  it("a count that reaches full is written full, and stays written full", () => {
    // A board is plain data: the same board with every open act given what it lacks.
    const done = { counts: board.counts.map((c) => (c.key === "acts" ? { ...c, open: [], done: c.total } : c)) };
    const next = rewritten(done, ratchet, "x");
    if (!("ratchet" in next)) throw new Error("a full count was refused");
    expect(next.ratchet.counts.acts).toEqual({ full: true, open: [] });
    expect(ratchetFailures(board, next.ratchet).join("\n")).toContain("Acts: " + countOf(board, "acts").open.length + " open items are new. This count was full");
    const again = rewritten(done, next.ratchet, "x");
    if (!("ratchet" in again)) throw new Error("a full count was refused the second time");
    expect(again.ratchet.counts.acts).toEqual({ full: true, open: [] });
  });
});

describe("rewriting the file", () => {
  it("refuses while any open item is not on the list, a newcomer beside a leaver included", () => {
    expect("failures" in rewritten(scoreGarden({ ...inputs, routes: [...inputs.routes, NEW_ROUTE] }), ratchet, "x")).toBe(true);
    const fixed = routeKey(openRoute.method, openRoute.path);
    const both = scoreGarden({ ...inputs, routes: [...inputs.routes, NEW_ROUTE], notAdmin: [...NOT_ADMIN_ROUTES, homeFor(fixed)] });
    expect("failures" in rewritten(both, ratchet, "x")).toBe(true);
  });

  it("drops every name that left and never adds one", () => {
    const fixed = routeKey(openRoute.method, openRoute.path);
    const next = rewritten(scoreGarden({ ...inputs, notAdmin: [...NOT_ADMIN_ROUTES, homeFor(fixed)] }), ratchet, "x");
    if (!("ratchet" in next)) throw new Error("a better board was refused");
    const held = next.ratchet.counts.endpoints;
    if (held === "not measured") throw new Error("Endpoints is measured");
    expect(held.open).toEqual(heldOf("endpoints").open.filter((name) => name !== fixed));
    for (const key of COUNT_KEYS) {
      const after = next.ratchet.counts[key];
      const before = ratchet.counts[key];
      if (after === "not measured" || before === "not measured") continue;
      expect(after.open.filter((name) => !before.open.includes(name)), key).toEqual([]);
    }
  });

  it("a name added in its place changes one line of the file, so two lanes that each add one do not rewrite it", () => {
    const withOne: Ratchet = { ...ratchet, counts: { ...ratchet.counts, endpoints: { full: false, open: inOrder([...heldOf("endpoints").open, "POST /api/admin/zz-control/new"]) } } };
    const before = ratchetText(ratchet).split("\n");
    const after = ratchetText(withOne).split("\n");
    expect(after.length).toBe(before.length + 1);
    const added = after.filter((line) => !before.includes(line));
    expect(added).toEqual(['    "POST /api/admin/zz-control/new",']);
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
