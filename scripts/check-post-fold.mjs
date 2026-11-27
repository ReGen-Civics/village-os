#!/usr/bin/env node
/**
 * Would main still be green after the generated-docs bot folds this tree?
 *
 * WHY THIS EXISTS. A pull request adds translations as fragments
 * (client/src/locales/<tag>.d/*.po) and never commits en.po or a folded es.po:
 * main's generated-docs workflow folds the fragments in and re-extracts after
 * the merge, and pushes that as one bot commit. Nothing ran the checks on the
 * folded tree before that push, so on 26 Nov 2026 main went red twice on the bot
 * commit and not on the release it followed:
 *
 *   7366a88 (after 1.3.82)  a test read es.po, and the fold changed what it read
 *   a187ce0 (after 1.3.83)  check-i18n-catalogs in strict mode failed on a folded
 *                           plural with no `one` case; PR mode had not looked
 *
 * Every open pull request's run merges main, so each one inherited the red.
 *
 * WHAT IT RUNS, on the folded tree:
 *   catalogs      check-i18n-catalogs.mjs with GENERATED_DOCS_MODE=strict, the
 *                 mode main's own workflow checks in
 *   locale-tests  every client, server and shared test file that reads a
 *                 catalog under client/src/locales, found by reading the files,
 *                 so a new one is covered without anyone listing it
 *
 * WHAT IT DOES NOT RUN, on purpose: the build and the dist budget. Compiled
 * catalogs land in dist/i18n, outside dist/public, so the fold cannot move the
 * budget (ea9a3a1 went red on the budget with a fold that touched only .po
 * files; that was du drifting 8 KB from the model at 7996 of 8000, a separate
 * problem).
 *
 *   node scripts/check-post-fold.mjs           the tree already holds the fold
 *                                              (generated-docs, before it pushes)
 *   node scripts/check-post-fold.mjs --fold    fold and extract first, IN PLACE
 *                                              (ci.yml, on its throwaway checkout)
 *   node scripts/check-post-fold.mjs --dry-run print what would run
 *
 * --fold edits client/src/locales and refuses unless that folder is clean, so
 * it never mixes with uncommitted work. Undo it with
 *   git checkout -- client/src/locales && git clean -fd client/src/locales
 *
 * Exit 0 when every check passed, 1 when any failed (all of them still run, and
 * the last line names each one that failed), 2 on bad usage.
 * Self-test: node scripts/check-post-fold.test.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES = "client/src/locales";

/** A test file reads a catalog when it names the locales folder or a .po file outside a comment. */
const READS_CATALOG = /locales["'`/]|\.po["'`]|mergedPoText|catalogLocales/;
const TEST_FILE = /\.test\.(ts|tsx|mts|mjs|js)$/;
const SEARCH_DIRS = ["client", "server", "shared"];

function codeOnly(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

/** Every test file under client, server and shared that reads a catalog, repo-relative and sorted. */
export function discoverLocaleTests(root = ROOT) {
  const found = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (TEST_FILE.test(e.name) && READS_CATALOG.test(codeOnly(fs.readFileSync(full, "utf8")))) {
        found.push(path.relative(root, full).split(path.sep).join("/"));
      }
    }
  };
  for (const d of SEARCH_DIRS) walk(path.join(root, d));
  return found.sort();
}

/** The checks, as [name, command, args, extra env]. */
export function plan({ fold, tests }) {
  const steps = [];
  if (fold) {
    steps.push(["fold", process.execPath, ["scripts/fold-po-fragments.mjs"], {}]);
    steps.push(["extract", "pnpm", ["i18n:extract"], {}]);
  }
  steps.push(["catalogs", process.execPath, ["scripts/check-i18n-catalogs.mjs"], { GENERATED_DOCS_MODE: "strict" }]);
  if (tests.length) {
    // ALLOW_STALE_DIST: vitest's global setup refuses a run whose dist is older than the
    // source (server/db/distFreshness.ts), and in ci.yml's verify the fold rewrites
    // client/src/locales AFTER the build, so every folded tree reads as stale (the
    // coordinator hit it composing 1.3.85). None of these tests reads dist: they read the
    // catalogs in client/src/locales, which is the folded tree under test. Held by
    // check-post-fold.test.mjs, which also holds that no discovered test names dist.
    // CI: "" because these files read catalogs and need no database, and the docs bot's job
    // (generated-docs.yml) has none. vitest's teardown (server/db/provisioningReport.ts) holds
    // any run with CI set and no TEST_DATABASE_URL to be a hollow run and fails it, filtered
    // or not, so the gate failed 22 green files and held back the first regeneration after
    // 1.3.85 (run 45909752640, 26 Nov 2026). Clearing CI here takes the demand off this one
    // step: REQUIRE_TEST_DB is left alone, every ci.yml shard keeps CI, and ci.yml's verify
    // runs this step with its database anyway. Held by check-post-fold.test.mjs.
    steps.push(["locale-tests", process.execPath, [path.join("node_modules", "vitest", "vitest.mjs"), "run", ...tests], { ALLOW_STALE_DIST: "1", CI: "" }]);
  }
  return steps;
}

