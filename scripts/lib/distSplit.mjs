/**
 * WHICH BUILT FILES ONLY AN ADMIN PAGE LOADS, and which a member can.
 *
 * WHY THIS EXISTS (the founder's ruling, 28 Nov 2026). One ceiling counted
 * everything in dist/public together, so a page only an admin opens spent the
 * same budget as the homepage. The ruling: the members' limits stay where they
 * are, admin-only pages get a counted allowance of their own, and the build
 * decides which pages are admin-only FROM THE ROUTES, never from a hand-kept
 * list of chunks. This file is that decision, as pure functions over facts the
 * build wrote down, so scripts/check-dist-budget.mjs and its test share it.
 *
 * THE RULE, in the order it is applied:
 *
 *   1. THE ADMIN ROOTS come from the router, and ADMIN-ONLY IS DECIDED BY
 *      WHAT A MEMBER CAN REALLY REACH (the coordinator's ruling, 28 Nov 2026).
 *      client/src/App.tsx is parsed for each route's path and the lazily
 *      imported page it renders. A route is an admin route when its path is
 *      /admin or under it, UNLESS the router or the page's own code says a
 *      person who is not an admin opens it: ADMIN_PATH_RULINGS below is that
 *      small reviewed list, each entry with the line of code that proves it,
 *      held to the router and to the quoted line by a test. A page outside
 *      /admin joins by ROAD_TO_LAUNCH_PATHS, which is empty today. The page's
 *      source file is found in the chunk graph, and the chunk holding it is an
 *      admin root, unless a member route's page sits in the same chunk: then a
 *      member route loads that chunk and it is a member chunk.
 *
 *   2. THE WALK starts from what index.html loads and follows every static
 *      and dynamic import in the CHUNK graph (dist/chunk-graph.json, written
 *      by vite.config.ts from the files that reached the disk), except the
 *      router's own lazy import of an admin root. Every chunk the walk reaches
 *      is a MEMBER chunk. So a chunk any member route can pull in is a member
 *      chunk by construction, and that includes an admin root itself when any
 *      chunk other than the router's imports it.
 *
 *   3. ADMIN-ONLY is what the admin roots reach that the walk did not.
 *
 *   4. STYLES, FONTS AND IMAGES follow the files that load them. A file
 *      index.html or any member file loads is a member file; a file only
 *      admin-only files load is admin-only. "Loads" is read off the graph
 *      first (which chunk pulls in which stylesheet and built file), then off
 *      a stylesheet's own text, and off a chunk's text only for files the
 *      graph cannot know. A NAME IS NOT A LOAD: the router's chunk and the
 *      route-preload table both spell out the Admin page's stylesheet without
 *      loading it for a member, and the two notes beside `placedByGraph` and
 *      `readRoutePreloadTable` below say how each is read.
 *
 *   5. A FILE NOTHING NAMES is reported apart and counted on the members'
 *      side, so nothing escapes the gate. The directories are counted there
 *      too, for the same reason.
 *
 * WHY THE CHUNK GRAPH AND NOT THE MODULE GRAPH. A reach worked out from
 * module-level import lists keeps edges the bundler dropped, so it is an upper
 * bound, and it has misled this repository before. The chunk graph is what a
 * browser loads. The one module-level fact used here is read in the safe
 * direction only: when something in the router's chunk other than the router
 * imports an admin page, the router's edge is NOT held back, which can only
 * move a chunk to the members' side.
 */

/** ext4 allocates whole blocks of this size, and `du` counts what is allocated. */
export const BLOCK = 4096;
export const charged = (bytes) => (bytes === 0 ? 0 : Math.ceil(bytes / BLOCK) * BLOCK);

/** The router, as the chunk graph names it. */
export const ROUTER_MODULE = "client/src/App.tsx";

/**
 * THE ROAD TO LAUNCH'S OWN PAGES, counted as admin routes though they sit
 * outside /admin. EMPTY TODAY, on purpose (the coordinator's ruling, 28 Nov
 * 2026: admin-only is decided by what a member can really reach).
 *
 * The first version of this list held /journey-to-launch and /setup-game, and
 * it counted four files and about 104 KB as admin-only that a member's own
 * visit loads: a signed-in member runs the test run on /journey-to-launch, a
 * steward who is not an admin hands powers over there, and the canvas is
 * there. /setup-game rides a chunk member pages share in any case.
 *
 * A road page joins this list on the day it is folded behind the admin's own
 * door, so that a person who is not an admin can no longer open it, and the
 * coordinator decides that, in the change that does the folding. Each path
 * here must be a route in client/src/App.tsx: scripts/check-dist-budget.test.mjs
 * fails otherwise.
 */
