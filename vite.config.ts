import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { linguiMacros } from "./client/src/i18n/linguiMacros";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { defineConfig, type Plugin, type Rollup } from "vite";
import {
  type ChunkFacts,
  landingRoutes,
  lazyRoutesFromApp,
  routePreloadScript,
  routePreloadTable,
  copyPartsIn,
} from "./client/src/lib/routePreload";
import { pointAtUnhintedFonts } from "./client/src/lib/unhintedFonts";
import { mayJoinSharedGroup } from "./client/src/lib/privilegedChunks";
import { allLazyInBoot, bootIntrudersMessage, judgeRoute, kb, lazyModulesInBoot, pageChunk, routeVerdictMessage, shortId, type BootChunkFacts, type RouteChunkFacts } from "./client/src/lib/bootSet";
import { CopyCollector, copyPartRead, partsBesideFiles, splitLongCopy } from "./client/src/i18n/copySplit";
import { splitArtifact, type SplitResult } from "./server/lib/groundsSplit";

/**
 * Serve the Living Map artifact in DEV, from the same source the server uses.
 *
 * In production Express hands out `docs/prototypes/grounds-v0.html` directly
 * (server/index.ts). It is deliberately NOT copied into `client/public`: a
 * second 4 MB copy in `dist/public` blew the CI bundle budget, which exists to
 * catch exactly that.
 *
 * Dev needs its own answer because `pnpm dev` runs no Express. It also cannot
 * simply drop the file in `public/`: a request ending in `.html` is claimed by
 * vite's own HTML middleware, which resolves it against `root` (`client/`) and
 * falls through to the SPA. Registering this middleware directly, rather than
 * returning a function from configureServer, puts it AHEAD of vite's internal
 * ones, which is the whole point. Two exact paths, no directory walking.
 */
function serveGroundsInDev(): Plugin {
  const file = path.resolve(import.meta.dirname, "docs", "prototypes", "grounds-v0.html");
  /*
   * The same split production serves (server/routes/grounds.ts): the page with
   * its embedded images swapped for /grounds/a/ files. Re-split only when the
   * file changes, so a reload after an edit shows the edit.
   */
  let memo: { key: string; split: SplitResult } | null = null;
  const split = (): SplitResult => {
    const st = fs.statSync(file);
    const key = `${st.size}:${st.mtimeMs}`;
    if (memo?.key !== key) memo = { key, split: splitArtifact(fs.readFileSync(file, "utf8")) };
    return memo.split;
  };
  return {
    name: "serve-grounds-in-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        const isArtifact = url === "/grounds/index.html" || /^\/grounds\/grounds-[a-f0-9]+\.html$/.test(url);
        const asset = /^\/grounds\/a\/([0-9a-f]{16}\.[a-z]+)$/.exec(url);
        if (!isArtifact && !asset && url !== "/grounds/manifest.json") return next();
        if (!fs.existsSync(file)) return next();
        if (asset) {
          const a = split().assets.get(asset[1]);
          if (!a) return next();
          res.setHeader("Content-Type", a.type);
          res.end(a.bytes);
          return;
        }
        if (url === "/grounds/manifest.json") {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          /*
           * Dev answers the same SHAPE as production so the shell takes one
           * code path in both. The url is the stable name here: hashing 4 MB
           * on every reload would buy nothing when nothing is cached anyway.
           */
          res.end(JSON.stringify({
            present: true,
            bytes: fs.statSync(file).size,
            url: "/grounds/index.html",
          }));
          return;
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(split().html);
      });
    },
  };
}

/**
 * Drop the legacy `.woff` fallback that @fontsource declares beside every
 * `.woff2`.
 *
 * Every face was shipping twice: 32 `.woff2` files at 651 KB and 32 `.woff`
 * files at 758 KB, and the second set is dead weight. A browser only reaches
 * the fallback when it cannot parse woff2, and woff2 landed in every engine
 * BEFORE ES modules did (Chrome 36 vs 61, Firefox 39 vs 60, Safari 10 vs 11,
 * Edge 14 vs 16). `client/index.html` boots the app from a single
 * `<script type="module">`, so a browser old enough to want the `.woff` cannot
 * run the app at all and never gets as far as requesting a font. The bytes
 * were unreachable by construction.
 *
 * This strips the fallback from the `src:` list BEFORE vite resolves the
 * url(), which is what stops the file being emitted at all: vite copies a font
 * into `dist/public/assets` because some CSS points at it, so removing the
 * pointer removes the copy. `enforce: "pre"` puts this ahead of vite's own CSS
 * plugin, and the match is scoped to @fontsource so a village's hand-written
 * @font-face is untouched.
 *
 * Member-uploaded display faces are a separate path and keep full `.woff`
 * support: `server/index.ts` still sniffs the `wOFF` magic bytes and serves
 * `font/woff`. This is only about the packaged Latin faces.
 */
function dropLegacyWoffFallback(): Plugin {
  const FALLBACK = /,\s*url\([^)]*\.woff\)\s*format\((['"])woff\1\)/g;
  return {
    name: "drop-legacy-woff-fallback",
    enforce: "pre",
    transform(code, id) {
      const file = id.split("?")[0].replace(/\\/g, "/");
      if (!file.endsWith(".css") || !file.includes("/@fontsource")) return null;
      const next = code.replace(FALLBACK, "");
      return next === code ? null : { code: next, map: null };
    },
  };
}

/**
 * Serve the unhinted copies of the packaged faces (client/src/fonts) in place
 * of @fontsource's own files: the same glyphs, code points and layout
 * features, without the TrueType hinting. 888 KB of the dist budget became
 * 808 KB. Eight families then went to one variable file each, every weight's
 * @font-face pointing at it with its own single weight unchanged: 39 files
 * became 9 and the fonts about 350 KB lighter in blocks. client/src/lib/unhintedFonts.ts
 * has the rule and `scripts/unhint-fonts.py --check` the proof that nothing
 * else differs, per cut, including that each variable instance lays text out
 * exactly as the static cut it replaces.
 */
function useUnhintedFonts(): Plugin {
  const dir = path.resolve(import.meta.dirname, "client", "src", "fonts");
  const available = new Set(fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".woff2")) : []);
  return {
    name: "use-unhinted-fonts",
    enforce: "pre",
    transform(code, id) {
      const file = id.split("?")[0].replace(/\\/g, "/");
      if (!file.endsWith(".css") || !file.includes("/@fontsource")) return null;
      const next = pointAtUnhintedFonts(code, available, "@/fonts");
      return next === null ? null : { code: next, map: null };
    },
  };
}

/**
 * Preload the visited route's own page chunk beside the main bundle.
 *
 * Every page but the eager three is `lazy()` (App.tsx), so on a first visit the
 * page's chunk was requested only after the main bundle had downloaded and run:
 * one more round trip in series. This emits `assets/route-preload-<hash>.js`, a
 * few kilobytes that load `async` with the bundle, read `location`, and add
 * `modulepreload` links for that page's chunk and its imports. The table comes
 * from App.tsx's routes and this build's own chunk graph, so it cannot name a
 * file that does not exist; client/src/lib/routePreload.ts has the rules and
 * routePreload.test.ts holds them, including a check against the real App.tsx.
 *
 * An external file rather than an inline script, so a `script-src 'self'`
 * policy covers it without a per-build hash. If App.tsx ever stops parsing,
 * the table is empty, the build warns, and no file or tag is emitted: pages
 * then load exactly as they did before this existed.
 *
 * Measured cost on the CI budgets: one asset of a few KB (one or two 4 KB
 * blocks of MAX_TOTAL_DIST_KB) and nothing on the main chunk.
 */
