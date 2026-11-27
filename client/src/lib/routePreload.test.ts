import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import {
  type ChunkFacts,
  LANDING_ROUTE,
  landingRoutes,
  lazyRoutesFromApp,
  moduleKey,
  routePattern,
  routePreloadScript,
  routePreloadTable,
} from "./routePreload";

const APP = fs.readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");

describe("landingRoutes, against the real App.tsx", () => {
  it("adds the landing page, because App.tsx draws Home from LandingRoute and loads it lazily", () => {
    expect(landingRoutes(APP)).toEqual([LANDING_ROUTE]);
    expect(LANDING_ROUTE).toEqual({ path: "/", module: "pages/Home" });
  });

  it("control: adds nothing once App.tsx stops loading Home that way", () => {
    expect(landingRoutes(APP.replace(/import\(\s*["']\.\/pages\/Home["']\s*\)/g, 'import("./pages/Welcome")'))).toEqual([]);
    expect(landingRoutes(APP.replace(/component=\{LandingRoute\}/g, "component={Elsewhere}"))).toEqual([]);
  });

  it("puts Home's chunk and its parts in the table for / only", () => {
    const chunks: ChunkFacts[] = [
      { fileName: "assets/index.js", imports: [], isEntry: true, isDynamicEntry: false, facadeModuleId: "/r/client/src/main.tsx", css: [] },
      { fileName: "assets/Home.js", imports: [], isEntry: false, isDynamicEntry: true, facadeModuleId: "/r/client/src/pages/Home.tsx", css: [], copyParts: ["abcdef123456"] },
    ];
    const t = routePreloadTable(landingRoutes(APP), chunks);
    expect(t.routes).toEqual([["^/?$", [0, 1]]]);
    expect(t.files).toEqual(["assets/Home.js", "api/i18n/catalog/en/part/abcdef123456"]);
  });
});

describe("lazyRoutesFromApp, against the real App.tsx", () => {
  const routes = lazyRoutesFromApp(APP);
  const of = (p: string) => routes.find((r) => r.path === p)?.module;

  it("reads the public routes members land on", () => {
    expect(of("/quests")).toBe("pages/Quests");
    expect(of("/quests/:id")).toBe("pages/QuestDetail");
    expect(of("/visit")).toBe("pages/Visit");
    expect(of("/investor")).toBe("pages/InvestorJourney");
    expect(of("/modules")).toBe("pages/Modules");
    expect(of("/events")).toBe("pages/Events");
    expect(of("/request-membership")).toBe("pages/RequestMembership");
  });

  it("leaves out the eager pages, which the main bundle already carries", () => {
    expect(of("/")).toBeUndefined();
    expect(of("/login")).toBeUndefined();
    expect(of("/404")).toBeUndefined();
  });

  it("finds nearly every route, so a change in App.tsx's shape cannot silently empty the table", () => {
    const declared = [...APP.matchAll(/<Route\s+path=/g)].length;
    // Everything except the eager three (/, /login, /404), the /seat-applications/:id redirect
    // to /role-applications/:id (members say role, 2026-10-21) and the /roles/draft redirect
    // to /roles/select (the board is "select" now, 2026-11-10), the /join and /apply redirects to /roles
    // and the /tokens redirect to /wallet (one page called Wallet, 2026-11-25), and the /review, /decisions and
    // /decisions/:id redirects into /governance (the lead, 26 Nov 2026: call it governance), the /budget redirect
    // to /governance/treasury#cash-budget (the cash budget folded into Governance, the lead, 27 Nov 2026), the
    // /role-measures redirect to /circles#role-measures (folded into Circles & Roles, 27 Nov 2026), the
    // /game-mechanics redirect to /governance/how#game-mechanics (Game Mechanics folded into How we work together,
    // 26 Nov 2026), and the four old addresses of Rights and agreements (/exit-policy, /good-neighbor,
    // /resident-rights, /steward-rights, redirects to /rights since the rights fold, 27 Nov 2026) is lazy today.
    expect(routes.length).toBeGreaterThanOrEqual(declared - 18);
    expect(routes.length).toBeGreaterThan(60);
  });

  it("sends /join and /apply to /roles, the one front door", () => {
    for (const from of ["/join", "/apply"]) {
      expect(APP).toMatch(new RegExp(`<Route path="${from}">\\{\\(\\) => <Redirect to="/roles" replace />\\}</Route>`));
    }
  });

  it("keeps App.tsx's order, because wouter's Switch takes the first match", () => {
    const i = (p: string) => routes.findIndex((r) => r.path === p);
    expect(i("/profile/characters")).toBeLessThan(i("/profile/:handle"));
    expect(i("/governance/decisions")).toBeLessThan(i("/governance/decisions/:id"));
  });

  it("reads a route that renders a lazy page with props, and leaves a redirect out", () => {
    expect(of("/training/steward")).toBe("pages/Training");
    expect(of("/training/resident")).toBe("pages/Training");
    expect(of("/join")).toBeUndefined();
    expect(of("/roles/draft")).toBeUndefined();
  });

  it("reads the email pages, which import one module three ways", () => {
    expect(of("/email/preferences")).toBe("pages/EmailPages");
  });
});

describe("routePattern", () => {
  const m = (p: string, url: string) => new RegExp(routePattern(p), "i").test(url);
  it("matches a static path with or without a trailing slash, and nothing longer", () => {
    expect(m("/quests", "/quests")).toBe(true);
    expect(m("/quests", "/quests/")).toBe(true);
    expect(m("/quests", "/quests/abc")).toBe(false);
    expect(m("/quests", "/questsx")).toBe(false);
  });
  it("treats a :param as one segment", () => {
    expect(m("/quests/:id", "/quests/abc-1")).toBe(true);
    expect(m("/quests/:id", "/quests/a/b")).toBe(false);
    expect(m("/quests/:id", "/quests")).toBe(false);
  });
  it("matches case-insensitively, as wouter does", () => {
    expect(m("/request-membership", "/Request-Membership")).toBe(true);
  });
});

describe("moduleKey", () => {
  it("normalises Windows and POSIX ids to a client/src-relative key", () => {
    expect(moduleKey("C:\\w\\client\\src\\pages\\Quests.tsx")).toBe("pages/Quests");
    expect(moduleKey("/w/client/src/pages/Quests.tsx?v=1")).toBe("pages/Quests");
    expect(moduleKey("/w/node_modules/x/index.js")).toBeNull();
  });
});

describe("routePreloadTable and the emitted script", () => {
  const chunk = (fileName: string, o: Partial<ChunkFacts> = {}): ChunkFacts => ({
    fileName, imports: [], isEntry: false, isDynamicEntry: false, facadeModuleId: null, css: [], ...o,
  });
  const chunks: ChunkFacts[] = [
    chunk("assets/index-E.js", { isEntry: true, imports: ["assets/icons-I.js"], css: ["assets/index-C.css"] }),
    chunk("assets/icons-I.js"),
    chunk("assets/Quests-Q.js", { isDynamicEntry: true, facadeModuleId: "/w/client/src/pages/Quests.tsx", imports: ["assets/icons-I.js", "assets/QuestCard-K.js"] }),
    chunk("assets/QuestCard-K.js", { imports: ["assets/shared-S.js"] }),
    chunk("assets/shared-S.js"),
    chunk("assets/Events-V.js", { isDynamicEntry: true, facadeModuleId: "/w/client/src/pages/Events.tsx", imports: ["assets/shared-S.js"], css: ["assets/Events-V.css"] }),
  ];
  const routes = [
    { path: "/quests", module: "pages/Quests" },
    { path: "/events", module: "pages/Events" },
    { path: "/ghost", module: "pages/NoSuchPage" },
  ];
  const table = routePreloadTable(routes, chunks);
  const filesFor = (url: string) => {
    for (const [re, ids] of table.routes) if (new RegExp(re, "i").test(url)) return ids.map((i) => table.files[i]);
    return [];
  };

  it("lists the page chunk and everything it imports, transitively", () => {
    expect(filesFor("/quests")).toEqual(["assets/Quests-Q.js", "assets/QuestCard-K.js", "assets/shared-S.js"]);
  });

  it("never lists what index.html already loads", () => {
    for (const [, ids] of table.routes) {
      for (const i of ids) expect(["assets/index-E.js", "assets/icons-I.js", "assets/index-C.css"]).not.toContain(table.files[i]);
    }
  });

  it("carries a page's CSS", () => {
    expect(filesFor("/events")).toEqual(["assets/Events-V.js", "assets/Events-V.css", "assets/shared-S.js"]);
  });

  it("lists a CSS-only chunk's stylesheet and never its script, which Vite does not write", () => {
    // components/motion/motion.css shipped as a chunk of CSS alone: the table named its script, Vite removed it, and
    // every page preloaded a missing /assets/motion-*.js (main at 004e28f, 24 Nov 2026).
    const withCssChunk: ChunkFacts[] = [
      ...chunks.map((c) => (c.fileName === "assets/QuestCard-K.js" ? { ...c, imports: [...c.imports, "assets/motion-M.js"] } : c)),
      chunk("assets/motion-M.js", { cssOnly: true, css: ["assets/motion-M.css"] }),
    ];
    const t = routePreloadTable(routes, withCssChunk);
    const ids = t.routes.find(([re]) => new RegExp(re, "i").test("/quests"))![1].map((i) => t.files[i]);
    expect(ids).toContain("assets/motion-M.css");
    expect(ids).not.toContain("assets/motion-M.js");
    expect(t.files).not.toContain("assets/motion-M.js");
  });

  it("drops a route whose page has no chunk, rather than guessing", () => {
    expect(filesFor("/ghost")).toEqual([]);
    expect(table.routes).toHaveLength(2);
  });

  it("emits a script that adds exactly those links for the visited path, and none elsewhere", () => {
    const run = (pathname: string) => {
      const added: Array<Record<string, string>> = [];
      const document = {
        createElement: () => ({}) as Record<string, string>,
        head: { appendChild: (l: Record<string, string>) => added.push(l) },
      };
      vm.runInNewContext(routePreloadScript(table, "/"), { location: { pathname }, document });
      return added;
    };
    expect(run("/quests").map((l) => [l.rel, l.href, l.crossOrigin])).toEqual([
      ["modulepreload", "/assets/Quests-Q.js", ""],
      ["modulepreload", "/assets/QuestCard-K.js", ""],
      ["modulepreload", "/assets/shared-S.js", ""],
    ]);
    const css = run("/events").find((l) => l.href.endsWith(".css"))!;
    expect([css.rel, css.as, css.crossOrigin]).toEqual(["preload", "style", ""]);
    expect(run("/")).toEqual([]);
    expect(run("/nowhere")).toEqual([]);
  });

  /*
   * A chunk whose long English moved to a part (client/src/i18n/copySplit.ts)
   * awaits that part before it runs. Fetching it beside the JS keeps the move
   * free of an extra round trip. `crossOrigin = ""` is "anonymous", which is
   * what a plain same-origin fetch() asks for, so the preload is reused.
   */
  it("preloads the English parts of a route's chunks as fetches", () => {
    const withParts: ChunkFacts[] = chunks.map((c) =>
      c.fileName === "assets/QuestCard-K.js" ? { ...c, copyParts: ["Part_K-12345"] } : c.fileName === "assets/index-E.js" ? { ...c, copyParts: ["BootPart0000"] } : c,
    );
    const t = routePreloadTable(routes, withParts);
    const ids = t.routes.find(([re]) => new RegExp(re, "i").test("/quests"))![1];
    expect(ids.map((i) => t.files[i])).toContain("api/i18n/catalog/en/part/Part_K-12345");
    expect(t.files).not.toContain("api/i18n/catalog/en/part/BootPart0000");
    const added: Array<Record<string, string>> = [];
    vm.runInNewContext(routePreloadScript(t, "/"), {
      location: { pathname: "/quests" },
      document: { createElement: () => ({}), head: { appendChild: (l: Record<string, string>) => added.push(l) } },
    });
    const part = added.find((l) => l.href.includes("/part/"))!;
    expect([part.rel, part.as, part.href, part.crossOrigin]).toEqual(["preload", "fetch", "/api/i18n/catalog/en/part/Part_K-12345", ""]);
  });
});
