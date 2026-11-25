/**
 * Replays an export of past crash alert emails (or audit-trail crash lines) through the crash triage, and prints how
 * many would have emailed. The rules and what an export cannot say are in server/lib/crashReplay.ts.
 *
 *   npx tsx scripts/crash-replay.ts <export.json|export.csv> [--json]
 *
 * Reads a local file and prints counts. It sends nothing and reads no database.
 */
import fs from "node:fs";
import { replay, rowsFromExport } from "../server/lib/crashReplay";

const file = process.argv[2];
if (!file) {
  console.error("usage: npx tsx scripts/crash-replay.ts <export.json|export.csv> [--json]");
  process.exit(2);
}
const r = replay(rowsFromExport(fs.readFileSync(file, "utf8")));
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(r, null, 2));
} else {
  console.log(`rows read: ${r.rows} (not browser crashes: ${r.notCrashes})`);
  console.log(`crashes, one per crash per minute across the admins it went to: ${r.crashes}`);
  console.log(`dropped as noise: ${r.droppedAsNoise}; dropped as a page from before a deploy: ${r.droppedAsStaleBuild}`);
  console.log(`signatures left: ${r.signatures}`);
  console.log(`would have emailed: at most ${r.wouldEmailAtMost} (if every one were in our own code), at least ${r.wouldEmailAtLeast} (only those that spread)`);
  for (const s of r.bySignature) console.log(`  ${s.reports} report(s), ${s.atLeast}-${s.atMost} email(s): ${s.message} (${s.page})`);
  if (r.noise.length) console.log("noise dropped:");
  for (const n of r.noise) console.log(`  ${n.reports} x ${n.message}`);
}