function routeChunkPreload(): Plugin {
  let base = "/";
  let emitted: string | null = null;
  return {
    name: "route-chunk-preload",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    generateBundle(_options, bundle) {
      emitted = null;
      const app = fs.readFileSync(path.resolve(import.meta.dirname, "client", "src", "App.tsx"), "utf8");
      const chunks: ChunkFacts[] = [];
      for (const out of Object.values(bundle)) {
        if (out.type !== "chunk") continue;
        chunks.push({
          fileName: out.fileName,
          imports: out.imports,
          isEntry: out.isEntry,
          isDynamicEntry: out.isDynamicEntry,
          facadeModuleId: out.facadeModuleId,
          css: [...(out.viteMetadata?.importedCss ?? [])],
          copyParts: copyPartsIn(out.code),
        });
      }
      const table = routePreloadTable([...landingRoutes(app), ...lazyRoutesFromApp(app)], chunks);
      if (table.routes.length === 0) {
        this.warn("route-chunk-preload: no route in client/src/App.tsx matched a page chunk, so nothing was emitted");
        return;
      }
      const ref = this.emitFile({ type: "asset", name: "route-preload.js", source: routePreloadScript(table, base) });
      emitted = this.getFileName(ref);
    },
    transformIndexHtml: {
      order: "post",
      handler() {
        if (!emitted) return;
        // fetchpriority: Chrome gives an async script Low priority, which would
        // queue this behind the fonts and images it exists to get ahead of.
        return [{ tag: "script", attrs: { async: true, fetchpriority: "high", src: base + emitted }, injectTo: "head" }];
      },
    },
  };
}

/**
 * PRELOAD THE SHEET'S DISPLAY FACE (go-live pass, M11).
 *
 * Every page in the night world sets its headings in the sheet's carved face
 * (Marcellus, `--sheet-font-display`), and the browser only asks for the file
 * once the stylesheet has parsed and a heading needs it, so a phone painted
 * the hero in a fallback face and swapped it late. The file is hashed, so it
 * cannot be named in index.html by hand: this finds it in the bundle and adds
 * one preload link. One woff2 of about 30 KB, and nothing on the JS budgets.
 */
const PRELOADED_FACE = /^assets\/marcellus-latin-400-normal-[\w-]+\.woff2$/;
function preloadDisplayFace(): Plugin {
  let base = "/";
  return {
    name: "preload-display-face",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const file = Object.keys(ctx.bundle ?? {}).find((f) => PRELOADED_FACE.test(f));
        if (!file) return;
        return [{ tag: "link", attrs: { rel: "preload", as: "font", type: "font/woff2", href: base + file, crossorigin: "anonymous" }, injectTo: "head-prepend" }];
      },
    },
  };
}

/**
 * FAIL THE BUILD, BY NAME, WHEN A LAZY-ONLY MODULE JOINS THE FIRST PAGE.
 *
 * The size budgets (scripts/check-dist-budget.mjs) say the first page got
 * heavier and cannot say which module moved. This reads the module graph and
 * the finished bundle and does: see client/src/lib/bootSet.ts for the rule.
 */
function guardBootSet(): Plugin {
  return {
    name: "guard-boot-set",
    apply: "build",
    generateBundle(_options, bundle) {
      // Everything the entry reaches by static imports, in the module graph.
      const eager = new Set<string>();
      const stack: string[] = [];
      const chunks: BootChunkFacts[] = [];
      for (const out of Object.values(bundle)) {
        if (out.type !== "chunk") continue;
        chunks.push({ fileName: out.fileName, imports: out.imports, isEntry: out.isEntry, moduleIds: Object.keys(out.modules) });
        if (out.isEntry && out.facadeModuleId) stack.push(out.facadeModuleId);
      }
      while (stack.length) {
        const id = stack.pop() as string;
        if (eager.has(id)) continue;
        eager.add(id);
        for (const dep of this.getModuleInfo(id)?.importedIds ?? []) stack.push(dep);
      }
      const root = import.meta.dirname;
      const name = (id: string) => shortId(id, root);
      const baselineFile = path.resolve(root, "scripts", "boot-set-baseline.json");
      const known = new Set<string>(fs.existsSync(baselineFile) ? (JSON.parse(fs.readFileSync(baselineFile, "utf8")).modules as string[]) : []);
      const found = lazyModulesInBoot(chunks, eager, known, name);
      if (found.length && !process.env.BOOT_SET_WRITE) this.error(bootIntrudersMessage(found, root));
      const now = allLazyInBoot(chunks, eager, name);
      if (process.env.BOOT_SET_WRITE) {
        // Writing only ever shrinks the list, once it exists: a new intruder is fixed, not recorded.
        if (known.size > 0 && now.some((m) => !known.has(m))) this.error(`BOOT_SET_WRITE refuses to add to the baseline.\n${bootIntrudersMessage(found, root)}`);
        fs.writeFileSync(baselineFile, JSON.stringify({ modules: now }, null, 2) + "\n");
        return;
      }
      const gone = Array.from(known).filter((m) => !now.includes(m));
      if (gone.length) this.warn(`scripts/boot-set-baseline.json lists ${gone.length} module(s) that no longer ride the first page. Shrink it with BOOT_SET_WRITE=1 pnpm build: ${gone.join(", ")}`);
    },
  };
}

/**
 * FAIL THE BUILD WHEN A KEY ROUTE'S FIRST VIEW CARRIES ANOTHER PAGE'S CODE, OR
 * GROWS PAST ITS BUDGET.
 *
 * The boot rule above sees only what index.html loads. A visitor to /steward
 * also waits on the page's chunk and its static imports, which route-preload.js
 * asks for beside the bundle; client/src/lib/bootSet.ts (judgeRoute) has the
 * rule and scripts/route-first-view.json the routes, their pages, their gzipped
 * JS budgets and the modules already known to ride along (a ratchet: the list
 * shrinks, never grows). ROUTE_VIEW_REPORT=1 prints every route's chunks and
 * its foreign modules, passing or not.
 */
