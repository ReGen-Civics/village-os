/**
 * The routes each admin page reads (shared/adminActs/reads.ts), held equal to the client's own source.
 *
 * The table is derived, never typed (server/testkit/pageReads.ts). This file runs the derivation again and fails by
 * name when the committed table differs from it in either direction:
 *
 *   a read the table is missing   a page started calling a steward's route, or a new route arrived that a page calls
 *   a read the table still holds  the page stopped calling it, or the route is gone
 *
 * Either way the fix is one command: `npx tsx scripts/garden-reads.ts --write`. It also holds what makes a read
 * worth claiming: the route is registered, it is a GET, and it is a steward's by evidence.
 *
 * Reads files and needs no database.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { adminAct } from "../shared/adminActs";
import { TAB_PAGES } from "../shared/adminActs/derived";
import { PATH_READS, TAB_READS } from "../shared/adminActs/reads";
import { routeKey, stewardsRoute } from "../shared/gardenScore";
import { ClientReader, codeCalls, pathPattern } from "./testkit/clientReads";
import { readMatrix } from "./testkit/gardenInputs";
import { actPagePaths, derivePageReads } from "./testkit/pageReads";
import { routeDoors } from "./testkit/routeDoors";

const ROOT = path.resolve(__dirname, "..");
const HOW = "Run `npx tsx scripts/garden-reads.ts --write` and commit shared/adminActs/reads.ts.";
const derived = derivePageReads(ROOT);

/** Every claim of a table as one line each: `players reads /api/admin/players`. */
const lines = (table: Readonly<Record<string, readonly string[]>>): string[] => Object.keys(table).flatMap((k) => table[k].map((p) => `${k} reads ${p}`)).sort();

describe("how a route's path is found in the client's code", () => {
  it("matches the three ways the client spells the base, and a `${...}` where the path has a `:name`", () => {
    expect(codeCalls('load("/api/admin/players")', "/api/admin/players")).toBe(true);
    expect(codeCalls("load(`${API_BASE}/admin/players`)", "/api/admin/players")).toBe(true);
    expect(codeCalls("load(`${API_BASE}/api/admin/players?stage=${s}`)", "/api/admin/players")).toBe(true);
    expect(codeCalls("load(`/api/admin/players/${id}/notes`)", "/api/admin/players/:id/notes")).toBe(true);
    expect(pathPattern("/api/admin/players/:id").source).toContain("API_BASE");
  });

  it("never reads a longer path, a neighbour, or a plain word in a `:name` place as the route", () => {
    expect(codeCalls('load("/api/admin/players/detail")', "/api/admin/players")).toBe(false);
    expect(codeCalls('load("/api/admin/players/detail")', "/api/admin/players/:id")).toBe(false);
    expect(codeCalls('load("/api/admin/playersx")', "/api/admin/players")).toBe(false);
    expect(codeCalls("load(`/api/admin/players/${id}/notes`)", "/api/admin/players/:id")).toBe(false);
    expect(codeCalls("the words /api/admin/players in a comment", "/api/admin/players")).toBe(false);
  });
});

describe("the reader finds the pages", () => {
  const reader = new ClientReader(ROOT);

  it("finds a component for nearly every tab, and says by name which it cannot read", () => {
    const blindTabs = derived.blind.filter((b) => b.startsWith("tab "));
    console.log(`\n[garden reads] no component found, so nothing is claimed: ${derived.blind.join(", ") || "none"}\n`);
    expect(reader.tabComponents().size).toBeGreaterThan(0);
    // A change of shape in Admin.tsx that hides most tabs from the reader fails here, before it empties the table.
    expect(blindTabs.length, blindTabs.join(", ")).toBeLessThan(TAB_PAGES.length / 4);
  });

  it("reads a tab's own code, and only that tab's", () => {
    expect(codeCalls(reader.tabCode("ledger"), "/api/admin/ledger/reconciliation")).toBe(true);
    expect(codeCalls(reader.tabCode("ledger"), "/api/admin/players")).toBe(false);
    expect(reader.tabCode("no-such-tab")).toBe("");
    expect(codeCalls(reader.pageCode("/admin/mint"), "/api/admin/economy")).toBe(true);
  });
});

describe("the table of reads is the client's own, in both directions", () => {
  it("holds no read the client no longer makes, and misses none it makes", () => {
    const held = [...lines(TAB_READS).map((l) => `tab ${l}`), ...lines(PATH_READS).map((l) => `page ${l}`)];
    const live = [...lines(derived.tabs).map((l) => `tab ${l}`), ...lines(derived.paths).map((l) => `page ${l}`)];
    const missing = live.filter((l) => !held.includes(l));
    const stale = held.filter((l) => !live.includes(l));
    expect(missing, `shared/adminActs/reads.ts is missing reads the client makes. ${HOW}\n${missing.join("\n")}`).toEqual([]);
    expect(stale, `shared/adminActs/reads.ts holds reads the client no longer makes. ${HOW}\n${stale.join("\n")}`).toEqual([]);
    // A floor on what was compared: an empty derivation would agree with an empty table.
    expect(live.length).toBeGreaterThan(100);
  });

  it("every read is a GET route the server registers, and a steward's by evidence", () => {
    const matrix = readMatrix(ROOT);
    const gets = new Map(routeDoors(ROOT).doors.filter((d) => d.method === "GET").map((d) => [routeKey("GET", d.path), d]));
    const wrong: string[] = [];
    for (const p of new Set([...Object.values(TAB_READS).flat(), ...Object.values(PATH_READS).flat()])) {
      const route = gets.get(routeKey("GET", p));
      if (!route) wrong.push(`${p}: no GET route is registered at this path`);
      else if (!stewardsRoute(route, matrix)) wrong.push(`${p}: nothing shows it is a steward's route`);
    }
    expect(wrong, wrong.join("\n")).toEqual([]);
  });

  it("names only tabs that are pages of their own, and pages an act lands on", () => {
    const tabKeys = new Set(TAB_PAGES.map((t) => t.key));
    expect(Object.keys(TAB_READS).filter((k) => !tabKeys.has(k))).toEqual([]);
    const pages = new Set(actPagePaths());
    expect(Object.keys(PATH_READS).filter((k) => !pages.has(k))).toEqual([]);
  });

  it("the registry carries them: a tab's page act its tab's, and an act on a page beside Admin that page's", () => {
    expect(adminAct("tab.ledger")?.reads).toEqual(TAB_READS.ledger);
    expect(adminAct("page.mint")?.reads).toEqual(PATH_READS["/admin/mint"]);
    // An act on a tab that is not the tab's page act carries none: the page answers for its reads once.
    expect(adminAct("gate.players.set-stage")?.reads).toBeUndefined();
    expect(adminAct("tab.players")?.reads).toEqual(TAB_READS.players);
  });
});
