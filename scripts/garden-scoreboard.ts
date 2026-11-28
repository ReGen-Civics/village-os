/**
 * THE ADMIN GARDEN SCOREBOARD, as one command.
 *
 *   npx tsx scripts/garden-scoreboard.ts            the seven counts as a table, then each count's open items
 *   npx tsx scripts/garden-scoreboard.ts --all      the same, with every open item listed
 *   npx tsx scripts/garden-scoreboard.ts --json     the same counts as JSON, and nothing else
 *   npx tsx scripts/garden-scoreboard.ts --out dir  also writes dir/scoreboard.json and dir/scoreboard.md
 *   npx tsx scripts/garden-scoreboard.ts --walk dir also writes dir/WALK-LIST.md and dir/WALK-LIST.csv: every act, every
 *                                                   route an admin can reach that no act claims, every setting with
 *                                                   no full home, for a person walking the build
 *   npx tsx scripts/garden-scoreboard.ts --ratchet  rewrites server/gardenScoreboard.ratchet.json: drops every name that is
 *                                                   no longer open. It never adds a name, and it refuses while any
 *                                                   open item is not on the list.
 *
 * `pnpm garden:score` runs the first form.
 *
 * It measures nothing itself. `gatherScoreInputs` (server/testkit/gardenInputs.ts) reads the repository,
 * `scoreGarden` (shared/gardenScore.ts) counts, and shared/gardenScoreReport.ts prints. The ratchet
 * (server/gardenScoreboard.test.ts) runs the same two functions, so this command and CI cannot disagree.
 *
 * THE RATCHET, IN SHORT (shared/gardenScoreRatchet.ts has the whole of it). The ratchet file keeps the NAME of every
 * item that is open under each count, one to a line, in order. An open item that is not named there fails
 * server/gardenScoreboard.test.ts, whatever the totals say, so a newcomer cannot hide behind somebody else's fix. A
 * name may always leave the list, and --ratchet is the one step that drops it. Nothing here adds a name: when nothing
 * can give a newcomer a home yet, a person writes its line into the file by hand and a reviewer sees it arrive.
 *
 * It exits 0 when it reports. With --ratchet it exits 1 when an open item is not on the list, and writes nothing.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { gatherScoreInputs } from "../server/testkit/gardenInputs";
import { scoreGarden } from "../shared/gardenScore";
import { scoreMarkdown, scoreText } from "../shared/gardenScoreReport";
import { RATCHET_ABOUT, isRatchet, ratchetLeft, ratchetText, rewritten, type Ratchet } from "../shared/gardenScoreRatchet";
import { walkCsv, walkMarkdown, walkOf } from "../shared/gardenWalk";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const valueOf = (name: string): string | null => {
  const at = args.indexOf(name);
  return at >= 0 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : null;
};

/** The commit the numbers were measured on, for the written files. Empty when git cannot say. */
function commitLine(): string {
  try {
    const sha = execFileSync("git", ["rev-parse", "--short=8", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).trim() ? ", with uncommitted changes" : "";
    return `Measured on commit ${sha}${dirty}.`;
  } catch {
    return "";
  }
}

const inputs = gatherScoreInputs(ROOT);
const board = scoreGarden(inputs);
const all = flag("--all");

if (flag("--json")) console.log(JSON.stringify(board, null, 1));
else console.log(scoreText(board, { all }));

const RATCHET_FILE = path.join(ROOT, "server", "gardenScoreboard.ratchet.json");
const onDisk: unknown = fs.existsSync(RATCHET_FILE) ? JSON.parse(fs.readFileSync(RATCHET_FILE, "utf8")) : null;
if (onDisk !== null && !isRatchet(onDisk)) {
  console.error("server/gardenScoreboard.ratchet.json is not in the shape this command reads (a list of names under each count). Nothing was compared against it.");
  process.exitCode = 1;
}
const earlier: Ratchet | null = isRatchet(onDisk) ? onDisk : null;
if (flag("--ratchet") && (onDisk === null || earlier)) {
  const result = rewritten(board, earlier, RATCHET_ABOUT);
  if ("failures" in result) {
    console.error(`The ratchet was not rewritten: ${result.failures.length} thing(s) fail it.\n\n${result.failures.join("\n\n")}`);
    process.exitCode = 1;
  } else {
    const left = earlier ? ratchetLeft(board, earlier) : [];
    fs.writeFileSync(RATCHET_FILE, ratchetText(result.ratchet));
    const dropped = left.reduce((n, l) => n + l.names.length, 0);
    console.error(earlier ? `Rewrote server/gardenScoreboard.ratchet.json: ${dropped} name(s) dropped, none added.` : "Wrote server/gardenScoreboard.ratchet.json from today's open items.");
    for (const l of left) console.error(`  ${l.title}: ${l.names.join(", ")}`);
  }
} else if (earlier && !flag("--json")) {
  const left = ratchetLeft(board, earlier);
  const dropped = left.reduce((n, l) => n + l.names.length, 0);
  if (dropped) console.log(`${dropped} name(s) on the ratchet's list are no longer open. Run with --ratchet to drop them.\n`);
}

const out = valueOf("--out");
const walkDir = valueOf("--walk");
for (const name of ["--out", "--walk"]) {
  if (flag(name) && !valueOf(name)) {
    console.error(`${name} needs a folder to write into.`);
    process.exitCode = 2;
  }
}
if (walkDir) {
  const dir = path.resolve(process.cwd(), walkDir);
  fs.mkdirSync(dir, { recursive: true });
  const walk = walkOf(inputs, board);
  fs.writeFileSync(path.join(dir, "WALK-LIST.md"), `${walkMarkdown(walk, board, commitLine())}\n`);
  fs.writeFileSync(path.join(dir, "WALK-LIST.csv"), walkCsv(walk));
  if (!flag("--json")) console.log(`Wrote WALK-LIST.md and WALK-LIST.csv to ${dir}: ${walk.acts.length} acts, ${walk.dials.length} dials, ${walk.routes.length} unclaimed routes an admin can reach, ${walk.settings.length} settings.`);
}
if (out) {
  const dir = path.resolve(process.cwd(), out);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = commitLine();
  fs.writeFileSync(path.join(dir, "scoreboard.json"), `${JSON.stringify({ measuredOn: stamp, ...board }, null, 1)}\n`);
  fs.writeFileSync(path.join(dir, "scoreboard.md"), `${scoreMarkdown(board, { all, stamp })}\n`);
  if (!flag("--json")) console.log(`Wrote scoreboard.json and scoreboard.md to ${dir}`);
}