function guardRouteFirstViews(): Plugin {
  return {
    name: "guard-route-first-views",
    apply: "build",
    generateBundle(_options, bundle) {
      const root = import.meta.dirname;
      const file = path.resolve(root, "scripts", "route-first-view.json");
      const spec = JSON.parse(fs.readFileSync(file, "utf8")) as { everyPage?: string[]; routes: Array<{ path: string; page: string; maxGzipKB: number; known?: string[] }> };
      const chunks: RouteChunkFacts[] = [];
      const gzip = new Map<string, number>();
      const entries: string[] = [];
      for (const out of Object.values(bundle)) {
        if (out.type !== "chunk") continue;
        chunks.push({ fileName: out.fileName, imports: out.imports, isEntry: out.isEntry, isDynamicEntry: out.isDynamicEntry, facadeModuleId: out.facadeModuleId, moduleIds: Object.keys(out.modules) });
        gzip.set(out.fileName, zlib.gzipSync(out.code, { level: 9 }).length);
        if (out.isEntry && out.facadeModuleId) entries.push(out.facadeModuleId);
      }
      const reachFrom = (starts: string[]): Set<string> => {
        const seen = new Set<string>();
        const stack = [...starts];
        while (stack.length) {
          const id = stack.pop() as string;
          if (seen.has(id)) continue;
          seen.add(id);
          for (const dep of this.getModuleInfo(id)?.importedIds ?? []) stack.push(dep);
        }
        return seen;
      };
      const name = (id: string) => shortId(id, root);
      const failures: string[] = [];
      const everyPage: RouteChunkFacts[] = [];
      for (const piece of spec.everyPage ?? []) {
        const c = pageChunk(chunks, path.resolve(root, piece));
        if (c) everyPage.push(c);
        else failures.push(`everyPage: no lazy chunk stands for ${piece}, so no route's first view would count it. Fix scripts/route-first-view.json.`);
      }
      for (const r of spec.routes) {
        const pageId = path.resolve(root, r.page);
        const page = pageChunk(chunks, pageId);
        // A renamed or eagerly imported page would make this route's check pass by measuring nothing.
        if (!page) {
          failures.push(`${r.path}: no lazy chunk stands for ${r.page}, so its first view cannot be measured. Fix scripts/route-first-view.json.`);
          continue;
        }
        const v = judgeRoute({ route: r.path, chunks, page, everyPage, reach: reachFrom([...entries, page.facadeModuleId as string, ...everyPage.map((c) => c.facadeModuleId as string)]), known: new Set(r.known ?? []), maxGzipKB: r.maxGzipKB, gzipOf: (f) => gzip.get(f) ?? 0, name });
        if (process.env.ROUTE_VIEW_REPORT) {
          console.log(`\n[route-first-view] ${r.path}: ${kb(v.gzipBytes)} KB gzipped of ${r.maxGzipKB}, ${v.chunks.length} chunks: ${v.chunks.join(" ")}`);
          for (const c of v.chunks) console.log(`  ${c} ${kb(gzip.get(c) ?? 0)} KB`);
          console.log(`  foreign modules (${v.allForeign.length}): ${v.allForeign.join(" ")}`);
        }
        const gone = (r.known ?? []).filter((m) => !v.allForeign.includes(m));
        if (gone.length) this.warn(`scripts/route-first-view.json: ${r.path} lists ${gone.length} module(s) that no longer ride its first view; remove them: ${gone.join(", ")}`);
        const msg = routeVerdictMessage(v, root);
        if (msg) failures.push(msg);
      }
      if (failures.length) this.error(failures.join("\n\n"));
    },
  };
}

/**
 * SMALL SHARED MODULES SHARE TWO LAZY CHUNKS.
 *
 * Rollup gives every shared module its own chunk, and CI charges every file a
 * whole 4 KB block (scripts/check-dist-budget.mjs), so a 300-byte API helper
 * imported by two pages costs 4 KB. A module under this many bytes of source,
 * imported by two or more modules and loaded only after the first page, goes
 * into "smalls" (plain modules in shared/, client/src/lib/, client/src/hooks/)
 * or "smallui" (components). See `smallGroupOf` for the exact rule.
 *
 * Measured on batch 62 (2026-10-31, with experimentalMinChunkSize 4096 below):
 * 6500 KB block-charged with the old leaf-only rule, 6460 KB with this one
 * (this rule without minChunkSize, 6528). The first page fetches the same
 * code, about 242 KB gzipped either way, in more files: main JS reads 361 KB
 * where it read 623 KB, because rollup moves the boot modules the groups
 * import out of the entry chunk into shared boot chunks, which is why the
 * MAX_BOOT_JS_KB budget exists. The groups are 31 KB ("smalls") and 58 KB
 * ("smallui") gzipped. 6000 bytes measured 6492 KB; 12000 measured 6448 KB
 * with a 77 KB "smallui", too much for a route's first paint to wait on.
 * Measure all three budgets with check-dist-budget.mjs after any change.
 *
 * Four rules keep it safe, each one found by a build that broke without it:
 * - `onlyExplicitManualChunks` (output, below). Without it rollup moves every
 *   unassigned dependency of a group INTO the group, react included, and the
 *   first page load then fetches the whole group (400 KB when tried).
 * - Never a module the entry imports statically, for the same reason.
 * - A group imports only packages, boot modules and its own or an earlier
 *   group, and nothing the natural kit imports joins one, or two chunks import
 *   each other and rollup warns of a circular chunk.
 * - Two or more importers. A module with one importer already rides in that
 *   importer's chunk, so grouping it saves nothing and only grows the group.
 */
const SMALL_MODULE_BYTES = 12000;
/**
 * The modules the entry imports statically, worked out on the first call and
 * kept for the rest of the build. `vite build` is one build per process here;
 * a `--watch` rebuild would read a stale set and only lose some grouping.
 */
let eagerModules: Set<string> | null = null;
/** The brochure pages' words: leaf modules with no imports of their own (see "page-copy" below). */
const PAGE_COPY = /shared[\\/]pageContent[\\/](team|circles|opportunities|masterPlan|loveLetter|training|howWeCreate)\.ts$/;
/** A route page, and the size under which it rides the "smallpages" chunk below. */
const SMALL_PAGE = /client[\\/]src[\\/]pages[\\/][^\\/]+\.tsx$/;
/*
 * 12000 since the page speed pass (14 Nov 2026), was 7500. Turning
 * experimentalMinChunkSize off (below) cost the block-charged total about 250
 * KB. Measured with this pass on 1.3.6: 7500 left it at 7416 KB of 7400 and
 * 10000 at 7380; on main at 2b783b0, 10000 at 7392 and 12000 at 7332. The
 * ceiling was not raised.
 * The price is paid only on these small pages, none of them a key route: the
 * group they share is about 125 KB raw (it was 43 KB), fetched on the first
 * visit to any of them and from cache after.
 */
const SMALL_PAGE_BYTES = 12000;
/*
 * TWO MORE PAGE GROUPS (budget headroom pass, 16 Nov 2026). The total stood
 * at 7392 KB of 7400 on 5fc1b94, and the pages that were still one file each
 * paid about 2 KB of padding apiece. Neither group holds a key route, and
 * nothing imports a page but the router, so neither can be imported back.
 *
 * "shopfront": the public brochure pages (the SHOPFRONT list in
 * scripts/check-brand-refs.mjs, without the key routes and without
 * ProjectHistory, which is big enough to be its own file). A visitor reading
 * one usually reads the next, so the group is about 125 KB raw fetched once
 * instead of one file per page. One that is under SMALL_PAGE_BYTES stays in
 * "smallpages" where it already was.
 *
 * "midpages": member pages from SMALL_PAGE_BYTES up to this many bytes of
 * source (source length counts comments and long copy, so these are 7 to 20 KB
 * once built). About 125 KB raw, a second "smallpages" so the first one does
 * not grow.
 *
 * Measured together with the "keyset-" groups and the preload trim below: 7224
 * KB block-charged, main JS and first-page JS no higher than before. 24000
 * here measured 7204 with a 290 KB group, too much for one page to wait on.
 */
const MID_PAGE_BYTES = 18000;
const SHOPFRONT_PAGES = /client[\\/]src[\\/]pages[\\/](Team|MasterPlan|Visit|WorkWithUs|LoveLetter|GoodNeighbor|CoCreatorsGuide|HowWeCreate|InvestorJourney|ResidentJourney|ProsperityJourney|ResidentRights|StewardRights)\.tsx$/;
/** The natural interface kit, grouped into its own chunk below. */
const NATURAL_KIT = /components[\\/]natural[\\/]|lib[\\/]celebrated|shared[\\/]capabilities/;
/**
 * The two merged groups and where their members live. A "smalls" member is a
 * plain module; a "smallui" member is a component. "smallui" may import
 * "smalls" and never the reverse, so the two can never import each other.
 */
