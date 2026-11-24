#!/usr/bin/env node
/**
 * HOW MUCH OF EACH SURFACE READS IN A LANGUAGE, measured from the code
 * (the lead, 24 Nov 2026: "ALL surfaces need to have spanish translation").
 *
 * A surface is one route in client/src/App.tsx. Its files are the page file
 * and every module under client/src it imports, statically or lazily, minus
 * the shell (Layout and what Layout imports), which is measured once as its
 * own surface. For each surface:
 *
 *   wrapped     Lingui messages whose origin is one of its files (from the
 *               locale's PO file, deduplicated by id)
 *   translated  those with a non-empty msgstr in the locale's PO file
 *   unwrapped   English the ratchet counts in its files (check-i18n-ratchet.mjs,
 *               copyHits): JSX text and copy props that never reach Lingui
 *   %           translated / (wrapped + unwrapped)
 *
 * WHAT IT DOES NOT SEE, said here so nobody reads more into the number:
 *   - the village's own words (brochure pages, journey pages, role cards,
 *     FAQs, festivals), which live in the database and are translated per
 *     village in `content_translations`. Admin, Translations shows those;
 *   - English kept in a constant and rendered elsewhere (a nav table's
 *     `label: "About"`), which the ratchet cannot see either;
 *   - server-sent text: API errors, emails, notifications;
 *   - whether a translation is GOOD. Entries marked `needs-native-review`
 *     are counted as translated and listed in the review column.
 *
 *   node scripts/i18n-coverage.mjs                    # es, every surface, grouped
 *   node scripts/i18n-coverage.mjs --locale es --group public
 *   node scripts/i18n-coverage.mjs --json             # for a dashboard or a diff
 *   node scripts/i18n-coverage.mjs --files /resident  # which files a surface is made of
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyHits } from "./check-i18n-ratchet.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "client", "src");
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
};

/** Where a route belongs. Signed-out pages a visitor can reach are listed by path; the rest follow the prefix rules. */
const PUBLIC = new Set([
  "/", "/resident", "/steward", "/prosperity", "/love-letter", "/visit", "/governance", "/how-we-create",
  "/good-neighbor", "/team", "/exit-policy", "/seasonal-festivals", "/gratitude", "/roles", "/powers", "/places",
  "/events", "/partner", "/work-with-us", "/feedback", "/propose-quest", "/propose-a-role", "/login", "/register",
  "/forgot-password", "/reset-password", "/campaigns", "/faq", "/about", "/privacy", "/terms",
]);
const APPLICANT = /^\/(request-membership|apply|application|applicant|join|welcome|onboarding|invite)/;
export function groupOf(route) {
  if (route.startsWith("/admin")) return "admin";
  if (APPLICANT.test(route)) return "applicant";
  if (PUBLIC.has(route)) return "public";
  return "member";
}

// ---------- the PO file ----------

function unquote(s) {
  return JSON.parse(s);
}

/** Entries of one PO file: id (context + message), origins, translated, flagged for review. */
export function parsePo(text) {
  const out = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const e = { origins: [], ctx: "", id: "", str: "", review: false, obsolete: false };
    let field = null;
    for (const line of lines) {
      if (line.startsWith("#~")) e.obsolete = true;
      else if (line.startsWith("#:")) e.origins.push(...line.slice(2).trim().split(/\s+/).map((o) => o.replace(/:\d+$/, "")));
      else if (line.startsWith("#") && /needs-native-review/.test(line)) e.review = true;
      else if (line.startsWith("msgctxt ")) (field = "ctx"), (e.ctx = unquote(line.slice(8)));
      else if (line.startsWith("msgid_plural ")) field = "plural";
      else if (line.startsWith("msgid ")) (field = "id"), (e.id = unquote(line.slice(6)));
      else if (/^msgstr(\[\d+\])? /.test(line)) {
        const v = unquote(line.slice(line.indexOf(" ") + 1));
        field = "str";
        e.str += v;
      } else if (line.startsWith('"') && field) {
        const v = unquote(line);
        if (field === "ctx") e.ctx += v;
        else if (field === "id") e.id += v;
        else if (field === "str") e.str += v;
      }
    }
    if (e.id && !e.obsolete) out.push(e);
  }
  return out;
}

// ---------- the import graph ----------

const EXTS = [".tsx", ".ts", "/index.tsx", "/index.ts"];
function resolveImport(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const ext of EXTS) if (fs.existsSync(base + ext)) return base + ext;
  return null;
}

const IMPORT_RE = /(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
const depsCache = new Map();
function depsOf(file) {
  let d = depsCache.get(file);
  if (d) return d;
  d = [];
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(IMPORT_RE)) {
    const r = resolveImport(file, m[1] ?? m[2]);
    if (r && r.startsWith(SRC) && !/\.(test|spec)\.tsx?$/.test(r)) d.push(r);
  }
  depsCache.set(file, d);
  return d;
}

/** Every client/src file reachable from `entry`, not crossing into `stop`. */
function closure(entry, stop = new Set()) {
  const seen = new Set();
  const todo = [entry];
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f) || stop.has(f)) continue;
    seen.add(f);
    for (const d of depsOf(f)) todo.push(d);
  }
  return seen;
}

// ---------- the routes ----------

