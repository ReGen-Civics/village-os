/**
 * The Treasury, Admin, Mint and Cash pages keep their own lazy chunks: none of
 * them may join "smallpages", "midpages", "shopfront" or "smallui", where a
 * member opening a neighbour would download them (client/src/lib/privilegedChunks.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lazyRoutesFromApp } from "./routePreload";
import { adminCodeOnMemberFiles, adminOnlyModules, adminRootPages, isAdminRoute, mayJoinSharedGroup, OPENED_BY_OTHERS, PRIVILEGED_PAGE, type BuiltChunk, type GraphNode } from "./privilegedChunks";

const page = (name: string) => path.join(process.cwd(), "client", "src", "pages", `${name}.tsx`);

describe("privileged pages never ride a shared page group", () => {
  it("keeps the Treasury out, on either slash", () => {
    expect(mayJoinSharedGroup(page("Treasury"))).toBe(false);
    expect(mayJoinSharedGroup("C:/repo/client/src/pages/Treasury.tsx")).toBe(false);
    expect(mayJoinSharedGroup("C:\\repo\\client\\src\\pages\\Treasury.tsx")).toBe(false);
  });

  it("keeps Admin*, Mint* and Cash* pages out", () => {
    for (const name of ["Admin", "AdminGuide", "Mint", "CashPayouts"]) expect(mayJoinSharedGroup(page(name)), name).toBe(false);
  });

  it("keeps the shared hand-mint form and the treasury components out", () => {
    expect(mayJoinSharedGroup("/repo/client/src/components/admin/MintDesk.tsx")).toBe(false);
    expect(mayJoinSharedGroup("/repo/client/src/components/treasury/TreasuryCard.tsx")).toBe(false);
    // Pay by member (#1358) and the cash desk, each drawn by the Treasury and by Admin.
    expect(mayJoinSharedGroup("C:\\repo\\client\\src\\components\\myMoon\\PayBoard.tsx")).toBe(false);
    expect(mayJoinSharedGroup("/repo/client/src/components/admin/CashPayoutsTab.tsx")).toBe(false);
    // The role waitlist's admin panel and its letter, which /roles draws only for an admin.
    expect(mayJoinSharedGroup("/repo/client/src/components/roleCard/WaitlistAdmin.tsx")).toBe(false);
    expect(mayJoinSharedGroup("C:\\repo\\client\\src\\components\\roleCard\\WaitlistLetter.tsx")).toBe(false);
    expect(mayJoinSharedGroup("/repo/client/src/components/roleCard/WaitlistForm.tsx")).toBe(true);
    expect(mayJoinSharedGroup("/repo/client/src/components/myMoon/MyMoon.tsx")).toBe(true);
  });

  it("lets ordinary member pages and components group as before", () => {
    for (const name of ["Roles", "Events", "Badges", "Stay"]) expect(mayJoinSharedGroup(page(name)), name).toBe(true);
    expect(mayJoinSharedGroup("/repo/client/src/components/admin/TokensTab.test.tsx")).toBe(true);
    expect(PRIVILEGED_PAGE.test("/repo/client/src/components/Treasury.tsx")).toBe(false);
  });

  it("is asked by every page and component group rule in vite.config.ts", () => {
    const config = fs.readFileSync(path.join(process.cwd(), "vite.config.ts"), "utf8");
    // The page rule that hands out smallpages, shopfront and midpages.
    expect(config).toMatch(/if \(SMALL_PAGE\.test\(id\)[^\n]*mayJoinSharedGroup\(id\)\) \{/);
    // The three module group rules: smallGroupOf, the "keyset-" candidate filter, and lazyGroupPlan's `free`
    // (the "lazy-" groups and every module that rides in a group).
    expect(config.match(/!SMALL_GROUP_NEVER\.test\(id\) &&\s*\n\s*mayJoinSharedGroup\(id\) &&/g)?.length).toBe(3);
  });
});

describe("admin-only code is decided from the router and the import graph", () => {
  const app = fs.readFileSync(path.join(process.cwd(), "client", "src", "App.tsx"), "utf8");
  const routes = lazyRoutesFromApp(app);

  it("reads the admin roots off App.tsx: /admin and /admin/mint, never a page a non-admin opens", () => {
    expect(adminRootPages(routes)).toEqual(["pages/Admin", "pages/Mint"]);
    for (const p of ["/journey-to-launch", "/setup-game", "/admin/review", "/admin/proposals", "/admin/role-progress"]) expect(isAdminRoute(p), p).toBe(false);
    expect(isAdminRoute("/admin")).toBe(true);
    expect(isAdminRoute("/admin/mint")).toBe(true);
    expect(isAdminRoute("/administer")).toBe(false);
  });

  it("names only pages the router still draws under /admin", () => {
    // A stale name here would hold nothing back and say it did.
    const paths = routes.map((r) => r.path);
    for (const p of Object.keys(OPENED_BY_OTHERS)) expect(paths, p).toContain(p);
  });

  it("counts a page a member route also draws as a member page", () => {
    expect(adminRootPages([{ path: "/admin/x", module: "pages/X" }, { path: "/x", module: "pages/X" }, { path: "/admin/y", module: "pages/Y" }])).toEqual(["pages/Y"]);
  });

  // A small graph: the entry imports the router, which lazily imports a member page and the admin page.
  const graph = (extra: Record<string, Partial<GraphNode>> = {}) => {
    const nodes: Record<string, GraphNode> = {
      entry: { importedIds: ["router"], dynamicallyImportedIds: [], isEntry: true },
      router: { importedIds: [], dynamicallyImportedIds: ["member", "admin"], isEntry: false },
      member: { importedIds: ["shared"], dynamicallyImportedIds: [], isEntry: false },
      admin: { importedIds: ["shared", "tab"], dynamicallyImportedIds: ["lazyTab"], isEntry: false },
      shared: { importedIds: [], dynamicallyImportedIds: [], isEntry: false },
      tab: { importedIds: ["tabHelper"], dynamicallyImportedIds: [], isEntry: false },
      tabHelper: { importedIds: [], dynamicallyImportedIds: [], isEntry: false },
      lazyTab: { importedIds: [], dynamicallyImportedIds: [], isEntry: false },
    };
    for (const [id, n] of Object.entries(extra)) nodes[id] = { ...(nodes[id] ?? { importedIds: [], dynamicallyImportedIds: [], isEntry: false }), ...n };
    const ids = Object.keys(nodes);
    return adminOnlyModules(ids, (id) => nodes[id] ?? null, new Set(["admin"]), "router");
  };

  it("holds back only the router's lazy import of a root, so what only the root reaches is admin-only", () => {
    expect(Array.from(graph()).sort()).toEqual(["admin", "lazyTab", "tab", "tabHelper"]);
  });

  it("makes a module a member's the moment any member page can import it, statically or lazily", () => {
    expect(Array.from(graph({ member: { importedIds: ["shared", "tab"] } })).sort()).toEqual(["admin", "lazyTab"]);
    expect(Array.from(graph({ member: { importedIds: ["shared"], dynamicallyImportedIds: ["lazyTab"] } })).sort()).toEqual(["admin", "tab", "tabHelper"]);
    // A member page that lazily imports the admin page itself makes all of it a member's.
    expect(graph({ member: { importedIds: ["shared"], dynamicallyImportedIds: ["admin"] } }).size).toBe(0);
  });

  describe("the built files a member can fetch", () => {
    const A = "/r/client/src/components/admin/A.tsx";
    const mod = (n: number) => ({ renderedLength: n });
    const chunk = (fileName: string, o: Partial<BuiltChunk>): BuiltChunk => ({ fileName, isEntry: false, imports: [], dynamicImports: [], modules: {}, ...o });
    const built = (smallui: BuiltChunk["modules"]) => [
      chunk("index.js", { isEntry: true, imports: ["first-page.js"] }),
      chunk("first-page.js", { modules: { "/r/client/src/App.tsx": mod(10) }, dynamicImports: ["Admin.js", "Home.js"] }),
      chunk("Home.js", { modules: { "/r/client/src/pages/Home.tsx": mod(10) }, imports: ["smallui.js"] }),
      chunk("smallui.js", { modules: smallui }),
      // Only the admin page asks for this file, so a member never does, whatever it holds.
      chunk("Admin.js", { modules: { "/r/client/src/pages/Admin.tsx": mod(10), [A]: mod(10), "/r/shared/x.ts": mod(10) } }),
    ];
    const leaks = (chunks: BuiltChunk[], routerOnly = true) =>
      adminCodeOnMemberFiles(chunks, new Set(["/r/client/src/pages/Admin.tsx", A]), new Set(["/r/client/src/pages/Admin.tsx"]), "/r/client/src/App.tsx", () => routerOnly).map((l) => l.fileName);

    it("passes admin code that rides only the admin page's files", () => {
      expect(leaks(built({ "/r/client/src/components/B.tsx": mod(10) }))).toEqual([]);
    });

    it("fails a member file that carries an admin-only module, and only our own rendered source counts", () => {
      expect(leaks(built({ [A]: mod(10), "/r/client/src/components/B.tsx": mod(10) }))).toEqual(["smallui.js"]);
      // Tree-shaken to nothing, it is not in that file.
      expect(leaks(built({ [A]: mod(0), "/r/client/src/components/B.tsx": mod(10) }))).toEqual([]);
    });

    it("counts the admin page's own file a member's once anything but the router imports the page", () => {
      expect(leaks(built({}), false)).toEqual(["Admin.js"]);
    });
  });

  it("is asked by the group rules and checked on the finished bundle in vite.config.ts", () => {
    const config = fs.readFileSync(path.join(process.cwd(), "vite.config.ts"), "utf8");
    expect(config).toMatch(/mayJoinSharedGroup\(id\) &&[^\n]*\n\s*!adminOnlyIds\?\.has\(id\) &&/);
    expect(config).toMatch(/if \(SMALL_PAGE\.test\(id\)[^\n]*!adminOnly\.has\(id\)/);
    expect(config).toMatch(/lazy-\$\{adminOnlyIds\?\.has\(id\) \? "admin-" : ""\}/);
    expect(config).toMatch(/const leaks = adminCodeOnMemberFiles\(/);
  });
});
