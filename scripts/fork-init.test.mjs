/**
 * fork-init.mjs, run for real from a checkout whose folder name has a space in
 * it. `new URL(import.meta.url).pathname` keeps the space as "%20", so the
 * script looked for its template in a folder that does not exist and said
 * "cannot find the template". It reads its own location through
 * fileURLToPath now, and this runs a copy of it from such a folder to prove it.
 *
 * Run: node scripts/fork-init.test.mjs
 */
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, "fork-init.mjs");
const EXAMPLE = path.join(HERE, "..", ".env.example");

const base = fs.mkdtempSync(path.join(os.tmpdir(), "fork init "));
const root = path.join(base, "my village");
fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
fs.copyFileSync(SCRIPT, path.join(root, "scripts", "fork-init.mjs"));
fs.copyFileSync(EXAMPLE, path.join(root, ".env.example"));

function run(extra = []) {
  const r = spawnSync(
    process.execPath,
    [path.join(root, "scripts", "fork-init.mjs"), "--village-name", "Rio Nuevo", "--admin-email", "founder@example.org", ...extra],
    { encoding: "utf8", cwd: os.tmpdir() },
  );
  return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

try {
  // A dry run from the spaced folder finds the template beside it.
  const dry = run(["--dry"]);
  assert.strictEqual(dry.code, 0, `expected a dry run to succeed from a spaced path:\n${dry.out}`);
  assert.ok(!/cannot find the template/.test(dry.out), `the template beside the script was not found:\n${dry.out}`);
  assert.ok(/--dry: would write \d+ variable/.test(dry.out), `expected the dry-run report:\n${dry.out}`);
  assert.ok(!fs.existsSync(path.join(root, ".env")), "a dry run wrote a file");

  // A real run writes .env into the spaced folder, not into a "%20" one.
  const real = run();
  assert.strictEqual(real.code, 0, `expected a real run to succeed from a spaced path:\n${real.out}`);
  assert.ok(fs.existsSync(path.join(root, ".env")), `.env was not written beside the template:\n${real.out}`);
  assert.ok(!fs.existsSync(path.join(base, "my%20village")), "the script wrote into a percent-encoded folder");

  // Control: a missing template is still refused by name.
  fs.rmSync(path.join(root, ".env.example"));
  const missing = run(["--dry"]);
  assert.strictEqual(missing.code, 1, `expected a missing template to be refused:\n${missing.out}`);
  assert.ok(/cannot find the template/.test(missing.out), `expected the refusal to name the template:\n${missing.out}`);

  console.log("fork-init.test: OK (spaced path dry run, real run, missing-template control)");
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}
