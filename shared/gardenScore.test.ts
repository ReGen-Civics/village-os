/**
 * The scoreboard's pure half (shared/gardenScore.ts), on small inputs made by hand, so each rule is seen deciding.
 * The repository's own numbers are held by the ratchet (server/gardenScoreboard.test.ts).
 */
import { describe, expect, it } from "vitest";
import { adminAct, type AdminAct } from "./adminActs";
import { dialAct } from "./adminActs/derived";
import { mayPropose } from "./adminHelper";
import { VARIABLES } from "./gameVariables";
import type { GardenMount } from "./gardenMounts";
import { gardenPlaceOf } from "./gardenMounts";
import { actFacts, actSettingFacts, countOf, dialFacts, guideCanToday, matrixVerdict, oldDoors, routeGroup, routeMatches, scoreGarden, stewardsByItsHandler, type ScoreInputs } from "./gardenScore";
import { openGroups, scoreMarkdown, scoreTable, scoreText, summaryRow } from "./gardenScoreReport";
import type { NotAdminFamily } from "./notAdminRoutes";

const real = (id: string): AdminAct => {
  const a = adminAct(id);
  if (!a) throw new Error(`no act ${id}`);
  return a;
};

const proposable = VARIABLES.find((v) => mayPropose(v) && !v.withheld && !v.key.startsWith("agents."))!;
const sealed = VARIABLES.find((v) => v.movedToSecret)!;

const page: AdminAct = { id: "tab.players", kind: "page", place: "gate", tab: "players", title: "Players", help: "Everyone here.", synonyms: [], power: "admin", parity: ["A11"] };
const write: AdminAct = { id: "gate.players.set-stage", kind: "act", place: "gate", tab: "players", title: "Set a stage", help: "Grant a stage.", synonyms: ["stage"], power: "admin", holder: "operator.accounts", route: { method: "PUT", path: "/api/admin/players/:id/stage" }, parity: ["A11"] };
const bare: AdminAct = { id: "gate.players.age", kind: "act", place: "gate", tab: "players", title: "Correct an age", help: "Set the band.", synonyms: ["age"], power: "admin", route: { method: "PUT", path: "/api/admin/members/:id/age-band" }, parity: ["A11"] };
const unread: AdminAct = { id: "tower.mail.pause", kind: "control", place: "tower", tab: "comms-settings", title: "Pause email", help: "Holds every email.", synonyms: [], power: "comms.manage", partial: true, parity: ["A70"] };
const outside: AdminAct = { id: "page.review", kind: "outside", place: "hall", path: "/review", title: "Review", help: "Waiting changes.", synonyms: [], power: "admin", parity: ["H3"] };

const tabs = [
  { key: "players", area: "people" as const, place: "gate" as const, name: "Players", help: "" },
  { key: "comms-settings", area: "events" as const, place: "tower" as const, name: "Mail settings", help: "" },
  { key: "variables", area: "village" as const, place: "greenhouse" as const, name: "Game mechanics", help: "" },
];

function inputs(over: Partial<ScoreInputs> = {}): ScoreInputs {
  return {
    routes: [],
    unresolved: [],
    matrix: { identities: ["signedOut", "member", "powerHolder", "adminGroup", "admin", "founder"], routes: {} },
    acts: [page, write, bare, unread, outside],
    dials: [],
    tabs,
    ledger: { rows: { A11: "Players", A70: "Mail settings", H3: "The deciders' queue", G16: "A panel" }, stillOpen: {}, neverDrawn: { G16: "no page renders it" } },
    mounts: [],
    cuts: [],
    notAdmin: [],
    old: { movedTabs: {}, leftAdmin: {}, clientRoutes: ["/admin", "/review", "/forum/:id"] },
    ...over,
  };
}

const everything: GardenMount[] = [
  { place: "gate", tabs: ["players"], pages: [] },
  { place: "tower", tabs: ["comms-settings"], pages: [] },
  { place: "hall", tabs: [], pages: ["/review"] },
];

