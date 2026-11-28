/**
 * THE MEASURED SPLIT, WRITTEN DOWN: the tables a person takes to whoever sets
 * the two numbers, made from one build by one command.
 *
 * The members' ceiling and the admin allowance are chosen from a build of
 * main, and main moves several times a day, so a table typed by hand is about
 * a tree that is already gone. `node scripts/measure-dist-split.mjs` builds,
 * measures and writes these tables again, and `check-dist-budget.mjs
 * --split-md <file>` writes them for the build that is already there.
 *
 * Everything here is worked out from the same facts the gate reads
 * (scripts/lib/distSplit.mjs): no table has a second source. Three things are
 * CHECKS OF THOSE FACTS, kept apart from the split so a disagreement is named
 * and never folded in:
 *
 *   1. the chunk graph against the import statements in the built files;
 *   2. each route's first view against the route-preload table the build ships;
 *   3. the same against the route first views guard's own record, when the
 *      build was run with ROUTE_VIEW_REPORT=1 and its log is handed over.
 */
import { ROAD_TO_LAUNCH_PATHS, classifyDist, firstViewOf, isAdminPath, memberChunksHolding, memberRoutesLoading, readRoutePreloadTable, routePatternOf } from "./distSplit.mjs";

/** The folder the admin shell's own parts live in: code from here inside a member chunk is a leak worth naming. */
export const ADMIN_PARTS_DIR = "client/src/components/admin/";

const stripExt = (id) => id.replace(/\.[cm]?[jt]sx?$/, "");
const kb = (bytes) => Math.floor(bytes / 1024);
const dirOf = (file) => (file.includes("/") ? file.slice(0, file.lastIndexOf("/") + 1) : "");

/** The sibling chunks a built chunk's own text imports, statically and lazily, as paths in dist/public. */
export function importsWrittenIn(file, text) {
  const here = dirOf(file);
  const statics = new Set(Array.from(text.matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g), (m) => here + m[1]));
  const lazies = new Set(Array.from(text.matchAll(/import\(\s*["']\.\/([^"']+\.js)["']\s*\)/g), (m) => here + m[1]));
  return { statics, lazies };
}

/** Check 1: every chunk's edges in the graph against the imports its file writes. */
export function checkGraphAgainstFiles(graph, textOf) {
  const differing = [];
  for (const c of graph.chunks) {
    const text = textOf(c.file);
    if (text === null) {
      differing.push({ file: c.file, note: "not in dist/public" });
      continue;
    }
    const written = importsWrittenIn(c.file, text);
    const only = (a, b) => Array.from(a).filter((x) => !b.has(x)).sort();
    const d = {
      staticOnlyInFile: only(written.statics, new Set(c.imports)),
      staticOnlyInGraph: only(new Set(c.imports), written.statics),
      lazyOnlyInFile: only(written.lazies, new Set(c.dynamicImports)),
      lazyOnlyInGraph: only(new Set(c.dynamicImports), written.lazies),
    };
    if (Object.values(d).some((list) => list.length)) differing.push({ file: c.file, ...d });
  }
  return { chunks: graph.chunks.length, differing };
}

/** The chunk that holds each source module, by the module's path without its extension. */
function chunkOfModuleMap(graph) {
  const map = new Map();
  for (const c of graph.chunks) for (const id of Object.keys(c.modules ?? {})) map.set(stripExt(id), c);
  return map;
}

/**
 * Check 2: the route-preload table against the walk. For a page with a chunk
 * of its own the row is the page's first view beyond what index.html loads,
 * scripts and stylesheets. For a page packed into a group the row is the
 * group's chunk alone (client/src/lib/routePreload.ts says why).
 */