/** { path, component, file } for every <Route path= component=> in App.tsx. */
export function readRoutes(appText = fs.readFileSync(path.join(SRC, "App.tsx"), "utf8")) {
  const appFile = path.join(SRC, "App.tsx");
  const fileOf = new Map();
  for (const m of appText.matchAll(/^const (\w+)\s*=\s*\w+\(\s*\(\)\s*=>\s*import\(\s*["']([^"']+)["']\s*\)/gm)) fileOf.set(m[1], resolveImport(appFile, m[2]));
  for (const m of appText.matchAll(/^import (\w+) from ["']([^"']+)["']/gm)) if (!fileOf.has(m[1])) fileOf.set(m[1], resolveImport(appFile, m[2]));
  // const loadHome = () => import("./pages/Home"); const Home = lazy(loadHome);
  const loaders = new Map();
  for (const m of appText.matchAll(/^const (\w+)\s*=\s*\(\)\s*=>\s*import\(\s*["']([^"']+)["']\s*\)/gm)) loaders.set(m[1], resolveImport(appFile, m[2]));
  for (const m of appText.matchAll(/^const (\w+)\s*=\s*\w+\(\s*(\w+)\s*\)/gm)) if (!fileOf.has(m[1]) && loaders.has(m[2])) fileOf.set(m[1], loaders.get(m[2]));
  // A route component written in App.tsx itself (the landing route) is measured
  // as the first lazily loaded page its body draws: for "/", the brochure home.
  const drawnBy = (name) => {
    const body = appText.match(new RegExp(`function ${name}\\(\\)[\\s\\S]*?\\n}`))?.[0] ?? "";
    for (const m of body.matchAll(/<(\w+)\s*\/>/g)) if (fileOf.get(m[1])?.includes(`${path.sep}pages${path.sep}`)) return fileOf.get(m[1]);
    return null;
  };
  const routes = [];
  for (const m of appText.matchAll(/<Route\s+path="([^"]+)"\s+component=\{(\w+)\}/g)) {
    const file = fileOf.get(m[2]) ?? drawnBy(m[2]);
    routes.push({ path: m[1], component: m[2], file });
  }
  return routes;
}

// ---------- the measure ----------

const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/");

export function measureCoverage(locale = "es") {
  const po = parsePo(fs.readFileSync(path.join(SRC, "locales", `${locale}.po`), "utf8"));
  const byFile = new Map();
  for (const e of po) {
    for (const o of e.origins) {
      if (!byFile.has(o)) byFile.set(o, []);
      byFile.get(o).push(e);
    }
  }
  const hitsCache = new Map();
  const hits = (f) => {
    if (!hitsCache.has(f)) hitsCache.set(f, copyHits(fs.readFileSync(f, "utf8"), f).length);
    return hitsCache.get(f);
  };
  const score = (files) => {
    const ids = new Map();
    let unwrapped = 0;
    for (const f of files) {
      for (const e of byFile.get(rel(f)) ?? []) ids.set(`${e.ctx}\u0004${e.id}`, e);
      unwrapped += hits(f);
    }
    const entries = [...ids.values()];
    const translated = entries.filter((e) => e.str.trim()).length;
    const review = entries.filter((e) => e.str.trim() && e.review).length;
    const total = entries.length + unwrapped;
    return { wrapped: entries.length, translated, review, unwrapped, pct: total ? Math.round((1000 * translated) / total) / 10 : 100, files: files.size };
  };

  const shellEntry = path.join(SRC, "components", "Layout.tsx");
  const shell = closure(shellEntry);
  const surfaces = [{ path: "(shell: header, menu, footer)", group: "shell", ...score(shell), fileList: [...shell].map(rel) }];
  const seen = new Set();
  for (const r of readRoutes()) {
    if (!r.file || seen.has(r.path)) continue;
    seen.add(r.path);
    const files = closure(r.file, shell);
    surfaces.push({ path: r.path, group: groupOf(r.path), ...score(files), fileList: [...files].map(rel) });
  }
  const all = new Set();
  for (const f of fs.readdirSync(SRC, { recursive: true })) {
    const p = path.join(SRC, f);
    if (/\.tsx?$/.test(p) && !/\.(test|spec)\.tsx?$/.test(p) && !p.endsWith(".d.ts") && !p.includes(`${path.sep}locales${path.sep}`)) all.add(p);
  }
  return { locale, surfaces, total: score(all) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const locale = arg("--locale") ?? "es";
  const { surfaces, total } = measureCoverage(locale);
  const group = arg("--group");
  const shown = surfaces.filter((s) => !group || s.group === group || s.group === "shell");
  const filesFor = arg("--files");
  if (filesFor) {
    const s = surfaces.find((x) => x.path === filesFor);
    console.log(s ? s.fileList.sort().join("\n") : `No route ${filesFor}.`);
    process.exit(s ? 0 : 1);
  }
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ locale, total, surfaces: shown.map(({ fileList, ...s }) => s) }, null, 2));
    process.exit(0);
  }
  const groups = ["shell", "public", "applicant", "member", "admin"];
  console.log(`Platform strings in ${locale}, per surface (village content in the database is not counted here).\n`);
  for (const g of groups) {
    const rows = shown.filter((s) => s.group === g).sort((a, b) => a.pct - b.pct || a.path.localeCompare(b.path));
    if (!rows.length) continue;
    const t = rows.reduce((a, s) => ({ tr: a.tr + s.translated, all: a.all + s.wrapped + s.unwrapped }), { tr: 0, all: 0 });
    console.log(`${g.toUpperCase()}  (${rows.length} surface(s), ${t.all ? ((100 * t.tr) / t.all).toFixed(1) : "100.0"}% summed)`);
    for (const s of rows) {
      console.log(`  ${s.pct.toFixed(1).padStart(5)}%  ${s.path.padEnd(40)} ${String(s.translated).padStart(5)} of ${String(s.wrapped + s.unwrapped).padStart(5)}   unwrapped ${String(s.unwrapped).padStart(4)}   needs review ${s.review}`);
    }
    console.log("");
  }
  console.log(`WHOLE CLIENT: ${total.pct}% (${total.translated} translated of ${total.wrapped + total.unwrapped}; ${total.unwrapped} never wrapped; ${total.review} awaiting native review)`);
}