describe("Functions: a ledger row in its garden place", () => {
  it("with nothing mounted every row is open, and the row no page draws is reported apart", () => {
    const c = countOf(scoreGarden(inputs()), "functions");
    expect([c.done, c.total]).toEqual([0, 4]);
    expect(openGroups(c).map((g) => `${g.group}:${g.items.length}`)).toEqual(["still in the old tab:3", "no page draws it:1"]);
    expect(c.open.find((o) => o.name.startsWith("A11"))!.why).toContain("3 of its 3 acts open outside the garden");
  });

  it("a row is done only when every act carrying it opens on something mounted in the act's own place", () => {
    const some = countOf(scoreGarden(inputs({ mounts: [{ place: "gate", tabs: ["players"], pages: [] }] })), "functions");
    expect(some.done).toBe(1);
    const all = countOf(scoreGarden(inputs({ mounts: everything })), "functions");
    expect([all.done, all.open.map((o) => o.group)]).toEqual([3, ["no page draws it"]]);
    // Mounted in the wrong place is not in its place.
    const wrong = countOf(scoreGarden(inputs({ mounts: [{ place: "hall", tabs: ["players"], pages: [] }] })), "functions");
    expect(wrong.done).toBe(0);
  });

  it("a row with a part no act carries stays open after its tab is mounted, and says which part", () => {
    const c = countOf(scoreGarden(inputs({ mounts: everything, ledger: { rows: { A11: "Players" }, stillOpen: { A11: "erase prep" }, neverDrawn: {} } })), "functions");
    expect(c.done).toBe(0);
    expect(c.open[0]).toMatchObject({ group: "in the garden, with a part no act carries" });
    expect(c.open[0].why).toContain("erase prep");
  });

  it("a cut counts only with the ruling's date and words, and a cut that carries neither is ignored and named", () => {
    const cut = countOf(scoreGarden(inputs({ cuts: [{ row: "G16", date: "2026-11-27", words: "Cut it." }] })), "functions");
    expect(cut.done).toBe(1);
    expect(cut.parts.find((p) => p.name === "cut by ruling")!.value).toBe(1);
    const empty = countOf(scoreGarden(inputs({ cuts: [{ row: "G16", date: "", words: "Cut it." }, { row: "Z9", date: "2026-11-27", words: "x" }] })), "functions");
    expect(empty.done).toBe(0);
    expect(empty.notes.join(" ")).toContain("G16, Z9");
  });

  it("a row no act carries, and that is not on the never-drawn list, is open as missing", () => {
    const c = countOf(scoreGarden(inputs({ ledger: { rows: { B1: "Find by code" }, stillOpen: {}, neverDrawn: {} } })), "functions");
    expect(c.open[0]).toMatchObject({ group: "no act carries it" });
  });
});

describe("Acts: place, entry, consequence line, tier", () => {
  it("a write whose door names a power has its line, and one whose door asks only for an admin does not", () => {
    expect(actFacts(write)).toMatchObject({ place: true, entry: true, writes: true, consequence: true, tierSettled: true });
    expect(actFacts(bare)).toMatchObject({ writes: true, consequence: false });
    // A page changes nothing, so no line is asked of it.
    expect(actFacts(page)).toMatchObject({ writes: false, consequence: true });
  });

  it("an act marked partial with no route has no settled tier: nothing says whether it writes", () => {
    expect(actFacts(unread).tierSettled).toBe(false);
    expect(actFacts({ ...unread, partial: undefined }).tierSettled).toBe(true);
    // Partial with a route is settled: the class is read off the route.
    expect(actFacts({ ...write, partial: true }).tierSettled).toBe(true);
  });

  it("counts an act done only when all four hold, and names each open one with why", () => {
    const c = countOf(scoreGarden(inputs()), "acts");
    expect([c.done, c.total]).toEqual([3, 5]);
    expect(c.open.map((o) => `${o.name.split(" ")[0]}|${o.group}`).sort()).toEqual(["gate.players.age|needs a consequence line", "tower.mail.pause|tier not settled"]);
    expect(c.parts.find((p) => p.name === "changes something, and has its consequence line")).toMatchObject({ value: 1, of: 2 });
  });

  it("an act in a place the garden does not have is open by name", () => {
    const stray = { ...page, id: "tab.x", place: "attic" as never };
    const c = countOf(scoreGarden(inputs({ acts: [stray] })), "acts");
    expect(c.open[0]).toMatchObject({ group: "no place" });
  });
});

