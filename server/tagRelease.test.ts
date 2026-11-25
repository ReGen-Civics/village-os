/**
 * The guards behind .github/workflows/tag-release.yml (scripts/tag-release-check.mjs),
 * which lets the coordinator tag a release by dispatching a workflow. Each
 * guard is shown refusing, so a guard that stopped guarding fails here, in a
 * pull request, and not on the day a release is wanted:
 *
 *   1. the version is a plain X.Y.Z;
 *   2. the commit is on main;
 *   3. package.json, PLATFORM_VERSION, the changelog section and the compose
 *      image all name the version at that commit;
 *   4. the tag does not exist yet;
 *   5. ci concluded success on a push run at exactly that commit, or the
 *      commit is a merge whose tree equals its second parent's and that
 *      parent passed a whole ci push run (the tested twin).
 *
 * The last block drives the command line against a throwaway git repository,
 * so the gathering (git show at the commit, the ancestry check) is exercised
 * as well as the decisions.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script without type declarations
import * as guard from "../scripts/tag-release-check.mjs";

const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);

function files(version: string) {
  return {
    packageJson: JSON.stringify({ name: "village-os", version }),
    identityTs: `export const PLATFORM_VERSION = "${version}";\n`,
    changelog: `# Changelog\n\n## Unreleased\n\n## ${version} (2026-11-17)\n\n- a change\n`,
    compose: `services:\n  app:\n    image: \${VILLAGE_OS_IMAGE:-ghcr.io/example-owner/village-os:${version}}\n`,
  };
}

const greenRun = { head_sha: SHA, event: "push", status: "completed", conclusion: "success" };

function facts(over: Record<string, unknown> = {}) {
  return {
    version: "1.3.21",
    sha: SHA,
    onMain: true,
    files: files("1.3.21"),
    remoteTags: `${OTHER}\trefs/tags/v1.3.20\n${SHA}\trefs/tags/v1.3.20^{}\n`,
    ciRuns: [greenRun],
    ...over,
  };
}

describe("evaluate: every guard passes on a real release commit", () => {
  it("allows v1.3.21 when all five hold", () => {
    const v = guard.evaluate(facts());
    expect(v.problems).toEqual([]);
    expect(v.ok).toBe(true);
    expect(v.tag).toBe("v1.3.21");
  });
});

describe("guard 1: the version input", () => {
  it.each([
    ["", "No version was given"],
    ["v1.3.21", "without the v"],
    ["1.3", "not a release number"],
    ["1.3.21-rc1", "prerelease is tagged by hand"],
    ["01.3.21", "not a release number"],
  ])("refuses %j", (version, msg) => {
    const v = guard.evaluate(facts({ version }));
    expect(v.ok).toBe(false);
    expect(v.problems.join("\n")).toContain(msg);
  });
});

describe("guard 2: the commit is on main", () => {
  it("refuses a commit main does not carry", () => {
    const v = guard.evaluate(facts({ onMain: false }));
    expect(v.ok).toBe(false);
    expect(v.problems).toEqual([`${SHA} is not on main. Only a commit main already carries can be released.`]);
  });
});

describe("guard 3: every version site names the version", () => {
  it("refuses a package.json on another number", () => {
    const v = guard.evaluate(facts({ files: { ...files("1.3.21"), packageJson: JSON.stringify({ version: "1.3.20" }) } }));
    expect(v.problems).toEqual(["package.json says 1.3.20, not 1.3.21."]);
  });
  it("refuses a PLATFORM_VERSION on another number", () => {
    const v = guard.evaluate(facts({ files: { ...files("1.3.21"), identityTs: 'export const PLATFORM_VERSION = "1.3.20";' } }));
    expect(v.problems).toEqual(["PLATFORM_VERSION in server/lib/identity.ts says 1.3.20, not 1.3.21."]);
  });
  it("refuses a changelog with no section for the version", () => {
    const v = guard.evaluate(facts({ files: { ...files("1.3.21"), changelog: "## Unreleased\n\n## 1.3.20 (2026-11-16)\n" } }));
    expect(v.problems.join("\n")).toContain('CHANGELOG.md has no section headed "## 1.3.21"');
  });
  it("does not take 1.3.210 for 1.3.21, or a mention in prose for a heading", () => {
    expect(guard.hasChangelogSection("## 1.3.210 (2026-11-17)\n", "1.3.21")).toBe(false);
    expect(guard.hasChangelogSection("see ## 1.3.21 above\n", "1.3.21")).toBe(false);
    expect(guard.hasChangelogSection("## 1.3.21\n", "1.3.21")).toBe(true);
    expect(guard.hasChangelogSection("## 1.3.21 (2026-11-17)\r\n", "1.3.21")).toBe(true);
  });
  it("refuses a compose file that starts another image", () => {
    const v = guard.evaluate(facts({ files: { ...files("1.3.21"), compose: files("1.3.20").compose } }));
    expect(v.problems.join("\n")).toContain("docker-compose.yml starts the village-os image at 1.3.20, not 1.3.21");
  });
  it("refuses missing files, naming each", () => {
    const v = guard.evaluate(facts({ files: { packageJson: null, identityTs: null, changelog: null, compose: null } }));
    expect(v.problems).toHaveLength(4);
    expect(v.problems[0]).toContain("package.json says nothing readable");
  });
});

describe("guard 4: no tag yet", () => {
  it("refuses a version whose tag exists", () => {
    const v = guard.evaluate(facts({ remoteTags: `${OTHER}\trefs/tags/v1.3.21\n${SHA}\trefs/tags/v1.3.21^{}\n` }));
    expect(v.problems).toEqual(["The tag v1.3.21 already exists. A published version is final; release the next number instead."]);
  });
  it("does not take v1.3.210 or v1.3.21-rc1 for v1.3.21", () => {
    expect(guard.tagExists(`${SHA}\trefs/tags/v1.3.210\n${SHA}\trefs/tags/v1.3.21-rc1\n`, "v1.3.21")).toBe(false);
  });
});

describe("guard 5: ci green on a push run at exactly this commit", () => {
  it.each([
    ["no runs at all", []],
    ["a red push run", [{ ...greenRun, conclusion: "failure" }]],
    ["an unfinished push run", [{ ...greenRun, status: "in_progress", conclusion: null }]],
    ["a cancelled push run", [{ ...greenRun, conclusion: "cancelled" }]],
    ["only a green pull_request run", [{ ...greenRun, event: "pull_request" }]],
    ["a green push run on another commit", [{ ...greenRun, head_sha: OTHER }]],
  ])("refuses %s", (_label, ciRuns) => {
    const v = guard.evaluate(facts({ ciRuns }));
    expect(v.ok).toBe(false);
    expect(v.problems.join("\n")).toContain(`ci has not concluded success on a push run at ${SHA}`);
  });
  it("allows one green push run beside a red one", () => {
    expect(guard.evaluate(facts({ ciRuns: [{ ...greenRun, conclusion: "failure" }, greenRun] })).ok).toBe(true);
  });
});

const WHOLE_JOBS = ["verify", "test (1/4)", "test (2/4)", "test (3/4)", "test (4/4)", "tests-ran-once", "browser-smoke"];
const jobsOf = (names: string[]) => names.map((name) => ({ name, status: "completed", conclusion: "success" }));
const twinRun = { id: 7, head_sha: OTHER, event: "push", status: "completed", conclusion: "success" };
function twin(over: Record<string, unknown> = {}) {
  return { parent: OTHER, sameTree: true, runs: [twinRun], jobsByRun: { "7": jobsOf(WHOLE_JOBS) }, ...over };
}

describe("guard 5, the tested twin: a merge whose tree its second parent already passed", () => {
  const cancelled = [{ ...greenRun, conclusion: "cancelled" }];

  it("allows the merge commit when the second parent's push run was whole and green", () => {
    const v = guard.evaluate(facts({ ciRuns: cancelled, twin: twin() }));
    expect(v.problems).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it("allows six shards as well as four, since the shard count is read off the job names", () => {
    const six = ["verify", ...[1, 2, 3, 4, 5, 6].map((i) => `test (${i}/6)`), "tests-ran-once", "browser-smoke"];
    expect(guard.checkWholeRun(jobsOf(six))).toEqual([]);
  });

  it.each([
    ["a tree that differs from the parent's", { sameTree: false }, "its tree differs"],
    ["no second parent", { parent: "" }, "not a merge commit"],
    ["a parent with only a red push run", { runs: [{ ...twinRun, conclusion: "failure" }] }, "no green ci push run"],
    ["a parent green only on pull_request", { runs: [{ ...twinRun, event: "pull_request" }] }, "no green ci push run"],
    ["a green run on some other commit", { runs: [{ ...twinRun, head_sha: SHA }] }, "no green ci push run"],
    ["a green run with no jobs read", { jobsByRun: {} }, "under the floor of 7"],
    ["a run missing browser-smoke", { jobsByRun: { "7": jobsOf(WHOLE_JOBS.filter((n) => n !== "browser-smoke")) } }, "no browser-smoke job"],
    ["a run missing tests-ran-once", { jobsByRun: { "7": jobsOf(WHOLE_JOBS.filter((n) => n !== "tests-ran-once")) } }, "no tests-ran-once job"],
    ["a run missing a shard", { jobsByRun: { "7": jobsOf(WHOLE_JOBS.filter((n) => n !== "test (3/4)")) } }, "no test (3/4) job"],
    [
      "a run whose shards disagree on N",
      { jobsByRun: { "7": jobsOf([...WHOLE_JOBS, "test (5/6)"]) } },
      "shard jobs disagree on N",
    ],
    [
      "a run with a skipped job",
      { jobsByRun: { "7": [...jobsOf(WHOLE_JOBS.slice(1)), { name: "verify", status: "completed", conclusion: "skipped" }] } },
      "verify is completed/skipped",
    ],
  ])("refuses %s", (_label, over, msg) => {
    const v = guard.evaluate(facts({ ciRuns: cancelled, twin: twin(over) }));
    expect(v.ok).toBe(false);
    expect(v.problems.join("\n")).toContain(`ci has not concluded success on a push run at ${SHA}`);
    expect(v.problems.join("\n")).toContain(msg);
  });

  it("takes any one whole green run among several", () => {
    const runs = [{ ...twinRun, id: 6 }, twinRun];
    const jobsByRun = { "6": jobsOf(["verify"]), "7": jobsOf(WHOLE_JOBS) };
    expect(guard.checkTestedTwin(twin({ runs, jobsByRun })).ok).toBe(true);
  });

  it("does not let the twin excuse any other guard", () => {
    const v = guard.evaluate(facts({ ciRuns: cancelled, twin: twin(), onMain: false }));
    expect(v.ok).toBe(false);
    expect(v.problems).toEqual([`${SHA} is not on main. Only a commit main already carries can be released.`]);
  });
});

describe("evaluate reports every refusal at once", () => {
  it("lists all four failing guards together", () => {
    const v = guard.evaluate(
      facts({ onMain: false, files: files("1.3.20"), remoteTags: `${SHA}\trefs/tags/v1.3.21\n`, ciRuns: [] }),
    );
    expect(v.problems.length).toBe(4 + 3);
  });
});

describe("the command line, against a real git repository", () => {
  const SCRIPT = path.resolve(import.meta.dirname, "../scripts/tag-release-check.mjs");

  function repo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tag-release-"));
    const g = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf8" }).trim();
    g("init", "-q", "-b", "main");
    const write = (version: string) => {
      const f = files(version);
      fs.mkdirSync(path.join(dir, "server/lib"), { recursive: true });
      fs.writeFileSync(path.join(dir, "package.json"), f.packageJson);
      fs.writeFileSync(path.join(dir, "server/lib/identity.ts"), f.identityTs);
      fs.writeFileSync(path.join(dir, "CHANGELOG.md"), f.changelog);
      fs.writeFileSync(path.join(dir, "docker-compose.yml"), f.compose);
      g("add", "-A");
      g("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qm", `release ${version}`);
      return g("rev-parse", "HEAD");
    };
    const old = write("1.3.20");
    const tip = write("1.3.21");
    g("switch", "-qc", "side");
    const side = write("1.3.22");
    g("switch", "-q", "main");
    return { dir, old, tip, side };
  }

  function run(dir: string, args: string[], runs: unknown[], tags = "") {
    fs.writeFileSync(path.join(dir, "runs.json"), JSON.stringify({ workflow_runs: runs }));
    fs.writeFileSync(path.join(dir, "tags.txt"), tags);
    const out = path.join(dir, "gh-output");
    fs.writeFileSync(out, "");
    const r = spawnSync(
      process.execPath,
      [SCRIPT, ...args, "--main-ref", "main", "--ci-runs", "runs.json", "--remote-tags", "tags.txt"],
      { cwd: dir, encoding: "utf8", env: { ...process.env, GITHUB_OUTPUT: out } },
    );
    return { status: r.status, text: `${r.stdout}${r.stderr}`, output: fs.readFileSync(out, "utf8") };
  }

  const green = (sha: string) => [{ head_sha: sha, event: "push", status: "completed", conclusion: "success" }];

  it("passes main's tip when no --sha is given, and writes the outputs", () => {
    const { dir, tip } = repo();
    const r = run(dir, ["--version", "1.3.21"], green(tip));
    expect(r.text).toContain(`v1.3.21 may be tagged at ${tip}`);
    expect(r.status).toBe(0);
    expect(r.output).toBe(`sha=${tip}\ntag=v1.3.21\nversion=1.3.21\n`);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reads the files AT the commit: an older commit on main carries the older number", () => {
    const { dir, old } = repo();
    const r = run(dir, ["--version", "1.3.21", "--sha", old], green(old));
    expect(r.status).toBe(1);
    expect(r.text).toContain("package.json says 1.3.20, not 1.3.21.");
    expect(r.output).toBe("");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("refuses a commit that is only on a side branch", () => {
    const { dir, side } = repo();
    const r = run(dir, ["--version", "1.3.22", "--sha", side], green(side));
    expect(r.status).toBe(1);
    expect(r.text).toContain(`${side} is not on main.`);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function merge(dir: string, side: string, sameTree: boolean) {
    const g = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf8" }).trim();
    const id = ["-c", "user.name=t", "-c", "user.email=t@example.invalid"];
    // A batch built on current main and merged with --merge: main has not
    // moved, so the merge commit's tree is the batch head's. Otherwise main
    // moved first and the merged tree is one nobody tested.
    if (!sameTree) {
      fs.writeFileSync(path.join(dir, "extra.txt"), "only on main\n");
      g("add", "extra.txt");
      g(...id, "commit", "-qm", "main moved");
    }
    g(...id, "merge", "-q", "--no-ff", "-m", "Merge the batch", side);
    return g("rev-parse", "HEAD");
  }

  function twinFiles(dir: string, parent: string, names = WHOLE_JOBS) {
    fs.writeFileSync(path.join(dir, "twin-runs.json"), JSON.stringify({ workflow_runs: [{ ...twinRun, head_sha: parent }] }));
    fs.writeFileSync(path.join(dir, "twin-jobs.json"), JSON.stringify({ "7": jobsOf(names) }));
    return ["--twin-runs", "twin-runs.json", "--twin-jobs", "twin-jobs.json"];
  }

  it("tags a merge commit whose own run was cancelled, when its tree is the tested batch head's", () => {
    const { dir, side } = repo();
    const m = merge(dir, side, true);
    const cancelledRun = [{ head_sha: m, event: "push", status: "completed", conclusion: "cancelled" }];
    const r = run(dir, ["--version", "1.3.22", "--sha", m, ...twinFiles(dir, side)], cancelledRun);
    expect(r.text).toContain(`v1.3.22 may be tagged at ${m}`);
    expect(r.text).toContain("tested twin");
    expect(r.status).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("refuses the same merge when the batch head's run was not whole", () => {
    const { dir, side } = repo();
    const m = merge(dir, side, true);
    const r = run(dir, ["--version", "1.3.22", "--sha", m, ...twinFiles(dir, side, WHOLE_JOBS.slice(0, 5))], []);
    expect(r.status).toBe(1);
    expect(r.text).toContain("not a whole one");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("refuses a merge whose tree is NOT its second parent's, however green that parent", () => {
    const { dir, side } = repo();
    const m = merge(dir, side, false);
    const r = run(dir, ["--version", "1.3.22", "--sha", m, ...twinFiles(dir, side)], []);
    expect(r.status).toBe(1);
    expect(r.text).toContain("its tree differs");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("answers release.yml's --twin-only question the same way", () => {
    const { dir, side, tip } = repo();
    const m = merge(dir, side, true);
    const ask = (sha: string) =>
      spawnSync(process.execPath, [SCRIPT, "--twin-only", "--sha", sha, ...twinFiles(dir, side)], { cwd: dir, encoding: "utf8" });
    const yes = ask(m);
    expect(yes.stdout).toContain(`${m} is a tested twin`);
    expect(yes.status).toBe(0);
    const no = ask(tip);
    expect(no.stderr).toContain("not a merge commit");
    expect(no.status).toBe(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("refuses a sha that is not a commit at all", () => {
    const { dir } = repo();
    const r = run(dir, ["--version", "1.3.21", "--sha", "nonsense"], []);
    expect(r.status).toBe(1);
    expect(r.text).toContain('"nonsense" is not a commit sha.');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("refuses a hex sha the repository does not hold", () => {
    const { dir } = repo();
    const r = run(dir, ["--version", "1.3.21", "--sha", "c".repeat(40)], []);
    expect(r.status).toBe(1);
    expect(r.text).toContain("is not a commit in this repository.");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("refuses when the tag is already on the remote", () => {
    const { dir, tip } = repo();
    const r = run(dir, ["--version", "1.3.21"], green(tip), `${tip}\trefs/tags/v1.3.21\n`);
    expect(r.status).toBe(1);
    expect(r.text).toContain("The tag v1.3.21 already exists.");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
