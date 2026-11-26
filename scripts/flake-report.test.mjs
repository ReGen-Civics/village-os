/**
 * The flake report's own proof (scripts/flake-report.mjs), on fixtures shaped
 * like the GitHub API's answers. The report must:
 *   - call a failure a flake only when the SAME code also went fully green;
 *   - treat a pull_request run's base as part of its code (a new main is new code);
 *   - leave out a failure that never went green, and a cancelled attempt;
 *   - name the failing test from a shard's log, and the failed step otherwise;
 *   - rank by events, worst first.
 *
 * Run: node scripts/flake-report.test.mjs
 */
import assert from "node:assert";
import { attribute, findFlakeEvents, keyOf, markdown, outcomeOf, parseFailLines, rank, tableCell, withRetry } from "./flake-report.mjs";

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const ok = (name) => ({ id: name.length, name, status: "completed", conclusion: "success", steps: [] });
const bad = (name, id, step = "Test") => ({
  id,
  name,
  status: "completed",
  conclusion: "failure",
  steps: [{ name: "Build", conclusion: "success" }, { name: step, conclusion: "failure" }],
});

await check("a push run is keyed on its sha; a pull_request run on head and base", () => {
  assert.strictEqual(keyOf({ event: "push", head_sha: "a1" }), "a1");
  assert.strictEqual(keyOf({ event: "pull_request", head_sha: "a1", pull_requests: [{ base: { sha: "m1" } }] }), "a1@m1");
  assert.strictEqual(keyOf({ event: "pull_request", head_sha: "a1", pull_requests: [] }), "a1@?");
});

await check("an attempt with a cancelled or unfinished job has no verdict", () => {
  assert.strictEqual(outcomeOf([ok("verify"), { ...ok("test (1/6)"), conclusion: "cancelled" }]), null);
  assert.strictEqual(outcomeOf([ok("verify"), { ...ok("test (1/6)"), status: "in_progress", conclusion: null }]), null);
  assert.strictEqual(outcomeOf([]), null);
  const v = outcomeOf([ok("verify"), bad("test (3/6)", 9)]);
  assert.strictEqual(v.green, false);
  assert.deepStrictEqual(v.failedJobs, [{ id: 9, name: "test (3/6)", step: "Test" }]);
});

await check("a failure is a flake only when the same code also went fully green", () => {
  const red = outcomeOf([ok("verify"), bad("test (3/6)", 9)]);
  const green = outcomeOf([ok("verify"), ok("test (3/6)")]);
  const events = findFlakeEvents([
    { key: "s1", url: "u1", outcome: red },
    { key: "s1", url: "u2", outcome: green },
    { key: "s2", url: "u3", outcome: red },
    { key: "s3", url: "u4", outcome: null },
    { key: "s3", url: "u5", outcome: green },
  ]);
  assert.deepStrictEqual(events.map((e) => e.url), ["u1"]);
});

await check("the same head on a new main is new code, so its pass excuses nothing", () => {
  const red = outcomeOf([bad("verify", 1, "Translation catalogs")]);
  const green = outcomeOf([ok("verify")]);
  const runA = { event: "pull_request", head_sha: "h", pull_requests: [{ base: { sha: "mainA" } }] };
  const runB = { event: "pull_request", head_sha: "h", pull_requests: [{ base: { sha: "mainB" } }] };
  assert.deepStrictEqual(findFlakeEvents([{ key: keyOf(runA), outcome: red }, { key: keyOf(runB), outcome: green }]), []);
});

