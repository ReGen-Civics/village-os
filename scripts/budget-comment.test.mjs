/**
 * The budget comment's own proof (scripts/budget-comment.mjs). It must show the
 * three numbers with the change against main and the headroom, flag a total
 * inside the safety margin and anything over a ceiling, and say plainly when
 * there is no baseline from main yet.
 *
 * Run: node scripts/budget-comment.test.mjs
 */
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MARKER, render, sanitize } from "./budget-comment.mjs";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const pr = { sha: "a".repeat(40), pr: 12, baseSha: "b".repeat(40), duKb: 7950, blockChargedKb: 7948, maxTotalDistKb: 8000, mainJsKb: 300, maxMainJsKb: 400, bootJsKb: 690, maxBootJsKb: 750 };
const main = { sha: "c".repeat(40), duKb: 7928, mainJsKb: 295, bootJsKb: 687 };

check("each number shows this PR, main, the change, the ceiling and the headroom", () => {
  const body = render(pr, main);
  assert.ok(body.startsWith(MARKER));
  assert.match(body, /\| Main JS <sub>.*<\/sub> \| 300 KB \| 295 KB \| \+5 KB \| 400 KB \| 100 KB \|/);
  assert.match(body, /\| First-page JS <sub>.*<\/sub> \| 690 KB \| 687 KB \| \+3 KB \| 750 KB \| 60 KB \|/);
  assert.match(body, /\| Total dist\/public <sub>.*<\/sub> \| 7950 KB \| 7928 KB \| \+22 KB \| 8000 KB \| 50 KB \|/);
  assert.doesNotMatch(body, /safety margin\.\*\*/);
  assert.match(body, /green push run at `ccccccc`/);
});

check("a total inside the 12 KB margin is flagged, and over a ceiling is flagged harder", () => {
  const inMargin = render({ ...pr, duKb: 7990 }, main);
  assert.match(inMargin, /10 KB :warning: \|/);
  assert.match(inMargin, /inside the 12 KB safety margin/);
  const over = render({ ...pr, mainJsKb: 410 }, main);
  assert.match(over, /-10 KB :x: \|/);
  assert.match(over, /Main JS is over its ceiling by 10 KB/);
});

check("no baseline from main yet says so, and shows n/a for the change", () => {
  const body = render(pr, null);
  assert.match(body, /\| 7950 KB \| n\/a \| n\/a \|/);
  assert.match(body, /no baseline from main yet/);
});

check("a hostile file puts nothing but numbers into the comment", () => {
  const s = sanitize({ ...pr, duKb: "7950 KB | [click](https://evil)", sha: "<img src=x>", pr: 999, extra: "@everyone" });
  assert.ok(Number.isNaN(s.duKb));
  assert.strictEqual(s.sha, null);
  assert.ok(!("pr" in s) && !("extra" in s));
});

check("without --post it prints and posts nothing; with no PR number from the event it posts nothing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budget-"));
  fs.writeFileSync(path.join(dir, "pr.json"), JSON.stringify(pr));
  fs.writeFileSync(path.join(dir, "push.json"), JSON.stringify({ ...pr, pr: null }));
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "budget-comment.mjs");
  const printed = spawnSync(process.execPath, [script, "--pr", path.join(dir, "pr.json")], { encoding: "utf8", env: { ...process.env, GITHUB_TOKEN: "" } });
  assert.strictEqual(printed.status, 0, printed.stderr);
  assert.ok(printed.stdout.startsWith(MARKER));
  const push = spawnSync(process.execPath, [script, "--pr", path.join(dir, "pr.json"), "--post"], { encoding: "utf8", env: { ...process.env, GITHUB_TOKEN: "" } });
  assert.strictEqual(push.status, 0, push.stderr);
  assert.match(push.stdout, /No pull request number from the event/);
  fs.rmSync(dir, { recursive: true, force: true });
});

console.log(`budget-comment.test: ${passed}/5 checks passed`);
