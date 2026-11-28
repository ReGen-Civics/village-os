/**
 * THE ADMIN GARDEN SCOREBOARD, as one command.
 *
 *   npx tsx scripts/garden-scoreboard.ts            the seven counts as a table, then each count's open items
 *   npx tsx scripts/garden-scoreboard.ts --all      the same, with every open item listed
 *   npx tsx scripts/garden-scoreboard.ts --json     the same counts as JSON, and nothing else
 *   npx tsx scripts/garden-scoreboard.ts --out dir  also writes dir/scoreboard.json and dir/scoreboard.md
 *   npx tsx scripts/garden-scoreboard.ts --ratchet  tightens server/gardenScoreboard.ratchet.json to today's numbers.
 *                                                   It only lowers a ceiling, and refuses while anything is over one.
 *
 * `pnpm garden:score` runs the first form.
 *
 * It measures nothing itself. `gatherScoreInputs` (server/testkit/gardenInputs.ts) reads the repository,
 * `scoreGarden` (shared/gardenScore.ts) counts, and shared/gardenScoreReport.ts prints. The ratchet
 * (server/gardenScoreboard.test.ts) runs the same two functions, so this command and CI cannot disagree.
 *
 * It exits 0 when it reports. With --ratchet it exits 1 when something is over its ceiling, and writes nothing.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { gatherScoreInputs } from "../server/testkit/gardenInputs";
import { scoreGarden } from "../shared/gardenScore";
import { scoreMarkdown, scoreText } from "../shared/gardenScoreReport";
import { RATCHET_ABOUT, ratchetSlack, tightened, type Ratchet } from "../shared/gardenScoreRatchet";

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

const board = scoreGarden(gatherScoreInputs(ROOT));
const all = flag("--all");

if (flag("--json")) console.log(JSON.stringify(board, null, 1));
else console.log(scoreText(board, { all }));

const RATCHET_FILE = path.join(ROOT, "server", "gardenScoreboard.ratchet.json");
const earlier: Ratchet | null = fs.existsSync(RATCHET_FILE) ? (JSON.parse(fs.readFileSync(RATCHET_FILE, "utf8")) as Ratchet) : null;
if (flag("--ratchet")) {
  const result = tightened(board, earlier, RATCHET_ABOUT);
  if ("failures" in result) {
    console.error(`The ratchet was not rewritten: ${result.failures.length} heading(s) are over their ceiling.\n\n${result.failures.join("\n\n")}`);
    process.exitCode = 1;
  } else {
    const locked = earlier ? ratchetSlack(board, earlier) : [];
    fs.writeFileSync(RATCHET_FILE, `${JSON.stringify(result.ratchet, null, 1)}\n`);
    console.error(earlier ? `Tightened server/gardenScoreboard.ratchet.json: ${locked.length} ceiling(s) lowered.` : "Wrote server/gardenScoreboard.ratchet.json from today's numbers.");
    for (const line of locked) console.error(`  ${line}`);
  }
} else if (earlier && !flag("--json")) {
  const slack = ratchetSlack(board, earlier);
  if (slack.length) console.log(`${slack.length} heading(s) are below their ceiling. Run with --ratchet to lock them in.\n`);
}

const out = valueOf("--out");
if (flag("--out") && !out) {
  console.error("--out needs a folder to write into.");
  process.exitCode = 2;
}
if (out) {
  const dir = path.resolve(process.cwd(), out);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = commitLine();
  fs.writeFileSync(path.join(dir, "scoreboard.json"), `${JSON.stringify({ measuredOn: stamp, ...board }, null, 1)}\n`);
  fs.writeFileSync(path.join(dir, "scoreboard.md"), `${scoreMarkdown(board, { all, stamp })}\n`);
  if (!flag("--json")) console.log(`Wrote scoreboard.json and scoreboard.md to ${dir}`);
}
