/**
 * The size gate's own test: the admin and member split, and the gate with and
 * without the two new numbers.
 *
 * WHY IT EXISTS. scripts/check-dist-budget.mjs sat in the list of guards with
 * no test that runs them, because it measures a built tree and a self-test has
 * none. Since the founder's ruling of 28 Nov 2026 it also decides which built
 * files only an admin page loads, and a rule like that is exactly the kind a
 * gate can get quietly wrong in the direction that helps: call a member's
 * chunk admin-only and the members' ceiling stops seeing it. So every rule is
 * driven here, on small hand-made chunk graphs for the pure part
 * (scripts/lib/distSplit.mjs) and on a small built-looking tree for the gate
 * itself, through `--root`.
 *
 * WHAT IT HOLDS:
 *   - a shared chunk is a member chunk; a chunk behind two admin roots is
 *     admin-only; a lazy import from a member chunk into an admin file makes
 *     that file a member chunk; a file both sides name is a member file; a
 *     file nothing names is counted on the members' side;
 *   - the planted import, on the fixture: one new import from a member page
 *     into an admin-only chunk moves that chunk to the members' side and fails
 *     a members' ceiling set just above the weight before the plant
 *     (scripts/plant-admin-import.mjs does the same on the real build);
 *   - with the two new numbers unset, the gate's exit code is the single
 *     total's, and the split is only printed;
 *   - the road to launch's paths, the one hand-written list, are still routes
 *     in client/src/App.tsx, and the router has no route the reader cannot read.
 *
 * Run: node scripts/check-dist-budget.test.mjs
 */
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  GARDEN_DIR,
  ROAD_TO_LAUNCH_PATHS,
  charged,
  classifyDist,
  firstViewOf,
  isAdminPath,
  memberChunksHolding,
  memberRoutesLoading,
  preloadFilesForMembers,
  readRoutePreloadTable,
  routePatternOf,
  routesFromApp,
  splitTotals,
  textNames,
  unreadRoutes,
} from "./lib/distSplit.mjs";

const HERE = import.meta.dirname;
const GATE = path.join(HERE, "check-dist-budget.mjs");

