#!/usr/bin/env node
/**
 * THE PLANTED IMPORT, on the real build: prove that the size gate moves an
 * admin-only chunk to the members' side the moment a member page imports it.
 *
 * WHY THIS IS A SCRIPT AND NOT A TEST. The proof needs two client builds, the
 * tree with the plant and the tree without it again, and a client build is
 * minutes. scripts/check-dist-budget.test.mjs holds the same rule on a small
 * hand-made tree in under a second, on every run. This is the same question
 * asked of rollup itself: run it by hand after changing how chunks are made
 * (manualChunks in vite.config.ts) or how the split is decided
 * (scripts/lib/distSplit.mjs).
 *
 * WHAT IT DOES, in order:
 *   1. Reads the build that is already in dist/public as the baseline: the
 *      members' weight, the admin-only weight and the admin-only files.
 *   2. Chooses the plant FROM THAT BUILD'S GRAPH, with nothing named here: the
 *      largest admin-only chunk that is not an admin route's own page, and the
 *      first member route in the router that is not a key route.
 *   3. Sets the members' ceiling just above the baseline (its weight plus the
 *      gate's safety margin, the lowest number the baseline passes) and the
 *      admin allowance at the baseline's admin-only weight, and checks that
 *      the baseline passes at those numbers.
 *   4. Appends one lazy import of the admin module to the member page, builds,
 *      and runs the gate at the same numbers. The chunk holding the module
 *      must now count on the members' side, and the gate must exit 1.
 *   5. Takes the plant out again (always, also when a step fails or the run is
 *      interrupted) and builds once more, so dist/public is the tree's own
 *      build again, and checks the gate passes as it did.
 *
 * Usage:
 *   pnpm build                                        # the baseline, if dist/ is not this tree's build
 *   node scripts/plant-admin-import.mjs               # two client builds, several minutes
 *   node scripts/plant-admin-import.mjs --no-rebuild  # skip step 5's build; dist/public is then the PLANTED
 *                                                     # build, and its freshness receipt is removed so no
 *                                                     # test trusts it. Run pnpm build afterwards.
 *
 * Exit code 0 when every expectation held, 1 otherwise. The build logs are in
 * the system temp folder; the script prints where.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isAdminPath, routesFromApp } from "./lib/distSplit.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const GATE = path.join(ROOT, "scripts", "check-dist-budget.mjs");
const VITE = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
const MARKER = "PLANTED-ADMIN-IMPORT";
const noRebuild = process.argv.includes("--no-rebuild");

const say = (line) => console.log(line);
const expectations = [];
function expect(name, ok, detail = "") {
  expectations.push({ name, ok });
  say(`${ok ? "ok   " : "FAIL "} ${name}${detail ? `\n      ${detail}` : ""}`);
}

/** The gate over this tree's dist/public. Nothing about the two new numbers is inherited from the shell. */
function gate(env, extra = []) {
  const clean = { ...process.env };
  for (const k of ["MAX_MEMBER_DIST_KB", "MAX_ADMIN_DIST_KB", "GITHUB_ACTIONS", "GITHUB_STEP_SUMMARY"]) delete clean[k];
  const r = spawnSync(process.execPath, [GATE, ...extra], { cwd: ROOT, encoding: "utf8", env: { ...clean, ...env }, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const measure = () => JSON.parse(gate({}, ["--json", "--report"]).out);

function build(label) {
  const log = path.join(os.tmpdir(), `plant-admin-import-${label}-${process.pid}.log`);
  const fd = fs.openSync(log, "w");
  const started = Date.now();
  const r = spawnSync(process.execPath, [VITE, "build"], { cwd: ROOT, stdio: ["ignore", fd, fd] });
  fs.closeSync(fd);
  say(`      client build (${label}): exit ${r.status} in ${Math.round((Date.now() - started) / 1000)} s, log ${log}`);
  return r.status === 0;
}

/* 1. The baseline. */
const before = measure();
if (!before.split?.measured) {
  console.error(`The baseline could not be split: ${before.split?.why ?? "no split in the gate's report"}`);
  process.exit(1);
}
const graph = JSON.parse(fs.readFileSync(path.join(ROOT, "dist", "chunk-graph.json"), "utf8"));
const routes = routesFromApp(fs.readFileSync(path.join(ROOT, "client", "src", "App.tsx"), "utf8"));

/* 2. The plant, chosen from the build. */
const rootChunks = new Set(before.split.adminRoots.map((r) => r.chunk));
const target = before.split.adminOnly
  .filter((f) => f.path.endsWith(".js") && !rootChunks.has(f.path))
  .map((f) => ({ ...f, chunk: graph.chunks.find((c) => c.file === f.path) }))
  .map((f) => ({ ...f, module: f.chunk?.facade ?? Object.entries(f.chunk?.modules ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] }))
  .find((f) => f.module && f.module.startsWith("client/src/") && fs.existsSync(path.join(ROOT, f.module)));
const keyPages = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "route-first-view.json"), "utf8")).routes.map((r) => r.page.replace(/\.[cm]?[jt]sx?$/, "")));
const host = routes
  .filter((r) => r.kind === "lazy" && !isAdminPath(r.path) && !keyPages.has(r.page))
  .map((r) => ({ ...r, file: [".tsx", ".ts"].map((ext) => path.join(ROOT, r.page + ext)).find((f) => fs.existsSync(f)) }))
  .find((r) => r.file);
