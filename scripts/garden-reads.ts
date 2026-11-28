/**
 * THE ROUTES EACH ADMIN PAGE READS, REGENERATED.
 *
 *   npx tsx scripts/garden-reads.ts            says whether shared/adminActs/reads.ts matches the client, and what differs
 *   npx tsx scripts/garden-reads.ts --write    rewrites shared/adminActs/reads.ts from the client's source
 *
 * The table is derived (server/testkit/pageReads.ts says how) and nobody types it. It is a file only because an act
 * is plain data and cannot read the client. server/gardenReads.test.ts fails by name when the file and the client
 * disagree, and tells you to run this.
 *
 * Exits 1 when the file is out of date and --write was not given.
 */
import fs from "node:fs";
import path from "node:path";
import { derivePageReads } from "../server/testkit/pageReads";
import { PATH_READS, TAB_READS } from "../shared/adminActs/reads";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILE = path.join(ROOT, "shared", "adminActs", "reads.ts");
const write = process.argv.includes("--write");

const derived = derivePageReads(ROOT);

const table = (name: string, rows: Record<string, string[]>): string => {
  const keys = Object.keys(rows).sort();
  const body = keys.map((k) => `  ${JSON.stringify(k)}: [${rows[k].map((p) => JSON.stringify(p)).join(", ")}],`).join("\n");
  return `export const ${name}: Readonly<Record<string, readonly string[]>> = {\n${body}\n};\n`;
};

const START = "// ── generated: do not edit below this line by hand ──";
const text = fs.readFileSync(FILE, "utf8").replace(/\r\n/g, "\n");
const at = text.indexOf(START);
if (at < 0) throw new Error(`${FILE} has lost its marker line.`);
const next = `${text.slice(0, at)}${START}\n\n${table("TAB_READS", derived.tabs)}\n${table("PATH_READS", derived.paths)}`;

const same = (a: Readonly<Record<string, readonly string[]>>, b: Record<string, string[]>) => JSON.stringify(Object.keys(a).sort().map((k) => [k, a[k]])) === JSON.stringify(Object.keys(b).sort().map((k) => [k, b[k]]));
const upToDate = same(TAB_READS, derived.tabs) && same(PATH_READS, derived.paths);

const count = (rows: Record<string, string[]>) => new Set(Object.values(rows).flat()).size;
console.log(`Tabs that read a steward's route: ${Object.keys(derived.tabs).length}. Pages beside Admin: ${Object.keys(derived.paths).length}.`);
console.log(`Distinct routes read: ${count({ ...derived.tabs, ...Object.fromEntries(Object.entries(derived.paths).map(([k, v]) => [`page ${k}`, v])) })}.`);
if (derived.blind.length) console.log(`No component found, so nothing is claimed: ${derived.blind.join(", ")}.`);

if (write) {
  fs.writeFileSync(FILE, next);
  console.log(upToDate ? "shared/adminActs/reads.ts was already up to date." : "Rewrote shared/adminActs/reads.ts.");
} else if (!upToDate) {
  console.log("shared/adminActs/reads.ts is out of date. Run: npx tsx scripts/garden-reads.ts --write");
  process.exitCode = 1;
} else {
  console.log("shared/adminActs/reads.ts matches the client.");
}