// "smalls" also takes shared/comms/ and client/src/i18n/ since the dist headroom pass (23 Nov 2026): the same plain modules, one folder down.
const SMALL_GROUPS = [
  { name: "smalls", home: /[\\/]shared[\\/](?:comms[\\/])?[^\\/]+\.ts$|client[\\/]src[\\/](lib|hooks|i18n)[\\/].+\.ts$/, mayImport: ["smalls"] },
  { name: "smallui", home: /client[\\/]src[\\/]components[\\/].+\.tsx?$/, mayImport: ["smalls", "smallui"] },
] as const;
type SmallGroup = (typeof SMALL_GROUPS)[number]["name"];
/** Each module's group, worked out once per build like `eagerModules`. */
const smallVerdicts = new Map<string, SmallGroup | null>();

/*
 * NEVER A GROUP MEMBER, 1: WHAT A KEY ROUTE DRAWS (page speed pass, 14 Nov 2026).
 *
 * A merged group is all or nothing: a page that statically imports one member
 * downloads every member. The landing page and the steward page each needed a
 * handful of small components, and for that they fetched the whole of "smallui"
 * (77 KB gzipped, 12% of it run there): the voice recorder, the companion, the
 * price ask and the role-card words among it, plus "smalls" and the chunks only
 * its members needed, d3-interpolate among them.
 *
 * So nothing a key route's page reaches by static imports joins a group. The
 * key routes are the ones scripts/route-first-view.json holds to a budget, and
 * the guard-route-first-views plugin above fails the build when one of them
 * carries a module neither it nor the entry imports. Those modules fall back
 * to rollup's own chunking, which groups modules by the set of pages that load
 * them and so never hands a page another page's code.
 *
 * A group member may still import one of these: what a key page reaches is a
 * static closure, so none of it can import a group member back, and no chunk
 * cycle can form.
 *
 * Tried and measured on the way here, so nobody has to again:
 *   - one group per set of key pages ("smallui-Home-Roles"): the groups import
 *     boot modules, rollup split the boot set from 10 files into 18 to serve
 *     them, and the total rose to 7512 KB;
 *   - leaving experimentalMinChunkSize on at 4096 (or 2048, 1024, 512): it
 *     merged the freed small chunks into chunks index.html loads (the boot-set
 *     guard refuses that) or into chunks /roles and /propose-a-role load, which
 *     put 501 to 512 KB on /roles where this rule alone gives 362.
 */
const KEY_ROUTE_SPEC = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "scripts", "route-first-view.json"), "utf8")) as { everyPage?: string[]; routes: Array<{ page: string }> };
/** The key pages, and the lazy pieces the shell draws on every page (the root strip), as forward-slash paths. */
const KEY_ROUTE_PAGES: string[] = [...KEY_ROUTE_SPEC.routes.map((r) => r.page), ...(KEY_ROUTE_SPEC.everyPage ?? [])].map((p) => path.resolve(import.meta.dirname, p).replace(/\\/g, "/"));
/** Every module a key route's page reaches by static imports, worked out once per build like `eagerModules`. */
let keyRouteModules: Set<string> | null = null;
/** For each module a key page reaches, the names of the key pages that reach it, joined: worked out once per build. */
let keySetModules: Map<string, string> | null = null;
/*
 * NEVER A GROUP MEMBER, 2: THE MICROPHONE AND THE COMPANION. They hold
 * SpeechRecognition, MediaRecorder and getUserMedia, and the companion's
 * persona and words, and only the pages that record or talk need them. In a
 * group they ride every page that imports any other member, so they stay in
 * their own chunks whichever page imports them.
 */
const SMALL_GROUP_NEVER = /components[\\/](?:voice|companion|companionWelcome)[\\/]|components[\\/](?:MicButton|form[\\/]MicInput)\.tsx$|shared[\\/](?:voiceNotes|companionPersona)\.ts$/;

type ModuleInfoOf = (id: string) => { code?: string | null; importers: readonly string[]; importedIds: readonly string[] } | null;

/**
 * Which merged group a module joins, or null. It must be small, lazy, shared
 * by at least two importers (a module with one importer already rides in that
 * importer's chunk and costs no block of its own), and import only packages,
 * boot modules, or members of a group its own group may import. That last rule
 * keeps each group closed, so no chunk of ours can import it back.
 */
function smallGroupOf(id: string, info: ModuleInfoOf, eager: Set<string>, key: ReadonlySet<string> = new Set()): SmallGroup | null {
  const known = smallVerdicts.get(id);
  if (known !== undefined) return known;
  // Provisionally none, so an import cycle settles as "not small" instead of looping.
  smallVerdicts.set(id, null);
  const m = info(id);
  const group = SMALL_GROUPS.find((g) => g.home.test(id));
  const ok =
    !!group &&
    !!m?.code &&
    m.code.length < SMALL_MODULE_BYTES &&
    !eager.has(id) &&
    !key.has(id) &&
    !SMALL_GROUP_NEVER.test(id) &&
    mayJoinSharedGroup(id) && // never the Treasury's or Admin's pieces (client/src/lib/privilegedChunks.ts)
    m.importers.length >= 2 &&
    !NATURAL_KIT.test(id) &&
    !PAGE_COPY.test(id) &&
    !m.importers.some((by) => NATURAL_KIT.test(by)) &&
    m.importedIds.every((dep) => {
      // What a key page reaches is a static closure, so none of it can import this module back.
      if (dep.includes("node_modules") || eager.has(dep) || key.has(dep)) return true;
      const of = smallGroupOf(dep, info, eager, key);
      return of !== null && (group.mayImport as readonly string[]).includes(of);
    });
  const verdict = ok ? group.name : null;
  smallVerdicts.set(id, verdict);
  return verdict;
}

/*
 * A KEY ROUTE'S OWN SMALL MODULES, ONE CHUNK PER SET OF KEY PAGES (budget
 * headroom pass, 16 Nov 2026).
 *
 * The rule above keeps every module a key page reaches out of "smalls" and
 * "smallui", and rightly: those groups would hand the landing page the role
 * editor's code. But it left those modules to rollup, which gave each shared
 * one its own file, and on 5fc1b94 that was 64 files under 4 KB (24 of them
 * reached by /roles alone) costing a whole block each.
 *
 * So a small module a key page reaches joins a group named for exactly the set
 * of key pages that reach it ("keyset-Roles", "keyset-Home-Roles"). Every
 * member of "keyset-Roles" is a module /roles already loads on its first view,
 * so the group hands no key route a module it did not already fetch, which is
 * what guard-route-first-views measures. A lazy page outside the key routes
 * that imports one member downloads the group: tens of KB, and from cache
 * after the first key route.
 *
 * It stays acyclic for the same reason the groups above do. What a key page
 * reaches is a static closure, so a member's imports are reached by at least
 * the same key pages: a group only ever imports a group with the same or a
 * larger page set. And a member may import only packages, boot modules, named
 * chunks and members of such groups, so no chunk rollup builds can sit
 * between two groups and import one back.
 *
 * THE FIRST PAGE MUST NOT SPLIT, and that is the rule that decides most
 * verdicts. Rollup treats every named chunk as an entry of its own that
 * nothing is "already loaded" for, and it puts first-page modules that the
 * same named chunks reach into the same file. So a group reaching some of the
 * modules in one of those files, and not the rest, splits that file in two:
 * the first try at this rule took the first page from 10 files to 16 and the
 * total UP to 7436 KB. A member therefore has to reach either none or all of
 * each such set (an "atom" below). keySetPlan works the atoms out the same way
 * rollup does for first-page modules, from which named chunks reach them, and
 * drops any candidate that would cut one.
 */