export const ROAD_TO_LAUNCH_PATHS = [];

/**
 * WHO OPENS EACH /admin ADDRESS, AS THE CODE ITSELF SAYS.
 *
 * An address under /admin is an admin route by the path rule. The path is a
 * name and three of these pages say so in their own words: a steward, a
 * circle's lead or a holder of the needed powers opens them without being an
 * admin, and what such a person loads is a member's weight. So each /admin
 * address is ruled on here, with the file and the line that proves it:
 *
 *   opens "members"  the page is a MEMBER route. Its chunk is never an admin
 *                    root, whatever its address.
 *   opens "admins"   the page is an admin root, and the line quoted is its
 *                    gate.
 *
 * An /admin address with no entry stays an admin root BY PATH ALONE, and the
 * gate and the written tables say "admin by path, not proved by a gate" beside
 * it: nobody has guessed for it either way. Nothing here is decided by a file
 * name. Add an entry only with a line of code to quote; the test holds each
 * address to the router and each quoted line to its file, so an entry cannot
 * outlive its proof. What the test cannot see is whether the line is true: for
 * the three member entries the server's own gate was read as well
 * (server/routes/reviewInbox.ts admits any member, server/routes/roleMeasures.ts
 * a circle's lead, server/routes/proposedChanges.ts a holder of a reader key),
 * and for /admin/mint the server answers only an admin (`isAdmin`, the
 * /api/admin/economy read in server/index.ts).
 */
export const ADMIN_PATH_RULINGS = [
  { path: "/admin", opens: "admins", file: "client/src/pages/Admin.tsx", proof: "return <AdminGate onAuth={setPassword} />;" },
  { path: "/admin/mint", opens: "admins", file: "client/src/pages/Mint.tsx", proof: "Sign in with your admin account to open the Mint." },
  { path: "/admin/proposals", opens: "members", file: "client/src/pages/ProposedChanges.tsx", proof: "This page is for admins and for the people who hold the powers these changes need." },
  { path: "/admin/review", opens: "members", file: "client/src/pages/AdminReview.tsx", proof: "nothing: a steward who is not an admin opens it." },
  { path: "/admin/role-progress", opens: "members", file: "client/src/App.tsx", proof: "The /admin/ path gates nothing: a circle's lead opens it too." },
];

/** The /admin addresses a person who is not an admin opens, by the rulings above. */
export const MEMBER_OPENED_ADMIN_PATHS = ADMIN_PATH_RULINGS.filter((r) => r.opens === "members").map((r) => r.path);

/** Whether an address sits at or under /admin, whoever opens it. */
export const isUnderAdmin = (routePath) => routePath === "/admin" || routePath.startsWith("/admin/");

export function isAdminPath(routePath, roadPaths = ROAD_TO_LAUNCH_PATHS, memberOpened = MEMBER_OPENED_ADMIN_PATHS) {
  return (isUnderAdmin(routePath) && !memberOpened.includes(routePath)) || roadPaths.includes(routePath);
}

const stripExt = (id) => id.replace(/\.[cm]?[jt]sx?$/, "");

/** "./pages/Admin" as App.tsx writes it -> "client/src/pages/Admin", the chunk graph's spelling without the extension. */
function moduleOfSpec(spec) {
  if (spec.startsWith("@shared/")) return stripExt(`shared/${spec.slice("@shared/".length)}`);
  if (spec.startsWith("@/")) return stripExt(`client/src/${spec.slice(2)}`);
  return stripExt(`client/src/${spec.replace(/^\.\//, "")}`);
}

