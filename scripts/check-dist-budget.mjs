#!/usr/bin/env node
/**
 * The bundle budget, measured the way CI measures it.
 *
 * WHY THIS FILE EXISTS. The budget lived as a shell block in
 * `.github/workflows/ci.yml` and CLAUDE.md said "nothing local reproduces
 * them". That was true, and it cost a lane a full session: the workflow sizes
 * `dist/public` with `du -sk`, and `du` reports ALLOCATED BLOCKS. On the ext4
 * filesystem GitHub runners use, every file consumes a whole 4096-byte block,
 * so a 300-byte chunk costs 4 KB and a 4100-byte chunk costs 8 KB. Add up the
 * rounding across a tree with a hundred small files and the gate reads about
 * 700 KB heavier than the bytes actually on disk. A lane that measured real
 * bytes locally saw headroom that CI did not have.
 *
 * THE COUNTER-INTUITIVE PART, and the reason this is worth a script instead of
 * a comment: the two budgets pull in opposite directions.
 *
 *   MAX_MAIN_JS_KB is REAL BYTES on one file. Splitting a route out of the
 *   main chunk makes that number fall. Splitting is the fix.
 *   MAX_TOTAL_DIST_KB is BLOCK-CHARGED bytes across the tree. Splitting a
 *   4 KB module into its own chunk adds a whole block whatever the module
 *   weighs, so splitting makes that number RISE. Merging is the fix.
 *
 * A build tuned only for the first budget quietly spends the second. This
 * script prints both so the trade is visible before a push, and it names the
 * files paying the most padding so the next lane knows where to look.
 *
 * WHAT IT MEASURES, precisely, so the arithmetic can be checked by hand:
 *   real bytes      sum of file sizes.
 *   block-charged   sum of ceil(size / 4096) * 4096 over files, plus what each
 *                   directory costs. Empty files cost nothing, which is what
 *                   `du` reports for them.
 *
 * A DIRECTORY IS NOT ALWAYS ONE BLOCK, which is the detail that made a first
 * version of this read 8 KB light. ext4 stores directory entries in 4 KB
 * blocks and grows past one once the names stop fitting, then adds an htree
 * index block on top. `dist/public/assets` holds about 120 hashed filenames
 * and measures 12288 bytes on ext4, three blocks where the other five
 * directories in the tree take one each. So directories are costed from their
 * entry names here, the same way the filesystem does it. Checked against a
 * real ext4 volume: `du -sk` said 5432 KB and this says 5432 KB.
 *
 * The numbers come off `.github/workflows/ci.yml`, which CLAUDE.md names as
 * the authority for them, so this script cannot drift from the gate by holding
 * a stale copy. Environment variables override for a what-if run.
 *
 * Usage:
 *   node scripts/check-dist-budget.mjs           # the gate, plus the report
 *   node scripts/check-dist-budget.mjs --report  # measure only, always exit 0
 *   node scripts/check-dist-budget.mjs --json    # machine readable
 *   node scripts/check-dist-budget.mjs --admin-top 25   # list more of the admin-only files (ten by default)
 *   node scripts/check-dist-budget.mjs --root <dir>     # measure another tree; only the self-test uses it
 *
 * THE ADMIN AND MEMBER SPLIT (the founder's ruling, 28 Nov 2026). One total
 * counted an admin-only page as though every member paid for it. The script
 * now also says which files only an admin page loads and which a member can,
 * decided from the routes and the build's own chunk graph, never from a file
 * name or a kept list (scripts/lib/distSplit.mjs has the rule, and
 * vite.config.ts writes the graph to dist/chunk-graph.json). It prints both
 * sides under the three budget lines, the admin-only files with their sizes,
 * and one line saying whether any member chunk holds the Admin Garden's code.
 *
 * Two more numbers gate them, read like the other three (the environment, then
 * `.github/workflows/ci.yml`): MAX_MEMBER_DIST_KB, the members' ceiling, and
 * MAX_ADMIN_DIST_KB, the admin allowance. WITH BOTH UNSET NOTHING IS GATED
 * THAT WAS NOT GATED BEFORE: the single total decides alone, exactly as it
 * did, and the split is only printed. With both set, each side is held to its
 * own number as well as the total to its own. An admin allowance with no
 * members' ceiling is a mistake and fails by name; a members' ceiling with no
 * admin allowance gates nothing and says so in a warning, because with no
 * admin allowance this script exits as it always did. The total keeps its own
 * check either way, so MAX_TOTAL_DIST_KB has to be the two added together on
 * the day they are set. The members' ceiling carries the same safety
 * margin as the total, because the members' side carries the directories,
 * which is where du and this model can part by a block; the admin side is a
 * plain sum of file blocks and needs none.
 *
 * THE SAFETY MARGIN (26 Nov 2026, the coordinator's ruling, Option A). On a
 * lane's machine this fails inside the last SAFETY_MARGIN_KB of the ceiling, not
 * only above it. `du -sk` on the CI runner is the gate (CLAUDE.md names it the
 * authority), and on ea9a3a1 it read 8004 KB where this model read 7996 KB: the
 * ext4 directory layout depends on the hashed file names, so two near-identical
 * trees land a couple of blocks apart. A tree inside the margin can therefore
 * pass here and fail there, and a local number should err safe. On the runner
 * (GITHUB_ACTIONS=true) du gates, so this script fails only above the ceiling
 * there, as before, and prints a warning inside the margin. `--no-margin` turns
 * the margin off for a what-if. The ceiling itself is not moved by this.
 *
 * Read the exit code. A failing run prints `::error::` lines that GitHub lifts
 * into the run summary, and those are not reliably the last line on a
 * terminal.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BLOCK, GARDEN_DIR, charged, classifyDist, memberChunksHolding, routesFromApp, splitTotals, textNames, unreadRoutes } from "./lib/distSplit.mjs";
import { budgetInWorkflow, stepDownVerdict } from "./lib/adminShellStepDown.mjs";

const args = process.argv.slice(2);
/** The value after a flag, or null: `--root <dir>`, `--admin-top <n>`. */
const valueOf = (flag) => (args.includes(flag) ? (args[args.indexOf(flag) + 1] ?? null) : null);