let checks = 0;
let failures = 0;
function check(name, fn) {
  checks += 1;
  try {
    fn();
    console.log(`ok    ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`FAIL  ${name}\n      ${String(err.message).split("\n").join("\n      ")}`);
  }
}

/* ------------------------------------------------------------------ the pure rule */

/** A small router: two member pages, two admin pages, one page on the road to launch. */
const APP = `
const Quests = lazyPage(() => import("./pages/Quests"));
const Profile = lazyPage(() => import("./pages/Profile"));
const Admin = lazyPage(() => import("./pages/Admin"));
const Mint = lazyPage(() => import("./pages/Mint"));
const Road = lazyPage(() => import("./pages/JourneyToLaunch"));
<Route path="/" component={LandingRoute} />
<Route path="/quests" component={Quests} />
<Route path="/profile" component={Profile} />
<Route path="/admin" component={Admin} />
<Route path="/admin/mint" component={Mint} />
<Route path="/journey-to-launch" component={Road} />
<Route path="/old">{() => <Redirect to="/quests" replace />}</Route>
`;
const ROUTES = routesFromApp(APP);
const ROAD = ["/journey-to-launch"];

const chunk = (file, o = {}) => ({ file, isEntry: false, isDynamicEntry: false, facade: null, imports: [], dynamicImports: [], css: [], assets: [], modules: {}, ...o });

/**
 * The graph every case starts from:
 *   entry -> first-page (holds the router) -> lazily: quests, profile, admin, mint, road
 *   quests, profile and admin all import `shared`; admin and mint both import `desk`;
 *   admin lazily imports `tab`.
 */
function baseGraph() {
  return {
    chunks: [
      chunk("assets/index.js", { isEntry: true, imports: ["assets/first-page.js"], modules: { "client/src/main.tsx": 10 } }),
      chunk("assets/first-page.js", {
        dynamicImports: ["assets/quests.js", "assets/profile.js", "assets/admin.js", "assets/mint.js", "assets/road.js"],
        modules: { "client/src/App.tsx": 100 },
      }),
      chunk("assets/quests.js", { imports: ["assets/first-page.js", "assets/shared.js"], modules: { "client/src/pages/Quests.tsx": 50 } }),
      chunk("assets/profile.js", { imports: ["assets/first-page.js", "assets/shared.js"], modules: { "client/src/pages/Profile.tsx": 50 } }),
      chunk("assets/shared.js", { modules: { "client/src/lib/shared.ts": 20 } }),
      chunk("assets/admin.js", { imports: ["assets/first-page.js", "assets/shared.js", "assets/desk.js"], dynamicImports: ["assets/tab.js"], css: ["assets/admin.css"], modules: { "client/src/pages/Admin.tsx": 500 } }),
      chunk("assets/mint.js", { imports: ["assets/first-page.js", "assets/desk.js"], modules: { "client/src/pages/Mint.tsx": 60 } }),
      chunk("assets/desk.js", { modules: { "client/src/components/admin/Desk.tsx": 40 } }),
      chunk("assets/tab.js", { imports: ["assets/first-page.js"], modules: { "client/src/components/admin/AgentsTab.tsx": 80 } }),
      chunk("assets/road.js", { imports: ["assets/first-page.js"], modules: { "client/src/pages/JourneyToLaunch.tsx": 70 } }),
    ],
    lazy: {},
  };
}
const FILES = [
  { path: "index.html", bytes: 900 },
  { path: "assets/index.js", bytes: 1000 },
  { path: "assets/first-page.js", bytes: 5000 },
  { path: "assets/quests.js", bytes: 3000 },
  { path: "assets/profile.js", bytes: 3000 },
  { path: "assets/shared.js", bytes: 100 },
  { path: "assets/admin.js", bytes: 9000 },
  { path: "assets/mint.js", bytes: 2000 },
  { path: "assets/desk.js", bytes: 600 },
  { path: "assets/tab.js", bytes: 4097 },
  { path: "assets/road.js", bytes: 2500 },
  { path: "assets/admin.css", bytes: 300 },
];
const INDEX_REFS = ["assets/index.js", "assets/first-page.js"];
const split = (graph = baseGraph(), extra = {}) => classifyDist({ graph, routes: ROUTES, files: FILES, indexRefs: INDEX_REFS, roadPaths: ROAD, ...extra });
const sideOf = (s, file) => s.side.get(file);

check("routesFromApp reads a lazy page, an eager one and a redirect, each as itself", () => {
  assert.deepStrictEqual(ROUTES.map((r) => `${r.path}=${r.kind}`), ["/=eager", "/quests=lazy", "/profile=lazy", "/admin=lazy", "/admin/mint=lazy", "/journey-to-launch=lazy", "/old=redirect"]);
  assert.strictEqual(ROUTES.find((r) => r.path === "/admin").page, "client/src/pages/Admin");
  assert.deepStrictEqual(unreadRoutes(ROUTES), []);
});

check("routesFromApp follows a named loader and an inline route with props", () => {
  const r = routesFromApp(`
    const loadHome = () => import("./pages/Home");
    const Home = lazy(loadHome);
    const Training = lazyPage(() => import("./pages/Training"));
    const Door = lazyPage(() => import("./pages/rites/Door").then((m) => ({ default: m.Door })));
    <Route path="/home" component={Home} />
    <Route path="/training/steward">{() => <Training track="steward" />}</Route>
    <Route path="/door/:code" component={Door} />
    <Route path="/changes/:id">{(p) => <Redirect to={x(p.id)} replace />}</Route>`);
  assert.deepStrictEqual(r.map((x) => `${x.path}=${x.kind}:${x.page}`), [
    "/home=lazy:client/src/pages/Home",
    "/training/steward=lazy:client/src/pages/Training",
    "/door/:code=lazy:client/src/pages/rites/Door",
    "/changes/:id=redirect:null",
  ]);
});

check("a route in a shape the reader does not know is reported, never skipped", () => {
  const r = routesFromApp(`<Route path="/admin/new" render={something} />`);
  assert.deepStrictEqual(unreadRoutes(r), ["/admin/new"]);
  const computed = routesFromApp(`<Route path="/quests" component={Quests} />\n<Route path={ADMIN_BASE} component={Admin} />`);
  assert.strictEqual(computed.length, 2, "a path that is not a plain string still counts as a route");
  assert.deepStrictEqual(unreadRoutes(computed), ["<Route path={ADMIN_BASE} component={Admin} />"]);
});

check("an admin path is /admin, anything under it, or a road path, and nothing that only starts with the letters", () => {
  assert.ok(isAdminPath("/admin") && isAdminPath("/admin/mint") && isAdminPath("/journey-to-launch", ROAD));
  assert.ok(!isAdminPath("/administer") && !isAdminPath("/quests") && !isAdminPath("/journey-to-launch", []));
});

check("the admin pages' chunks and what only they reach are admin-only", () => {
  const s = split();
  for (const f of ["assets/admin.js", "assets/mint.js", "assets/road.js", "assets/tab.js", "assets/desk.js", "assets/admin.css"]) assert.strictEqual(sideOf(s, f), "admin", f);
  for (const f of ["index.html", "assets/index.js", "assets/first-page.js", "assets/quests.js", "assets/profile.js"]) assert.strictEqual(sideOf(s, f), "member", f);
});

check("a shared chunk is a member chunk, though an admin page imports it too", () => {
  assert.strictEqual(sideOf(split(), "assets/shared.js"), "member");
});

check("a chunk behind two admin roots is admin-only, and both own it", () => {
  const s = split();
  assert.strictEqual(sideOf(s, "assets/desk.js"), "admin");
  assert.deepStrictEqual(s.adminFiles.find((f) => f.path === "assets/desk.js").owners, ["/admin", "/admin/mint"]);
  assert.deepStrictEqual(s.adminFiles.find((f) => f.path === "assets/tab.js").owners, ["/admin"]);
});

check("a lazy import from a member chunk into an admin-looking file makes that file a member chunk", () => {
  const g = baseGraph();
  g.chunks.find((c) => c.file === "assets/quests.js").dynamicImports.push("assets/tab.js");
  const s = split(g);
  assert.strictEqual(sideOf(s, "assets/tab.js"), "member");
  assert.strictEqual(sideOf(s, "assets/admin.js"), "admin", "the admin page itself stays behind its route");
});

check("a static import from a member chunk does the same", () => {
  const g = baseGraph();
  g.chunks.find((c) => c.file === "assets/profile.js").imports.push("assets/desk.js");
  assert.strictEqual(sideOf(split(g), "assets/desk.js"), "member");
});

check("an admin page a member chunk imports is a member chunk, with everything it reaches", () => {
  const g = baseGraph();
  g.chunks.find((c) => c.file === "assets/quests.js").dynamicImports.push("assets/admin.js");
  const s = split(g);
  for (const f of ["assets/admin.js", "assets/tab.js", "assets/desk.js", "assets/admin.css"]) assert.strictEqual(sideOf(s, f), "member", f);
  assert.strictEqual(s.roots.find((r) => r.path === "/admin").heldBack, false);
  assert.ok(s.notes.some((n) => n.includes("/admin") && n.includes("assets/quests.js")), "the note names the member chunk that imports it");
  assert.strictEqual(sideOf(s, "assets/road.js"), "admin", "another admin root is untouched");
});

check("an admin page that shares its chunk with a member page is a member chunk", () => {
  const g = baseGraph();
  g.chunks = g.chunks.filter((c) => c.file !== "assets/mint.js");
  g.chunks.find((c) => c.file === "assets/quests.js").modules["client/src/pages/Mint.tsx"] = 60;
  g.chunks.find((c) => c.file === "assets/first-page.js").dynamicImports = ["assets/quests.js", "assets/profile.js", "assets/admin.js", "assets/road.js"];
  const s = classifyDist({ graph: g, routes: ROUTES, files: FILES.filter((f) => f.path !== "assets/mint.js"), indexRefs: INDEX_REFS, roadPaths: ROAD });
  assert.strictEqual(sideOf(s, "assets/quests.js"), "member");
  const mint = s.roots.find((r) => r.path === "/admin/mint");
  assert.strictEqual(mint.heldBack, false);
  assert.match(mint.why, /shares a chunk with 1 member page/);
});

check("another module in the router's own chunk importing an admin page moves it to the members' side", () => {
  const g = baseGraph();
  g.chunks.find((c) => c.file === "assets/first-page.js").modules["client/src/components/Layout.tsx"] = 30;
  g.lazy = { "client/src/pages/Mint.tsx": { importers: [], dynamicImporters: ["client/src/App.tsx", "client/src/components/Layout.tsx"] } };
  const s = split(g);
  assert.strictEqual(sideOf(s, "assets/mint.js"), "member");
  assert.strictEqual(sideOf(s, "assets/admin.js"), "admin");
});

check("an importer outside the router's chunk does not, on that fact alone: the chunk graph decides", () => {
  const g = baseGraph();
  g.lazy = { "client/src/pages/Mint.tsx": { importers: [], dynamicImporters: ["client/src/App.tsx", "client/src/pages/Admin.tsx"] } };
  assert.strictEqual(sideOf(split(g), "assets/mint.js"), "admin");
});

check("a file both sides name is a member file; a file only an admin file names is admin-only", () => {
  const files = [...FILES, { path: "assets/both.woff2", bytes: 10 }, { path: "assets/crest.webp", bytes: 10 }, { path: "assets/site.css", bytes: 10 }];
  const g = baseGraph();
  g.chunks.find((c) => c.file === "assets/first-page.js").css.push("assets/site.css");
  const textRefs = [
    { from: "assets/admin.css", to: "assets/both.woff2" },
    { from: "assets/site.css", to: "assets/both.woff2" },
    { from: "assets/admin.css", to: "assets/crest.webp" },
  ];
  const s = classifyDist({ graph: g, routes: ROUTES, files, indexRefs: INDEX_REFS, textRefs, roadPaths: ROAD });
  assert.strictEqual(sideOf(s, "assets/both.woff2"), "member");
  assert.strictEqual(sideOf(s, "assets/crest.webp"), "admin");
  assert.deepStrictEqual(s.adminFiles.find((f) => f.path === "assets/crest.webp").owners, ["/admin"], "a file is owned by the route that owns what names it");
});

check("a file index.html names is a member file, whoever else names it", () => {
  const files = [...FILES, { path: "assets/face.woff2", bytes: 10 }];
  const s = classifyDist({ graph: baseGraph(), routes: ROUTES, files, indexRefs: [...INDEX_REFS, "assets/face.woff2"], textRefs: [{ from: "assets/admin.css", to: "assets/face.woff2" }], roadPaths: ROAD });
  assert.strictEqual(sideOf(s, "assets/face.woff2"), "member");
});

check("a chunk's text spelling out a lazy import's stylesheet does not make it a member file: the graph places it", () => {
  // Vite writes the preload list beside every lazy import, so the router's chunk names the Admin page's CSS in its text.
  const s = split(baseGraph(), { textRefs: [{ from: "assets/first-page.js", to: "assets/admin.css" }] });
  assert.strictEqual(sideOf(s, "assets/admin.css"), "admin");
});

check("a chunk's text does count for a file the graph places nowhere, such as one copied in from client/public", () => {
  const files = [...FILES, { path: "images/seal.webp", bytes: 10 }, { path: "images/desk.webp", bytes: 10 }];
  const textRefs = [
    { from: "assets/quests.js", to: "images/seal.webp" },
    { from: "assets/admin.js", to: "images/desk.webp" },
  ];
  const s = classifyDist({ graph: baseGraph(), routes: ROUTES, files, indexRefs: INDEX_REFS, textRefs, roadPaths: ROAD });
  assert.strictEqual(sideOf(s, "images/seal.webp"), "member");
  assert.strictEqual(sideOf(s, "images/desk.webp"), "admin");
});

check("a file nothing names is reported apart and counted on the members' side", () => {
  const files = [...FILES, { path: "stray.txt", bytes: 5000 }];
  const s = classifyDist({ graph: baseGraph(), routes: ROUTES, files, indexRefs: INDEX_REFS, roadPaths: ROAD });
  assert.strictEqual(sideOf(s, "stray.txt"), "unnamed");
  assert.deepStrictEqual(s.unnamedFiles, ["stray.txt"]);
  const before = splitTotals(split(), 8192);
  const after = splitTotals(s, 8192);
  assert.strictEqual(after.memberChargedBytes - before.memberChargedBytes, 8192, "its two blocks land on the members' side");
  assert.strictEqual(after.adminChargedBytes, before.adminChargedBytes);
});

check("a chunk no route and no page reaches is counted on the members' side too", () => {
  const g = baseGraph();
  g.chunks.push(chunk("assets/orphan.js", { modules: { "client/src/lost.ts": 5 } }));
  const s = classifyDist({ graph: g, routes: ROUTES, files: [...FILES, { path: "assets/orphan.js", bytes: 10 }], indexRefs: INDEX_REFS, roadPaths: ROAD });
  assert.strictEqual(sideOf(s, "assets/orphan.js"), "unnamed");
});

check("the two sides add up to the tree, block for block, with the directories on the members' side", () => {
  const s = split();
  const t = splitTotals(s, 8192);
  const all = FILES.reduce((n, f) => n + charged(f.bytes), 0) + 8192;
  assert.strictEqual(t.memberChargedBytes + t.adminChargedBytes, all);
  // admin.js 9000 -> 12288, mint 4096, desk 4096, tab 4097 -> 8192, road 4096, admin.css 4096
  assert.strictEqual(t.adminChargedBytes, 12288 + 4096 + 4096 + 8192 + 4096 + 4096);
  assert.strictEqual(t.adminFiles, 6);
  assert.strictEqual(t.memberFiles, 6);
});

check("with no router chunk in the graph nothing is held back: every chunk counts as a member's", () => {
  const g = baseGraph();
  delete g.chunks.find((c) => c.file === "assets/first-page.js").modules["client/src/App.tsx"];
  const s = split(g);
  assert.strictEqual(s.admin.files, 0);
  assert.ok(s.notes.some((n) => n.includes("client/src/App.tsx")));
});

check("a road path only counts while it is on the list", () => {
  const s = classifyDist({ graph: baseGraph(), routes: ROUTES, files: FILES, indexRefs: INDEX_REFS, roadPaths: [] });
  assert.strictEqual(sideOf(s, "assets/road.js"), "member");
});

check("a member chunk holding garden code is found from the graph's modules, and an admin-only one is not", () => {
  const g = baseGraph();
  g.chunks.find((c) => c.file === "assets/admin.js").modules[`${GARDEN_DIR}Grounds.tsx`] = 90;
  assert.deepStrictEqual(memberChunksHolding(g, split(g), (id) => id.startsWith(GARDEN_DIR)), []);
  g.chunks.find((c) => c.file === "assets/shared.js").modules[`${GARDEN_DIR}Lantern.tsx`] = 12;
  g.chunks.find((c) => c.file === "assets/shared.js").modules[`${GARDEN_DIR}shaken.ts`] = 0;
  const found = memberChunksHolding(g, split(g), (id) => id.startsWith(GARDEN_DIR));
  assert.deepStrictEqual(found.map((f) => f.chunk), ["assets/shared.js"]);
  assert.deepStrictEqual(found[0].modules.map((m) => m.id), [`${GARDEN_DIR}Lantern.tsx`], "a module the bundler rendered nothing from is not code in the chunk");
});

check("a first view is the first page plus the page chunk and its static imports", () => {
  assert.deepStrictEqual(firstViewOf(baseGraph(), INDEX_REFS, ["assets/admin.js"]), ["assets/admin.js", "assets/desk.js", "assets/first-page.js", "assets/index.js", "assets/shared.js"]);
});

check("the member routes that load a chunk are named nearest first", () => {
  const g = baseGraph();
  g.chunks.find((c) => c.file === "assets/quests.js").dynamicImports.push("assets/tab.js");
  assert.deepStrictEqual(memberRoutesLoading(g, ROUTES, INDEX_REFS, "assets/shared.js", ROAD).firstView, ["/quests", "/profile"]);
  assert.deepStrictEqual(memberRoutesLoading(g, ROUTES, INDEX_REFS, "assets/tab.js", ROAD).later, ["/quests"]);
  assert.strictEqual(memberRoutesLoading(g, ROUTES, INDEX_REFS, "assets/first-page.js", ROAD).firstPage, true);
});

check("a text names a file only as a whole path", () => {
  assert.ok(textNames(`navigator.serviceWorker.register("/sw.js")`, "sw.js"));
  assert.ok(!textNames(`register("/hidden-map-sw.js")`, "sw.js"));
  assert.ok(!textNames(`fetch("/sw.json")`, "sw.js"));
  assert.ok(textNames(`src:url(/assets/face-AbC1.woff2)format("woff2")`, "assets/face-AbC1.woff2"));
});

/* ------------------------------------------------------------------ the route-preload table */

check("the route-preload table names a file for members only through a row that serves a member route", () => {
  const table = { files: ["assets/quests.js", "assets/site.css", "assets/admin.js", "assets/admin.css", "assets/gone.js"], rows: [["^/quests/?$", [0, 1]], ["^/admin/?$", [2, 3]], ["^/retired/?$", [4]]] };
  assert.deepStrictEqual(preloadFilesForMembers(table, ROUTES, ROAD), ["assets/quests.js", "assets/site.css", "assets/gone.js"], "a row for a pattern the router no longer has counts for members, the careful way round");
  assert.deepStrictEqual(preloadFilesForMembers(table, ROUTES, []), ["assets/quests.js", "assets/site.css", "assets/gone.js"]);
  assert.deepStrictEqual(preloadFilesForMembers({ files: ["a"], rows: [["^/journey-to-launch/?$", [0]]] }, ROUTES, ROAD), []);
  assert.deepStrictEqual(preloadFilesForMembers({ files: ["a"], rows: [["^/journey-to-launch/?$", [0]]] }, ROUTES, []), ["a"]);
});

check("text that is not the table is not read as one", () => {
  assert.strictEqual(readRoutePreloadTable(`self.addEventListener("fetch", () => {});`), null);
  assert.strictEqual(readRoutePreloadTable(`  var b = "/", f = ["a.js"], r = [["^/x/?$",[7]]];\n`), null, "an index past the end of the file list");
  assert.deepStrictEqual(readRoutePreloadTable(`(function () {\n  var b = "/", f = ["a.js"], r = [["^/x/?$",[0]]];\n  var p = location.pathname;\n})();\n`), { files: ["a.js"], rows: [["^/x/?$", [0]]] });
});

/*
 * The table is written by client/src/lib/routePreload.ts, which is TypeScript
 * and so out of this file's reach. client/src/lib/routePreloadReader.test.ts
 * holds the reader to the writer itself: it runs the writer's own functions,
 * reads the table back, and compares every route's pattern.
 */

/* ------------------------------------------------------------------ the real router */

const realApp = fs.readFileSync(path.join(HERE, "..", "client", "src", "App.tsx"), "utf8");
const realRoutes = routesFromApp(realApp);

check("every route in client/src/App.tsx is read", () => {
  const declared = (realApp.match(/<Route\s+path=/g) ?? []).length;
  assert.ok(declared >= 100, `only ${declared} routes found in App.tsx, so the pattern stopped matching`);
  assert.strictEqual(realRoutes.length, declared);
  assert.deepStrictEqual(unreadRoutes(realRoutes), [], "a route the reader cannot read: teach routesFromApp the new shape");
});

check("each road to launch path is still a route the router draws from a lazy page", () => {
  assert.ok(ROAD_TO_LAUNCH_PATHS.length > 0);
  for (const p of ROAD_TO_LAUNCH_PATHS) {
    const r = realRoutes.find((x) => x.path === p);
    assert.ok(r, `${p} is in ROAD_TO_LAUNCH_PATHS (scripts/lib/distSplit.mjs) and is no longer a route in client/src/App.tsx. Take it off the list, or name the address the road moved to.`);
    assert.notStrictEqual(r.kind, "unread", `${p} is drawn in a shape the reader does not know`);
  }
});

check("a route's pattern is one segment per parameter, with the trailing slash optional", () => {
  assert.strictEqual(routePatternOf("/admin"), "^/admin/?$");
  assert.strictEqual(routePatternOf("/quests/:id"), "^/quests/[^/]+/?$");
  assert.strictEqual(routePatternOf("/"), "^/?$");
  assert.strictEqual(routePatternOf("/a.b/:id/"), "^/a\\.b/[^/]+/?$");
});

check("/admin is a route with a lazy page of its own", () => {
  const admin = realRoutes.find((r) => r.path === "/admin");
  assert.ok(admin && admin.kind === "lazy" && admin.page, "the /admin route no longer renders a lazily imported page, so nothing would be counted as admin-only");
});

/* ------------------------------------------------------------------ the gate, on a small built tree */

const pad = (text, bytes) => text + " ".repeat(bytes - Buffer.byteLength(text));

/**
 * A tree shaped like a build: 11 files, 68 KB block-charged with its two
 * directories. Admin-only, 4 files: Admin 12, AdminTab 8, admin.css 4, crest
 * 4 = 28 KB. Members, 7 files: 40 KB, of which 8 are the directories and 4
 * the file nothing names.
 */
function tree(dir, o = {}) {
  const put = (rel, text) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  };
  put("client/src/App.tsx", `
    const Quests = lazyPage(() => import("./pages/Quests"));
    const Admin = lazyPage(() => import("./pages/Admin"));
    <Route path="/quests" component={Quests} />
    <Route path="/admin" component={Admin} />
  `);
  const preloadTag = o.preload ? `<script async src="/assets/route-preload-r.js"></script>` : "";
  put("dist/public/index.html", pad(`<script type="module" src="/assets/index-a.js"></script><link rel="modulepreload" href="/assets/first-page-b.js"><link rel="preload" href="/assets/both-h.woff2">${preloadTag}`, 900));
  put("dist/public/assets/index-a.js", pad(`import"./first-page-b.js";`, 1000));
  // o.mapDeps: the list Vite writes beside a lazy import, which spells out the target's stylesheet in the importer's text.
  put("dist/public/assets/first-page-b.js", pad(`import("./Quests-c.js");import("./Admin-d.js");${o.mapDeps ? `const deps=["assets/Admin-d.js","assets/admin-g.css"];` : ""}`, 5000));
  // o.preload: one more script index.html loads that is no chunk, 4 KB on the members' side: the route-preload table, or text that is not one.
  if (o.preload === "table") put("dist/public/assets/route-preload-r.js", pad(`(function () {\n  var b = "/", f = ["assets/Quests-c.js","assets/shared-f.js","assets/Admin-d.js","assets/admin-g.css"], r = [["^/quests/?$",[0,1]],["^/admin/?$",${o.preloadShort ? "[2,3]" : "[2,1,3]"}]];\n  var p = location.pathname;\n})();\n`, 500));
  if (o.preload === "text") put("dist/public/assets/route-preload-r.js", pad(`var list = ["assets/Quests-c.js","assets/admin-g.css"];`, 500));
  put("dist/public/assets/Quests-c.js", pad(`import"./first-page-b.js";import"./shared-f.js";`, 3000));
  put("dist/public/assets/shared-f.js", pad(`export{};`, 100));
  put("dist/public/assets/Admin-d.js", pad(`import"./first-page-b.js";import"./shared-f.js";import("./AdminTab-e.js");const crest="/assets/crest-i.webp";`, 9000));
  put("dist/public/assets/AdminTab-e.js", pad(`export{};`, 4097));
  put("dist/public/assets/admin-g.css", pad(`@font-face{src:url(/assets/both-h.woff2)}`, 300));
  put("dist/public/assets/both-h.woff2", pad("f", 10));
  put("dist/public/assets/crest-i.webp", pad("i", 10));
  put("dist/public/stray.txt", pad("s", 10));
  const graph = {
    version: 1,
    chunks: [
      chunk("assets/index-a.js", { isEntry: true, imports: ["assets/first-page-b.js"], modules: { "client/src/main.tsx": 10 } }),
      chunk("assets/first-page-b.js", { dynamicImports: ["assets/Quests-c.js", "assets/Admin-d.js"], modules: { "client/src/App.tsx": 100 } }),
      chunk("assets/Quests-c.js", { facade: "client/src/pages/Quests.tsx", imports: ["assets/first-page-b.js", "assets/shared-f.js"], dynamicImports: o.plant ? ["assets/AdminTab-e.js"] : [], modules: { "client/src/pages/Quests.tsx": 50 } }),
      chunk("assets/shared-f.js", { modules: { "client/src/lib/shared.ts": 20, ...(o.garden ? { [`${GARDEN_DIR}Lantern.tsx`]: 12 } : {}), ...(o.leak ? { "client/src/components/admin/NeedTagPicker.tsx": 30 } : {}) } }),
      chunk("assets/Admin-d.js", { facade: "client/src/pages/Admin.tsx", imports: ["assets/first-page-b.js", "assets/shared-f.js"], dynamicImports: ["assets/AdminTab-e.js"], css: ["assets/admin-g.css"], modules: { "client/src/pages/Admin.tsx": 500 } }),
      chunk("assets/AdminTab-e.js", { modules: { "client/src/components/admin/AgentsTab.tsx": 80 } }),
    ],
    assets: ["assets/admin-g.css", "assets/both-h.woff2", "assets/crest-i.webp"],
    lazy: {},
  };
  if (o.graph !== false) put("dist/chunk-graph.json", JSON.stringify(o.staleGraph ? { ...graph, chunks: [...graph.chunks, chunk("assets/gone-z.js")] } : graph));
  if (o.record) put("scripts/admin-shell-step-down.json", JSON.stringify(o.record));
  if (o.spec) put("scripts/route-first-view.json", JSON.stringify(o.spec));
}

/** Run the gate over a fixture tree. The budgets come from `env`; nothing is inherited from the machine or from CI. */
function gate(o = {}, env = {}, extra = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "distbudget-"));
  try {
    tree(dir, o);
    const clean = { ...process.env };
    for (const k of ["MAX_MAIN_JS_KB", "MAX_BOOT_JS_KB", "MAX_TOTAL_DIST_KB", "MAX_MEMBER_DIST_KB", "MAX_ADMIN_DIST_KB", "GITHUB_ACTIONS", "GITHUB_STEP_SUMMARY"]) delete clean[k];
    // "@md" in the arguments is a file inside the fixture, read back before the fixture is removed (--split-md @md).
    const md = path.join(dir, "split.md");
    if (o.buildLog) fs.writeFileSync(path.join(dir, "build.log"), o.buildLog);
    const r = spawnSync(process.execPath, [GATE, "--root", dir, ...extra.map((a) => (a === "@md" ? md : a === "@log" ? path.join(dir, "build.log") : a))], {
      encoding: "utf8",
      env: { ...clean, MAX_MAIN_JS_KB: "400", MAX_BOOT_JS_KB: "750", MAX_TOTAL_DIST_KB: "200", ...env },
    });
    return { code: r.status, out: r.stdout, err: r.stderr, md: fs.existsSync(md) ? fs.readFileSync(md, "utf8") : null };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

check("with the two new numbers unset the gate passes a tree under the total, and prints both sides", () => {
  const r = gate();
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /Total dist\/public: 68 KB of 200 KB/);
  assert.match(r.out, /Members' side: 40 KB, measured in BLOCK-CHARGED bytes across 7 files .*MAX_MEMBER_DIST_KB is not set/);
  assert.match(r.out, /Admin-only: 28 KB, measured in BLOCK-CHARGED bytes across 4 files .*MAX_ADMIN_DIST_KB is not set/);
  assert.match(r.out, /12 KB\s+9000 B on disk\s+assets\/Admin-d\.js\s+\/admin/);
  assert.match(r.out, /nothing names, so counted on the members' side: stray\.txt/);
  assert.match(r.out, /Garden code in member chunks: none/);
  assert.strictEqual(r.err, "", "no error and no warning line");
});

check("unset, the total still fails a tree over it, exactly as before", () => {
  const r = gate({}, { MAX_TOTAL_DIST_KB: "64" });
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /::error::dist\/public is 68 KB block-charged .* over the 64 KB budget/);
});

check("unset, the total's safety margin still fails here and only warns on the runner", () => {
  assert.strictEqual(gate({}, { MAX_TOTAL_DIST_KB: "72" }).code, 1);
  const onRunner = gate({}, { MAX_TOTAL_DIST_KB: "72", GITHUB_ACTIONS: "true" });
  assert.strictEqual(onRunner.code, 0);
  assert.match(onRunner.err, /::warning::dist\/public is 68 KB/);
});

check("unset, a missing chunk graph changes nothing but one line of the report", () => {
  const r = gate({ graph: false });
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /Members' side and admin-only: NOT MEASURED\. dist\/chunk-graph\.json is missing/);
});

check("both set and both under: the gate passes and prints each side against its own number", () => {
  const r = gate({}, { MAX_MEMBER_DIST_KB: "60", MAX_ADMIN_DIST_KB: "28" });
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /Members' side: 40 KB of 60 KB/);
  assert.match(r.out, /Admin-only: 28 KB of 28 KB/);
});

check("the members' side over its ceiling fails, whatever room the admin allowance has", () => {
  const r = gate({}, { MAX_MEMBER_DIST_KB: "36", MAX_ADMIN_DIST_KB: "1000" });
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /::error::The members' side of dist\/public is 40 KB block-charged, over the members' ceiling of 36 KB \(MAX_MEMBER_DIST_KB\)/);
});

check("the admin-only side over its allowance fails, whatever room the members' ceiling has", () => {
  const r = gate({}, { MAX_MEMBER_DIST_KB: "1000", MAX_ADMIN_DIST_KB: "24" });
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /::error::The admin-only files in dist\/public are 28 KB block-charged, over the admin allowance of 24 KB \(MAX_ADMIN_DIST_KB\)/);
});

check("the members' ceiling has the total's safety margin: inside it fails here, warns on the runner, and --no-margin lifts it", () => {
  const env = { MAX_MEMBER_DIST_KB: "48", MAX_ADMIN_DIST_KB: "28" };
  assert.strictEqual(gate({}, env).code, 1, "40 KB is inside the last 12 KB below 48");
  assert.strictEqual(gate({}, { ...env, MAX_MEMBER_DIST_KB: "52" }).code, 0, "and exactly at the edge of it passes");
  const onRunner = gate({}, { ...env, GITHUB_ACTIONS: "true" });
  assert.strictEqual(onRunner.code, 0);
  assert.match(onRunner.err, /::warning::The members' side of dist\/public is 40 KB/);
  assert.strictEqual(gate({}, env, ["--no-margin"]).code, 0);
});

check("THE PLANTED IMPORT: a member page importing an admin-only chunk moves it to the members' side and fails the members' ceiling", () => {
  // The ceiling is the members' weight before the plant plus the safety margin: the lowest number today's tree passes.
  const env = { MAX_MEMBER_DIST_KB: "52", MAX_ADMIN_DIST_KB: "28" };
  const before = gate({}, env);
  assert.strictEqual(before.code, 0, before.err);
  const after = gate({ plant: true }, env);
  assert.strictEqual(after.code, 1, "the same tree with one import from /quests into the admin tab must fail");
  assert.match(after.out, /Members' side: 48 KB of 52 KB/, "the tab's 8 KB moved to the members' side");
  assert.match(after.out, /Admin-only: 20 KB of 28 KB/, "and left the admin side, which now has room it cannot lend");
  assert.ok(!/assets\/AdminTab-e\.js\s+\/admin/.test(after.out), "the tab is no longer listed as admin-only");
  assert.match(after.err, /::error::The members' side of dist\/public is 48 KB/);
  assert.strictEqual(gate({ plant: true }).code, 0, "and with the two numbers unset the planted tree passes, as it does today");
});

check("an admin allowance with no members' ceiling fails by name", () => {
  const r = gate({}, { MAX_ADMIN_DIST_KB: "1000" });
  assert.strictEqual(r.code, 1);
  assert.match(r.err, /::error::MAX_ADMIN_DIST_KB is set and MAX_MEMBER_DIST_KB is not/);
});

check("a members' ceiling with no admin allowance gates nothing: the exit code is the total's, with a warning", () => {
  const r = gate({}, { MAX_MEMBER_DIST_KB: "4" });
  assert.strictEqual(r.code, 0);
  assert.match(r.err, /::warning::MAX_MEMBER_DIST_KB is set and MAX_ADMIN_DIST_KB is not/);
  assert.strictEqual(gate({}, { MAX_MEMBER_DIST_KB: "4", MAX_TOTAL_DIST_KB: "64" }).code, 1, "and the total still fails what it failed");
});

check("both set and no graph, or a graph from another build: the gate fails, since a side it cannot measure is a side nothing holds", () => {
  const env = { MAX_MEMBER_DIST_KB: "1000", MAX_ADMIN_DIST_KB: "1000" };
  const none = gate({ graph: false }, env);
  assert.strictEqual(none.code, 1);
  assert.match(none.err, /could not be measured\. dist\/chunk-graph\.json is missing/);
  const stale = gate({ staleGraph: true }, env);
  assert.strictEqual(stale.code, 1);
  assert.match(stale.err, /is from another build: 1 of its 7 chunks are not in dist\/public \(assets\/gone-z\.js\)/);
});

check("garden code in a member chunk is said in one line, by the chunk", () => {
  const r = gate({ garden: true });
  assert.strictEqual(r.code, 0, "the line is a report, the two ceilings are the gate");
  assert.match(r.out, /Garden code in member chunks: YES, 1 chunk\(s\)/);
  assert.match(r.out, /assets\/shared-f\.js: client\/src\/components\/admin\/garden\/Lantern\.tsx/);
});

check("--report always exits 0, and --json prints one JSON document with the total's key on one line only", () => {
  assert.strictEqual(gate({}, { MAX_MEMBER_DIST_KB: "4", MAX_ADMIN_DIST_KB: "4", MAX_TOTAL_DIST_KB: "4" }, ["--report"]).code, 0);
  const r = gate({}, { MAX_MEMBER_DIST_KB: "60", MAX_ADMIN_DIST_KB: "28" }, ["--json", "--report"]);
  const doc = JSON.parse(r.out);
  assert.strictEqual(doc.blockChargedKb, 68);
  assert.deepStrictEqual([doc.split.memberKb, doc.split.adminKb, doc.split.maxMemberDistKb, doc.split.maxAdminDistKb, doc.split.gated], [40, 28, 60, 28, true]);
  assert.strictEqual(doc.split.memberKb + doc.split.adminKb, doc.blockChargedKb);
  // ci.yml reads the total with: sed -n 's/.*"blockChargedKb": *\([0-9]*\).*/\1/p'
  assert.strictEqual(r.out.split("\n").filter((line) => /"blockChargedKb": *[0-9]+/.test(line)).length, 1);
});

check("the admin page's stylesheet stays admin-only though the route-preload table and the router's own preload list both spell it out", () => {
  const r = gate({ preload: "table", mapDeps: true });
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /Members' side: 44 KB, measured in BLOCK-CHARGED bytes across 8 files/);
  assert.match(r.out, /Admin-only: 28 KB, measured in BLOCK-CHARGED bytes across 4 files/);
  assert.match(r.out, /4 KB\s+300 B on disk\s+assets\/admin-g\.css\s+\/admin/);
});

check("a script index.html loads that is not the table is read as text, and what it names counts on the members' side", () => {
  const r = gate({ preload: "text" });
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /Members' side: 48 KB, measured in BLOCK-CHARGED bytes across 9 files/);
  assert.match(r.out, /Admin-only: 24 KB, measured in BLOCK-CHARGED bytes across 3 files/);
});

/* The step down: the old admin shell, recorded in scripts/admin-shell-step-down.json (the rule's own cases are in admin-shell-step-down.test.mjs). */

check("the old shell still built: the gate says which chunk holds it and what it weighs, and fails nothing", () => {
  const r = gate({ record: { page: "client/src/pages/Admin.tsx", chargedKb: 12, allowanceWithShellKb: 28 } }, { MAX_MEMBER_DIST_KB: "60", MAX_ADMIN_DIST_KB: "28" });
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /Old admin shell: client\/src\/pages\/Admin\.tsx is in assets\/Admin-d\.js, 12 KB block-charged; scripts\/admin-shell-step-down\.json records 12 KB/);
  assert.ok(!r.out.includes("out of date"));
});

check("a recorded weight the build has moved away from is said, so the record is right on the day", () => {
  const r = gate({ record: { page: "client/src/pages/Admin.tsx", chargedKb: 8, allowanceWithShellKb: null } });
  assert.strictEqual(r.code, 0, r.err);
  assert.match(r.out, /records 8 KB.*The record is out of date: write 12 there/);
});

check("THE STEP DOWN: the old shell in no built chunk and the allowance not lowered by its weight fails; lowered, it passes", () => {
  const record = { page: "client/src/pages/OldAdmin.tsx", chargedKb: 12, allowanceWithShellKb: 60 };
  const still = gate({ record }, { MAX_MEMBER_DIST_KB: "60", MAX_ADMIN_DIST_KB: "60" });
  assert.strictEqual(still.code, 1);
  assert.match(still.err, /::error::The old admin shell \(client\/src\/pages\/OldAdmin\.tsx\) is no longer built, and the admin allowance is 60 KB\..*must come down to 48 KB or less/);
  assert.strictEqual(gate({ record }, { MAX_MEMBER_DIST_KB: "60", MAX_ADMIN_DIST_KB: "52" }).code, 1, "lowered by 8 of the 12 is not enough");
  const lowered = gate({ record }, { MAX_MEMBER_DIST_KB: "60", MAX_ADMIN_DIST_KB: "48" });
  assert.strictEqual(lowered.code, 0, lowered.err);
  assert.match(lowered.out, /Old admin shell: client\/src\/pages\/OldAdmin\.tsx is in no built chunk\. .*came down from 60 KB to 48 KB/);
});

check("with no admin allowance set, a retired shell fails nothing: the gate exits as it always did", () => {
  const r = gate({ record: { page: "client/src/pages/OldAdmin.tsx", chargedKb: 12, allowanceWithShellKb: 60 } });
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(r.err, "");
});

/* The written tables (--split-md): the same measurement as Markdown, for whoever sets the two numbers. */

check("--split-md writes the split's tables and the arithmetic, and changes nothing the gate decides", () => {
  const plain = gate({});
  const r = gate({}, {}, ["--split-md", "@md"]);
  assert.strictEqual(r.code, plain.code);
  assert.ok(r.md, "no file was written");
  assert.match(r.md, /\| \*\*Members\*\* \| 7 \| \d+ KB \| \*\*40 KB\*\* \|/);
  assert.match(r.md, /\| \*\*Admin-only\*\* \| 4 \| \d+ KB \| \*\*28 KB\*\* \|/);
  assert.match(r.md, /\| `\/admin` \| pages\/Admin \| `Admin-d\.js` \| admin-only \|/);
  assert.match(r.md, /\| 1 \| `Admin-d\.js` \| 9,000 \| 12 KB \| `\/admin` \|/);
  assert.match(r.md, /Members' ceiling = the members' side \+ the gate's safety margin\.\*\* 40 \+ 12 = \*\*52 KB\*\*/);
  assert.match(r.md, /Admin allowance = admin-only \+ room[^\n]*28 \+ room\. No room was given/);
  assert.match(r.md, /6 chunks; 0 whose import statements differ/);
  assert.match(r.md, /first views guard's own record\.\*\* NOT RUN/);
});

check("--room-kb is added to the admin-only weight in the worked arithmetic, and the total is the two added together", () => {
  const r = gate({}, {}, ["--report", "--split-md", "@md", "--room-kb", "20"]);
  assert.match(r.md, /28 \+ 20 = \*\*48 KB\*\*/);
  assert.match(r.md, /MAX_TOTAL_DIST_KB = the two added together[^\n]*52 \+ 48 = 100 KB/);
});

check("the written checks name a graph edge the built file does not write", () => {
  // The planted fixture adds the edge to the graph alone: the file of /quests still writes no such import.
  const r = gate({ plant: true }, {}, ["--report", "--split-md", "@md"]);
  assert.match(r.md, /6 chunks; 1 whose import statements differ from the graph's edges\. `Quests-c\.js`/);
});

check("the written checks compare the walk with the route-preload table and with the guard's own record", () => {
  const log = "[route-first-view] /quests: 1.0 KB gzipped of 9, 4 chunks: assets/index-a.js assets/first-page-b.js assets/Quests-c.js assets/shared-f.js\n";
  const spec = { routes: [{ path: "/quests", page: "client/src/pages/Quests.tsx", maxGzipKB: 9 }] };
  const agree = gate({ preload: "table", buildLog: log, spec }, {}, ["--report", "--split-md", "@md", "--build-log", "@log"]);
  assert.match(agree.md, /route-preload table against the walk\.\*\* 2 routes have a row \(0 for a page packed[^\n]*; 0 differ\./);
  assert.match(agree.md, /guard's own record\.\*\* `\/quests` 4 chunks\. All agree\./);
  const short = gate({ preload: "table", preloadShort: true }, {}, ["--report", "--split-md", "@md"]);
  assert.match(short.md, /2 routes have a row[^\n]*; 1 differ\. `\/admin`/, "a row that leaves out a chunk the page's first view loads is named");
  const differs = gate({ preload: "table", buildLog: log.replace(" assets/shared-f.js", ""), spec }, {}, ["--report", "--split-md", "@md", "--build-log", "@log"]);
  assert.match(differs.md, /`\/quests` 3 chunks \(DIFFERS: only in the guard none; only in the walk assets\/shared-f\.js\)/);
});

check("a what-if says what a route would add as an admin route, and says so when the route is unknown or admin already", () => {
  const r = gate({}, {}, ["--report", "--split-md", "@md", "--candidate", "/quests", "--candidate", "/admin", "--candidate", "/nowhere"]);
  assert.match(r.md, /\| `\/quests` \| pages\/Quests \| 8 KB in 2 file\(s\) \|/, "the page's chunk, and the shared chunk no member page would load any more");
  assert.match(r.md, /\| `\/admin` \| [^|]* \| it is an admin route already \|/);
  assert.match(r.md, /\| `\/nowhere` \| not a route in the router \| \|/);
});

check("the leaks name an admin part inside a member chunk and the member route that loads it", () => {
  const r = gate({ leak: true }, {}, ["--report", "--split-md", "@md"]);
  assert.match(r.md, /\| `shared-f\.js` \| 0 KB \| 0 KB \| 1: NeedTagPicker\.tsx \| the first view of 1 member route\(s\): \/quests \|/);
});

check("--admin-top limits the list", () => {
  const r = gate({}, {}, ["--admin-top", "1"]);
  assert.match(r.out, /admin-only files, largest first \(1 of 4;/);
  assert.ok(!r.out.includes("assets/AdminTab-e.js  /admin"));
});

console.log(`\n${checks - failures} of ${checks} checks passed`);
if (failures) process.exit(1);
