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
 *   1. THE ADMIN ROOTS come from the router. client/src/App.tsx is parsed for
 *      each route's path and the lazily imported page it renders. A route is
 *      an admin route when its path is /admin or under it, or is one of the
 *      road to launch's own pages (ROAD_TO_LAUNCH_PATHS, the one list here,
 *      held to the router by a test). The page's source file is found in the
 *      chunk graph, and the chunk holding it is an admin root, unless a member
 *      route's page sits in the same chunk: then a member route loads that
 *      chunk and it is a member chunk.
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
 *   4. STYLES, FONTS AND IMAGES follow the files that name them. A file named
 *      by index.html or by any member file is a member file; a file named only
 *      by admin-only files is admin-only.
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
 * THE ROAD TO LAUNCH'S OWN PAGES: the checklist a founder walks from claiming
 * a village to its launch vote (pages/JourneyToLaunch), and the setup game
 * that fills the same checklist in (pages/SetupGame). They sit outside /admin
 * by address and belong to the admin allowance by the ruling. This is the one
 * hand-written list in the split, and scripts/check-dist-budget.test.mjs fails
 * if a path here stops being a route in client/src/App.tsx.
 */
export const ROAD_TO_LAUNCH_PATHS = ["/journey-to-launch", "/setup-game"];

export function isAdminPath(routePath, roadPaths = ROAD_TO_LAUNCH_PATHS) {
  return routePath === "/admin" || routePath.startsWith("/admin/") || roadPaths.includes(routePath);
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
  for (const m of appSource.matchAll(/<Route\s+path=["']([^"']+)["']([^>]*)>/g)) {
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
  const roots = [];
  const lazyFacts = o.graph.lazy ?? {};
  for (const r of adminRoutes) {
    const file = chunkOfModule.get(r.page) ?? null;
    const root = { path: r.path, page: r.page, chunk: file, heldBack: false, why: "" };
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
  for (const r of o.textRefs ?? []) if (!chunks.has(r.to)) name(r.from, r.to);
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
