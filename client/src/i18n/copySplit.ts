/**
 * LONG ENGLISH LEAVES THE LAZY CHUNKS (dist headroom, Rye 2026-11-09: "move
 * long copy out of the bundle").
 *
 * BUILD-TIME ONLY. vite.config.ts imports this; nothing in the app does, so it
 * never ships. It lives under client/src so `pnpm check` type-checks it.
 *
 * English is the source language and the Lingui macro keeps each message in
 * the chunk that renders it (linguiMacros.ts). That is right for a short label
 * and wasteful for a paragraph: every word of every page sat in dist/public,
 * which CI caps. So the production build moves each message of
 * LONG_MESSAGE_CHARS or more out of its descriptor (precompileEnglish.ts,
 * which leaves `{ id }`) and decides per CHUNK where its English goes:
 *
 *  - A chunk the first page loads (the entry and everything it imports
 *    statically) gets its English back INLINE, pushed onto a queue the i18n
 *    runtime drains. The first paint never waits on a fetch, and those bytes
 *    simply stay where they were.
 *  - Every other chunk gets one statement before any of its code:
 *    `globalThis.__villageCopyGet("<part>")`, a plain synchronous read. The
 *    part is a JSON file in dist/i18n/parts/en, outside dist/public, served by
 *    the i18n catalog route (server/routes/i18n.ts). It is fetched BEFORE the
 *    chunk is imported: every lazy import goes through Vite's preload helper,
 *    the helper's dependency list names each chunk's part beside its file
 *    (`assets/Page-x.js~<part>`, see partsBesideFiles), and the helper waits
 *    for those parts before it imports (wrapPreloadHelper). The Suspense
 *    fallback the page already has covers the wait, no text is ever drawn
 *    missing, and route-preload.js fetches the part beside the chunk, so the
 *    wait is the chunk's own.
 *
 * NO TOP-LEVEL AWAIT IN A LAZY CHUNK (crash guard, 19 Nov 2026). This used to
 * be `await globalThis.__villageCopyLoad("<part>")` at the top of the chunk.
 * A module with a top-level await stays "evaluating" while it waits, and iOS
 * Safari can hand a SECOND importer of such a module its namespace before the
 * module's top-level `let`s exist. Release 1.3.27 fixed one crash of that
 * shape on /propose-a-role (voiceStepMoreLazy.ts); moving the wait in front of
 * the import removes the whole class, because no lazy chunk waits on anything
 * while it evaluates. scripts/check-lazy-chunk-tla.mjs holds the built output
 * to it in CI. If a part was somehow not loaded, the read throws a named error,
 * the import fails like a missing chunk, and the error boundary reports it.
 *
 * English stays the fallback under every language: client/src/i18n/i18n.ts
 * keeps every part it loaded and merges it beneath the active catalog.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseAst, type Plugin } from "vite";
import { LONG_MESSAGE_CHARS, type LongCopySink } from "./precompileEnglish";

export { LONG_MESSAGE_CHARS };

/** The part names a chunk can carry and the server accepts: 12 base64url characters. */
export const PART_NAME = /^[A-Za-z0-9_-]{12}$/;

/**
 * One part: the chunk's moved Lingui messages, by id, and its moved plain
 * string literals, in the order the chunk reads them (`texts[i]`).
 */
export interface PartBody {
  messages: Record<string, unknown>;
  texts: string[];
}

/** Every moved message, per module, and every part the chunks were given. */
export class CopyCollector implements LongCopySink {
  readonly byModule = new Map<string, Map<string, string>>();
  readonly parts = new Map<string, PartBody>();

  record(moduleId: string, id: string, compiledJson: string): void {
    let m = this.byModule.get(moduleId);
    if (!m) this.byModule.set(moduleId, (m = new Map()));
    m.set(id, compiledJson);
  }

  forget(moduleId: string): void {
    this.byModule.delete(moduleId);
  }

  /** The moved messages of these modules, id -> compiled, or null when there are none. */
  messagesOf(moduleIds: readonly string[]): Record<string, unknown> | null {
    const out: Record<string, unknown> = {};
    let any = false;
    for (const mod of moduleIds) {
      const m = this.byModule.get(mod);
      if (!m) continue;
      for (const [id, json] of Array.from(m)) {
        out[id] = JSON.parse(json);
        any = true;
      }
    }
    return any ? out : null;
  }
}

/** The facts this needs about a chunk, as rollup's renderChunk sees it. */
export interface ChunkShape {
  fileName: string;
  isEntry: boolean;
  /** Static imports, by file name. */
  imports: readonly string[];
  moduleIds: readonly string[];
}

/** What index.html loads before the first paint: each entry and its static imports, transitively. */
export function bootChunks(chunks: Record<string, ChunkShape>): Set<string> {
  const boot = new Set<string>();
  const walk = (name: string) => {
    if (boot.has(name)) return;
    boot.add(name);
    for (const next of chunks[name]?.imports ?? []) walk(next);
  };
  for (const c of Object.values(chunks)) if (c.isEntry) walk(c.fileName);
  return boot;
}