/**
 * Every route in App.tsx, in order: its path, the component it draws, and the
 * lazily imported page behind that component when there is one.
 *
 * Reads the shapes App.tsx uses: `const X = lazyPage(() => import("./pages/Y"))`
 * (or brochurePage, or lazy), `const load = () => import("./pages/Y")` with
 * `const X = lazy(load)`, `<Route path="/p" component={X} />`, and a route
 * that draws inline, `<Route path="/p">{() => <X ... />}</Route>`. `kind` is
 * "lazy" (a page chunk), "redirect", or "eager" (drawn by the first page's own
 * code). A route this cannot read comes back with kind "unread", and
 * `unreadRoutes` lists them, so a new shape is seen and never skipped.
 */
export function routesFromApp(appSource) {
  const loaders = new Map();
  const importers = new Map();
  for (const m of appSource.matchAll(/const\s+(\w+)\s*=\s*\(\)\s*=>\s*import\(\s*["']([^"']+)["']\s*\)/g)) importers.set(m[1], m[2]);
  for (const m of appSource.matchAll(/const\s+(\w+)\s*=\s*(?:lazyPage|brochurePage|lazy)\(\s*\(\)\s*=>\s*import\(\s*["']([^"']+)["']\s*\)/g)) loaders.set(m[1], m[2]);
  for (const m of appSource.matchAll(/const\s+(\w+)\s*=\s*(?:lazyPage|brochurePage|lazy)\(\s*(\w+)\s*\)/g)) {
    if (importers.has(m[2])) loaders.set(m[1], importers.get(m[2]));
  }
  const routes = [];
  const tag = /<Route\s+path=["']([^"']+)["']([^>]*)>/y;
  for (const open of appSource.matchAll(/<Route\s+path=/g)) {
    tag.lastIndex = open.index;
    const m = tag.exec(appSource);
    if (!m) {
      // A path that is not a plain string (`path={...}`): named by its own text, so it is seen and never skipped.
      routes.push({ path: appSource.slice(open.index, open.index + 60).split("\n")[0], component: null, kind: "unread", page: null });
      continue;
    }
    const routePath = m[1];
    let component = /component=\{(\w+)\}/.exec(m[2])?.[1] ?? null;
    if (!component) {
      // An inline route: the first element its arrow function draws.
      const after = appSource.slice(m.index + m[0].length, m.index + m[0].length + 200);
      component = /^\s*\{\s*\(\w*\)\s*=>\s*<(\w+)[\s/>]/.exec(after)?.[1] ?? null;
    }
    const spec = component ? loaders.get(component) : undefined;
    const kind = !component ? "unread" : spec ? "lazy" : component === "Redirect" ? "redirect" : "eager";
    routes.push({ path: routePath, component, kind, page: spec ? moduleOfSpec(spec) : null });
  }
  return routes;
}

export const unreadRoutes = (routes) => routes.filter((r) => r.kind === "unread").map((r) => r.path);

/** Every chunk reachable from `starts` by the edges `next(file)` yields, `starts` included. */
function closure(starts, next) {
  const seen = new Set();
  const stack = [...starts];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const dep of next(f)) stack.push(dep);
  }
  return seen;
}

/**
 * The split itself.
 *
 * @param {object} o
 * @param {{chunks: Array<{file:string, isEntry:boolean, imports:string[], dynamicImports:string[], css:string[], assets:string[], modules:Record<string,number>}>, lazy?: Record<string,{importers:string[], dynamicImporters:string[]}>}} o.graph
 *        dist/chunk-graph.json.
 * @param {ReturnType<typeof routesFromApp>} o.routes
 * @param {Array<{path:string, bytes:number}>} o.files every file in dist/public, by its path there.
 * @param {string[]} o.indexRefs the files index.html names.
 * @param {Array<{from:string, to:string}>} [o.textRefs] "the text of `from` names `to`", found on disk (a stylesheet's fonts, a chunk's images).
 * @param {string[]} [o.roadPaths]
 */