const ROOT = valueOf("--root") ? path.resolve(valueOf("--root")) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist", "public");
const WORKFLOW = path.join(ROOT, ".github", "workflows", "ci.yml");
/** The build's chunk graph, written beside dist/public by vite.config.ts (writeChunkGraph). */
const GRAPH = path.join(ROOT, "dist", "chunk-graph.json");
const ROUTER = path.join(ROOT, "client", "src", "App.tsx");
/** The old admin shell and what it weighs, for the day it is retired (scripts/lib/adminShellStepDown.mjs). */
const STEP_DOWN = path.join(ROOT, "scripts", "admin-shell-step-down.json");

const asJson = args.includes("--json");
/** du's drift from this model seen on a runner (8 KB on ea9a3a1), plus a block. */
const SAFETY_MARGIN_KB = 12;
const onRunner = process.env.GITHUB_ACTIONS === "true";
const marginApplies = !onRunner && !args.includes("--no-margin");
const reportOnly = args.includes("--report");
const adminTop = /^\d+$/.test(valueOf("--admin-top") ?? "") ? Number(valueOf("--admin-top")) : 10;

/** Reads a budget off the workflow so this script and CI cannot disagree. */
function budgetFromWorkflow(name, fallback) {
  const fromEnv = process.env[name];
  if (fromEnv && /^\d+$/.test(fromEnv)) return { value: Number(fromEnv), source: "env" };
  try {
    const inWorkflow = budgetInWorkflow(fs.readFileSync(WORKFLOW, "utf8"), name);
    if (inWorkflow !== null) return { value: inWorkflow, source: ".github/workflows/ci.yml" };
  } catch {
    /* falls through to the fallback below */
  }
  return { value: fallback, source: fallback === null ? "not set" : "built-in fallback" };
}