describe("Endpoints: whose is every route", () => {
  const routes = [
    { method: "PUT", path: "/api/admin/players/:id/stage" },
    { method: "GET", path: "/api/admin/players" },
    { method: "GET", path: "/api/admin/players/:id/notes" },
    { method: "GET", path: "/api/profile" },
    { method: "GET", path: "/health" },
    { method: "GET", path: "/health" },
  ];
  const matrix = {
    identities: ["signedOut", "member", "powerHolder", "adminGroup", "admin", "founder"],
    routes: { "GET /api/admin/players/:id/notes": [401, 401, 401, 200, 200, 200], "GET /api/admin/players": [401, 200, 200, 200, 200, 200] },
  };
  const member: NotAdminFamily = { key: "profile", kind: "member", names: ["/api/profile"], test: (_m, p) => p === "/api/profile" || p.startsWith("/api/profile/"), why: "A member's own profile." };

  it("with no reads and no families, only the routes an act calls are accounted for, and a route registered twice counts once", () => {
    const c = countOf(scoreGarden(inputs({ routes, matrix })), "endpoints");
    expect([c.done, c.total]).toEqual([1, 5]);
    expect(openGroups(c).map((g) => `${g.group}:${g.items.length}`)).toEqual(["/api/admin:2", "/api/profile:1", "/health:1"]);
  });

  it("a read an act names, and a family that is not admin's, each account for their routes; what is left is open by name", () => {
    const reader = { ...page, reads: ["/api/admin/players"] };
    const c = countOf(scoreGarden(inputs({ routes, matrix, acts: [reader, write], notAdmin: [member] })), "endpoints");
    expect([c.done, c.total]).toEqual([3, 5]);
    expect(c.open.map((o) => o.name).sort()).toEqual(["GET /api/admin/players/:id/notes", "GET /health"]);
    expect(c.parts.find((p) => p.name === "an act's page reads it")!.value).toBe(1);
    expect(c.parts.find((p) => p.name === "not admin's: a member's own side")!.value).toBe(1);
  });

  it("what a handler asks overrules a family: asking for an admin, or naming a role's power, keeps the route open", () => {
    const asks = [
      { method: "GET", path: "/api/profile", asksAdmin: false, powers: [] },
      { method: "POST", path: "/api/profile/hide", asksAdmin: true, powers: [] },
      { method: "POST", path: "/api/profile/pay", asksAdmin: false, powers: ["role.pay"] },
      // A power a stage unlocks is a member's everyday power, and does not overrule.
      { method: "POST", path: "/api/profile/post", asksAdmin: false, powers: ["forum.post"] },
    ];
    const c = countOf(scoreGarden(inputs({ routes: asks, acts: [], notAdmin: [member] })), "endpoints");
    expect([c.done, c.total]).toEqual([2, 4]);
    expect(c.open.map((o) => o.name).sort()).toEqual(["POST /api/profile/hide", "POST /api/profile/pay"]);
    expect(c.open.find((o) => o.name === "POST /api/profile/hide")!.why).toContain("asks whether the caller is an admin");
    expect(c.open.find((o) => o.name === "POST /api/profile/pay")!.why).toContain("role.pay");
    expect(c.parts.find((p) => p.name === "open, in a family that is not admin's and overruled by its own handler")!.value).toBe(2);
    expect(stewardsByItsHandler({ asksAdmin: false, powers: ["forum.post"] })).toBeNull();
    expect(stewardsByItsHandler({})).toBeNull();
  });

  it("says when the permission matrix shows an open route is admin's", () => {
    const c = countOf(scoreGarden(inputs({ routes, matrix })), "endpoints");
    expect(c.open.find((o) => o.name === "GET /api/admin/players/:id/notes")!.why).toContain("matrix shows it is admin's");
    expect(c.parts.find((p) => p.name === "open, and the permission matrix shows it is admin's")!.value).toBe(1);
    expect(matrixVerdict(matrix, "GET /api/admin/players")).toBe("open");
    expect(matrixVerdict(matrix, "GET /api/profile")).toBe("absent");
    // Refused to an admin and let in for a founder alone is still admin's side of the house.
    expect(matrixVerdict({ ...matrix, routes: { "PUT /x": [401, 401, 403, 403, 403, 400] } }, "PUT /x")).toBe("admin");
    expect(matrixVerdict({ ...matrix, routes: { "PUT /x": [401, 403, 403, 403, 403, 403] } }, "PUT /x")).toBe("open");
  });

  it("a registration whose path could not be read is open and counted, and a route an act names that is gone is said", () => {
    const c = countOf(scoreGarden(inputs({ routes: [], unresolved: [{ method: "GET", file: "server/routes/x.ts", line: 9, text: "somePath()" }] })), "endpoints");
    expect([c.done, c.total, c.open[0].group]).toEqual([0, 1, "(path not read)"]);
    expect(c.notes.join(" ")).toContain("PUT /api/admin/players/:id/stage");
  });

  it("groups by the first two path segments", () => {
    expect(routeGroup("/api/admin/players/:id")).toBe("/api/admin");
    expect(routeGroup("/health")).toBe("/health");
    expect(routeGroup("/{*splat}")).toBe("/{*splat}");
  });
});