export function classifyDist(o) {
  const roadPaths = o.roadPaths ?? ROAD_TO_LAUNCH_PATHS;
  const chunks = new Map(o.graph.chunks.map((c) => [c.file, c]));
  const notes = [];

  // Which chunk holds each source module, by the module's path without its extension.
  const chunkOfModule = new Map();
  for (const c of o.graph.chunks) for (const id of Object.keys(c.modules ?? {})) chunkOfModule.set(stripExt(id), c.file);
  const routerChunk = chunkOfModule.get(stripExt(ROUTER_MODULE)) ?? null;
  if (!routerChunk) notes.push(`no chunk holds ${ROUTER_MODULE}, so no admin root can be told from a member page and every chunk counts as a member's`);

  // 1. The admin roots, from the router.
  const lazyRoutes = o.routes.filter((r) => r.kind === "lazy");
  const adminRoutes = lazyRoutes.filter((r) => isAdminPath(r.path, roadPaths));
  const memberPages = new Set(lazyRoutes.filter((r) => !isAdminPath(r.path, roadPaths)).map((r) => r.page));
  for (const r of o.routes) {
    if (!isAdminPath(r.path, roadPaths) || r.kind === "lazy" || r.kind === "redirect") continue;
    notes.push(`${r.path} is an admin route the first page draws itself (${r.component ?? "unread"}), so it has no chunk of its own to count apart`);
  }
  // The /admin addresses a person who is not an admin opens: member routes, named so nobody takes them for an oversight.
  const rulings = new Map(ADMIN_PATH_RULINGS.map((r) => [r.path, r]));
  const memberOpened = o.routes
    .filter((r) => isUnderAdmin(r.path) && !isAdminPath(r.path, roadPaths))
    .map((r) => ({ path: r.path, page: r.page, chunk: r.page ? (chunkOfModule.get(r.page) ?? null) : null, file: rulings.get(r.path)?.file ?? null, proof: rulings.get(r.path)?.proof ?? null }));
  const roots = [];
  const lazyFacts = o.graph.lazy ?? {};
  for (const r of adminRoutes) {
    const file = chunkOfModule.get(r.page) ?? null;
    // `gate` is the line of code that proves only an admin opens the page, or null: admin by path, not proved by a gate.
    const ruled = rulings.get(r.path);
    const root = { path: r.path, page: r.page, chunk: file, heldBack: false, why: "", gate: ruled?.opens === "admins" ? { file: ruled.file, proof: ruled.proof } : null, byRoadList: !isUnderAdmin(r.path) };
    roots.push(root);
    if (!file) {
      root.why = "its page is in no chunk of this build";
      notes.push(`${r.path}: ${r.page} is in no chunk of this build, so nothing is counted for it`);
      continue;
    }
    if (memberPages.has(r.page)) {
      root.why = "a member route draws the same page";
      notes.push(`${r.path}: a member route draws ${r.page} too, so its chunk ${file} is a member chunk`);
      continue;
    }
    const sharing = Object.keys(chunks.get(file).modules ?? {}).map(stripExt).filter((id) => memberPages.has(id));
    if (sharing.length) {
      const named = `${sharing.slice(0, 3).join(", ")}${sharing.length > 3 ? ` and ${sharing.length - 3} more` : ""}`;
      root.why = `it shares a chunk with ${sharing.length} member page(s): ${named}`;
      notes.push(`${r.path}: ${r.page} shares the chunk ${file} with ${sharing.length} member route page(s) (${named}), so that chunk is a member chunk`);
      continue;
    }
    // The one module-level fact: another module in the router's own chunk importing this page.
    const fact = Object.entries(lazyFacts).find(([id]) => stripExt(id) === r.page)?.[1];
    const others = [...(fact?.importers ?? []), ...(fact?.dynamicImporters ?? [])].filter((id) => id !== ROUTER_MODULE && chunkOfModule.get(stripExt(id)) === routerChunk);
    if (others.length) {
      root.why = `${others.join(", ")} imports it from the first page`;
      notes.push(`${r.path}: ${others.join(", ")} imports ${r.page} from the router's own chunk, so the walk follows that import and ${file} is a member chunk`);
      continue;
    }
    root.heldBack = routerChunk !== null;
  }
  const heldBack = new Set(roots.filter((r) => r.heldBack).map((r) => r.chunk));

  // 2. The walk: from what index.html loads, every import except the router's lazy import of an admin root.
  const starts = o.indexRefs.filter((f) => chunks.has(f));
  for (const c of o.graph.chunks) if (c.isEntry && !starts.includes(c.file)) starts.push(c.file);
  const edges = (file) => {
    const c = chunks.get(file);
    if (!c) return [];
    const lazy = c.dynamicImports.filter((to) => !(file === routerChunk && heldBack.has(to)));
    return [...c.imports, ...lazy];
  };
  const memberChunks = closure(starts, edges);
  for (const r of roots) {
    if (r.heldBack && memberChunks.has(r.chunk)) {
      r.heldBack = false;
      r.why = "a member chunk imports it";
      const by = o.graph.chunks.filter((c) => memberChunks.has(c.file) && c.file !== routerChunk && [...c.imports, ...c.dynamicImports].includes(r.chunk)).map((c) => c.file);
      notes.push(`${r.path}: the member chunk ${by.join(", ") || "(the first page)"} imports ${r.chunk}, so it is a member chunk`);
    }
  }

  // 3. Admin-only: what the admin roots reach that the walk did not. A root's reach stops at a member chunk:
  // past one lies the router, and through the router every page there is.
  const beyondMembers = (file) => (memberChunks.has(file) ? [] : [...(chunks.get(file)?.imports ?? []), ...(chunks.get(file)?.dynamicImports ?? [])]);
  const reachOfRoot = new Map(roots.filter((r) => r.chunk).map((r) => [r.path, closure([r.chunk], beyondMembers)]));
  const adminReach = new Set();
  for (const reach of reachOfRoot.values()) for (const f of reach) if (!memberChunks.has(f)) adminReach.add(f);

  // 4. Every other file follows the files that name it.
  const namedBy = new Map();
  const name = (from, to) => {
    if (from === to) return;
    if (!namedBy.has(to)) namedBy.set(to, new Set());
    namedBy.get(to).add(from);
  };
  for (const c of o.graph.chunks) for (const f of [...(c.css ?? []), ...(c.assets ?? [])]) name(c.file, f);
  /*
   * A CHUNK'S TEXT IS NOT ASKED ABOUT A FILE THE GRAPH ALREADY PLACES. Beside
   * every lazy import Vite writes the list of files to preload with it, the
   * target's stylesheet among them, so the router's chunk spells out the Admin
   * page's CSS in its own text without ever loading it for a member. The graph
   * says which chunk pulls a stylesheet or a built file in, and that is the
   * authority. A chunk's text is read only for the files the graph cannot know:
   * the ones copied in from client/public and named by a plain string.
   */
  const placedByGraph = new Set(o.graph.chunks.flatMap((c) => [...(c.css ?? []), ...(c.assets ?? [])]));
  for (const r of o.textRefs ?? []) {
    if (chunks.has(r.to) || (chunks.has(r.from) && placedByGraph.has(r.to))) continue;
    name(r.from, r.to);
  }
  const INDEX = "index.html";
  for (const f of o.indexRefs) name(INDEX, f);

  const side = new Map();
  for (const f of o.files) {
    if (f.path === INDEX || memberChunks.has(f.path)) side.set(f.path, "member");
    else if (adminReach.has(f.path)) side.set(f.path, "admin");
  }
  // Members first, to a fixed point: a file any member file names is a member file.
  for (let grew = true; grew; ) {
    grew = false;
    for (const f of o.files) {
      if (side.has(f.path)) continue;
      if (Array.from(namedBy.get(f.path) ?? []).some((by) => side.get(by) === "member")) {
        side.set(f.path, "member");
        grew = true;
      }
    }
  }
  // Then what only admin-only files name.
  for (let grew = true; grew; ) {
    grew = false;
    for (const f of o.files) {
      if (side.has(f.path)) continue;
      if (Array.from(namedBy.get(f.path) ?? []).some((by) => side.get(by) === "admin")) {
        side.set(f.path, "admin");
        grew = true;
      }
    }
  }
  // 5. Nothing names it: reported apart, counted with the members.
  for (const f of o.files) if (!side.has(f.path)) side.set(f.path, "unnamed");

  const sum = (which) => {
    const of = o.files.filter((f) => side.get(f.path) === which);
    return { files: of.length, realBytes: of.reduce((n, f) => n + f.bytes, 0), chargedBytes: of.reduce((n, f) => n + charged(f.bytes), 0) };
  };
  const ownersOf = (file) => Array.from(reachOfRoot).filter(([, reach]) => reach.has(file)).map(([p]) => p);
  const adminFiles = o.files
    .filter((f) => side.get(f.path) === "admin")
    .map((f) => {
      // A style or a font is owned by whoever owns the files that name it.
      const seen = new Set();
      const owners = new Set();
      const stack = [f.path];
      while (stack.length) {
        const at = stack.pop();
        if (seen.has(at)) continue;
        seen.add(at);
        if (chunks.has(at)) for (const p of ownersOf(at)) owners.add(p);
        else for (const by of namedBy.get(at) ?? []) stack.push(by);
      }
      return { path: f.path, bytes: f.bytes, chargedBytes: charged(f.bytes), isChunk: chunks.has(f.path), owners: Array.from(owners).sort() };
    })
    .sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));

  return {
    routerChunk,
    roots,
    memberOpened,
    notes,
    side,
    memberChunks,
    member: sum("member"),
    admin: sum("admin"),
    unnamed: sum("unnamed"),
    unnamedFiles: o.files.filter((f) => side.get(f.path) === "unnamed").map((f) => f.path).sort(),
    adminFiles,
  };
}