if (!target || !host) {
  console.error(!target ? "No admin-only chunk beside the admin pages' own to plant: every admin-only file is an admin route's page." : "No member route's page file was found to plant into.");
  process.exit(1);
}
const spec = path.relative(path.dirname(host.file), path.join(ROOT, target.module)).split(path.sep).join("/").replace(/\.[cm]?[jt]sx?$/, "");
const plantLine = `void import("${spec.startsWith(".") ? spec : `./${spec}`}"); // ${MARKER} by scripts/plant-admin-import.mjs: remove this line, never commit it`;
say("The baseline, read from the build in dist/public");
say(`      members' side ${before.split.memberKb} KB, admin-only ${before.split.adminKb} KB, total ${before.blockChargedKb} KB, ${before.split.adminOnly.length} admin-only file(s)`);
say(`      plant: ${host.path} (${path.relative(ROOT, host.file).split(path.sep).join("/")}) will lazily import ${target.module}`);
say(`      that module is in ${target.path}, ${target.chargedKb} KB block-charged, admin-only, owned by ${target.owners.join(" ")}`);

/* 3. The two numbers, and the baseline against them. */
const numbers = { MAX_MEMBER_DIST_KB: String(before.split.memberKb + before.safetyMarginKb), MAX_ADMIN_DIST_KB: String(before.split.adminKb) };
say(`      members' ceiling ${numbers.MAX_MEMBER_DIST_KB} KB (the baseline plus the ${before.safetyMarginKb} KB safety margin), admin allowance ${numbers.MAX_ADMIN_DIST_KB} KB`);
const control = gate(numbers);
const today = gate({});
expect("the baseline passes at those numbers exactly as it passes with none", control.code === today.code && control.code === 0, `exit ${control.code} with the numbers, ${today.code} without`);

/* 4. Plant, build, gate. The plant always comes out again. */
const original = fs.readFileSync(host.file);
if (original.includes(MARKER)) {
  console.error(`${host.file} already carries a ${MARKER} line from a run that died. Remove that line and run again.`);
  process.exit(1);
}
let planted = false;
const unplant = () => {
  if (!planted) return;
  fs.writeFileSync(host.file, original);
  planted = false;
};
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    unplant();
    process.exit(1);
  });
}
let builtPlanted = false;
try {
  fs.writeFileSync(host.file, Buffer.concat([original, Buffer.from(`\n${plantLine}\n`)]));
  planted = true;
  say("\nThe planted tree");
  builtPlanted = build("planted");
  expect("the planted tree builds", builtPlanted);
  if (builtPlanted) {
    const after = measure();
    const afterGraph = JSON.parse(fs.readFileSync(path.join(ROOT, "dist", "chunk-graph.json"), "utf8"));
    const holder = afterGraph.chunks.find((c) => Object.keys(c.modules).includes(target.module));
    const stillAdmin = after.split.adminOnly.some((f) => f.path === holder?.file);
    say(`      members' side ${after.split.memberKb} KB (was ${before.split.memberKb}), admin-only ${after.split.adminKb} KB (was ${before.split.adminKb}), total ${after.blockChargedKb} KB (was ${before.blockChargedKb})`);
    say(`      ${target.module} is now in ${holder?.file ?? "no chunk"}`);
    expect("the chunk holding the planted module counts on the members' side", Boolean(holder) && !stillAdmin, stillAdmin ? `${holder.file} is still listed as admin-only` : "");
    expect("the members' side grew by at least that chunk", after.split.memberKb - before.split.memberKb >= target.chargedKb, `${after.split.memberKb - before.split.memberKb} KB against ${target.chargedKb} KB`);
    expect("the admin-only side shrank by at least that chunk", before.split.adminKb - after.split.adminKb >= target.chargedKb, `${before.split.adminKb - after.split.adminKb} KB against ${target.chargedKb} KB`);
    const verdict = gate(numbers);
    const line = verdict.err.split("\n").find((l) => l.includes("members' side")) ?? verdict.err.trim().split("\n")[0] ?? "";
    // Over the ceiling, or inside its safety margin when the planted chunk is a small one: both are the members' ceiling failing.
    expect("the gate FAILS the members' ceiling on the planted tree", verdict.code === 1 && /::error::The members' side of dist\/public is \d+ KB block-charged, (?:over|inside)/.test(verdict.err), `exit ${verdict.code}: ${line.slice(0, 220)}`);
    expect("and the admin allowance, with room to spare, does not fail", !verdict.err.includes("over the admin allowance"));
    expect("with the two numbers unset the planted tree passes, as it would today", gate({}).code === today.code);
  }
} finally {
  unplant();
}

/* 5. The tree's own build again. */
say("\nThe plant is out");
expect("the page file is byte for byte what it was", fs.readFileSync(host.file).equals(original));
if (noRebuild) {
  fs.rmSync(path.join(ROOT, "dist", ".build-inputs.client.json"), { force: true });
  say("      --no-rebuild: dist/public is still the PLANTED build and its receipt is removed. Run pnpm build.");
} else {
  const rebuilt = build("restored");
  expect("the tree builds again without the plant", rebuilt);
  if (rebuilt) {
    const again = measure();
    expect("the split is the baseline's again", again.split.memberKb === before.split.memberKb && again.split.adminKb === before.split.adminKb, `members' side ${again.split.memberKb} KB, admin-only ${again.split.adminKb} KB`);
    expect("and the gate passes at the same numbers again", gate(numbers).code === 0);
  }
}

const failed = expectations.filter((e) => !e.ok);
say(`\n${expectations.length - failed.length} of ${expectations.length} expectations held`);
process.exit(failed.length ? 1 : 0);