describe("Settings: the five answers", () => {
  it("a dial answers all five from what decides it, and one whose value is sealed has no path by a vote", () => {
    expect(dialFacts(proposable, dialAct(proposable)).missing).toEqual({});
    expect(Object.keys(dialFacts(sealed, dialAct(sealed)).missing)).toEqual(["vote"]);
  });

  it("a dial with no act has no home and no door, and one with no words of its own says which are missing", () => {
    expect(Object.keys(dialFacts(proposable, undefined).missing).sort()).toEqual(["home", "who"]);
    const wordless = { ...proposable, label: proposable.key, description: "" };
    expect(Object.keys(dialFacts(wordless, dialAct(wordless)).missing).sort()).toEqual(["changes", "name"]);
  });

  it("a key and a shipped control cannot answer their path by a vote, and a control whose door was never read cannot say who", () => {
    const key = real("key.assistant_api_key");
    expect(Object.keys(actSettingFacts(key, "key").missing)).toEqual(["vote"]);
    expect(Object.keys(actSettingFacts(unread, "control").missing).sort()).toEqual(["vote", "who"]);
  });

  it("counts dials, keys and controls together and reports each kind facet by facet", () => {
    const c = countOf(scoreGarden(inputs({ acts: [dialAct(proposable), dialAct(sealed), real("key.assistant_api_key"), unread], dials: [proposable, sealed] })), "settings");
    expect([c.done, c.total]).toEqual([1, 4]);
    expect(c.parts.find((p) => p.name === "dials: its path by the highest vote")).toMatchObject({ value: 1, of: 2 });
    expect(c.parts.find((p) => p.name === "keys: its path by the highest vote")).toMatchObject({ value: 0, of: 1 });
    expect(c.parts.find((p) => p.name === "shipped controls: who may change it")).toMatchObject({ value: 0, of: 1 });
  });
});

describe("The road: not measured", () => {
  it("reads as not measured with its reason, and never as zero", () => {
    const c = countOf(scoreGarden(inputs()), "road");
    expect(c).toMatchObject({ measured: false, total: null, done: null });
    expect(c.notMeasured).toContain("not built");
    expect(summaryRow(c)).toMatchObject({ done: "not measured", total: "not measured" });
    expect(scoreTable(scoreGarden(inputs()))).toContain("not measured");
  });
});

describe("Three ways: click, Find anything, the guide", () => {
  const defs = new Map(VARIABLES.map((v) => [v.key, v]));

  it("the guide counts for a dial she may prepare, and for nothing else", () => {
    expect(guideCanToday(dialAct(proposable), defs)).toBe(true);
    expect(guideCanToday(dialAct(sealed), defs)).toBe(false);
    expect(guideCanToday(write, defs)).toBe(false);
    expect(guideCanToday(page, defs)).toBe(false);
  });

  it("follows the helper's list: a dial it refuses is not hers, whatever else is true", () => {
    const refusing = { always: [], neverProposed: () => null, variableNever: () => null, proposalRefusal: () => "Not this one." };
    expect(guideCanToday(dialAct(proposable), defs, refusing)).toBe(false);
  });

  it("reports the three numbers and the intersection", () => {
    const c = countOf(scoreGarden(inputs({ acts: [dialAct(proposable), dialAct(sealed), write, page], dials: [proposable, sealed] })), "threeWays");
    expect([c.done, c.total]).toEqual([1, 4]);
    expect(c.parts.map((p) => p.value)).toEqual([4, 4, 1, 1]);
    expect(openGroups(c).map((g) => g.group).sort()).toEqual(["a dial the guide may not prepare", "not by the guide yet: act", "not by the guide yet: page"]);
  });
});

