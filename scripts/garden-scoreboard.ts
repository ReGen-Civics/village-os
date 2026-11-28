/**
 * THE ADMIN GARDEN SCOREBOARD, as one command.
 *
 *   npx tsx scripts/garden-scoreboard.ts            the seven counts as a table, then each count's open items
 *   npx tsx scripts/garden-scoreboard.ts --all      the same, with every open item listed
 *   npx tsx scripts/garden-scoreboard.ts --json     the same counts as JSON, and nothing else
 *   npx tsx scripts/garden-scoreboard.ts --out dir  also writes dir/scoreboard.json and dir/scoreboard.md
 *
 * `pnpm garden:score` runs the first form.
 *
 * It measures nothing itself. `gatherScoreInputs` (server/testkit/gardenInputs.ts) reads the repository,
 * `scoreGarden` (shared/gardenScore.ts) counts, and shared/gardenScoreReport.ts prints. The ratchet
 * (server/gardenScoreboard.test.ts) runs the same two functions, so this command and CI cannot disagree.
 *
 * It always exits 0: it reports. The ratchet is what fails.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { gatherScoreInputs } from "../server/testkit/gardenInputs";
import { scoreGarden } from "../shared/gardenScore";
import { scoreMarkdown, scoreText } from "../shared/gardenScoreReport";

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
