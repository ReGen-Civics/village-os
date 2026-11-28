/**
 * THE SIZE GATE READS THE ROUTE-PRELOAD TABLE BACK, and this holds its reader
 * to the table's writer.
 *
 * scripts/check-dist-budget.mjs counts the files only an admin page loads apart
 * from the files a member's page can load (scripts/lib/distSplit.mjs has the
 * rule). index.html loads one script that is no chunk, the table routePreload.ts
 * writes, and that table names every route's files, the Admin page's own
 * stylesheet among them. Read as plain text it put that stylesheet on the
 * members' side on the first measured build. So the gate reads it as a table:
 * a row for an admin route names its files for that route alone.
 *
 * A reader of a format somebody else writes goes blind the day the format
 * moves, and a blind reader here falls back to plain text, which is the safe
 * way round and still a wrong number. So the writer's own functions are run
 * here, on the real router, and the reader must read back what they wrote.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { preloadFilesForMembers, readRoutePreloadTable, routePatternOf, routesFromApp, unreadRoutes } from "../../../scripts/lib/distSplit.mjs";
import { lazyRoutesFromApp, routePattern, routePreloadScript, type RoutePreloadTable } from "./routePreload";

const APP = fs.readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");

describe("the size gate's reader of the route-preload table", () => {
  const table: RoutePreloadTable = {
    files: ["assets/Quests-AbC_1-x.js", "assets/site-9.css", "api/i18n/catalog/en/part/s5MJ_mISq62N", "assets/Admin-q.js", "assets/Admin-q.css"],
    routes: [
      [routePattern("/quests/:id"), [0, 1, 2]],
      [routePattern("/admin"), [3, 4]],
    ],
  };

  it("reads back exactly the table the writer writes", () => {
    expect(readRoutePreloadTable(routePreloadScript(table, "/"))).toEqual({ files: table.files, rows: table.routes });
  });

  it("names for members the files of a member route's row and none of an admin route's", () => {
    const read = readRoutePreloadTable(routePreloadScript(table, "/"));
    expect(read).not.toBeNull();
    const forMembers = preloadFilesForMembers(read!, routesFromApp(APP));
    expect(forMembers).toEqual(["assets/Quests-AbC_1-x.js", "assets/site-9.css", "api/i18n/catalog/en/part/s5MJ_mISq62N"]);
  });

  it("spells every route's pattern as the writer does, on the real router", () => {
    const routes = routesFromApp(APP);
    expect(routes.length).toBeGreaterThan(100);
    expect(unreadRoutes(routes)).toEqual([]);
    for (const r of routes) expect(routePatternOf(r.path), r.path).toBe(routePattern(r.path));
  });

  it("sees every lazy route the writer's own router reader sees, with the same page", () => {
    const mine = new Map(routesFromApp(APP).filter((r) => r.kind === "lazy").map((r) => [r.path, r.page]));
    const theirs = lazyRoutesFromApp(APP);
    expect(theirs.length).toBeGreaterThan(100);
    for (const r of theirs) expect(mine.get(r.path), r.path).toBe(`client/src/${r.module}`);
  });
});