describe("Old doors: every old address", () => {
  const old = { movedTabs: { "email-settings": { tab: "comms-settings" } }, leftAdmin: { "quest-claims": "/review?kind=claim", gone: "/nowhere" }, clientRoutes: ["/admin", "/review", "/forum/:id"] };

  it("lists each address once and settles it through the aliases", () => {
    const doors = oldDoors({ acts: [page, write, outside], tabs, old, mounts: [] });
    const by = new Map(doors.map((d) => [d.address, d]));
    expect(by.get("/admin?tab=email-settings")).toMatchObject({ kind: "folded tab", lands: { tab: "comms-settings" }, reaches: true });
    expect(by.get("/admin?tab=quest-claims")).toMatchObject({ lands: { path: "/review?kind=claim" }, reaches: true });
    expect(by.get("/admin?tab=gone")).toMatchObject({ reaches: false });
    expect(by.get("/review")).toMatchObject({ kind: "page", reaches: true });
    // The act on the players tab lands on the tab's own address, which is listed once.
    expect(doors.filter((d) => d.address === "/admin?tab=players")).toHaveLength(1);
  });

  it("an address that reaches nothing is open under its own heading, and nothing is in the garden until it is mounted", () => {
    const c = countOf(scoreGarden(inputs({ acts: [page, outside], old })), "oldDoors");
    expect(c.done).toBe(0);
    expect(c.open.find((o) => o.name === "/admin?tab=gone")).toMatchObject({ group: "reaches nothing today" });
    const mounted = countOf(scoreGarden(inputs({ acts: [page, outside], old, mounts: everything })), "oldDoors");
    // players, comms-settings and its old name, /review, and the folded tab that lands on /review.
    expect(mounted.done).toBe(5);
    expect(mounted.open.map((o) => o.name).sort()).toEqual(["/admin?tab=gone", "/admin?tab=variables"]);
  });

  it("matches a router pattern segment by segment", () => {
    expect(routeMatches("/forum/:id", "/forum/abc")).toBe(true);
    expect(routeMatches("/forum/:id", "/forum")).toBe(false);
    expect(routeMatches("/review", "/review")).toBe(true);
    expect(routeMatches("/review", "/reviews")).toBe(false);
  });
});

describe("the mount seam", () => {
  it("answers for a tab by its key and for a page by its bare path, and for nothing when empty", () => {
    expect(gardenPlaceOf({ tab: "players" }, everything)).toBe("gate");
    expect(gardenPlaceOf({ path: "/review?kind=claim#top" }, everything)).toBe("hall");
    expect(gardenPlaceOf({ tab: "players" }, [])).toBeNull();
    expect(gardenPlaceOf({ tab: "players" })).toBeNull();
  });
});

describe("the printed report", () => {
  const board = scoreGarden(inputs());

  it("is data: it survives a JSON round trip, so the JSON a lane reads is the board itself", () => {
    expect(JSON.parse(JSON.stringify(board))).toEqual(board);
  });

  it("prints all seven counts, cuts a long list and says how many more, and lists everything when asked", () => {
    const many = scoreGarden(inputs({ routes: Array.from({ length: 9 }, (_, n) => ({ method: "GET", path: `/api/things/${n}` })) }));
    const short = scoreText(many);
    expect(short).toContain("ENDPOINTS: 0 of 9");
    expect(short).toContain("and 6 more");
    expect(scoreText(many, { all: true })).toContain("GET /api/things/8");
    for (const title of ["Functions", "Acts", "Endpoints", "Settings", "The road", "Three ways", "Old doors"]) expect(scoreTable(many)).toContain(title);
  });

  it("writes Markdown with the table first and the stamp it was handed", () => {
    const text = scoreMarkdown(board, { stamp: "Measured on commit abc." });
    expect(text.indexOf("| Count | Done | Total | Open |")).toBeLessThan(text.indexOf("## Functions"));
    expect(text).toContain("Measured on commit abc.");
    expect(text).toContain("| The road | not measured | not measured | not measured |");
  });
});
