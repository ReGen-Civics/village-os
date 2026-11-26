/**
 * The post-fold check's own proof (scripts/check-post-fold.mjs).
 *
 * What must hold for it to stand between a merge and a red main:
 *   - it finds every test that reads a catalog, and not a file that only
 *     mentions one in a comment;
 *   - catalogs are checked in strict mode, the mode main checks in;
 *   - with --fold it folds and extracts BEFORE any check;
 *   - every check runs even after one fails, so the report names all of them;
 *   - a failed fold stops the checks, which would otherwise judge a half-folded tree.
 *
 * Proven against real trees before wiring (26 Nov 2026): on 7dac6f1, the 1.3.82
 * merge, `--fold` fails locale-tests in guideNameWords.test.tsx exactly as main's
 * bot commit 7366a88 did, and the same test passes unfolded. On a187ce0 it fails
 * catalogs exactly as main's run did.
 *
 * Run: node scripts/check-post-fold.test.mjs
 */
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverLocaleTests, plan, runSteps } from "./check-post-fold.mjs";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-post-fold.mjs");
let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

check("finds a test that reads a catalog, and not one that only names it in a comment", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "post-fold-"));
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  put("client/src/lib/reads.test.ts", 'const po = fs.readFileSync(path.join(dir, "../locales", "es.po"), "utf8");\n');
  put("server/folds.test.ts", 'import { mergedPoText } from "../scripts/lib/poFragments.mjs";\n');
  put("shared/comment.test.ts", "// reads client/src/locales/es.po in spirit only\n/* and es.po here too */\nexpect(1).toBe(1);\n");
  put("client/src/lib/notATest.ts", 'const po = "../locales/es.po";\n');
  put("scripts/outside.test.mjs", 'readFileSync("client/src/locales/es.po")\n');
  assert.deepStrictEqual(discoverLocaleTests(root), ["client/src/lib/reads.test.ts", "server/folds.test.ts"]);
  fs.rmSync(root, { recursive: true, force: true });
});

check("the real tree has catalog-reading tests, so the step is not silently empty", () => {
  const found = discoverLocaleTests();
  assert.ok(found.length >= 5, `found only ${found.length}`);
  assert.ok(found.includes("client/src/lib/guideNameWords.test.tsx"), "the test that turned main red on 7366a88 is not found");
});

check("catalogs run in strict mode, after fold and extract when folding", () => {
  const steps = plan({ fold: true, tests: ["a.test.ts"] });
  assert.deepStrictEqual(steps.map((s) => s[0]), ["fold", "extract", "catalogs", "locale-tests"]);
  assert.strictEqual(steps[2][3].GENERATED_DOCS_MODE, "strict");
  assert.ok(steps[3][2].includes("a.test.ts"));
});

check("without --fold it only checks, and with no catalog tests it skips that step", () => {
  assert.deepStrictEqual(plan({ fold: false, tests: [] }).map((s) => s[0]), ["catalogs"]);
});

check("every check runs after a failure, and the report names each one that failed", () => {
  const ran = [];
  const failed = runSteps(plan({ fold: false, tests: ["a.test.ts"] }), (name) => {
    ran.push(name);
    return false;
  });
  assert.deepStrictEqual(ran, ["catalogs", "locale-tests"]);
  assert.deepStrictEqual(failed, ["catalogs", "locale-tests"]);
});

check("a failed fold stops the checks: a half-folded tree says nothing about main", () => {
  const ran = [];
  const failed = runSteps(plan({ fold: true, tests: ["a.test.ts"] }), (name) => {
    ran.push(name);
    return name !== "fold";
  });
  assert.deepStrictEqual(ran, ["fold"]);
  assert.deepStrictEqual(failed, ["fold"]);
});

check("--dry-run prints the plan and changes nothing; an unknown flag is refused", () => {
  const dry = spawnSync(process.execPath, [SCRIPT, "--fold", "--dry-run"], { encoding: "utf8" });
  assert.strictEqual(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /^fold: /m);
  assert.match(dry.stdout, /^catalogs: GENERATED_DOCS_MODE=strict /m);
  const bad = spawnSync(process.execPath, [SCRIPT, "--nope"], { encoding: "utf8" });
  assert.strictEqual(bad.status, 2);
});

check("generated-docs.yml runs this BEFORE it pushes to main, and pushes only when it passed", () => {
  const wf = fs.readFileSync(path.join(path.dirname(SCRIPT), "..", ".github", "workflows", "generated-docs.yml"), "utf8");
  const gate = wf.indexOf("node scripts/check-post-fold.mjs");
  const push = wf.indexOf("git push origin HEAD:refs/heads/main");
  assert.ok(gate > 0 && push > 0, "the gate or the push to main is gone from generated-docs.yml");
  assert.ok(gate < push, "the post-fold check runs after the push to main again");
  const commitStep = wf.slice(wf.indexOf("- name: Commit"), push);
  assert.match(commitStep, /if: steps\.gate\.outcome == 'success'/, "the push to main no longer waits for the gate");
});

check("ci.yml folds and checks every pull request, after the build and the budget", () => {
  const ci = fs.readFileSync(path.join(path.dirname(SCRIPT), "..", ".github", "workflows", "ci.yml"), "utf8");
  const step = ci.indexOf("node scripts/check-post-fold.mjs --fold");
  assert.ok(step > 0, "ci.yml no longer simulates the fold");
  assert.ok(step > ci.indexOf("scripts/check-dist-budget"), "the in-place fold now runs before the budget, which would measure a folded tree");
});

console.log(`check-post-fold.test: ${passed}/9 checks passed`);