/**
 * What one directory costs on ext4, from the names it holds.
 *
 * Each entry is an 8-byte header plus the name rounded up to a multiple of 4,
 * and the first block also carries `.` and `..`. A small directory is one
 * linear block. Once the entries stop fitting, ext4 switches to an htree: one
 * index block above some number of leaf blocks.
 *
 * The leaves are the part worth explaining. An htree splits a leaf by HASH
 * RANGE and not by fill, so leaves sit partly empty and counting bytes as
 * though they packed tight reads a block light. LEAF_FILL is where that lands
 * in practice, and it is pinned tighter than it looks: on the trees checked
 * here 7100 bytes of entries took two leaves and 8044 took three, which puts
 * the boundary between 0.867 and 0.982, and 0.9 sits inside it.
 *
 * This is a model of a filesystem, so treat it as accurate to about one block
 * per large directory. It matched `du -sk` exactly on four different built
 * trees, and CI still runs `du` beside it as the authority.
 */
const LEAF_FILL = 0.9;
function directoryBytes(names) {
  const ENTRY_HEADER = 8;
  const DOT_ENTRIES = 24;
  const dirents = names.reduce((sum, n) => sum + ENTRY_HEADER + Math.ceil(Buffer.byteLength(n, "utf8") / 4) * 4, 0);
  if (dirents + DOT_ENTRIES <= BLOCK) return BLOCK;
  return (Math.ceil(dirents / (BLOCK * LEAF_FILL)) + 1) * BLOCK;
}

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  out.dirBytes += directoryBytes(entries.map((e) => e.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.dirs += 1;
      walk(full, out);
    } else if (entry.isFile()) {
      out.files.push({ path: path.relative(DIST, full).split(path.sep).join("/"), bytes: fs.statSync(full).size });
    }
  }
  return out;
}

const kb = (bytes) => Math.floor(bytes / 1024);

if (!fs.existsSync(DIST)) {
  console.error("::error::dist/public is missing. Run pnpm build first: this gate measures the built tree.");
  process.exit(1);
}

const scan = walk(DIST, { files: [], dirs: 1, dirBytes: 0 });
const files = scan.files;

const realBytes = files.reduce((sum, f) => sum + f.bytes, 0);
const fileBlocks = files.reduce((sum, f) => sum + charged(f.bytes), 0);
const blockBytes = fileBlocks + scan.dirBytes;
const overheadBytes = blockBytes - realBytes;

const buckets = [
  { label: "under 1 KB", min: 0, max: 1024 },
  { label: "1 to 2 KB", min: 1024, max: 2048 },
  { label: "2 to 4 KB", min: 2048, max: 4096 },
  { label: "4 to 8 KB", min: 4096, max: 8192 },
  { label: "over 8 KB", min: 8192, max: Infinity },
];
const histogram = buckets.map((b) => {
  const inBucket = files.filter((f) => f.bytes >= b.min && f.bytes < b.max);
  return {
    label: b.label,
    count: inBucket.length,
    paddingBytes: inBucket.reduce((sum, f) => sum + (charged(f.bytes) - f.bytes), 0),
  };
});

/*
 * Zero-byte files are counted here and contribute nothing, which keeps this
 * line's count equal to the first three histogram buckets. `du` charges an
 * empty file no blocks, so it wastes no padding either.
 */
const subBlock = files.filter((f) => f.bytes < BLOCK);
const subBlockPadding = subBlock.reduce((sum, f) => sum + (f.bytes === 0 ? 0 : BLOCK - f.bytes), 0);

const worst = files
  .map((f) => ({ ...f, padding: charged(f.bytes) - f.bytes }))
  .sort((a, b) => b.padding - a.padding)
  .slice(0, 12);

/** The main chunk is the largest `assets/index-*.js`, matching the workflow. */
const mainCandidates = files.filter((f) => /^assets\/index-[^/]*\.js$/.test(f.path)).sort((a, b) => b.bytes - a.bytes);
const mainBytes = mainCandidates.length ? mainCandidates[0].bytes : 0;

