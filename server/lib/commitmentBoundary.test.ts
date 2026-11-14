/**
 * COMMITMENT IS STORED AND SHOWN, AND NOTHING THAT PAYS READS IT (0383, lane E1).
 *
 * The lead may later want a member's commitment to shape rewards and payouts.
 * Until the lead says so, money stays a person's decision, so this is the wall:
 *
 *   1. no module that moves value (the same subjects as
 *      shared/seatSettings.boundary.test.ts: the ledger, the economy, the
 *      exchange, payments, payouts, redemption, minting, treasuries, cycle
 *      settlement and every file acting on `role.cycle`) reaches the member's
 *      history, directly or through anything it imports;
 *   2. none of them names a commitment column, the history table, or the
 *      fit helpers in its own source;
 *   3. the history is append only: its repo holds no UPDATE and no REPLACE.
 *
 * NARROWED ONCE (Rye, 14 Nov 2026, answer A): when a member's roles are paid
 * through separate applications, each role's pay scales by its share of their
 * time, from the split, and a Treasurer confirms the scaled amounts at End of
 * Moon before anything is paid. That needs the split on the invoice, so there
 * is exactly one door through this wall, and the tests below hold its shape:
 *
 *   - the door is server/lib/splitForPay.ts, and the walk stops there: any
 *     other way from a pay path into the history still fails rule 1;
 *   - only server/lib/moonRecap.ts (the moon frame the invoice is drawn from)
 *     opens the door;
 *   - the door takes one binding from the history, `splitOn`, and `splitOn`
 *     selects `split_json` alone, so the percent a member gives, the period,
 *     the note and the history never reach pay;
 *   - rules 2 and 3 are unchanged.
 * What keeps the split from paying on its own is not this file: Finance
 * approval refuses a scaled invoice until it is confirmed
 * (`splitUnconfirmed`, server/lib/moonReview.ts; tested in
 * server/lib/moonReviewSplit.test.ts).
 *
 * Controls keep the walk honest: the subject list is not empty, the walk does
 * find the history from the quests routes that are known to reach it, and the
 * text check does fire on a source that names a column.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const HISTORY_REPO = path.join(ROOT, "server", "repos", "memberCommitments.ts");
const HISTORY_ROUTES = path.join(ROOT, "server", "routes", "memberCommitment.ts");
/** The one narrowed door (Rye, 14 Nov 2026): it hands the split, and only the split, to the moon invoice. */
const SPLIT_DOOR = path.join(ROOT, "server", "lib", "splitForPay.ts");
/** The one file allowed to open it. */
const SPLIT_DOOR_USER = path.join(ROOT, "server", "lib", "moonRecap.ts");

const SUBJECT = /(ledger|econom|settle|settlement|exchange|payment|payout|redemption|mint|faucet|treasury|swap|cyclePool|gratitude-cycles|contributionPay|admission|vouches|dryRun|workPay|cashOwed)/i;
const SUBJECT_DIRS = ["server/lib", "server/routes", "server/repos", "shared", "shared/dryRun"];
const ROLE_CYCLE = /["']role\.cycle["']/;
/** What a pay path may not name: the columns, the table and the helpers that read a member's word. */
const NAMES = /\b(commitmentPct|commitmentRequired|commitment_pct|commitment_required|member_commitments|memberCommitments|questFit|orderByFit|rolesWithinReach|roleBeyondReach|commitmentNow|commitmentHistory)\b/;

const isSource = (f: string) => /\.tsx?$/.test(f) && !/\.(test|spec)\.tsx?$/.test(f) && !f.endsWith(".d.ts");

function subjects(): string[] {
  const out = new Set<string>();
  for (const dir of SUBJECT_DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) {
      const file = path.join(abs, name);
      if (!fs.statSync(file).isFile() || !isSource(name)) continue;
      if (SUBJECT.test(name) || ROLE_CYCLE.test(fs.readFileSync(file, "utf8"))) out.add(file);
    }
  }
  out.delete(path.join(ROOT, "server", "index.ts"));
  return Array.from(out).sort();
}

const IMPORT = /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|import\s*["']([^"']+)["']/g;

function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@shared/")) base = path.join(ROOT, "shared", spec.slice("@shared/".length));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function chainTo(entry: string, targets: ReadonlySet<string>, stopAt: ReadonlySet<string> = new Set([SPLIT_DOOR])): string[] | null {
  const seen = new Set<string>([entry]);
  const queue: Array<{ file: string; chain: string[] }> = [{ file: entry, chain: [entry] }];
  while (queue.length > 0) {
    const { file, chain } = queue.shift()!;
    if (targets.has(file)) return chain;
    if (stopAt.has(file)) continue;
    let src: string;
    try {
      src = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const m of src.matchAll(IMPORT)) {
      const next = resolve(file, m[1] ?? m[2] ?? m[3]);
      if (!next || seen.has(next)) continue;
      seen.add(next);
      queue.push({ file: next, chain: [...chain, next] });
    }
  }
  return null;
}