type GetModuleInfo = Rollup.GetModuleInfo;
let keySetGroups: Map<string, string> | null = null;
function keySetPlan(info: GetModuleInfo, ids: () => IterableIterator<string>): ReadonlyMap<string, string> {
  if (keySetGroups) return keySetGroups;
  const all = Array.from(ids());
  // The rules above, for every module: which named chunk each one joins.
  const base = new Map<string, string>();
  for (const id of all) {
    const g = baseChunkOf(id, info, ids);
    if (g) base.set(id, g);
  }
  const eager = eagerModules as Set<string>;
  const keySet = keySetModules as Map<string, string>;
  const membersOf = new Map<string, string[]>();
  for (const [id, g] of Array.from(base)) membersOf.set(g, [...(membersOf.get(g) ?? []), id]);
  // What rollup counts as loaded with a named chunk: its members, their
  // imports, and every member of any named chunk reached on the way.
  const closureOf = (start: readonly string[]): Set<string> => {
    const seen = new Set<string>();
    const stack = [...start];
    while (stack.length) {
      const m = stack.pop() as string;
      if (seen.has(m)) continue;
      seen.add(m);
      const g = base.get(m);
      if (g) for (const other of membersOf.get(g) ?? []) stack.push(other);
      for (const dep of info(m)?.importedIds ?? []) stack.push(dep);
    }
    return seen;
  };
  // A first-page module outside every named chunk travels with the others
  // that the same named chunks reach: one "atom" per set.
  const reachedBy = new Map<string, string[]>();
  for (const [g, members] of Array.from(membersOf)) {
    for (const m of Array.from(closureOf(members))) if (eager.has(m) && !base.has(m)) reachedBy.set(m, [...(reachedBy.get(m) ?? []), g]);
  }
  const atomKey = (m: string) => (reachedBy.get(m) ?? []).sort().join(",");
  const atoms = new Map<string, string[]>();
  for (const m of Array.from(eager)) if (!base.has(m)) atoms.set(atomKey(m), [...(atoms.get(atomKey(m)) ?? []), m]);
  // Candidates: small modules a key page reaches that no rule above took.
  const candidate = (id: string): boolean => {
    const m = info(id);
    return (
      keySet.has(id) &&
      !base.has(id) &&
      !!m?.code &&
      m.code.length < SMALL_MODULE_BYTES &&
      !id.includes("node_modules") &&
      !id.startsWith("\0") &&
      !eager.has(id) &&
      !SMALL_GROUP_NEVER.test(id) &&
      mayJoinSharedGroup(id) && // never the Treasury's or Admin's pieces (client/src/lib/privilegedChunks.ts)
      m.importers.length >= 2 &&
      !NATURAL_KIT.test(id) &&
      !m.importers.some((by) => NATURAL_KIT.test(by))
    );
  };
  // A candidate whose first-page reach would cut an atom never joins.
  const cutsNoAtom = (id: string) => {
    const reach = new Set(Array.from(closureOf([id])).filter((m) => eager.has(m) && !base.has(m)));
    return Array.from(reach).every((m) => (atoms.get(atomKey(m)) ?? []).every((x) => reach.has(x)));
  };
  const accepted = new Set(all.filter((id) => candidate(id) && cutsNoAtom(id)));
  // And one whose imports include a lazy module outside every group drops out, until none does.
  for (let changed = true; changed; ) {
    changed = false;
    for (const id of Array.from(accepted)) {
      const deps = info(id)?.importedIds ?? [];
      if (!deps.every((dep) => eager.has(dep) || base.has(dep) || accepted.has(dep) || dep.includes("node_modules"))) {
        accepted.delete(id);
        changed = true;
      }
    }
  }
  const keyset = new Map(Array.from(accepted, (id): [string, string] => [id, `keyset-${keySet.get(id)}`]));
  keySetGroups = new Map([...Array.from(keyset), ...Array.from(lazyGroupPlan({ info, all, base, keyset, keySet, eager, closureOf }))]);
  return keySetGroups;
}

/** A lazily imported piece under this many bytes of source may join a "lazy-" group (see lazyGroupPlan). */
const LAZY_PIECE_BYTES = 32000;
/** And a "lazy-" group stops growing at this many bytes of source, smallest pieces first, so opening one piece never fetches a page's worth. */
const LAZY_GROUP_BYTES = 80000;
/** lib/motionFeatures.ts, the animation engine App.tsx loads after the first page; never a "lazy-" group member. */
const MOTION_FEATURES = /client[\\/]src[\\/]lib[\\/]motionFeatures\.ts$/;

/*
 * LAZY PIECES SHARE A FILE, AND A MODULE ONLY A GROUP IMPORTS RIDES IN IT
 * (dist headroom pass, 23 Nov 2026). On 7980327 the block-charged total stood
 * at 7556 KB of 7600, with 91 lazily imported components and 47 page chunks
 * each paying up to 4 KB of padding. Two rules, applied after every group
 * above is settled, none of them touching what a key page reaches:
 *
 * 1. A piece that is only ever imported lazily (React.lazy or import(), no
 *    static importer anywhere) joins "lazy-<area>", where the area is the set
 *    of route pages whose code can reach its importers: the role card's
 *    on-demand pieces share one file, the Admin page's tabs another. Only
 *    pieces under LAZY_PIECE_BYTES with what rides along, smallest first, up to
 *    LAZY_GROUP_BYTES a group, and a group of one is not made. When every
 *    importer is a member of one page group (smallpages, midpages, shopfront)
 *    the piece joins that group instead, beside the page that asks for it.
 *    Nothing imports such a piece statically, so no chunk can import a group
 *    back, and none of them is on a key route's first view, which is a key
 *    page's static closure. Route pages are left alone: a page in a group
 *    loses its row in route-preload.js (routePreload.ts maps a route to a
 *    chunk by its facade), and a rites-pages group measured 8 KB.
 *
 * 2. A module whose static importers all sit in ONE named chunk joins that
 *    chunk. The chunk imports it statically, so it was already loaded every
 *    time the chunk was; it had a file of its own only because rollup groups
 *    such a module by the pages that load it, not by the chunk. This moved
 *    whole chunks (the priority board into "midpages") without changing a
 *    byte any page loads.
 *
 * WHY THESE GROUPS DO NOT SPLIT THE FIRST PAGE, read off rollup 4's
 * getChunkAssignments. A named chunk holding a lazily imported module counts
 * as a dynamic entry, and rollup treats everything the importers of its lazy
 * members already loaded as loaded for it: for a piece imported by a page,
 * that is every first-page file. The exception is an importer inside (or under)
 * a STATIC named group ("smalls", "smallui", "keyset-", "natural", ...), a
 * group with no lazily imported member, which is an entry nothing is loaded
 * for; through one of those, only what that group itself reaches counts. So a
 * new group keeps only members whose first-page reach every such group already
 * covers (`unfit` below), and rule 2 reaches nothing its importers did not.
 * Pages and the page groups are dynamic entries for the same reason; the atom
 * model in keySetPlan still counts the page groups as reachers, which only
 * makes it stricter than rollup.
 * The build guards say so on every run: the boot-set guard, the key routes'
 * first views, and the three budgets.
 */
