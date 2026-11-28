/**
 * The admin allowance steps down when the old admin shell is retired, and this
 * fails if it does not (the founder's ruling, 28 Nov 2026).
 *
 * scripts/admin-shell-step-down.json records the old shell (the page the
 * /admin route drew on the day of the ruling) and what its chunk weighs. This
 * reads the allowance from where CI reads it, MAX_ADMIN_DIST_KB in
 * .github/workflows/ci.yml, and holds two things:
 *
 *   - while the old shell's file is in the tree, the allowance recorded beside
 *     the weight is the allowance CI holds, so the step down is measured from
 *     the right number on the day;
 *   - once the file is gone, the allowance is at least the shell's weight
 *     below what was recorded. Until it is, this fails.
 *
 * It has no build, so "is the old shell still built" is asked of the source
 * tree here. scripts/check-dist-budget.mjs asks the same of the built chunks
 * and fails by the same rule (scripts/lib/adminShellStepDown.mjs).
 *
 * The record's own header says what to do on the day.
 *
 * Run: node scripts/admin-shell-step-down.test.mjs
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { budgetInWorkflow, stepDownVerdict } from "./lib/adminShellStepDown.mjs";
import { routesFromApp } from "./lib/distSplit.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const RECORD = path.join(ROOT, "scripts", "admin-shell-step-down.json");

let checks = 0;
let failures = 0;
function check(name, fn) {
  checks += 1;
  try {
    fn();
    console.log(`ok    ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`FAIL  ${name}\n      ${String(err.message).split("\n").join("\n      ")}`);
  }
}

/* ------------------------------------------------------------------ the rule, on made-up numbers */

const shell = (allowanceWithShellKb) => ({ page: "client/src/pages/Admin.tsx", chargedKb: 732, allowanceWithShellKb });

check("while the shell ships and no allowance exists anywhere, there is nothing to hold", () => {
  assert.strictEqual(stepDownVerdict(shell(null), true, null).ok, true);
});

check("while the shell ships, an allowance in CI that the record does not carry fails, and names the field to write", () => {
  const v = stepDownVerdict(shell(null), true, 1800);
  assert.strictEqual(v.ok, false);
  assert.match(v.message, /allowanceWithShellKb/);
  assert.strictEqual(stepDownVerdict(shell(1700), true, 1800).ok, false, "a stale record fails too");
  assert.strictEqual(stepDownVerdict(shell(1800), true, 1800).ok, true);
});

check("the shell gone and the allowance untouched fails, and says the number it must come down to", () => {
  const v = stepDownVerdict(shell(1800), false, 1800);
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.maxAllowanceKb, 1068);
  assert.match(v.message, /must come down to 1068 KB or less/);
});

check("lowered by less than the shell's weight still fails; by exactly the weight, or more, passes", () => {
  assert.strictEqual(stepDownVerdict(shell(1800), false, 1069).ok, false);
  assert.strictEqual(stepDownVerdict(shell(1800), false, 1068).ok, true);
  assert.strictEqual(stepDownVerdict(shell(1800), false, 900).ok, true);
});

check("the shell gone with no allowance ever recorded, or none set now, has nothing to step down", () => {
  assert.strictEqual(stepDownVerdict(shell(null), false, null).ok, true);
  assert.strictEqual(stepDownVerdict(shell(null), false, 1200).ok, true);
  assert.strictEqual(stepDownVerdict(shell(1800), false, null).ok, true);
});

check("a budget is read off the workflow the way the gate reads it, and an absent one is null", () => {
  const yml = "        env:\n          MAX_TOTAL_DIST_KB: 8000\n          MAX_ADMIN_DIST_KB: 1800\n          # MAX_MEMBER_DIST_KB: 9999\n";
  assert.strictEqual(budgetInWorkflow(yml, "MAX_ADMIN_DIST_KB"), 1800);
  assert.strictEqual(budgetInWorkflow(yml, "MAX_MEMBER_DIST_KB"), null, "a commented-out line sets nothing");
  assert.strictEqual(budgetInWorkflow(yml, "MAX_BOOT_JS_KB"), null);
});

/* ------------------------------------------------------------------ this tree */

const record = JSON.parse(fs.readFileSync(RECORD, "utf8"));
const workflow = fs.readFileSync(path.join(ROOT, ".github", "workflows", "ci.yml"), "utf8");
const allowance = budgetInWorkflow(workflow, "MAX_ADMIN_DIST_KB");
const shellInTree = fs.existsSync(path.join(ROOT, record.page));

check("the record names a page, a weight in whole 4 KB blocks, and how to use it", () => {
  assert.strictEqual(record.route, "/admin");
  assert.match(record.page, /^client\/src\/.+\.tsx?$/);
  assert.ok(Number.isInteger(record.chargedKb) && record.chargedKb > 0 && record.chargedKb % 4 === 0, `chargedKb ${record.chargedKb} is not a positive multiple of 4`);
  assert.ok(record.allowanceWithShellKb === null || Number.isInteger(record.allowanceWithShellKb));
  assert.ok(Array.isArray(record.about) && record.about.some((line) => line.includes("ON THE DAY")), "the header must say what to do on the day");
});

check("the gate still reads CI's total from the workflow, so the reader here has not gone blind", () => {
  assert.ok(budgetInWorkflow(workflow, "MAX_TOTAL_DIST_KB") > 0, "MAX_TOTAL_DIST_KB was not found in .github/workflows/ci.yml, so an allowance beside it would not be found either");
});

check("while the old shell is in the tree, it is still the page a route draws or another module imports", () => {
  if (!shellInTree) return;
  // The day the router stops drawing it and nothing else imports it, it has left the build though its file remains:
  // say so here, since the file check below would not.
  const page = record.page.replace(/\.[cm]?[jt]sx?$/, "");
  const routed = routesFromApp(fs.readFileSync(path.join(ROOT, "client", "src", "App.tsx"), "utf8")).some((r) => r.page === page);
  const base = path.basename(page);
  const imported = routed || importedSomewhere(path.join(ROOT, "client", "src"), base, path.join(ROOT, record.page));
  assert.ok(imported, `${record.page} is in the tree and no route draws it and no file imports it, so it has left the build. Delete the file, and lower the admin allowance by ${record.chargedKb} KB (see the header of scripts/admin-shell-step-down.json).`);
});

check(`THE STEP DOWN: the old shell is ${shellInTree ? "still in the tree" : "gone"}, and the admin allowance (${allowance === null ? "not set" : `${allowance} KB`}) is where it must be`, () => {
  const v = stepDownVerdict(record, shellInTree, allowance);
  assert.ok(v.ok, v.message);
  console.log(`      ${v.message}`);
});

/** Whether any source file under `dir`, other than `self`, imports a module whose path ends in `/base`. */
function importedSomewhere(dir, base, self) {
  const wanted = new RegExp(`(?:from\\s*|import\\(\\s*)["'][^"']*/${base}(?:\\.tsx?)?["']`);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (importedSomewhere(full, base, self)) return true;
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && full !== self) {
      if (wanted.test(fs.readFileSync(full, "utf8"))) return true;
    }
  }
  return false;
}

console.log(`\n${checks - failures} of ${checks} checks passed`);
if (failures) process.exit(1);
