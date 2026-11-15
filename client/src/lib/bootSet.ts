/**
 * THE BOOT SET GUARD: a module only the lazy pages reach never rides the first page.
 *
 * WHY THIS EXISTS. `experimentalMinChunkSize` (vite.config.ts) merges small
 * chunks into a neighbour, and it does not ask whether the neighbour is loaded
 * on the first page. So one small static import in the boot graph can change
 * the shape of the chunk graph and pull modules that only lazy routes use into
 * a chunk the entry loads. That is how `AlignButton` importing `journey/look`
 * took `termsWords` and `seatSettings` into the boot chunk and first-page JS
 * from 750 KB to 1113 KB. The size budget caught it, but only as a number: it
 * could not say which module had moved, which is the one thing the next person
 * needs.
 *
 * THE RULE, structural and independent of any size. Work out the modules the
 * entry reaches by static imports, in the module graph and before any chunking
 * (the EAGER set). Work out the chunks index.html loads: the entry chunk and
 * everything it imports statically. Every module inside one of those chunks
 * must be in the eager set. A module that is not, is lazy-only code that joined
 * the first page, and the build fails naming it and the chunk it joined.
 *
 * The decision is a pure function so a test can hold it with no build; the
 * plugin in vite.config.ts feeds it the real bundle and module graph.
 */

export interface BootChunkFacts {
  fileName: string;
  /** Static imports only (rollup's `imports`, never `dynamicImports`). */
  imports: readonly string[];
  isEntry: boolean;
  /** The source modules rollup placed in this chunk. */
  moduleIds: readonly string[];
}

export interface BootIntruders {
  chunk: string;
  modules: string[];
}

/** Every chunk the first page loads: the entries and the closure of their static imports. */
export function bootChunks(chunks: readonly BootChunkFacts[]): BootChunkFacts[] {
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const seen = new Set<string>();
  const stack = chunks.filter((c) => c.isEntry).map((c) => c.fileName);
  while (stack.length) {
    const name = stack.pop() as string;
    if (seen.has(name)) continue;
    seen.add(name);
    for (const dep of byName.get(name)?.imports ?? []) stack.push(dep);
  }
  return chunks.filter((c) => seen.has(c.fileName));
}

/** Rollup's own helper modules (`\0` ids) belong to no source file and are never named. */
const isVirtual = (id: string): boolean => id.startsWith("\0");

/**
 * The lazy-only modules sitting in boot chunks, grouped by chunk. Empty when the
 * first page carries only what the entry imports.
 *
 * A RATCHET, like the repository's other baselines. Some lazy-only modules are
 * already in boot chunks on purpose or by history (the natural kit's own chunk,
 * and small shared modules rollup folded into a boot chunk); they are listed by
 * path in scripts/boot-set-baseline.json and `known` holds that list. Only a
 * module NOT in it is an intruder, so the list can shrink and never grow.
 */
export function lazyModulesInBoot(
  chunks: readonly BootChunkFacts[],
  eager: ReadonlySet<string>,
  known: ReadonlySet<string> = new Set(),
  name: (id: string) => string = (id) => id,
): BootIntruders[] {
  const out: BootIntruders[] = [];
  for (const c of bootChunks(chunks)) {
    const modules = c.moduleIds.filter((id) => !isVirtual(id) && !eager.has(id) && !known.has(name(id)));
    if (modules.length) out.push({ chunk: c.fileName, modules });
  }
  return out;
}

/** Every lazy-only module in a boot chunk, known or not, by name. Sorted, so the baseline file is stable. */
export function allLazyInBoot(chunks: readonly BootChunkFacts[], eager: ReadonlySet<string>, name: (id: string) => string): string[] {
  const all = new Set<string>();
  for (const c of bootChunks(chunks)) for (const id of c.moduleIds) if (!isVirtual(id) && !eager.has(id)) all.add(name(id));
  return Array.from(all).sort();
}