function lazyGroupPlan(g: {
  info: GetModuleInfo;
  all: string[];
  base: ReadonlyMap<string, string>;
  keyset: ReadonlyMap<string, string>;
  keySet: ReadonlyMap<string, string>;
  eager: ReadonlySet<string>;
  closureOf: (start: readonly string[]) => Set<string>;
}): Map<string, string> {
  const { info, all, base, keyset, keySet, eager, closureOf } = g;
  const extra = new Map<string, string>();
  const groupOf = (id: string) => base.get(id) ?? keyset.get(id) ?? extra.get(id);
  const PAGE_GROUPS = new Set(["smallpages", "midpages", "shopfront"]);
  const free = (id: string): boolean =>
    !groupOf(id) &&
    !id.includes("node_modules") &&
    !id.startsWith("\0") &&
    !eager.has(id) &&
    !keySet.has(id) &&
    !SMALL_GROUP_NEVER.test(id) &&
    mayJoinSharedGroup(id) && // never the Treasury's or Admin's pieces (client/src/lib/privilegedChunks.ts)
    !NATURAL_KIT.test(id) &&
    !PAGE_COPY.test(id);
  const label = (id: string) => path.basename(id.split("?")[0]).replace(/\.[jt]sx?$/, "");
  const ROUTE_PAGE = /client[\\/]src[\\/]pages[\\/]/;
  const reachOf = (id: string) => Array.from(closureOf([id])).filter((m) => eager.has(m) && !base.has(m));

  // The route pages whose static closure holds a module: the "area" a lazy piece's importers live in.
  const pagesReaching = new Map<string, string[]>();
  for (const page of all.filter((id) => ROUTE_PAGE.test(id) && (info(id)?.dynamicImporters.length ?? 0) > 0)) {
    const seen = new Set<string>();
    const stack = [page];
    while (stack.length) {
      const m = stack.pop() as string;
      if (seen.has(m) || eager.has(m)) continue;
      seen.add(m);
      pagesReaching.set(m, [...(pagesReaching.get(m) ?? []), label(page)]);
      for (const dep of info(m)?.importedIds ?? []) stack.push(dep);
      for (const dep of info(m)?.dynamicallyImportedIds ?? []) if (!ROUTE_PAGE.test(dep)) stack.push(dep);
    }
  }
  const areaOf = (by: string): string[] => pagesReaching.get(by) ?? [label(by)];
  /*
   * The members to drop so a group splits no first-page file (see the note
   * above): for every static group holding or reaching an importer of a lazy
   * member, that group must already reach every first-page module the members
   * reach. The members that bring a group falling short go.
   */
  const DYNAMIC_GROUPS = new Set(["smallpages", "midpages", "shopfront"]);
  const staticGroups = new Map<string, string[]>();
  for (const [id, name] of [...Array.from(base), ...Array.from(keyset)]) if (!DYNAMIC_GROUPS.has(name)) staticGroups.set(name, [...(staticGroups.get(name) ?? []), id]);
  const staticClosure = new Map(Array.from(staticGroups, ([name, members]) => [name, closureOf(members)] as const));
  const holdersOf = (id: string): string[] => {
    const importers = info(id)?.dynamicImporters ?? [];
    return Array.from(staticClosure).filter(([, reach]) => importers.some((by) => reach.has(by))).map(([name]) => name);
  };
  const reachMemo = new Map<string, string[]>();
  const firstPageReach = (id: string): string[] => {
    let r = reachMemo.get(id);
    if (!r) reachMemo.set(id, (r = reachOf(id)));
    return r;
  };
  const unfit = (members: string[]): string[] => {
    const left = [...members];
    for (;;) {
      const union = new Set(left.flatMap(firstPageReach));
      const short = new Set(left.flatMap(holdersOf).filter((name) => Array.from(union).some((x) => !staticClosure.get(name)?.has(x))));
      if (short.size === 0) return members.filter((id) => !left.includes(id));
      const keep = left.filter((id) => !holdersOf(id).some((name) => short.has(name)));
      if (keep.length === left.length) return members;
      left.splice(0, left.length, ...keep);
    }
  };
  // A piece's weight: its own source and that of every module only it reaches, which would ride with it (rule 2).
  const weightOf = (id: string): number => {
    const own = new Set([id]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const m of Array.from(own)) {
        for (const dep of info(m)?.importedIds ?? []) {
          const d = info(dep);
          if (own.has(dep) || !d || !free(dep) || d.dynamicImporters.length > 0 || !d.importers.every((by) => own.has(by))) continue;
          own.add(dep);
          grew = true;
        }
      }
    }
    return Array.from(own).reduce((n, m) => n + (info(m)?.code?.length ?? 0), 0);
  };
  // Rule 1: the seeds.
  for (const id of all) {
    if (!free(id)) continue;
    const m = info(id);
    if (!m) continue;
    if (m.importers.length > 0 || m.dynamicImporters.length === 0 || ROUTE_PAGE.test(id)) continue;
    // The animation engine keeps a file of its own (client/src/lib/lazyMotion.test.ts reads it by name):
    // the shell's other lazy pieces (the tab titles) would otherwise make "lazy-App" a group of two.
    if (MOTION_FEATURES.test(id)) continue;
    if (!m.code || weightOf(id) >= LAZY_PIECE_BYTES) continue;
    const owners = new Set(m.dynamicImporters.map((by) => base.get(by)));
    const owner = owners.size === 1 ? Array.from(owners)[0] : undefined;
    if (owner && PAGE_GROUPS.has(owner)) {
      // Into a group that already reaches every first-page module this piece does, or not at all.
      if (unfit([id]).length === 0) extra.set(id, owner);
      continue;
    }
    extra.set(id, `lazy-${Array.from(new Set(m.dynamicImporters.flatMap((by) => areaOf(by)))).sort().join("-")}`);
  }

  // Each "lazy-" group takes its smallest pieces first and stops at LAZY_GROUP_BYTES; the rest keep their own chunks.
  const seedsOf = new Map<string, string[]>();
  for (const [id, name] of Array.from(extra)) if (name.startsWith("lazy-")) seedsOf.set(name, [...(seedsOf.get(name) ?? []), id]);
  for (const seeds of Array.from(seedsOf.values())) {
    const weight = new Map(seeds.map((id) => [id, weightOf(id)]));
    let total = 0;
    for (const id of seeds.sort((a, b) => (weight.get(a) ?? 0) - (weight.get(b) ?? 0) || a.localeCompare(b))) {
      total += weight.get(id) ?? 0;
      if (total > LAZY_GROUP_BYTES) extra.delete(id);
    }
  }

  // A new group keeps only the members that, together, need no first-page module a static group would not already load.
  const isNew = (name: string) => name.startsWith("lazy-");
  for (let changed = true; changed; ) {
    changed = false;
    const byGroup = new Map<string, string[]>();
    for (const [id, name] of Array.from(extra)) if (isNew(name)) byGroup.set(name, [...(byGroup.get(name) ?? []), id]);
    for (const members of Array.from(byGroup.values())) {
      // A group of one saves nothing: its member keeps the chunk rollup gives it.
      const drop = members.length < 2 ? members : unfit(members);
      for (const id of drop) extra.delete(id);
      if (drop.length) changed = true;
    }
  }

  // Rule 2: a module only one named chunk imports rides in it, until nothing more moves.
  for (let changed = true; changed; ) {
    changed = false;
    for (const id of all) {
      if (!free(id)) continue;
      const m = info(id);
      if (!m || m.importers.length === 0 || m.dynamicImporters.length > 0) continue;
      if (m.importers.some((by) => NATURAL_KIT.test(by))) continue;
      const into = new Set(m.importers.map(groupOf));
      const name = into.size === 1 ? Array.from(into)[0] : undefined;
      if (!name || name.startsWith("keyset-") || name === "icons" || name === "shell-libs" || name === "natural") continue;
      extra.set(id, name);
      changed = true;
    }
  }
  return extra;
}