/**
 * The two gated totals in bytes, block-charged. The members' side carries the
 * files nothing names and every directory, so the two add up to the one total
 * the gate has always printed and nothing sits outside both.
 */
export function splitTotals(split, dirBytes) {
  return {
    memberChargedBytes: split.member.chargedBytes + split.unnamed.chargedBytes + dirBytes,
    memberRealBytes: split.member.realBytes + split.unnamed.realBytes,
    memberFiles: split.member.files + split.unnamed.files,
    adminChargedBytes: split.admin.chargedBytes,
    adminRealBytes: split.admin.realBytes,
    adminFiles: split.admin.files,
  };
}

/**
 * Member chunks that carry code from a source folder, with how much of it.
 * Decided from the graph: the modules rollup placed in each chunk and the
 * bytes of each it rendered. Used for the line a reviewer of the garden's
 * mount asks for ("does any member chunk contain garden code?") and to name
 * admin modules that leaked into a member page.
 */
export function memberChunksHolding(graph, split, isWanted) {
  const out = [];
  for (const c of graph.chunks) {
    if (split.side.get(c.file) !== "member") continue;
    const modules = Object.entries(c.modules ?? {}).filter(([id, rendered]) => rendered > 0 && isWanted(id));
    if (modules.length) out.push({ chunk: c.file, renderedBytes: modules.reduce((n, [, b]) => n + b, 0), modules: modules.map(([id, b]) => ({ id, renderedBytes: b })).sort((a, b) => b.renderedBytes - a.renderedBytes) });
  }
  return out.sort((a, b) => b.renderedBytes - a.renderedBytes);
}