/** Source text without comments, so a comment that explains the wall is not a breach of it. */
const codeOf = (file: string) =>
  fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/** The names a source uses that a pay path may not. */
function namesIn(code: string): string[] {
  return Array.from(new Set(Array.from(code.matchAll(new RegExp(NAMES.source, "g"))).map((m) => m[1])));
}

describe("nothing that pays reads a commitment", () => {
  const list = subjects();
  const history = new Set([HISTORY_REPO, HISTORY_ROUTES]);

  it("control: the subject list holds the pay paths", () => {
    expect(list.length).toBeGreaterThan(10);
    expect(list.some((f) => f.endsWith(path.join("server", "lib", "ledger.ts")))).toBe(true);
    expect(list.some((f) => f.endsWith(path.join("server", "lib", "workPay.ts")))).toBe(true);
  });

  it("control: the walk finds the history from the quests routes, which serve it", () => {
    expect(chainTo(path.join(ROOT, "server", "routes", "quests.ts"), history)).not.toBeNull();
  });

  it("no module that moves value reaches the member's history", () => {
    const reached = list.map((f) => ({ f, chain: chainTo(f, history) })).filter((x) => x.chain);
    expect(reached.map((x) => x.chain!.map((c) => path.relative(ROOT, c)).join(" -> "))).toEqual([]);
  });

  it("control: the name check fires on a source that names a column", () => {
    expect(namesIn("const pct = row.commitment_pct; const fit = questFit(1, 2);")).toEqual(["commitment_pct", "questFit"]);
  });

  it("no module that moves value names a commitment column, the history or the fit helpers", () => {
    const named = list.map((f) => ({ f: path.relative(ROOT, f), names: namesIn(codeOf(f)) })).filter((x) => x.names.length);
    expect(named).toEqual([]);
  });

  it("control: without the door, the walk does reach the history from a pay path, through the door", () => {
    const chain = chainTo(path.join(ROOT, "server", "routes", "cashOwed.ts"), history, new Set());
    expect(chain).not.toBeNull();
    expect(chain).toContain(SPLIT_DOOR);
  });

  it("only the moon frame opens the split door", () => {
    const openers: string[] = [];
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const file = path.join(dir, name);
        if (name === "node_modules" || name.startsWith(".")) continue;
        if (fs.statSync(file).isDirectory()) walk(file);
        else if (isSource(name) && file !== SPLIT_DOOR) {
          for (const m of fs.readFileSync(file, "utf8").matchAll(IMPORT)) {
            if (resolve(file, m[1] ?? m[2] ?? m[3]) === SPLIT_DOOR) openers.push(path.relative(ROOT, file));
          }
        }
      }
    };
    for (const dir of ["server", "shared", "client/src"]) walk(path.join(ROOT, dir));
    expect(Array.from(new Set(openers))).toEqual([path.relative(ROOT, SPLIT_DOOR_USER)]);
  });

  it("the door takes only `splitOn` from the history, and `splitOn` selects the split alone", () => {
    const door = codeOf(SPLIT_DOOR);
    const fromHistory = Array.from(door.matchAll(/import\s*(type\s*)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g))
      .filter((m) => resolve(SPLIT_DOOR, m[3]) && history.has(resolve(SPLIT_DOOR, m[3]) as string))
      .flatMap((m) => m[2].split(",").map((s) => s.trim()).filter(Boolean));
    expect(fromHistory).toEqual(["splitOn"]);
    expect(door).not.toMatch(/import\s*\*\s*as/);
    const repo = codeOf(HISTORY_REPO);
    const body = repo.slice(repo.indexOf("export async function splitOn"), repo.indexOf("export async function forgetCommitments"));
    const selects = Array.from(body.matchAll(/SELECT\s+([^"]*?)\s+FROM/g)).map((m) => m[1]);
    expect(selects).toEqual(["`split_json`"]);
  });

  it("the history is append only: its repo never updates or replaces a row", () => {
    const code = codeOf(HISTORY_REPO);
    expect(code).toMatch(/INSERT INTO `member_commitments`/);
    expect(code).not.toMatch(/\bUPDATE\b/i);
    expect(code).not.toMatch(/\bREPLACE\s+INTO\b/i);
    expect(code).not.toMatch(/ON DUPLICATE KEY/i);
  });
});