export function checkPreloadAgainstWalk(graph, routes, indexRefs, tableText) {
  const table = tableText === null ? null : readRoutePreloadTable(tableText);
  if (!table) return { read: false, rows: 0, packed: 0, differing: [] };
  const byModule = chunkOfModuleMap(graph);
  const boot = new Set(firstViewOf(graph, indexRefs, []));
  const bootCss = new Set(graph.chunks.filter((c) => boot.has(c.file)).flatMap((c) => c.css ?? []));
  const rows = new Map(table.rows.map((r) => [r[0], r[1].map((i) => table.files[i])]));
  const differing = [];
  const seen = new Set();
  let matched = 0;
  let packed = 0;
  for (const route of routes) {
    if (route.kind !== "lazy") continue;
    const pattern = routePatternOf(route.path);
    if (seen.has(pattern)) continue;
    seen.add(pattern);
    const listed = rows.get(pattern);
    const page = byModule.get(route.page);
    if (!listed || !page) continue;
    matched += 1;
    const isPacked = stripExt(page.facade ?? "") !== route.page;
    if (isPacked) packed += 1;
    const scripts = isPacked ? [page.file].filter((f) => !boot.has(f)) : firstViewOf(graph, [], [page.file]).filter((f) => !boot.has(f));
    const styles = isPacked ? [] : Array.from(new Set(graph.chunks.filter((c) => scripts.includes(c.file)).flatMap((c) => c.css ?? []).filter((f) => !bootCss.has(f))));
    const wanted = new Set([...scripts, ...styles]);
    const got = new Set(listed.filter((f) => /\.(?:js|css)$/.test(f)));
    const onlyInTable = Array.from(got).filter((f) => !wanted.has(f)).sort();
    const onlyInWalk = Array.from(wanted).filter((f) => !got.has(f)).sort();
    if (onlyInTable.length || onlyInWalk.length) differing.push({ route: route.path, onlyInTable, onlyInWalk });
  }
  return { read: true, rows: matched, packed, differing };
}

/**
 * Check 3: the guard's own record. `buildLog` is the output of a build run
 * with ROUTE_VIEW_REPORT=1, `spec` is scripts/route-first-view.json.
 */
export function checkFirstViewsAgainstGuard(graph, indexRefs, spec, buildLog) {
  const byModule = chunkOfModuleMap(graph);
  const everyPage = (spec.everyPage ?? []).map((p) => byModule.get(stripExt(p))?.file).filter(Boolean);
  const out = [];
  for (const r of spec.routes ?? []) {
    const esc = r.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(`\\[route-first-view\\] ${esc}: [\\d.]+ KB gzipped of \\d+, (\\d+) chunks: (.+)`).exec(buildLog);
    const page = byModule.get(stripExt(r.page))?.file;
    if (!m || !page) {
      out.push({ route: r.path, found: false, guard: 0, walk: 0, onlyInGuard: [], onlyInWalk: [] });
      continue;
    }
    const guard = m[2].trim().split(/\s+/).sort();
    const walk = firstViewOf(graph, indexRefs, [page, ...everyPage]);
    out.push({ route: r.path, found: true, guard: guard.length, walk: walk.length, onlyInGuard: guard.filter((f) => !walk.includes(f)), onlyInWalk: walk.filter((f) => !guard.includes(f)) });
  }
  return out;
}

/** In words, which member pages load a chunk. */
function loadedBy(graph, routes, indexRefs, file) {
  const who = memberRoutesLoading(graph, routes, indexRefs, file);
  const some = (list) => `${list.slice(0, 4).join(", ")}${list.length > 4 ? ` and ${list.length - 4} more` : ""}`;
  if (who.firstPage) return "the first page, on every visit";
  if (who.firstView.length) return `the first view of ${who.firstView.length} member route(s): ${some(who.firstView)}`;
  if (who.later.length) return `a later lazy import on ${who.later.length} member route(s): ${some(who.later)}`;
  return "a lazy import in the first page's own code";
}

/**
 * Admin code the walk found on the members' side: admin routes whose page a
 * member chunk carries, and member chunks holding modules from the admin
 * shell's own folder. The bytes are an ESTIMATE, each chunk's size on disk
 * shared out by the bytes rollup rendered from each module before minifying.
 */
