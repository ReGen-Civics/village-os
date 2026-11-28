/**
 * The list of routes that are not admin's (shared/notAdminRoutes.ts), held to the real server.
 *
 * It is the one hand-kept list the scoreboard's Endpoints count reads, and a hand-kept list fails open. So every
 * family is run against every route the server registers (read from the source by server/testkit/routeDoors.ts)
 * and against the permission matrix's snapshot:
 *
 *   - no family matches a route under /api/admin/;
 *   - no family matches a route the matrix shows is admin's;
 *   - no family matches a route an admin act calls;
 *   - every path a family names matches a real route, so no entry is dead;
 *   - no family is /api/ whole, and under /api/ each names at least the second segment;
 *   - a route inside a family whose own handler asks the admin question, or names a power only a role gives, is
 *     open on the scoreboard and never counted as not admin's.
 *
 * Reads files and needs no database.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_ACTS } from "../shared/adminActs";
import { actRoutes, countOf, matrixVerdict, routeKey, routeOwner, scoreGarden, stewardsByItsHandler } from "../shared/gardenScore";
import { NOT_ADMIN_ROUTES, OWN_SEGMENTS, isUnder, notAdminFamily } from "../shared/notAdminRoutes";
import { gatherScoreInputs, readMatrix } from "./testkit/gardenInputs";
import { routeDoors } from "./testkit/routeDoors";

const ROOT = path.resolve(__dirname, "..");
const { doors } = routeDoors(ROOT);
const matrix = readMatrix(ROOT);

describe("the routes that are not admin's", () => {
  it("reads the server's routes at all (a floor, so an empty read cannot pass)", () => {
    expect(doors.length).toBeGreaterThan(1500);
    expect(Object.keys(matrix.routes).length).toBeGreaterThan(400);
    expect(doors.filter((d) => d.asksAdmin).length).toBeGreaterThan(300);
  });

  it("every family has a key of its own, a kind, a reason and the paths it names", () => {
    const keys = NOT_ADMIN_ROUTES.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const f of NOT_ADMIN_ROUTES) {
      expect(["public", "member", "machine"], f.key).toContain(f.kind);
      expect(f.why.trim().length, f.key).toBeGreaterThan(20);
      expect(f.names.length, f.key).toBeGreaterThan(0);
    }
  });

  it("no family matches a route under /api/admin/, real or made up", () => {
    const swallowed = doors.filter((d) => d.path.startsWith("/api/admin/") && notAdminFamily(d.method, d.path)).map((d) => `${routeKey(d.method, d.path)} in ${notAdminFamily(d.method, d.path)!.key}`);
    expect(swallowed, swallowed.join("\n")).toEqual([]);
    // The segment family is the one that could reach in: a path with /me or /mine under Admin is still Admin's.
    for (const made of ["/api/admin/suggestions/mine", "/api/admin/me", "/api/admin/players/:id/me", "/api/admin/game/rules", "/api/admin/profile"]) {
      for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) expect(notAdminFamily(method, made), `${method} ${made}`).toBeNull();
    }
  });

  it("no family matches a route the permission matrix shows is admin's", () => {
    const swallowed: string[] = [];
    for (const key of Object.keys(matrix.routes)) {
      if (matrixVerdict(matrix, key) !== "admin") continue;
      const [method, routePath] = key.split(" ");
      const family = notAdminFamily(method, routePath);
      if (family) swallowed.push(`${key} in ${family.key}`);
    }
    expect(swallowed, swallowed.join("\n")).toEqual([]);
    // The matrix does show admin's routes, so the loop above compared something.
    expect(Object.keys(matrix.routes).filter((k) => matrixVerdict(matrix, k) === "admin").length).toBeGreaterThan(400);
  });

  it("no family matches a route an admin act calls", () => {
    const everyday = new Set(["member", "signed-in", "anyone"]);
    const swallowed = ADMIN_ACTS.filter((a) => a.route && !everyday.has(a.power) && notAdminFamily(a.route.method, a.route.path)).map((a) => `${a.id}: ${a.route!.method} ${a.route!.path} in ${notAdminFamily(a.route!.method, a.route!.path)!.key}`);
    expect(swallowed, swallowed.join("\n")).toEqual([]);
  });

  it("every path a family names matches a real route: no entry is dead", () => {
    const dead: string[] = [];
    for (const f of NOT_ADMIN_ROUTES) {
      for (const name of f.names) {
        const segment = (OWN_SEGMENTS as readonly string[]).includes(name.slice(1)) ? name.slice(1) : null;
        const hit = doors.some((d) => f.test(d.method, d.path) && (segment ? d.path.split("/").includes(segment) : d.path === name || isUnder(name, d.path)));
        if (!hit) dead.push(`${f.key}: ${name}`);
      }
    }
    expect(dead, `no route matches: ${dead.join(", ")}`).toEqual([]);
  });

  it("a family is a path that means something: none is /api/ whole, and under /api/ each names its second segment", () => {
    for (const f of NOT_ADMIN_ROUTES) {
      for (const name of f.names) {
        expect(["/", "/api", "/api/"], `${f.key}: ${name}`).not.toContain(name);
        if (name.startsWith("/api/")) expect(name.split("/").filter(Boolean).length, `${f.key}: ${name}`).toBeGreaterThanOrEqual(2);
      }
      // And the test itself agrees: a made-up route elsewhere under /api/ is in no family.
      expect(f.test("GET", "/api/zz-not-a-route/anything"), f.key).toBe(false);
      expect(f.test("POST", "/api"), f.key).toBe(false);
    }
  });

  it("holds a real share of the routes, and one named family answers for each kind", () => {
    const held = doors.filter((d) => notAdminFamily(d.method, d.path));
    expect(held.length).toBeGreaterThan(250);
    expect(notAdminFamily("GET", "/api/me/moon")?.key).toBe("member-own-records");
    expect(notAdminFamily("POST", "/api/auth/login")?.kind).toBe("public");
    expect(notAdminFamily("POST", "/api/webhooks/stripe")?.kind).toBe("machine");
    // A prefix named by a family answers before the segment family: a visitor's own record is public.
    expect(notAdminFamily("GET", "/api/visitor/me")?.key).toBe("portal-visitor");
    expect(notAdminFamily("GET", "/api/needs/mine")?.key).toBe("member-own-rows");
    // `/api/me` never swallows a neighbour that only starts with the same letters.
    expect(notAdminFamily("GET", "/api/members/:handle/moon")).toBeNull();
  });
});

describe("what a handler asks overrules the list", () => {
  const inputs = gatherScoreInputs(ROOT);
  const endpoints = countOf(scoreGarden(inputs), "endpoints");
  const openNames = new Set(endpoints.open.map((o) => o.name));

  it("a route inside a family whose handler asks for an admin, or names a role's power, is open by name", () => {
    const overruled = inputs.routes.filter((r) => notAdminFamily(r.method, r.path) && stewardsByItsHandler(r));
    expect(overruled.length).toBeGreaterThan(0);
    const named = new Set(ADMIN_ACTS.filter((a) => a.route).map((a) => routeKey(a.route!.method, a.route!.path)));
    for (const r of overruled) {
      const key = routeKey(r.method, r.path);
      if (named.has(key)) continue;
      expect(openNames.has(key), `${key} is in a family, its handler says it is a steward's, and it is not open`).toBe(true);
    }
    expect(endpoints.open.find((o) => o.name === "POST /api/game/mechanics/proposals/:id/passed")?.why).toContain("member-game");
  });

  it("no route counted as not admin's is one whose handler asks the admin question", () => {
    const named = actRoutes(inputs.acts);
    const notAdmins = inputs.routes.filter((r) => routeOwner(r, named, inputs.notAdmin).by === "not-admin");
    expect(notAdmins.length).toBeGreaterThan(250);
    expect(notAdmins.filter((r) => r.asksAdmin || stewardsByItsHandler(r)).map((r) => routeKey(r.method, r.path))).toEqual([]);
  });
});