/**
 * Run every step, even after a failure, so the report names all of them. A
 * failed fold or extract stops the rest: checks on a half-folded tree say
 * nothing about main.
 */
/**
 * Fragments still waiting in es.d mean this tree has not been folded: the fold deletes
 * every one. Checking such a tree without --fold reports every new string as "en.po is
 * stale" (175 errors on the 1.3.85 composition), which reads like a real failure.
 */
export function unfoldedFragments(root = ROOT) {
  const dir = path.join(root, LOCALES, "es.d");
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith(".po"));
  } catch {
    return [];
  }
}

export const UNFOLDED_HINT =
  "This tree has not been through the docs bot's fold (no pull request's tree has). Run with --fold, which folds and extracts in place first: node scripts/check-post-fold.mjs --fold";

export function runSteps(steps, run) {
  const failed = [];
  for (const [name, cmd, args, env] of steps) {
    const ok = run(name, cmd, args, env);
    if (!ok) {
      failed.push(name);
      if (name === "fold" || name === "extract") break;
    }
  }
  return failed;
}

function realRun(name, cmd, args, env) {
  console.log(`::group::post-fold: ${name}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env } });
  console.log("::endgroup::");
  const ok = r.status === 0;
  console.log(`${ok ? "ok" : "FAILED"}: ${name}`);
  return ok;
}

function localesClean() {
  const r = spawnSync("git", ["status", "--porcelain", "--", LOCALES], { cwd: ROOT, encoding: "utf8" });
  return r.status === 0 && r.stdout.trim() === "";
}

export function main(argv) {
  const fold = argv.includes("--fold");
  const dryRun = argv.includes("--dry-run");
  const unknown = argv.filter((a) => !["--fold", "--dry-run"].includes(a));
  if (unknown.length) {
    console.error(`usage: node scripts/check-post-fold.mjs [--fold] [--dry-run] (unknown: ${unknown.join(" ")})`);
    return 2;
  }
  const tests = discoverLocaleTests();
  const steps = plan({ fold, tests });
  if (dryRun) {
    for (const [name, cmd, args, env] of steps) {
      const vars = Object.entries(env).map(([k, v]) => `${k}=${v} `).join("");
      console.log(`${name}: ${vars}${path.basename(cmd)} ${args.join(" ")}`);
    }
    return 0;
  }
  if (!fold) {
    const waiting = unfoldedFragments();
    if (waiting.length) {
      console.error(`::error::${waiting.length} fragment(s) still wait in ${LOCALES}/es.d (${waiting.slice(0, 3).join(", ")}${waiting.length > 3 ? ", ..." : ""}). ${UNFOLDED_HINT}`);
      return 2;
    }
  }
  if (fold && !localesClean()) {
    console.error(`::error::${LOCALES} has uncommitted changes, and --fold edits it in place. Commit or stash them, or run without --fold.`);
    return 2;
  }
  const failed = runSteps(steps, realRun);
  const summary = failed.length
    ? `post-fold: FAILED ${failed.join(", ")}. The tree as main's generated-docs bot would fold it is red, so main would go red after the merge.`
    : `post-fold: green (${steps.map((s) => s[0]).join(", ")}; ${tests.length} test file(s) read a catalog).`;
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Post-fold check\n\n${summary}\n`);
    } catch {
      /* the summary is a convenience; the exit code is the answer */
    }
  }
  if (failed.length) console.error(`::error::${summary}`);
  // A stale en.po with no fragment waiting is still what an unfolded tree looks like.
  if (!fold && failed.includes("catalogs")) console.error(`If you have not folded this tree: ${UNFOLDED_HINT}`);
  else console.log(summary);
  if (fold) console.log(`(${LOCALES} was folded in place. Undo: git checkout -- ${LOCALES} && git clean -fd ${LOCALES})`);
  return failed.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