export function leaksOf(graph, split, routes, indexRefs, bytesOf) {
  const share = (c, wanted) => {
    const all = Object.values(c.modules ?? {}).reduce((n, b) => n + b, 0) || 1;
    const part = Object.entries(c.modules ?? {}).filter(([id]) => wanted(id)).reduce((n, [, b]) => n + b, 0);
    return Math.round(((bytesOf.get(c.file) ?? 0) * part) / all);
  };
  const chunks = new Map(graph.chunks.map((c) => [c.file, c]));
  const pages = split.roots
    .filter((r) => !r.heldBack && r.chunk && chunks.has(r.chunk))
    .map((r) => ({ route: r.path, page: r.page, chunk: r.chunk, chunkBytes: bytesOf.get(r.chunk) ?? 0, estBytes: share(chunks.get(r.chunk), (id) => stripExt(id) === r.page), why: r.why, loadedBy: loadedBy(graph, routes, indexRefs, r.chunk) }));
  const parts = memberChunksHolding(graph, split, (id) => id.startsWith(ADMIN_PARTS_DIR)).map((h) => ({
    chunk: h.chunk,
    chunkBytes: bytesOf.get(h.chunk) ?? 0,
    estBytes: share(chunks.get(h.chunk), (id) => id.startsWith(ADMIN_PARTS_DIR)),
    modules: h.modules.length,
    largest: h.modules.slice(0, 4).map((m) => m.id.slice(ADMIN_PARTS_DIR.length)),
    loadedBy: loadedBy(graph, routes, indexRefs, h.chunk),
  }));
  parts.sort((a, b) => b.estBytes - a.estBytes);
  return { pages, parts, estBytes: pages.reduce((n, p) => n + p.estBytes, 0) + parts.reduce((n, p) => n + p.estBytes, 0) };
}

/** What the admin-only side would gain if one more route were an admin root. Nothing is decided here: it is a what-if. */
export function candidateDelta(inputs, baseSplit, routePath) {
  const route = inputs.routes.find((r) => r.path === routePath);
  if (!route) return { route: routePath, known: false };
  const s = classifyDist({ ...inputs, roadPaths: [...ROAD_TO_LAUNCH_PATHS, routePath] });
  const root = s.roots.find((r) => r.path === routePath);
  return { route: routePath, known: true, already: isAdminPath(routePath), page: route.page, chunk: root?.chunk ?? null, adminOnly: Boolean(root?.heldBack), why: root?.why ?? "", addsBytes: s.admin.chargedBytes - baseSplit.admin.chargedBytes, addsFiles: s.admin.files - baseSplit.admin.files };
}

/**
 * The tables, as Markdown.
 *
 * @param {object} m
 * @param {{head: string, subject: string, dirty: boolean, main: string|null, containsMain: boolean|null}|null} m.tree what was built, from git.
 * @param {object} m.gate the gate's own JSON (`check-dist-budget.mjs --json`), `split` included.
 * @param {ReturnType<typeof leaksOf>} m.leaks
 * @param {object} m.checks { graph, preload, firstViews }
 * @param {Array<object>} m.candidates
 * @param {number|null} m.roomKb room measured for what is about to land on the admin side, or null when none was given.
 */