/*
 * NO PRELOAD HINT FOR A FILE THE IMPORTER ALREADY HOLDS (budget headroom pass,
 * 16 Nov 2026).
 *
 * Vite writes, beside every dynamic import, the list of files to preload with
 * it: the target and everything it imports, transitively. That list includes
 * the chunks the importing chunk has itself already imported statically, and
 * for the entry those are the first page's own chunks (icons, shell-libs,
 * internalPath and the rest), named again in the list of all hundred-odd
 * routes. Vite's preload helper skips a file it has a link for, so those
 * entries do nothing at runtime; they only cost bytes in the main chunk and in
 * every chunk that imports lazily. This drops, for each import, the files the
 * importer's own static imports already loaded.
 */
let preloadBundle: Rollup.OutputBundle | null = null;
const loadedWithChunk = new Map<string, Set<string>>();
function staticallyLoadedWith(fileName: string): Set<string> {
  const known = loadedWithChunk.get(fileName);
  if (known) return known;
  const seen = new Set<string>();
  const stack = [fileName];
  while (stack.length) {
    const f = stack.pop() as string;
    if (seen.has(f)) continue;
    seen.add(f);
    const out = preloadBundle?.[f];
    if (out?.type === "chunk") stack.push(...out.imports);
  }
  loadedWithChunk.set(fileName, seen);
  return seen;
}
/** The part of moved English a built chunk reads before its code, or null (copySplit.ts). */
function copyPartOfFile(fileName: string): string | null {
  const out = preloadBundle?.[fileName];
  return out?.type === "chunk" ? copyPartRead(out.code) : null;
}
function capturePreloadBundle(): Plugin {
  return {
    name: "capture-preload-bundle",
    apply: "build",
    generateBundle: {
      order: "pre",
      handler(_options, bundle) {
        preloadBundle = bundle;
        loadedWithChunk.clear();
      },
    },
  };
}

/**
 * Long English moved out of the lazy chunks into dist/i18n/parts/en, outside
 * dist/public (client/src/i18n/copySplit.ts). One collector per build: the
 * transform half (precompileEnglish) fills it, the renderChunk half reads it.
 */
const longCopy = new CopyCollector();
const LONG_COPY_PARTS = path.resolve(import.meta.dirname, "dist", "i18n", "parts", "en");

/**
 * The chunk a module joins under the rules above, before the "keyset-" groups
 * (keySetPlan below), or undefined for rollup's own chunking.
 */
function baseChunkOf(id: string, getModuleInfo: GetModuleInfo, getModuleIds: () => IterableIterator<string>): string | undefined {
  if (id.includes("lucide-react")) return "icons";
  /*
   * THE SHELL'S LIBRARIES, ONE NAMED CHUNK (role journey PR-B, 2026-11-09).
   * Rollup split these off the entry only when the lazy-chunk graph
   * happened to share them (a chunk it named "internalPath"), and folded
   * them back in when it did not: adding the role editor as one more lazy
   * chunk took the main chunk from 345 KB to 471 KB while first-page JS
   * stayed at 641 KB, i.e. nothing new was loaded. Named, the split no
   * longer depends on how many lazy chunks import them.
   */
  if (/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?:motion-dom|tailwind-merge|sonner|wouter|@lingui\/core)\//.test(id)) return "shell-libs";
  /*
   * The natural interface kit, one chunk instead of four.
   *
   * Its pieces are shared by the dashboard, the quest board, the
   * profile, the admin and both crowdpool boards, so rollup gave each
   * one its own shared chunk: 4276 real bytes spread across four files
   * and charged 16 KB in blocks. Grouped, the same bytes cost one
   * block. This is the merging fix the block-charge note above
   * describes, at the smallest scale it is worth doing.
   */
  // The celebration is the kit's one large piece and nothing on the first page
  // draws it (its last boot importer, NotificationToasts, went lazy with
  // MemberMoments), so it rides with the lazy pages that do. The moon pieces
  // likewise: once the bell went lazy (Layout), only lazy pages draw a moon,
  // and grouped here they kept shared/lunar and its table on the first page.
  if (NATURAL_KIT.test(id) && !/natural[\\/](?:Celebration|celebrationPlan|MoonProgress|moonGeometry)\./.test(id)) {
    return "natural";
  }
  // SMALL SHARED MODULES, two lazy chunks: see SMALL_MODULE_BYTES above.
  // Only modules the entry does NOT import statically, so the first
  // page load fetches nothing it did not fetch before.
  if (!eagerModules) {
    eagerModules = new Set();
    const stack = Array.from(getModuleIds()).filter((m) => getModuleInfo(m)?.isEntry);
    while (stack.length) {
      const m = stack.pop() as string;
      if (eagerModules.has(m)) continue;
      eagerModules.add(m);
      for (const dep of getModuleInfo(m)?.importedIds ?? []) stack.push(dep);
    }
  }
  // What the key routes' pages reach statically joins no group: see KEY_ROUTE_PAGES above.
  if (!keyRouteModules) {
    keyRouteModules = new Set();
    const stack = Array.from(getModuleIds()).filter((m) => KEY_ROUTE_PAGES.includes(m.split("?")[0].replace(/\\/g, "/")));
    while (stack.length) {
      const m = stack.pop() as string;
      if (keyRouteModules.has(m)) continue;
      keyRouteModules.add(m);
      for (const dep of getModuleInfo(m)?.importedIds ?? []) stack.push(dep);
    }
  }
  // Which key pages reach each module, for the "keyset-" groups: see keySetPlan above.
  if (!keySetModules) {
    const reached = new Map<string, string[]>();
    for (const page of Array.from(getModuleIds()).filter((m) => KEY_ROUTE_PAGES.includes(m.split("?")[0].replace(/\\/g, "/")))) {
      const label = path.basename(page.split("?")[0]).replace(/\.tsx?$/, "");
      const seen = new Set<string>();
      const stack = [page];
      while (stack.length) {
        const m = stack.pop() as string;
        if (seen.has(m)) continue;
        seen.add(m);
        reached.set(m, [...(reached.get(m) ?? []), label]);
        for (const dep of getModuleInfo(m)?.importedIds ?? []) stack.push(dep);
      }
    }
    /*
     * What a lazy piece the shell draws on every page reaches (the root strip,
     * `everyPage` in scripts/route-first-view.json) is on every key route's
     * first view, so its set of key pages is all of them, whichever pages also
     * import it: one "keyset-RootLine" group where there were three (dist
     * headroom pass, 23 Nov 2026).
     */
    const everyPage = new Set((KEY_ROUTE_SPEC.everyPage ?? []).map((p) => path.basename(p).replace(/\.tsx?$/, "")));
    keySetModules = new Map(Array.from(reached, ([m, labels]) => [m, (labels.some((l) => everyPage.has(l)) ? labels.filter((l) => everyPage.has(l)) : labels).sort().join("-")]));
  }
  const key = keyRouteModules;
  /*
   * THE PAGES' OWN COPY, one chunk (batch 158). Each brochure page's
   * words (shared/pageContent/<page>.ts) are a leaf module of 1 to 4 KB
   * shared by its page and the admin's page editor, so rollup gave each
   * its own file and a whole 4 KB block. Grouped, they ride one file. Only
   * lazy ones: whatever the first page already carries stays where it is.
   */
  if (PAGE_COPY.test(id) && !eagerModules.has(id) && !key.has(id)) return "page-copy";
  /*
   * SMALL LAZY PAGES, one chunk (batch 158). A route that is a few
   * hundred lines (the password pages, a short list) was its own 2 to 4
   * KB file and a whole 4 KB block. Nothing imports a page but the
   * router's React.lazy, so the group can never be imported back.
   */
  // A privileged page (Treasury, Admin*, Mint*, Cash*) keeps its own lazy chunk at any size, so its
  // code never ships to a member who opens a neighbour in a group (client/src/lib/privilegedChunks.ts).
  if (SMALL_PAGE.test(id) && !eagerModules.has(id) && !key.has(id) && mayJoinSharedGroup(id)) {
    const code = getModuleInfo(id)?.code;
    if (code && code.length < SMALL_PAGE_BYTES) return "smallpages";
    if (SHOPFRONT_PAGES.test(id)) return "shopfront";
    if (code && code.length < MID_PAGE_BYTES) return "midpages";
  }
  return smallGroupOf(id, getModuleInfo, eagerModules, key) ?? undefined;
}