/** Module ids as a repository path, so the failure names a file a person can open. */
export function shortId(id: string, root: string): string {
  // Rollup's ids use "/" on every OS and import.meta.dirname uses "\" on Windows; compare one spelling.
  const clean = id.split("?")[0].replace(/\\/g, "/");
  const base = root.replace(/\\/g, "/");
  const rel = clean.startsWith(base) ? clean.slice(base.length).replace(/^\/+/, "") : clean;
  return rel.replace(/^.*node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?/, "node_modules/");
}

export function bootIntrudersMessage(found: readonly BootIntruders[], root: string): string {
  const SHOWN = 12;
  const lines = found.flatMap((f) => [
    `  ${f.chunk} (loaded by index.html):`,
    ...f.modules.slice(0, SHOWN).map((m) => `    ${shortId(m, root)}`),
    ...(f.modules.length > SHOWN ? [`    ... and ${f.modules.length - SHOWN} more`] : []),
  ]);
  return [
    `The first page now carries ${found.reduce((n, f) => n + f.modules.length, 0)} module(s) that only lazy pages import:`,
    ...lines,
    "If one of these is meant to ride the first page, it belongs in scripts/boot-set-baseline.json; otherwise:",
    "A static import in the boot graph (a component the layout, the header or an eager page draws) changed how rollup groups chunks:",
    "either experimentalMinChunkSize merged these into a chunk the entry loads, or the import reaches a merged group (smalls, smallui,",
    "natural) that is now one of the entry's static imports. Find what the boot graph newly imports and make that import lazy, or move",
    "the shared piece it pulled in somewhere the boot graph does not import. Raising a budget is not the fix.",
  ].join("\n");
}

/*
 * THE SAME RULE, PER KEY ROUTE, AND A SIZE BUDGET FOR EACH (page speed pass, 14 Nov 2026).
 *
 * The rule above stops at the chunks index.html loads. A route's FIRST VIEW is
 * more than that: route-preload.js (client/src/lib/routePreload.ts) asks for the
 * page's own chunk and everything it imports statically, beside the boot set,
 * so a visitor waits on all of it before the page can draw. That is exactly
 * where the voice recorder leaked: the merged "smallui" group was a static
 * import of the landing page and the steward page, so both fetched 77 KB
 * (gzipped) of microphone, companion and price code that neither runs, and the
 * boot rule above could not see it because index.html never names "smallui".
 *
 * So for each key route (scripts/route-first-view.json): the first view is the
 * boot chunks plus the closure of the page's chunk, plus the closure of each
 * lazy piece the shell draws on every page (the root strip under the header,
 * which carried "smalls" onto every page after the groups left the pages).
 * Every module in it must be reachable by static imports from the entry, the
 * page or one of those pieces. A module
 * that is not belongs to some other page and rode in on a merged chunk. And
 * the JS of the first view, gzipped, must stay under the route's budget.
 */

export interface RouteChunkFacts extends BootChunkFacts {
  /** The module a dynamic-entry chunk stands for, or null. */
  facadeModuleId: string | null;
  isDynamicEntry: boolean;
}

/** The chunk whose facade is this page module (an absolute id), or undefined when the build has none. */
export function pageChunk(chunks: readonly RouteChunkFacts[], pageId: string): RouteChunkFacts | undefined {
  const unix = (id: string) => id.split("?")[0].replace(/\\/g, "/");
  const want = unix(pageId);
  return chunks.find((c) => c.isDynamicEntry && c.facadeModuleId && unix(c.facadeModuleId) === want);
}

/**
 * The first view of a route: every boot chunk, plus the page's chunk and the
 * closure of its static imports, plus the same for each lazy piece the shell
 * draws on every page (the root strip), which a visitor waits on just as much.
 */
