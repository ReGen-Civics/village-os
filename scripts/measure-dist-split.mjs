#!/usr/bin/env node
/**
 * THE SPLIT, MEASURED AGAIN IN ONE COMMAND: build this tree, measure which
 * built files only an admin page loads, and write the tables down.
 *
 * WHY. The members' ceiling and the admin allowance are set from a build of
 * main, and main moves several times a day: the first tables of the split were
 * written by hand on one commit and were a release behind before they were
 * read. So the measurement is a command, and whoever sets the numbers runs it
 * on the tree the numbers are for.
 *
 * WHAT IT DOES:
 *   1. `pnpm build`, with ROUTE_VIEW_REPORT=1 so the route first views guard
 *      prints its own record of each key route's chunks into the log.
 *   2. `node scripts/check-dist-budget.mjs --report --split-md <out>` on that
 *      build, handing it the log: the three budgets, the split, the admin-only
 *      files, the leaks, the three checks of the chunk graph, and the
 *      arithmetic for the two numbers with this build as the worked example
 *      (scripts/lib/distSplitReport.mjs).
 *
 * It gates nothing and writes nothing but the build and the one file. The
 * exit code is the build's, then the measuring step's.
 *
 * Usage:
 *   node scripts/measure-dist-split.mjs                       # writes dist/SPLIT-MEASURED.md
 *   node scripts/measure-dist-split.mjs --out <file.md>       # somewhere else
 *   node scripts/measure-dist-split.mjs --no-build            # the build that is already in dist/
 *   node scripts/measure-dist-split.mjs --room-kb 20          # room measured for what is about to land behind
 *                                                             # the admin routes, for the worked arithmetic
 *   node scripts/measure-dist-split.mjs --candidate /project-history --candidate /governance/work
 *                                                             # what-ifs: a route counted as an admin route
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const valueOf = (flag) => (args.includes(flag) ? (args[args.indexOf(flag) + 1] ?? null) : null);
const out = path.resolve(valueOf("--out") ?? path.join(ROOT, "dist", "SPLIT-MEASURED.md"));
const log = path.join(os.tmpdir(), `measure-dist-split-build-${process.pid}.log`);

const pass = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--room-kb" || args[i] === "--candidate") pass.push(args[i], args[i + 1] ?? "");
}

let haveLog = false;
if (!args.includes("--no-build")) {
  console.log(`Building (pnpm build, ROUTE_VIEW_REPORT=1). The log is ${log}`);
  const fd = fs.openSync(log, "w");
  const started = Date.now();
  const built = spawnSync("pnpm", ["build"], { cwd: ROOT, stdio: ["ignore", fd, fd], env: { ...process.env, ROUTE_VIEW_REPORT: "1" }, shell: process.platform === "win32" });
  fs.closeSync(fd);
  console.log(`  exit ${built.status} in ${Math.round((Date.now() - started) / 1000)} s`);
  if (built.status !== 0) {
    console.error("The build failed, so nothing was measured. Read the log above.");
    process.exit(built.status ?? 1);
  }
  haveLog = true;
}

const measured = spawnSync(process.execPath, [path.join(ROOT, "scripts", "check-dist-budget.mjs"), "--report", "--split-md", out, ...(haveLog ? ["--build-log", log] : []), ...pass], { cwd: ROOT, stdio: "inherit" });
process.exit(measured.status ?? 1);