await check("a shard's log names the failing tests, through timestamps and colour codes", () => {
  const log = [
    "2026-11-26T02:26:50.1Z  \u001b[31m FAIL \u001b[39m server/routes/roleStartAgreements.test.ts > start agreements > signs once",
    "2026-11-26T02:26:50.2Z  FAIL  server/routes/roleStartAgreements.test.ts > start agreements > signs once",
    "2026-11-26T02:26:50.3Z  FAIL  client/src/pages/CommsSettings.test.tsx > sends the test through its route",
    "2026-11-26T02:26:50.4Z  ✓ server/ok.test.ts (3 tests)",
    "2026-11-26T02:26:50.5Z  FAIL  shared/wholeFile.test.ts",
  ].join("\n");
  assert.deepStrictEqual(parseFailLines(log), [
    "server/routes/roleStartAgreements.test.ts > start agreements > signs once",
    "client/src/pages/CommsSettings.test.tsx > sends the test through its route",
    "shared/wholeFile.test.ts",
  ]);
});

await check("a shard is blamed on its tests, any other job on its failed step", async () => {
  const red = outcomeOf([bad("verify", 1, "Bundle budget"), bad("test (2/6)", 22)]);
  const api = {
    async text(p) {
      assert.match(p, /\/jobs\/22\/logs$/);
      return "2026-11-26T00:00:00Z  FAIL  a.test.ts > flips";
    },
  };
  const out = await attribute(api, "o/r", [{ key: "k", url: "u", outcome: red }]);
  assert.deepStrictEqual(out.map((o) => o.culprit), ["verify / Bundle budget", "a.test.ts > flips"]);
});

await check("an expired log still counts, under the shard's name", async () => {
  const red = outcomeOf([bad("test (2/6)", 22)]);
  const out = await attribute({ text: async () => "" }, "o/r", [{ key: "k", url: "u", outcome: red }]);
  assert.match(out[0].culprit, /^test \(2\/6\) \/ Test \(log gone/);
});

await check("ranked worst first, by events then by distinct code", () => {
  const r = rank([
    { culprit: "b", key: "k1", url: "x" },
    { culprit: "a", key: "k1", url: "y" },
    { culprit: "a", key: "k2", url: "z" },
    { culprit: "c", key: "k1", url: "w" },
    { culprit: "c", key: "k1", url: "v" },
  ]);
  assert.deepStrictEqual(r.map((e) => [e.culprit, e.events, e.codes]), [["a", 2, 2], ["c", 2, 1], ["b", 1, 1]]);
  const md = markdown(r, { days: 3, runs: 10, attempts: 9, events: 4, unkeyed: 0 });
  assert.match(md, /\| 1 \| `a` \| 2 \| 2 \|/);
  assert.match(md, /A retry, a skip or a looser assertion is not a fix/);
});

await check("a test name from a log cannot break out of its table cell", () => {
  assert.strictEqual(tableCell("a\\|b"), "a\\\\\\|b", "a backslash before a pipe must not unescape it");
  assert.strictEqual(tableCell("x | y"), "x \\| y");
  assert.strictEqual(tableCell("say `hi`"), "say 'hi'");
  assert.strictEqual(tableCell("one\ntwo"), "one two");
  const md = markdown([{ culprit: "t.test.ts > a\\|b", events: 1, codes: 1, example: "u" }], { days: 1, runs: 1, attempts: 1, events: 1, unkeyed: 0 });
  const row = md.split("\n").find((l) => l.startsWith("| 1 |"));
  assert.strictEqual(row.split(/(?<!\\)\|/).length, 7, `the row has extra cells: ${row}`);
});

await check("GitHub's transient answers are retried a bounded number of times, and nothing else is", async () => {
  const seq = (codes) => {
    let i = 0;
    return async () => ({ status: codes[Math.min(i++, codes.length - 1)] });
  };
  const opts = { sleep: async () => {} };
  assert.strictEqual((await withRetry(seq([502, 503, 200]), opts)).status, 200);
  assert.strictEqual((await withRetry(seq([502, 502, 502, 502, 200]), opts)).status, 502, "gives up after 4 tries");
  assert.strictEqual((await withRetry(seq([404, 200]), opts)).status, 404, "a 404 is an answer, not retried");
});

console.log(`flake-report.test: ${passed}/10 checks passed`);