export function routeFirstView(chunks: readonly RouteChunkFacts[], page: RouteChunkFacts, everyPage: readonly RouteChunkFacts[] = []): RouteChunkFacts[] {
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const seen = new Set(bootChunks(chunks).map((c) => c.fileName));
  const stack = [page.fileName, ...everyPage.map((c) => c.fileName)];
  while (stack.length) {
    const name = stack.pop() as string;
    if (seen.has(name)) continue;
    seen.add(name);
    for (const dep of byName.get(name)?.imports ?? []) stack.push(dep);
  }
  return chunks.filter((c) => seen.has(c.fileName));
}

export interface RouteVerdict {
  route: string;
  /** The first view's chunk file names, sorted. */
  chunks: string[];
  /** Gzipped bytes of every chunk in the first view. */
  gzipBytes: number;
  maxGzipKB: number;
  /** Modules no static import from the entry, the page or the shell's every-page pieces reaches, by chunk, minus the route's known list. */
  intruders: BootIntruders[];
  /** Every such module, known or not, by name. */
  allForeign: string[];
}

/**
 * The verdict for one route. `reach` is the set of modules the entry and the
 * page reach by static imports, worked out from the module graph by the caller.
 */
export function judgeRoute(o: {
  route: string;
  chunks: readonly RouteChunkFacts[];
  page: RouteChunkFacts;
  /** The lazy chunks the shell loads on every page (scripts/route-first-view.json, everyPage). */
  everyPage?: readonly RouteChunkFacts[];
  reach: ReadonlySet<string>;
  known: ReadonlySet<string>;
  maxGzipKB: number;
  gzipOf: (fileName: string) => number;
  name: (id: string) => string;
}): RouteVerdict {
  const view = routeFirstView(o.chunks, o.page, o.everyPage);
  const intruders: BootIntruders[] = [];
  const foreign = new Set<string>();
  for (const c of view) {
    const out = c.moduleIds.filter((id) => !isVirtual(id) && !o.reach.has(id));
    for (const id of out) foreign.add(o.name(id));
    const fresh = out.filter((id) => !o.known.has(o.name(id)));
    if (fresh.length) intruders.push({ chunk: c.fileName, modules: fresh });
  }
  return {
    route: o.route,
    chunks: view.map((c) => c.fileName).sort(),
    gzipBytes: view.reduce((n, c) => n + o.gzipOf(c.fileName), 0),
    maxGzipKB: o.maxGzipKB,
    intruders,
    allForeign: Array.from(foreign).sort(),
  };
}

export const kb = (bytes: number): string => (bytes / 1024).toFixed(1);

/** The failure text for one route, or null when the route passes. */
export function routeVerdictMessage(v: RouteVerdict, root: string): string | null {
  const over = v.gzipBytes > v.maxGzipKB * 1024;
  if (!v.intruders.length && !over) return null;
  const SHOWN = 12;
  const lines: string[] = [];
  if (over) {
    lines.push(`The first view of ${v.route} is ${kb(v.gzipBytes)} KB of JS gzipped, over its budget of ${v.maxGzipKB} KB (scripts/route-first-view.json).`);
  }
  if (v.intruders.length) {
    lines.push(`The first view of ${v.route} carries ${v.intruders.reduce((n, f) => n + f.modules.length, 0)} module(s) that neither the entry nor the page imports statically:`);
    for (const f of v.intruders) {
      lines.push(`  ${f.chunk}:`);
      for (const m of f.modules.slice(0, SHOWN)) lines.push(`    ${shortId(m, root)}`);
      if (f.modules.length > SHOWN) lines.push(`    ... and ${f.modules.length - SHOWN} more`);
    }
    lines.push("They belong to another page and rode in on a merged chunk (smalls, smallui, natural) the page imports statically.");
    lines.push("Keep that module out of the merged groups (SMALL_GROUP_NEVER in vite.config.ts) or load the module that reaches it lazily.");
  }
  lines.push(`Chunks in the first view: ${v.chunks.join(", ")}`);
  lines.push("Raising a budget or adding to a known list is not the fix.");
  return lines.join("\n");
}