/** The folder the Admin Garden's own code lives in. */
export const GARDEN_DIR = "client/src/components/admin/garden/";

/**
 * What one route's first view loads, from the chunk graph: every chunk
 * index.html loads, and the page's chunk with its static imports, plus the
 * same for each piece the shell draws on every page. The route first views
 * guard (vite.config.ts) records the same set, which is what this is checked
 * against.
 */
export function firstViewOf(graph, indexRefs, pageChunks) {
  const chunks = new Map(graph.chunks.map((c) => [c.file, c]));
  const starts = [...indexRefs.filter((f) => chunks.has(f)), ...graph.chunks.filter((c) => c.isEntry).map((c) => c.file), ...pageChunks];
  return Array.from(closure(starts, (f) => chunks.get(f)?.imports ?? [])).sort();
}

/**
 * The member routes whose pages load a chunk, nearest first: `firstPage` when
 * index.html loads it, then the routes whose first view holds it (`firstView`),
 * then the routes whose page reaches it by a later lazy import (`later`). A
 * chunk none of those reach is one the first page's own code imports lazily
 * (`shell`): the header, the layout or the router, on any page.
 */
export function memberRoutesLoading(graph, routes, indexRefs, file, roadPaths = ROAD_TO_LAUNCH_PATHS) {
  const chunks = new Map(graph.chunks.map((c) => [c.file, c]));
  const chunkOfModule = new Map();
  for (const c of graph.chunks) for (const id of Object.keys(c.modules ?? {})) chunkOfModule.set(stripExt(id), c.file);
  const statics = (f) => chunks.get(f)?.imports ?? [];
  const boot = closure([...indexRefs.filter((f) => chunks.has(f)), ...graph.chunks.filter((c) => c.isEntry).map((c) => c.file)], statics);
  if (boot.has(file)) return { firstPage: true, firstView: [], later: [], shell: false };
  // From a page, without passing back through the first page's chunks: their lazy imports are every other route.
  const beyondBoot = (f) => (boot.has(f) ? [] : [...statics(f), ...(chunks.get(f)?.dynamicImports ?? [])]);
  const firstView = [];
  const later = [];
  for (const r of routes) {
    if (r.kind !== "lazy" || isAdminPath(r.path, roadPaths)) continue;
    const page = chunkOfModule.get(r.page);
    if (!page) continue;
    if (closure([page], statics).has(file)) firstView.push(r.path);
    else if (closure([page], beyondBoot).has(file)) later.push(r.path);
  }
  return { firstPage: false, firstView, later, shell: firstView.length === 0 && later.length === 0 };
}