/**
 * THE FIRST PAGE'S SCRIPTS, every `.js` file index.html names (the entry
 * script, its modulepreloads, the route preloader), in real bytes. Main JS
 * reads one file, and how rollup spreads the boot modules over files is a
 * chunking choice: on 2026-10-31 the small-module groups in vite.config.ts
 * moved react and the shared boot modules out of the entry chunk, and main JS
 * fell from 620 KB to 362 KB while the first page loaded the same code. This
 * number does not move when code only changes file, so it is the one that
 * says what a visitor fetches before anything renders.
 */
const indexHtml = fs.existsSync(path.join(DIST, "index.html")) ? fs.readFileSync(path.join(DIST, "index.html"), "utf8") : "";
const bootPaths = new Set(Array.from(indexHtml.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.js)"/g), (m) => m[1]));
const bootFiles = files.filter((f) => bootPaths.has(f.path));
const bootBytes = bootFiles.reduce((sum, f) => sum + f.bytes, 0);

const MAX_MAIN = budgetFromWorkflow("MAX_MAIN_JS_KB", 700);
const MAX_BOOT = budgetFromWorkflow("MAX_BOOT_JS_KB", 750);
const MAX_TOTAL = budgetFromWorkflow("MAX_TOTAL_DIST_KB", 7600);

const mainKb = kb(mainBytes);
const bootKb = kb(bootBytes);
const totalKb = kb(blockBytes);
const realKb = kb(realBytes);

/*
 * THE ADMIN AND MEMBER SPLIT (see the header, and scripts/lib/distSplit.mjs
 * for the rule). Both numbers are unset until the founder and the coordinator
 * choose them, and unset means the single total gates alone, as before.
 */
const MAX_MEMBER = budgetFromWorkflow("MAX_MEMBER_DIST_KB", null);
const MAX_ADMIN = budgetFromWorkflow("MAX_ADMIN_DIST_KB", null);
const splitGated = MAX_MEMBER.value !== null && MAX_ADMIN.value !== null;
const splitHalfSet = (MAX_MEMBER.value === null) !== (MAX_ADMIN.value === null);

/**
 * Reads the build's chunk graph and the router and puts every file on a side.
 * Returns `{ measured: false, why }` whenever the split cannot be trusted: no
 * graph, a graph from another build, or a route the reader cannot read. An
 * unread route is refused because a member page nobody saw could let an admin
 * page that shares its chunk count as admin-only, which is the unsafe way round.
 */
function measureSplit() {
  if (!fs.existsSync(GRAPH)) return { measured: false, why: "dist/chunk-graph.json is missing. The build writes it (writeChunkGraph in vite.config.ts): run pnpm build." };
  if (!fs.existsSync(ROUTER)) return { measured: false, why: "client/src/App.tsx is missing, and the admin routes are read from it." };
  let graph;
  try {
    graph = JSON.parse(fs.readFileSync(GRAPH, "utf8"));
  } catch (err) {
    return { measured: false, why: `dist/chunk-graph.json does not parse (${err.message}). Run pnpm build.` };
  }
  if (!Array.isArray(graph.chunks) || graph.chunks.length === 0) return { measured: false, why: "dist/chunk-graph.json lists no chunks. Run pnpm build." };
  const onDisk = new Set(files.map((f) => f.path));
  const gone = graph.chunks.map((c) => c.file).filter((f) => !onDisk.has(f));
  if (gone.length) {
    return { measured: false, why: `dist/chunk-graph.json is from another build: ${gone.length} of its ${graph.chunks.length} chunks are not in dist/public (${gone.slice(0, 3).join(", ")}). Run pnpm build.` };
  }
  const routes = routesFromApp(fs.readFileSync(ROUTER, "utf8"));
  const unread = unreadRoutes(routes);
  if (routes.length === 0 || unread.length) {
    return {
      measured: false,
      why: routes.length === 0
        ? "no route was read from client/src/App.tsx, so no admin route is known. Teach routesFromApp in scripts/lib/distSplit.mjs the router's new shape."
        : `client/src/App.tsx has ${unread.length} route(s) this cannot read (${unread.join(", ")}). Teach routesFromApp in scripts/lib/distSplit.mjs the new shape.`,
    };
  }
  // What index.html names, and which built text names which other file (a stylesheet's fonts, a chunk's images).
  const indexRefs = Array.from(new Set(Array.from(indexHtml.matchAll(/(?:src|href|content)="\/?([^"#?]+)"/g), (m) => m[1]).filter((f) => onDisk.has(f))));
  const chunkFiles = new Set(graph.chunks.map((c) => c.file));
  const texts = files.filter((f) => /\.(?:js|css|html|json|webmanifest|txt|xml|svg)$/.test(f.path)).map((f) => ({ path: f.path, text: fs.readFileSync(path.join(DIST, f.path), "utf8") }));
  const textRefs = [];
  for (const f of files) {
    if (chunkFiles.has(f.path)) continue;
    for (const t of texts) if (t.path !== f.path && textNames(t.text, f.path)) textRefs.push({ from: t.path, to: f.path });
  }
  const split = classifyDist({ graph, routes, files, indexRefs, textRefs });
  return { measured: true, split, totals: splitTotals(split, scan.dirBytes), garden: memberChunksHolding(graph, split, (id) => id.startsWith(GARDEN_DIR)), oldShell: oldShellIn(graph) };
}

/**
 * THE STEP DOWN (the ruling's fourth point): the old admin shell, as
 * scripts/admin-shell-step-down.json records it, and whether any built chunk
 * still holds it. Once none does, the admin allowance must have come down by
 * the shell's recorded weight, or the gate fails; with no admin allowance set
 * there is nothing to come down and nothing here can fail. Null when the
 * record is not there, which is how it is once the step down is done.
 */
function oldShellIn(graph) {
  if (!fs.existsSync(STEP_DOWN)) return null;
  let record;
  try {
    record = JSON.parse(fs.readFileSync(STEP_DOWN, "utf8"));
  } catch (err) {
    return { unreadable: `scripts/admin-shell-step-down.json does not parse (${err.message})` };
  }
  const holder = graph.chunks.find((c) => Object.keys(c.modules ?? {}).includes(record.page));
  const bytes = holder ? (files.find((f) => f.path === holder.file)?.bytes ?? 0) : 0;
  return { record, chunk: holder?.file ?? null, chargedKb: holder ? kb(charged(bytes)) : null, verdict: stepDownVerdict(record, Boolean(holder), MAX_ADMIN.value) };
}
const sm = measureSplit();
const memberKb = sm.measured ? kb(sm.totals.memberChargedBytes) : null;
const adminKb = sm.measured ? kb(sm.totals.adminChargedBytes) : null;

const result = {
  files: files.length,
  directories: scan.dirs,
  realKb,
  blockChargedKb: totalKb,
  headroomKb: MAX_TOTAL.value - totalKb,
  safetyMarginKb: SAFETY_MARGIN_KB,
  overheadKb: kb(overheadBytes),
  subBlockFiles: subBlock.length,
  subBlockPaddingKb: kb(subBlockPadding),
  mainJsKb: mainKb,
  maxMainJsKb: MAX_MAIN.value,
  bootJsKb: bootKb,
  bootJsFiles: bootFiles.length,
  maxBootJsKb: MAX_BOOT.value,
  maxTotalDistKb: MAX_TOTAL.value,
  histogram: histogram.map((h) => ({ label: h.label, count: h.count, paddingKb: kb(h.paddingBytes) })),
  worstPadding: worst.map((w) => ({ path: w.path, bytes: w.bytes, paddingBytes: w.padding })),
  /*
   * No key in here is spelled like the total's own: ci.yml reads that one out
   * of this JSON with a line-by-line sed, and a second line with the same key
   * would hand it two numbers.
   */
  split: sm.measured
    ? {
        measured: true,
        memberKb,
        memberRealKb: kb(sm.totals.memberRealBytes),
        memberFiles: sm.totals.memberFiles,
        maxMemberDistKb: MAX_MEMBER.value,
        adminKb,
        adminRealKb: kb(sm.totals.adminRealBytes),
        adminFiles: sm.totals.adminFiles,
        maxAdminDistKb: MAX_ADMIN.value,
        gated: splitGated,
        adminOnly: sm.split.adminFiles.map((f) => ({ path: f.path, bytes: f.bytes, chargedKb: kb(f.chargedBytes), owners: f.owners })),
        adminRoots: sm.split.roots.map((r) => ({ path: r.path, page: r.page, chunk: r.chunk, adminOnly: r.heldBack, why: r.why })),
        unnamedFiles: sm.split.unnamedFiles,
        notes: sm.split.notes,
        gardenInMemberChunks: sm.garden.map((g) => ({ chunk: g.chunk, modules: g.modules.map((m) => m.id) })),
        oldShell: sm.oldShell?.record ? { page: sm.oldShell.record.page, chunk: sm.oldShell.chunk, chargedKb: sm.oldShell.chargedKb, recordedKb: sm.oldShell.record.chargedKb, stepDownOk: sm.oldShell.chunk ? true : sm.oldShell.verdict.ok } : null,
      }
    : { measured: false, why: sm.why, gated: splitGated },
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
}

const lines = [];
const say = (line) => {
  lines.push(line);
  if (!asJson) console.log(line);
};

say("dist/public, measured two ways");
say(`  files                    ${files.length} in ${scan.dirs} directories`);
say(`  real bytes               ${realKb} KB`);
say(`  block-charged (du, ext4) ${totalKb} KB   <- THIS is what MAX_TOTAL_DIST_KB gates`);
say(`  padding overhead         ${kb(overheadBytes)} KB`);
say(`  files under 4 KB         ${subBlock.length}, burning ${kb(subBlockPadding)} KB in padding alone`);
say("");
say("size histogram");
for (const h of histogram) {
  say(`  ${h.label.padEnd(11)} ${String(h.count).padStart(4)} file(s), ${String(kb(h.paddingBytes)).padStart(4)} KB padding`);
}
say("");
say("worst offenders by padding");
for (const w of worst) {
  say(`  ${String(w.padding).padStart(5)} B wasted  ${String(w.bytes).padStart(7)} B on disk  ${w.path}`);
}
say("");
say(`Main JS: ${mainKb} KB of ${MAX_MAIN.value} KB, measured in REAL bytes (${MAX_MAIN.source})`);
say(`First-page JS: ${bootKb} KB of ${MAX_BOOT.value} KB across the ${bootFiles.length} scripts index.html loads, in REAL bytes (${MAX_BOOT.source})`);
say(`Total dist/public: ${totalKb} KB of ${MAX_TOTAL.value} KB, measured in BLOCK-CHARGED bytes (${MAX_TOTAL.source})`);
say(`  the same tree is ${realKb} KB in real bytes, so ${kb(overheadBytes)} KB of the ceiling pays for 4 KB block rounding`);
say(`  headroom ${MAX_TOTAL.value - totalKb} KB; the last ${SAFETY_MARGIN_KB} KB below the ceiling is a safety margin, because du on the CI runner can read a couple of blocks above this model`);
if (!sm.measured) {
  say(`Members' side and admin-only: NOT MEASURED. ${sm.why}`);
} else {
  const t = sm.totals;
  const of = (max) => (max.value === null ? "" : ` of ${max.value} KB`);
  const from = (max, name) => (max.value === null ? `${name} is not set` : max.source);
  say(`Members' side: ${memberKb} KB${of(MAX_MEMBER)}, measured in BLOCK-CHARGED bytes across ${t.memberFiles} files a member's page can load (${from(MAX_MEMBER, "MAX_MEMBER_DIST_KB")})`);
  say(`Admin-only: ${adminKb} KB${of(MAX_ADMIN)}, measured in BLOCK-CHARGED bytes across ${t.adminFiles} files only an admin route loads (${from(MAX_ADMIN, "MAX_ADMIN_DIST_KB")})`);
  say(`  in real bytes ${kb(t.memberRealBytes)} KB and ${kb(t.adminRealBytes)} KB; the two sides add up to the total, and the members' side carries the directories (${kb(scan.dirBytes)} KB) and the ${sm.split.unnamed.files} file(s) nothing names`);
  if (!splitGated) say("  neither side is gated until both numbers are set; the total above decides alone, as it always has");
  const shown = sm.split.adminFiles.slice(0, adminTop);
  say(`  admin-only files, largest first (${shown.length} of ${sm.split.adminFiles.length}; --admin-top <n> for more)`);
  for (const f of shown) say(`    ${String(kb(f.chargedBytes)).padStart(5)} KB  ${String(f.bytes).padStart(7)} B on disk  ${f.path}  ${f.owners.join(" ")}`);
  const carried = sm.split.roots.filter((r) => !r.heldBack);
  if (carried.length) {
    say(`  ${carried.length} admin route(s) whose page is NOT admin-only, so its code counts on the members' side:`);
    for (const r of carried) say(`    ${r.path}  ${r.page}  in ${r.chunk ?? "no chunk"}: ${r.why}`);
  }
  if (sm.split.unnamedFiles.length) say(`  nothing names, so counted on the members' side: ${sm.split.unnamedFiles.join(" ")}`);
  if (sm.garden.length === 0) {
    say(`Garden code in member chunks: none. No chunk a member's page can load holds a module from ${GARDEN_DIR}`);
  } else {
    say(`Garden code in member chunks: YES, ${sm.garden.length} chunk(s) a member's page can load hold modules from ${GARDEN_DIR}`);
    for (const g of sm.garden) say(`    ${g.chunk}: ${g.modules.map((m) => m.id).join(" ")}`);
  }
  const shell = sm.oldShell;
  if (shell?.unreadable) say(`Old admin shell: ${shell.unreadable}`);
  else if (shell?.chunk) {
    const moved = shell.chargedKb === shell.record.chargedKb ? "" : `. The record is out of date: write ${shell.chargedKb} there before the day the shell is retired`;
    say(`Old admin shell: ${shell.record.page} is in ${shell.chunk}, ${shell.chargedKb} KB block-charged; scripts/admin-shell-step-down.json records ${shell.record.chargedKb} KB, which the admin allowance steps down by when it is retired${moved}`);
  } else if (shell) say(`Old admin shell: ${shell.record.page} is in no built chunk. ${shell.verdict.message}`);
}
say("");
say("Splitting a chunk lowers main JS and RAISES the block-charged total.");
say("Merging small chunks lowers the total. Watch both numbers on any chunking change.");

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n`);
}

if (reportOnly) process.exit(0);

let fail = 0;
if (!mainCandidates.length) {
  console.error("::error::No dist/public/assets/index-*.js found. The build did not produce a main chunk.");
  fail = 1;
}
if (mainKb > MAX_MAIN.value) {
  console.error(
    `::error::Main JS bundle is ${mainKb} KB, over the ${MAX_MAIN.value} KB budget. Split a route instead of raising the budget. Note that splitting adds a 4 KB block to the total below.`,
  );
  fail = 1;
}
if (!bootFiles.length) {
  console.error("::error::dist/public/index.html names no assets/*.js script. The build did not produce a first page to measure.");
  fail = 1;
}
if (bootKb > MAX_BOOT.value) {
  console.error(
    `::error::The first page loads ${bootKb} KB of scripts across ${bootFiles.length} files, over the ${MAX_BOOT.value} KB budget. Something the entry imports statically grew or joined it; make it lazy instead of raising the budget.`,
  );
  fail = 1;
}
if (totalKb > MAX_TOTAL.value) {
  console.error(
    `::error::dist/public is ${totalKb} KB block-charged (${realKb} KB of real bytes plus ${kb(overheadBytes)} KB of 4 KB block padding), over the ${MAX_TOTAL.value} KB budget. Check whether something large landed in client/public and belongs in the uploads volume, and whether a crop of sub-4 KB chunks can merge into their parents.`,
  );
  fail = 1;
}
if (totalKb <= MAX_TOTAL.value && totalKb > MAX_TOTAL.value - SAFETY_MARGIN_KB) {
  const why = `dist/public is ${totalKb} KB block-charged, inside the ${SAFETY_MARGIN_KB} KB safety margin below the ${MAX_TOTAL.value} KB budget. du on the CI runner, which is the gate, has read 8 KB above this model on a near-identical tree (ea9a3a1), so this tree can pass here and fail there. Make room (merge sub-4 KB chunks into their parents, or move art to the uploads volume) instead of hoping.`;
  if (marginApplies) {
    console.error(`::error::${why}`);
    fail = 1;
  } else {
    console.error(`::warning::${why}`);
  }
}

/*
 * THE TWO SIDES, only once both numbers exist. Everything above this line is
 * the gate as it was; with MAX_MEMBER_DIST_KB and MAX_ADMIN_DIST_KB unset none
 * of the checks below can fire.
 */
if (splitHalfSet && MAX_ADMIN.value === null) {
  // No admin allowance means the gate as it was, whatever else is set: said aloud, never a failure of its own.
  console.error("::warning::MAX_MEMBER_DIST_KB is set and MAX_ADMIN_DIST_KB is not, so neither side is gated and the total decides alone. Set the admin allowance beside it to hold each side to its own number.");
}
if (splitHalfSet && MAX_MEMBER.value === null) {
  console.error("::error::MAX_ADMIN_DIST_KB is set and MAX_MEMBER_DIST_KB is not. An admin allowance needs the members' ceiling beside it: without one, nothing says how much of dist/public a member's page may load.");
  fail = 1;
}
if (splitGated && !sm.measured) {
  console.error(`::error::MAX_MEMBER_DIST_KB and MAX_ADMIN_DIST_KB are set, and the two sides of dist/public could not be measured. ${sm.why}`);
  fail = 1;
}
if (splitGated && sm.measured) {
  if (memberKb > MAX_MEMBER.value) {
    console.error(
      `::error::The members' side of dist/public is ${memberKb} KB block-charged, over the members' ceiling of ${MAX_MEMBER.value} KB (MAX_MEMBER_DIST_KB). The admin allowance cannot pay for it: a file counts here when any member's page can load it. If a member page newly imports an admin module, that module's chunk moved to this side; load it from an admin route only, or lazily behind one. Otherwise merge sub-4 KB chunks into their parents or move art to the uploads volume.`,
    );
    fail = 1;
  } else if (memberKb > MAX_MEMBER.value - SAFETY_MARGIN_KB) {
    const why = `The members' side of dist/public is ${memberKb} KB block-charged, inside the ${SAFETY_MARGIN_KB} KB safety margin below the members' ceiling of ${MAX_MEMBER.value} KB. It carries the directories, which is where du on the CI runner can read a couple of blocks above this model, so this tree can pass here and fail there. Make room instead of hoping.`;
    if (marginApplies) {
      console.error(`::error::${why}`);
      fail = 1;
    } else {
      console.error(`::warning::${why}`);
    }
  }
  if (adminKb > MAX_ADMIN.value) {
    console.error(
      `::error::The admin-only files in dist/public are ${adminKb} KB block-charged, over the admin allowance of ${MAX_ADMIN.value} KB (MAX_ADMIN_DIST_KB). The report above lists them, largest first, with the admin route that owns each. Trim the largest, or share what two admin pages both carry.`,
    );
    fail = 1;
  }
}
/*
 * THE STEP DOWN. Only when the old shell is in no built chunk, an admin
 * allowance is set and the record carries the allowance it had with the shell:
 * with any of the three missing the verdict is "nothing to step down". While
 * the shell still ships, keeping the record in step with ci.yml is the
 * self-test's to hold (scripts/admin-shell-step-down.test.mjs), never this gate's.
 */
if (sm.measured && sm.oldShell?.record && !sm.oldShell.chunk && !sm.oldShell.verdict.ok) {
  console.error(`::error::${sm.oldShell.verdict.message}`);
  fail = 1;
}
process.exit(fail);