export function splitReportMarkdown(m) {
  const g = m.gate;
  const s = g.split;
  const out = [];
  const say = (line = "") => out.push(line);
  const short = (f) => f.replace(/^assets\//, "");
  say("# The admin and member split of dist/public, measured");
  say();
  say("Written by `node scripts/measure-dist-split.mjs` (or `node scripts/check-dist-budget.mjs --report --split-md <file>` on a build that is already there). Every figure is from one build of one tree; run it again for another.");
  say();
  say("## What was built");
  say();
  if (m.tree) {
    say(`- **The tree:** \`${m.tree.head}\` (${m.tree.subject})${m.tree.dirty ? ", WITH UNCOMMITTED CHANGES" : ""}.`);
    if (m.tree.main) say(`- **Main:** \`origin/main\` is at \`${m.tree.main}\`, and the tree ${m.tree.containsMain ? "contains it" : "DOES NOT contain it: merge main and measure again before setting a number"}.`);
  } else say("- The tree could not be read from git.");
  say(`- ${g.files} files in ${g.directories} directories under dist/public.`);
  say();
  say("## The three numbers the gate has always printed");
  say();
  say("| | Measured | Ceiling |");
  say("|---|---|---|");
  say(`| Main JS (real bytes, one file) | ${g.mainJsKb} KB | ${g.maxMainJsKb} KB |`);
  say(`| First-page JS (real bytes, the ${g.bootJsFiles} scripts index.html loads) | ${g.bootJsKb} KB | ${g.maxBootJsKb} KB |`);
  say(`| Total dist/public (block-charged, 4 KB blocks) | ${g.blockChargedKb} KB | ${g.maxTotalDistKb} KB |`);
  say();
  say(`The same tree is ${g.realKb} KB in real bytes; ${g.overheadKb} KB of the total is block rounding. Headroom ${g.headroomKb} KB.`);
  say();
  say("## The split");
  say();
  if (!s.measured) {
    say(`NOT MEASURED. ${s.why}`);
    return `${out.join("\n")}\n`;
  }
  say("| Side | Files | Real bytes | Block-charged |");
  say("|---|---|---|---|");
  say(`| **Members** | ${s.memberFiles} | ${s.memberRealKb} KB | **${s.memberKb} KB** |`);
  say(`| **Admin-only** | ${s.adminFiles} | ${s.adminRealKb} KB | **${s.adminKb} KB** |`);
  say(`| Together | ${s.memberFiles + s.adminFiles} | ${g.realKb} KB | ${g.blockChargedKb} KB |`);
  say();
  say(`The two sides add up to the total. The members' side carries the directories and the ${s.unnamedFiles.length} file(s) nothing names${s.unnamedFiles.length ? ` (${s.unnamedFiles.join(", ")})` : ""}.`);
  say();
  say("## The admin routes, read from the router");
  say();
  say("| Admin route | Page | Chunk | Counted as |");
  say("|---|---|---|---|");
  for (const r of s.adminRoots) say(`| \`${r.path}\` | ${r.page.replace(/^client\/src\//, "")} | ${r.chunk ? `\`${short(r.chunk)}\`` : "none"} | ${r.adminOnly ? "admin-only" : `**member**: ${r.why}`} |`);
  say();
  say(`## The admin-only files, largest first (${s.adminOnly.length})`);
  say();
  say("| # | File | Real bytes | Block-charged | Owned by |");
  say("|---|---|---|---|---|");
  s.adminOnly.forEach((f, i) => say(`| ${i + 1} | \`${short(f.path)}\` | ${f.bytes.toLocaleString("en-US")} | ${f.chargedKb} KB | ${f.owners.map((o) => `\`${o}\``).join(" ")} |`));
  say();
  const byOwner = new Map();
  for (const f of s.adminOnly) for (const o of f.owners) byOwner.set(o, (byOwner.get(o) ?? 0) + f.chargedKb);
  say(`By owning route: ${Array.from(byOwner, ([o, n]) => `\`${o}\` ${n} KB`).join(", ")}. A file two admin routes both reach is counted under each.`);
  if (s.oldShell) say(`The old admin shell (\`${s.oldShell.page}\`) is ${s.oldShell.chunk ? `in \`${short(s.oldShell.chunk)}\`, **${s.oldShell.chargedKb} KB block-charged**; scripts/admin-shell-step-down.json records ${s.oldShell.recordedKb} KB` : "in no built chunk"}.`);
  say(`Garden code in member chunks: ${s.gardenInMemberChunks.length ? `**YES**, in ${s.gardenInMemberChunks.map((x) => `\`${short(x.chunk)}\``).join(", ")}` : "none"}.`);
  say();
  say("## Leaks: admin code the walk found on the members' side");
  say();
  say(`About **${kb(m.leaks.estBytes)} KB on disk**, an estimate: each chunk's size on disk, shared out by the bytes rollup rendered from each module before minifying.`);
  say();
  if (m.leaks.pages.length) {
    say("Admin routes whose page a member chunk carries:");
    say();
    say("| Admin route | Rides in | Its page there, about | Pulled in by |");
    say("|---|---|---|---|");
    for (const p of m.leaks.pages) say(`| \`${p.route}\` (${p.page.replace(/^client\/src\//, "")}) | \`${short(p.chunk)}\`, ${kb(p.chunkBytes)} KB on disk | ${kb(p.estBytes)} KB | ${p.loadedBy} |`);
    say();
  }
  if (m.leaks.parts.length) {
    say(`Member chunks holding modules from \`${ADMIN_PARTS_DIR}\`:`);
    say();
    say("| Member chunk | On disk | Admin code in it, about | Modules | Pulled in by |");
    say("|---|---|---|---|---|");
    for (const p of m.leaks.parts) say(`| \`${short(p.chunk)}\` | ${kb(p.chunkBytes)} KB | ${kb(p.estBytes)} KB | ${p.modules}: ${p.largest.join(", ")}${p.modules > p.largest.length ? " and more" : ""} | ${p.loadedBy} |`);
    say();
  }
  if (m.candidates.length) {
    say("## What-ifs: a route counted as an admin route");
    say();
    say("Nothing here is decided by the gate. Each line is what the admin-only side would gain if the route were named.");
    say();
    say("| Route | Page | Would add |");
    say("|---|---|---|");
    for (const c of m.candidates) {
      if (!c.known) say(`| \`${c.route}\` | not a route in the router | |`);
      else if (c.already) say(`| \`${c.route}\` | ${c.page ?? ""} | it is an admin route already |`);
      else say(`| \`${c.route}\` | ${(c.page ?? "no lazy page").replace(/^client\/src\//, "")} | ${c.adminOnly ? `${kb(c.addsBytes)} KB in ${c.addsFiles} file(s)` : `nothing: ${c.why || "its page has no chunk to count apart"}`} |`);
    }
    say();
  }
  say("## The checks of the chunk graph, and what disagreed");
  say();
  const cg = m.checks.graph;
  say(`1. **The graph against the built files.** ${cg.chunks} chunks; ${cg.differing.length} whose import statements differ from the graph's edges.${cg.differing.map((d) => ` \`${short(d.file)}\`${d.note ? ` (${d.note})` : ""}`).join(",")}`);
  const cp = m.checks.preload;
  say(cp.read ? `2. **The route-preload table against the walk.** ${cp.rows} routes have a row (${cp.packed} for a page packed into a group, whose row is the group's chunk alone); ${cp.differing.length} differ.${cp.differing.map((d) => ` \`${d.route}\``).join(",")}` : "2. **The route-preload table against the walk.** NOT RUN: index.html loads no script this could read as the table.");
  const cf = m.checks.firstViews;
  if (!cf) say("3. **The route first views guard's own record.** NOT RUN: it needs the log of a build run with ROUTE_VIEW_REPORT=1 (`--build-log <file>`, or `node scripts/measure-dist-split.mjs`, which does both).");
  else say(`3. **The route first views guard's own record.** ${cf.map((r) => (r.found ? `\`${r.route}\` ${r.guard} chunks${r.onlyInGuard.length || r.onlyInWalk.length ? ` (DIFFERS: only in the guard ${r.onlyInGuard.join(" ") || "none"}; only in the walk ${r.onlyInWalk.join(" ") || "none"})` : ""}` : `\`${r.route}\` NOT IN THE LOG`)).join(", ")}. ${cf.every((r) => r.found && !r.onlyInGuard.length && !r.onlyInWalk.length) ? "All agree." : "See the differences named."}`);
  say();
  say("No browser is driven here: these compare records the build itself wrote.");
  say();
  say("## The arithmetic, as a rule, with this build as the worked example");
  say();
  say("Nothing below is written into ci.yml by any script. Apply the rule to the build the numbers are set from.");
  say();
  const ceiling = s.memberKb + g.safetyMarginKb;
  say(`- **Members' ceiling = the members' side + the gate's safety margin.** ${s.memberKb} + ${g.safetyMarginKb} = **${ceiling} KB**. At that number this tree passes on a lane's machine with nothing to spare and CI fails above it. To leave the members' side the room the single ceiling leaves the whole tree today, add the headroom instead of the margin: ${s.memberKb} + ${g.headroomKb} = ${s.memberKb + g.headroomKb} KB.`);
  if (m.roomKb === null) say(`- **Admin allowance = admin-only + room measured for what is about to land behind the admin routes.** ${s.adminKb} + room. No room was given (\`--room-kb <n>\`).`);
  else say(`- **Admin allowance = admin-only + room measured for what is about to land behind the admin routes.** ${s.adminKb} + ${m.roomKb} = **${s.adminKb + m.roomKb} KB**.`);
  const allowance = s.adminKb + (m.roomKb ?? 0);
  say(`- **MAX_TOTAL_DIST_KB = the two added together**, because du gates the whole tree and cannot tell the sides apart: ${ceiling} + ${allowance}${m.roomKb === null ? " + room" : ""} = ${ceiling + allowance} KB${m.roomKb === null ? " + room" : ""}.`);
  if (s.oldShell?.chunk) say(`- **On the day the old admin shell is retired, the allowance comes down by the shell's weight:** ${s.oldShell.chargedKb} KB on this build, to ${allowance - s.oldShell.chargedKb} KB${m.roomKb === null ? " + room" : ""}, and the total by the same.`);
  say("- **Where they go:** `MAX_MEMBER_DIST_KB` and `MAX_ADMIN_DIST_KB` beside the other three in the \"Bundle budget\" step of `.github/workflows/ci.yml`, `MAX_TOTAL_DIST_KB` there set to their sum, and the admin number again as `allowanceWithShellKb` in `scripts/admin-shell-step-down.json`.");
  return `${out.join("\n")}\n`;
}