/**
 * Whether `text` names the file at `relPath`: the path itself, with no
 * file-name character on either side, so "sw.js" is not found inside
 * "hidden-map-sw.js". Hashed names make a chance match implausible; this
 * closes the plain ones.
 */
export function textNames(text, relPath) {
  for (let at = text.indexOf(relPath); at !== -1; at = text.indexOf(relPath, at + 1)) {
    const before = at === 0 ? "" : text[at - 1];
    const after = text[at + relPath.length] ?? "";
    if (!/[\w.-]/.test(before) && !/[\w-]/.test(after)) return true;
  }
  return false;
}

/*
 * THE ROUTE-PRELOAD TABLE IS A TABLE, NOT AN IMPORT.
 *
 * index.html loads one small script that is not a chunk: the route-preload
 * table (client/src/lib/routePreload.ts writes it). It names, for every route
 * that has a page chunk of its own, the files that route's first view needs,
 * and at run time it asks only for the row the address matches. Read as plain
 * text it "names" the old admin shell's stylesheet on every page, and on the
 * first measured build (614b5d16) that put the Admin page's own CSS on the
 * members' side though no member's page can load it. The Admin Garden's
 * stylesheet would have followed it and failed the members' ceiling for
 * nothing.
 *
 * So the table is read as what it is. A row for an admin route names its files
 * for that route alone. A row for a member route, or for a pattern this router
 * no longer has, names its files for members. Anything that does not parse as
 * the table is read as plain text, which is the careful way round: everything
 * it names counts on the members' side.
 */

/** A wouter pattern as the table spells it: `routePattern` in client/src/lib/routePreload.ts, to the character. */
export function routePatternOf(routePath) {
  const body = routePath
    .split("/")
    .map((seg) => (seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/")
    .replace(/\/$/, "");
  return `^${body}/?$`;
}

/** The table inside a built route-preload script, `{ files, rows }` with rows of [pattern, indexes into files], or null when the text is not one. */
export function readRoutePreloadTable(text) {
  const m = /^\s*var b = "(?:[^"\\]|\\.)*", f = (\[.*\]), r = (\[.*\]);\s*$/m.exec(text);
  if (!m) return null;
  try {
    const files = JSON.parse(m[1]);
    const rows = JSON.parse(m[2]);
    const sound =
      Array.isArray(files) &&
      files.every((f) => typeof f === "string") &&
      Array.isArray(rows) &&
      rows.every((r) => Array.isArray(r) && typeof r[0] === "string" && Array.isArray(r[1]) && r[1].every((i) => Number.isInteger(i) && i >= 0 && i < files.length));
    return sound ? { files, rows } : null;
  } catch {
    return null;
  }
}

/** The files a route-preload table names for members: every row but the rows that serve admin routes only. */
export function preloadFilesForMembers(table, routes, roadPaths = ROAD_TO_LAUNCH_PATHS) {
  const admin = new Set(routes.filter((r) => isAdminPath(r.path, roadPaths)).map((r) => routePatternOf(r.path)));
  const member = new Set(routes.filter((r) => !isAdminPath(r.path, roadPaths)).map((r) => routePatternOf(r.path)));
  const out = new Set();
  for (const [pattern, ids] of table.rows) {
    if (admin.has(pattern) && !member.has(pattern)) continue;
    for (const i of ids) out.add(table.files[i]);
  }
  return Array.from(out);
}