function partName(body: PartBody): string {
  const sorted = Object.fromEntries(Object.entries(body.messages).sort(([a], [b]) => (a < b ? -1 : 1)));
  return crypto.createHash("sha256").update(JSON.stringify({ messages: sorted, texts: body.texts })).digest("base64url").slice(0, 12);
}

/**
 * PLAIN LONG STRINGS. Most of the prose left in the lazy chunks is not a
 * Lingui message: it is data copy in files the SERVER also reads
 * (shared/guilds.ts, shared/modules.ts, shared/sessions.ts...), where wrapping
 * would change what the server sees, plus page copy not yet wrapped for
 * translation. So the build moves those too, from the chunk's final code,
 * leaving every source file as it is: each long string literal in a value
 * position becomes `<alias>[i]`, a read from the part the chunk awaits before
 * any of its code runs. The value is the same string, so equality, switch
 * cases, `.length` and JSON all behave as before.
 *
 * A literal moves only where a value read is legal and nothing else reads the
 * literal: never a property or method KEY (a computed key is an expression and
 * moves), an import or export source or name, a directive, a tagged template
 * (its tag reads the raw text), a template with `${}` in it, or a string vite
 * still rewrites after this hook (`__VITE_*` placeholders). It must also hold a
 * space: a path, hash, data URI or identifier never does, and prose always
 * does. The server never runs this: it reads shared/*.ts from source.
 */
const VITE_MARKER = /__vite/i;

interface Found {
  start: number;
  end: number;
  value: string;
}

type Node = { type: string; start: number; end: number; [k: string]: unknown };

function movableLiterals(code: string): Found[] {
  const found: Found[] = [];
  const ast = parseAst(code) as unknown as Node;
  const long = (v: string) => v.length >= LONG_MESSAGE_CHARS && v.includes(" ") && !VITE_MARKER.test(v);
  const visit = (node: Node, parent: Node | null, key: string) => {
    if (node.type === "Literal" && typeof node.value === "string") {
      if (!long(node.value) || !parent) return;
      const pt = parent.type;
      if ((pt === "Property" || pt === "MethodDefinition" || pt === "PropertyDefinition") && key === "key" && !parent.computed) return;
      if (/^(Import|Export)/.test(pt)) return;
      if (pt === "ExpressionStatement" && parent.directive !== undefined) return;
      found.push({ start: node.start, end: node.end, value: node.value });
      return;
    }
    if (node.type === "TemplateLiteral") {
      const quasis = node.quasis as Array<{ value: { cooked: string | null } }>;
      const exprs = node.expressions as unknown[];
      if (parent?.type !== "TaggedTemplateExpression" && exprs.length === 0 && quasis[0]?.value.cooked != null && long(quasis[0].value.cooked)) {
        found.push({ start: node.start, end: node.end, value: quasis[0].value.cooked });
      }
      if (exprs.length === 0) return;
    }
    for (const [k, child] of Object.entries(node)) {
      if (Array.isArray(child)) {
        for (const c of child) if (c && typeof c === "object" && typeof (c as Node).type === "string") visit(c as Node, node, k);
      } else if (child && typeof child === "object" && typeof (child as Node).type === "string") {
        visit(child as Node, node, k);
      }
    }
  };
  visit(ast, null, "");
  return found.sort((a, b) => a.start - b.start);
}

/** A name for the chunk's texts that its code does not already use. */
function aliasFor(code: string): string {
  let alias = "__vC";
  for (let i = 0; new RegExp(`\\b${alias}\\b`).test(code); i++) alias = `__vC${i}`;
  return alias;
}

/** The chunk with each movable literal read from `alias`, and the texts in index order. */
export function extractLongLiterals(code: string): { code: string; texts: string[]; alias: string } {
  const found = movableLiterals(code);
  if (found.length === 0) return { code, texts: [], alias: "" };
  const alias = aliasFor(code);
  const index = new Map<string, number>();
  const texts: string[] = [];
  let out = "";
  let last = 0;
  for (const f of found) {
    let i = index.get(f.value);
    if (i === undefined) {
      i = texts.push(f.value) - 1;
      index.set(f.value, i);
    }
    // The leading space keeps `return"..."` and `case"..."` two tokens.
    out += `${code.slice(last, f.start)} ${alias}[${i}]`;
    last = f.end;
  }
  return { code: out + code.slice(last), texts, alias };
}

/**
 * The chunk's code with its English put back (boot) or awaited (lazy), or
 * null when nothing in it moved. Records each lazy part on `collector`.
 */
