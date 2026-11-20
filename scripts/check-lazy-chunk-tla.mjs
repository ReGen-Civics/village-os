#!/usr/bin/env node
/**
 * LAZY CHUNKS MAY NOT RACE ON A TOP-LEVEL AWAIT (crash guard, 19 Nov 2026).
 *
 * Release 1.3.27 fixed a crash on /propose-a-role in iOS Safari. Two
 * components each lazily imported VoiceStepMore.tsx, whose chunk began with a
 * top-level await (the copy loader in client/src/i18n/copySplit.ts). Two
 * imports of a module that is still awaiting let Safari hand one importer the
 * module before its top-level `let`s existed, and a useSyncExternalStore
 * snapshot threw "Cannot access uninitialized variable". Nothing stopped the
 * pattern shipping, and nothing reported it: an applicant told us.
 *
 * The build now fetches each lazy chunk's copy BEFORE the import, so no lazy
 * chunk awaits anything while it evaluates (copySplit.ts, wrapPreloadHelper).
 * This reads the BUILT chunks in dist/public/assets and holds both halves:
 *
 *  1. THE RACE. A chunk with a top-level await AND top-level `let`/`var`
 *     state that more than one import site can reach (a dynamic import of it,
 *     or of any chunk that imports it statically) fails. That is the exact
 *     1.3.27 shape, whatever put the await there.
 *  2. THE OLD LOADER. A chunk that still awaits `__villageCopyLoad` fails:
 *     copySplit.ts went back to the shape that caused the crash.
 *  3. THE COPY ARRIVES FIRST. A chunk that reads a part with
 *     `__villageCopyGet("<part>")` must have that part named beside its file
 *     (`file~part`) in the preload list of EVERY dynamic import that can run
 *     it, unless the importer already loaded it statically. A boot chunk may
 *     not read a part at all, because nothing fetches one before the entry
 *     runs. Without this, the read throws at runtime on a route nobody tested.
 *
 * The page entry is whatever module script dist/public/index.html loads.
 * It parses every chunk with Vite's own parser (Rollup's), so it reads syntax,
 * never a regex over minified text. It needs a built tree: run `pnpm build`
 * first. A tree with no chunks, or one where it found no import sites at all,
 * fails, so a broken walker cannot read as clean.
 *
 * Usage: node scripts/check-lazy-chunk-tla.mjs [assetsDir] [--json]
 * Exit:  0 clean, 1 a rule failed, 2 the tree could not be read.
 * Tests: node scripts/check-lazy-chunk-tla.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { parseAst } from "vite";

const args = process.argv.slice(2);
const json = args.includes("--json");
const dir = path.resolve(args.find((a) => !a.startsWith("--")) ?? "dist/public/assets");

function die(msg) {
  console.error(`check-lazy-chunk-tla: ${msg}`);
  process.exit(2);
}

if (!fs.existsSync(dir)) die(`${dir} does not exist. Run pnpm build first.`);
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js"));
if (files.length === 0) die(`no .js chunks in ${dir}. Run pnpm build first.`);

const FUNCTION = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);
const PART_READ = /^__villageCopyGet$/;

/** Resolve a relative import specifier from one chunk to a chunk file name in `dir`, or null. */
function resolve(spec) {
  if (typeof spec !== "string" || !spec.startsWith("./")) return null;
  const name = spec.slice(2).split(/[?#]/)[0];
  return files.includes(name) ? name : null;
}

/** Every fact the rules need about one chunk. */
function analyse(file) {
  const code = fs.readFileSync(path.join(dir, file), "utf8");
  let ast;
  try {
    ast = parseAst(code);
  } catch (e) {
    die(`${file} does not parse: ${e.message}`);
  }
  const facts = { file, statics: [], sites: [], tla: false, mutable: [], partsRead: [], oldLoader: /__villageCopyLoad\b/.test(code), mapDeps: null };

  for (const node of ast.body) {
    const decl = node.type === "ExportNamedDeclaration" ? node.declaration : node;
    if ((node.type === "ImportDeclaration" || node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") && node.source) {
      const to = resolve(node.source.value);
      if (to) facts.statics.push(to);
    }
    if (decl?.type === "VariableDeclaration") {
      if (decl.kind === "let" || decl.kind === "var") {
        for (const d of decl.declarations) facts.mutable.push(d.id.type === "Identifier" ? d.id.name : "(pattern)");
      }
      for (const d of decl.declarations) {
        if (d.id.type === "Identifier" && d.id.name === "__vite__mapDeps") facts.mapDeps = stringArrayIn(d.init);
      }
    }
  }

  // One walk with an ancestor stack: top-level awaits, part reads, and dynamic import sites.
  const stack = [];
  const visit = (node) => {
    if (!node || typeof node.type !== "string") return;
    const inFunction = stack.some((n) => FUNCTION.has(n.type) || n.type === "MethodDefinition" || n.type === "PropertyDefinition" || n.type === "StaticBlock");
    if (!inFunction && (node.type === "AwaitExpression" || (node.type === "ForOfStatement" && node.await))) facts.tla = true;
    if (node.type === "CallExpression") {
      const callee = node.callee;
      const name = callee.type === "MemberExpression" && !callee.computed ? callee.property.name : callee.type === "Identifier" ? callee.name : null;
      if (name && PART_READ.test(name) && node.arguments[0]?.type === "Literal") facts.partsRead.push(node.arguments[0].value);
    }
    if (node.type === "ImportExpression") {
      const target = node.source.type === "Literal" ? resolve(node.source.value) : null;
      facts.sites.push({ target, raw: node.source.type === "Literal" ? node.source.value : "(computed)", deps: depsOfSite(stack) });
    }
    stack.push(node);
    for (const [key, child] of Object.entries(node)) {
      if (key === "type" || key === "start" || key === "end") continue;
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
    }
    stack.pop();
  };
  visit(ast);
  facts.code = code;
  return facts;
}

/** The first array of string literals inside `node`: the file table of `__vite__mapDeps`. */
function stringArrayIn(node) {
  let found = null;
  const visit = (n) => {
    if (found || !n || typeof n.type !== "string") return;
    if (n.type === "ArrayExpression" && n.elements.length > 0 && n.elements.every((e) => e?.type === "Literal" && typeof e.value === "string")) {
      found = n.elements.map((e) => e.value);
      return;
    }
    for (const [k, c] of Object.entries(n)) {
      if (k === "type") continue;
      if (Array.isArray(c)) c.forEach(visit);
      else if (c && typeof c === "object") visit(c);
    }
  };
  visit(node);
  return found;
}

/**
 * The preload list of a dynamic import, from its ancestors: Vite writes
 * `helper(() => import("./x.js"), __vite__mapDeps([i, j]))`, possibly with a
 * `.then(...)` after the import. Returns { wrapped, indexes } where indexes
 * point into the chunk's `__vite__mapDeps` table, or wrapped false when the
 * import is not the body of a function passed first to a call.
 */
function depsOfSite(stack) {
  for (let i = stack.length - 1; i >= 0; i--) {
    const n = stack[i];
    if (!FUNCTION.has(n.type)) continue;
    const call = stack[i - 1];
    if (call?.type !== "CallExpression" || call.arguments[0] !== n) return { wrapped: false, indexes: [] };
    const list = call.arguments[1];
    if (list?.type === "CallExpression" && list.callee.type === "Identifier" && list.callee.name === "__vite__mapDeps" && list.arguments[0]?.type === "ArrayExpression") {
      return { wrapped: true, indexes: list.arguments[0].elements.map((e) => (e?.type === "Literal" ? e.value : -1)) };
    }
    return { wrapped: true, indexes: [] };
  }
  return { wrapped: false, indexes: [] };
}

const chunks = new Map(files.map((f) => [f, analyse(f)]));

const closureMemo = new Map();
function closure(file) {
  if (closureMemo.has(file)) return closureMemo.get(file);
  const seen = new Set();
  const stack = [file];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const s of chunks.get(f)?.statics ?? []) stack.push(s);
  }
  closureMemo.set(file, seen);
  return seen;
}

// The boot set: every module script index.html loads (beside the assets
// folder), and everything those reach statically.
const html = path.join(dir, "..", "index.html");
if (!fs.existsSync(html)) die(`${html} does not exist, so the page entry is unknown. Run pnpm build first.`);
const entries = Array.from(fs.readFileSync(html, "utf8").matchAll(/<script\b[^>]*type="module"[^>]*src="[^"]*\/([^"/]+\.js)"/g), (m) => m[1]).filter((f) => files.includes(f));
if (entries.length === 0) die(`${html} loads no module script from ${dir}.`);
const boot = new Set(entries.flatMap((e) => [...closure(e)]));

const problems = [];
let siteCount = 0;

// Every import site, and every chunk each one can cause to evaluate.
const reachers = new Map(); // chunk -> [description of each site that can run it]
for (const e of entries) for (const f of closure(e)) (reachers.get(f) ?? reachers.set(f, []).get(f)).push(`the page entry ${e}`);
for (const c of chunks.values()) {
  for (const site of c.sites) {
    if (!site.target) continue;
    siteCount++;
    const already = closure(c.file);
    for (const f of closure(site.target)) {
      if (already.has(f)) continue;
      (reachers.get(f) ?? reachers.set(f, []).get(f)).push(`import("${site.raw}") in ${c.file}`);
      // Rule 3: the copy arrives first.
      for (const part of chunks.get(f).partsRead) {
        const table = c.mapDeps ?? [];
        const listed = site.deps.indexes.map((i) => table[i]);
        if (!site.deps.wrapped || !listed.includes(`assets/${f}~${part}`)) {
          problems.push({
            rule: "copy-before-import",
            chunk: f,
            message: `${f} reads copy part ${part}, but import("${site.raw}") in ${c.file} does not fetch it first (${site.deps.wrapped ? "missing from its preload list" : "not wrapped by the preload helper"}). The page would throw "copy part ${part} was not loaded before its chunk ran".`,
          });
        }
      }
    }
  }
}

for (const c of chunks.values()) {
  if (boot.has(c.file) && c.partsRead.length) {
    problems.push({ rule: "copy-before-import", chunk: c.file, message: `${c.file} loads with the first page but reads copy part ${c.partsRead[0]}, which nothing fetches before the entry runs.` });
  }
  if (c.oldLoader) {
    problems.push({ rule: "old-loader", chunk: c.file, message: `${c.file} still calls __villageCopyLoad, the top-level await loader that crashed iOS Safari in 1.3.27. copySplit.ts should emit __villageCopyGet.` });
  }
  if (c.tla && c.mutable.length) {
    const sites = reachers.get(c.file) ?? [];
    if (sites.length > 1) {
      problems.push({
        rule: "tla-race",
        chunk: c.file,
        message: `${c.file} has a top-level await and top-level mutable state (${c.mutable.slice(0, 4).join(", ")}${c.mutable.length > 4 ? ", ..." : ""}), and ${sites.length} import sites can run it: ${sites.slice(0, 4).join("; ")}${sites.length > 4 ? "; ..." : ""}. iOS Safari can hand the second importer this module before those variables exist (the 1.3.27 crash). Import it from one place, or move the await out of the chunk.`,
      });
    }
  }
}

if (siteCount === 0) die(`found ${files.length} chunks but no dynamic import site at all, so this walker is not reading the tree it was built for.`);

const summary = {
  chunks: files.length,
  bootChunks: boot.size,
  importSites: siteCount,
  withTopLevelAwait: [...chunks.values()].filter((c) => c.tla).length,
  readingCopy: [...chunks.values()].filter((c) => c.partsRead.length).length,
  problems,
};
if (json) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(
    `check-lazy-chunk-tla: ${summary.chunks} chunks (${summary.bootChunks} boot), ${summary.importSites} dynamic import sites, ${summary.withTopLevelAwait} with a top-level await, ${summary.readingCopy} reading a copy part.`,
  );
  for (const p of problems) console.log(`::error::[${p.rule}] ${p.message}`);
  if (problems.length === 0) console.log("check-lazy-chunk-tla: clean.");
}
process.exit(problems.length ? 1 : 0);