export default defineConfig({
  plugins: [linguiMacros(longCopy), splitLongCopy(longCopy, LONG_COPY_PARTS), react(), tailwindcss(), serveGroundsInDev(), dropLegacyWoffFallback(), useUnhintedFonts(), routeChunkPreload(), preloadDisplayFace(), guardBootSet(), guardRouteFirstViews(), capturePreloadBundle()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    // Drop preload hints for files the importer already loaded: see capturePreloadBundle above.
    // For a lazy import, name each chunk's part of moved English beside its
    // file, so the preload helper fetches it BEFORE the import and no lazy
    // chunk needs a top-level await (copySplit.ts, partsBesideFiles).
    modulePreload: {
      resolveDependencies: (file, deps, { hostId, hostType }) => {
        const loaded = staticallyLoadedWith(hostId);
        const wanted = deps.filter((dep) => !loaded.has(dep));
        return hostType === "js" ? partsBesideFiles(loaded.has(file) ? null : file, wanted, copyPartOfFile) : wanted;
      },
    },
    emptyOutDir: true,
    /*
     * Terser rather than esbuild's minifier, 2026-11-02 budget pass: about
     * 40 KB less across dist/public and 4 KB less main JS for the same code.
     * `module`/`toplevel` are safe because every chunk is an ES module, and
     * ecma 2020 matches Vite's default "modules" browser target. Costs a few
     * seconds of build time and nothing at runtime.
     */
    minify: "terser",
    terserOptions: { module: true, toplevel: true, ecma: 2020, compress: { passes: 3, ecma: 2020 }, mangle: { toplevel: true }, format: { comments: false, ecma: 2020 } },
    rollupOptions: {
      output: {
        /**
         * One icon chunk, because the total budget is measured in BLOCKS.
         *
         * CI sizes `dist/public` with `du -sk`, and `du` counts allocated
         * blocks. On the ext4 filesystem the runners use, every file costs a
         * whole 4096 bytes however small it is. So the two budgets in
         * `.github/workflows/ci.yml` pull in opposite directions: MAX_MAIN_JS_KB
         * is real bytes on one file and falls when you split, MAX_TOTAL_DIST_KB
         * is block-charged across the tree and RISES when you split. A 400-byte
         * chunk costs four kilobytes of the ceiling.
         *
         * Icons were the worst case of that. Each lucide glyph is its own
         * module, so any glyph used by two lazy routes became its own chunk:
         * eighty files of 130 to 790 bytes, spending 278 KB of the ceiling on
         * padding to carry about 37 KB of code. Grouping the package into one
         * chunk took `dist/public` from 6536 KB to 6260 KB block-charged and
         * the emitted chunk count from 152 to 82, while the main chunk FELL
         * from 503 KB to 477 KB because the shell's own icons left with them.
         *
         * The cost, measured and stated plainly: a first page load now fetches
         * every icon the app uses instead of the handful that route needs. The
         * three heaviest routes gained 4.3 KB (admin), 6.0 KB (history) and
         * 6.9 KB (map) gzipped, every later navigation gets its icons from
         * cache, and eighty requests became one. Compression is why the raw
         * numbers and the wire numbers disagree so much: gzip does very little
         * for a 400-byte file and a lot for an 81 KB one.
         *
         * `output.experimentalMinChunkSize` was measured here too and is the
         * weaker knob: about 64 KB at 4096, a plateau by 20000, and it pushes
         * real bytes INTO the main chunk, which is the one budget measured in
         * real bytes. Reach for it only after this.
         *
         * It was on, at 8192, for a few days (2026-10-09 to 2026-10-13): Village
         * Comms and the sessions module landing together took the total to
         * 6656 KB of 6600, and 8192 brought it to 6548 at 24 KB more main JS.
         * It came off once the avatars (1.6 MB) moved from client/public to the
         * uploads volume (#464), which was the lasting fix. Measured on that
         * tree: off is 5096 KB block-charged with main JS 516 KB; 8192 is 4980
         * and 539. Off spends 116 KB more of a ceiling that now has 1.5 MB
         * free, and saves every visitor 23 KB on first load and the risk of a
         * changed chunk order, so it is off.
         *
         * Verify any chunking change with `node scripts/check-dist-budget.mjs`,
         * which prints both measures.
         */
        /*
         * ON AT 4096, 2026-10-30, BESIDE THE SMALL-MODULE RULE BELOW. With that
         * rule alone the dashboard measured 6584 KB of 6600, and the
         * companions section (0295) took it to 6608. Measured on that tree:
         * off, 6608 KB block-charged and main JS 620 KB; 4096, 6480 and 624;
         * 8192, 6408 and 657. 4096 buys 128 KB of the ceiling for 4 KB of
         * first load. The note above says why it is the weaker knob; take it
         * off the day the total has room without it.
         *
         * OFF AGAIN, 2026-11-14 (page speed pass). It merges a small chunk into
         * whichever chunk is cheapest to load it with, without asking whether
         * that chunk's other pages need it, so once the key routes' modules left
         * the small groups (KEY_ROUTE_PAGES above) it folded them into the boot
         * chunks and into chunks /roles loads: 512 KB gzipped on /roles where
         * the rule alone gives 362. Off costs the block-charged total about 250
         * KB; SMALL_PAGE_BYTES above won back what kept it under the ceiling.
         */
        // Groups hold only what manualChunks names: see SMALL_MODULE_BYTES.
        onlyExplicitManualChunks: true,
        manualChunks: (id: string, { getModuleInfo, getModuleIds }) => baseChunkOf(id, getModuleInfo, getModuleIds) ?? keySetPlan(getModuleInfo, getModuleIds).get(id),
      },
    },
  },
  server: {
    port: 3000,
    strictPort: false,
    host: true,
    // Dev API proxy (plan hazard table, dies at S0): `pnpm dev` used to serve
    // the SPA with no backend at all — and the API server ALSO defaulted to
    // port 3000, so the two collided before a proxy could even exist. Run
    // `pnpm dev:server` (API on 3001 via .env PORT) beside `pnpm dev` and the
    // SPA talks to a real backend.
    proxy: {
      "/api": { target: process.env.API_PROXY_TARGET || "http://localhost:3001", changeOrigin: true },
      "/health": { target: process.env.API_PROXY_TARGET || "http://localhost:3001", changeOrigin: true },
    },
  },
});