export function renderChunkCopy(
  code: string,
  chunk: ChunkShape,
  chunks: Record<string, ChunkShape>,
  collector: CopyCollector,
  boot: Set<string> = bootChunks(chunks),
): string | null {
  const messages = collector.messagesOf(chunk.moduleIds);
  if (boot.has(chunk.fileName)) {
    if (!messages) return null;
    return `(globalThis.__villageCopyInline=globalThis.__villageCopyInline||[]).push(${JSON.stringify(messages)});\n${code}`;
  }
  const literals = extractLongLiterals(code);
  if (!messages && literals.texts.length === 0) return null;
  const body: PartBody = { messages: messages ?? {}, texts: literals.texts };
  const part = partName(body);
  collector.parts.set(part, body);
  const load = `globalThis.${COPY_GET}(${JSON.stringify(part)})`;
  return literals.alias ? `const ${literals.alias}=${load};\n${literals.code}` : `${load};\n${code}`;
}

/** The synchronous read every lazy chunk with moved copy starts with (i18n.ts defines it). */
export const COPY_GET = "__villageCopyGet";

/** The part a built chunk reads, off its code, or null when it reads none. */
export function copyPartRead(code: string): string | null {
  return /__villageCopyGet\("([A-Za-z0-9_-]{6,32})"\)/.exec(code)?.[1] ?? null;
}

/**
 * THE PARTS RIDE IN VITE'S DEPENDENCY LIST. For one lazy import, `deps` is
 * every chunk file the target needs that the importer has not loaded. Each one
 * that reads a part comes back as `file~part`, and `target` is added when Vite
 * left it out (it does when the target imports nothing; pass null when the
 * importer already loaded the target statically), so the helper knows
 * every part to fetch before the import. `~` never appears in an emitted file
 * name ([name]-[hash], base64url), so the split is unambiguous.
 */
export function partsBesideFiles(target: string | null, deps: readonly string[], partOf: (file: string) => string | null): string[] {
  const out = deps.map((d) => {
    const part = partOf(d);
    return part ? `${d}~${part}` : d;
  });
  const own = target === null ? null : partOf(target);
  if (target !== null && own && !deps.includes(target)) out.push(`${target}~${own}`);
  return out;
}

/** The id Vite gives its preload helper module. */
export const PRELOAD_HELPER_ID = "\0vite/preload-helper.js";
const HELPER_EXPORT = "export const __vitePreload = ";

/**
 * Vite's preload helper, taught the `file~part` entries: it strips the part
 * off for the link it adds, starts fetching every part at once, and calls the
 * import only after they have all arrived. A failed part rejects the import
 * through the helper's own error path, so `vite:preloadError` fires and
 * staleChunk.ts reloads once, exactly as for a missing chunk. Throws when the
 * helper's shape changed, so a Vite upgrade cannot silently drop the wait.
 */
export function wrapPreloadHelper(code: string): string {
  if (code.split(HELPER_EXPORT).length !== 2) {
    throw new Error("copySplit: Vite's preload helper changed shape, so lazy chunks would run before their copy arrives. Update wrapPreloadHelper.");
  }
  return (
    code.replace(HELPER_EXPORT, "const __villagePreloadFiles = ") +
    `;\nexport const __vitePreload = function (baseModule, deps, importerUrl) {
  const parts = [];
  const files = deps && deps.map((d) => {
    const at = d.indexOf("~");
    if (at < 0) return d;
    parts.push(d.slice(at + 1));
    return d.slice(0, at);
  });
  if (parts.length === 0) return __villagePreloadFiles(baseModule, files, importerUrl);
  const words = globalThis.${COPY_READY}(parts);
  words.catch(() => {});
  return __villagePreloadFiles(() => words.then(baseModule), files, importerUrl);
};\n`
  );
}

/** What the wrapped helper calls with the parts of one import (i18n.ts defines it). */
export const COPY_READY = "__villageCopyReady";

/** Write each part as `{ messages, texts }`, after clearing what an earlier build left. */
export function writeCopyParts(collector: CopyCollector, dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const [part, body] of Array.from(collector.parts)) {
    fs.writeFileSync(path.join(dir, `${part}.json`), JSON.stringify(body));
  }
}

/**
 * The renderChunk half (the transform half is precompileEnglish(collector)).
 * `partsDir` is dist/i18n/parts/en: beside the catalogs, outside dist/public.
 */
export function splitLongCopy(collector: CopyCollector, partsDir: string): Plugin {
  let boot: Set<string> | null = null;
  let bootOf: unknown = null;
  return {
    name: "village-split-long-copy",
    apply: "build",
    transform(code, id) {
      return id === PRELOAD_HELPER_ID ? { code: wrapPreloadHelper(code), map: null } : null;
    },
    renderChunk(code, chunk, _options, meta) {
      const all = meta.chunks as unknown as Record<string, ChunkShape>;
      if (bootOf !== meta.chunks) {
        boot = bootChunks(all);
        bootOf = meta.chunks;
      }
      const out = renderChunkCopy(code, chunk as unknown as ChunkShape, all, collector, boot!);
      return out === null ? null : { code: out, map: null };
    },
    writeBundle() {
      writeCopyParts(collector, partsDir);
    },
  };
}
