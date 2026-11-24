/**
 * The self-test runner's own proof: a failing self-test makes the run fail.
 *
 * `run-self-tests.mjs` is the CI step "Guard self-tests, all of them". From
 * 0e40a18 (2026-11-09) it counted failures and printed FAIL, then exited 0, so
 * the step was green while self-tests inside it were red. Two were red on main
 * by 2026-11-24 (enable-all-modules and ratchet-gates-go-red) and nothing in CI
 * said so.
 *
 * This runs the REAL runner, as a child process, against fixture directories
 * (`--dir`), never against `scripts/` itself, which holds this file and would
 * recurse. Each fixture is a few one-line self-tests that pass, fail, or die
 * on a signal on purpose, and the exit code is read directly.
 *
 * Run: node scripts/run-self-tests.test.mjs
 */
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNNER = path.join(HERE, "run-self-tests.mjs");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "run-self-tests-"));
let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  PASS  ${name}`);
};

/** A directory of self-tests, each given as its file name and its body. */
function fixture(name, tests) {
  const dir = path.join(scratch, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, body] of Object.entries(tests)) fs.writeFileSync(path.join(dir, file), body);
  return dir;
}
const runOn = (dir, env = {}) => {
  const r = spawnSync(process.execPath, [RUNNER, "--dir", dir], { encoding: "utf8", env: { ...process.env, ...env } });
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` };
};

const PASS = `console.log("ok  fixture passes");\n`;
const FAIL = `console.error("fixture assertion: the reason it failed");\nprocess.exit(1);\n`;
const THROW = `throw new Error("fixture threw on purpose");\n`;
const KILLED = `process.kill(process.pid, "SIGKILL");\n`;

try {
  check("every self-test passing exits 0 and says how many ran", () => {
    const r = runOn(fixture("green", { "a.test.mjs": PASS, "b.test.mjs": PASS, "not-a-test.mjs": FAIL }));
    assert.strictEqual(r.status, 0, `a green run exited ${r.status}:\n${r.out}`);
    assert.match(r.out, /2 guard self-test\(s\) run, 0 failed\./, `no summary, or a file that is not *.test.mjs was run:\n${r.out}`);
  });

  check("CONTROL: one failing self-test among passing ones exits 1, names it, and keeps its reason", () => {
    const r = runOn(fixture("one-red", { "a.test.mjs": PASS, "b.test.mjs": FAIL, "c.test.mjs": PASS }));
    assert.strictEqual(r.status, 1, `a run with a failing self-test exited ${r.status}, a false green:\n${r.out}`);
    assert.match(r.out, /FAIL {2}b\.test\.mjs/);
    assert.match(r.out, /fixture assertion: the reason it failed/, "the failing child's own words were dropped");
    assert.match(r.out, /3 guard self-test\(s\) run, 1 failed\./);
  });

  check("CONTROL: a self-test that throws exits 1", () => {
    const r = runOn(fixture("threw", { "a.test.mjs": THROW }));
    assert.strictEqual(r.status, 1, `a thrown self-test exited ${r.status}:\n${r.out}`);
    assert.match(r.out, /fixture threw on purpose/);
  });

  check("CONTROL: a self-test killed by a signal (no exit status at all) exits 1 and says so", () => {
    const r = runOn(fixture("killed", { "a.test.mjs": PASS, "b.test.mjs": KILLED }));
    assert.strictEqual(r.status, 1, `a killed self-test exited ${r.status}:\n${r.out}`);
    assert.match(r.out, /killed by signal SIGKILL/);
  });

  check("CONTROL: the serial path (SELF_TEST_JOBS=1) fails the same way", () => {
    const r = runOn(fixture("serial", { "a.test.mjs": FAIL, "b.test.mjs": PASS }), { SELF_TEST_JOBS: "1" });
    assert.strictEqual(r.status, 1, `a serial run with a failing self-test exited ${r.status}:\n${r.out}`);
    assert.match(r.out, /2 guard self-test\(s\) run, 1 failed\./);
  });

  check("CONTROL: a directory with no self-tests at all exits 1, never a clean run", () => {
    const r = runOn(fixture("empty", { "README.txt": "nothing here\n" }));
    assert.strictEqual(r.status, 1, `finding no self-tests exited ${r.status}:\n${r.out}`);
    assert.match(r.out, /no scripts\/\*\.test\.mjs found/);
  });
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

assert.strictEqual(passed, 6);
console.log(`ok  run-self-tests: ${passed} checks, a failing self-test fails the run`);
