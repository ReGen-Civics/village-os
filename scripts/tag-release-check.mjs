#!/usr/bin/env node
// May this commit be tagged as this release? The guards behind
// .github/workflows/tag-release.yml, which lets a release be tagged by
// dispatching a workflow instead of a person running `git push origin vX.Y.Z`.
//
// The workflow gathers nothing itself and decides nothing itself. It checks out
// the repository with full history, asks the API for ci's runs on the commit,
// and hands both to this file, which answers. The decisions live here so a
// wrong one fails in server/tagRelease.test.ts, in a pull request, and not on
// the day somebody needs a release out.
//
// THE GUARDS, every one checked and every failure reported together:
//
//   1. the version is a plain release number, X.Y.Z. A prerelease is still
//      tagged by hand (docs/RELEASING.md, step 5).
//   2. the commit is on main: an ancestor of main's tip, or the tip itself.
//   3. at that commit, package.json's version, PLATFORM_VERSION in
//      server/lib/identity.ts, a `## X.Y.Z` section in CHANGELOG.md and the
//      default image in docker-compose.yml all name the version. release.yml
//      refuses a tag the first two or the compose file disagree with, and the
//      release notes come from the changelog section, so a tag without them is
//      a tag release.yml would turn away after it already exists.
//   4. no tag vX.Y.Z exists yet on the remote. A published version is final.
//   5. ci concluded success on a PUSH run at exactly that commit, which is the
//      question release.yml asks again before it builds anything. OR, the
//      TESTED TWIN: the commit is a merge whose tree is byte-identical to its
//      second parent's tree, and that second parent (a batch or integration
//      branch, the only branches besides main with push runs) has a green ci
//      PUSH run with every job present and green: verify, every `test (i/N)`
//      shard, tests-ran-once and browser-smoke. Same bytes, already judged.
//      This is what a release batch merged with `--merge` looks like when the
//      merge commit's own run never finished (25 Nov 2026: 712becf, whose
//      tree is 7222a20's, waited a whole second run).
//
//      NOT accepted: a docs-bot commit on top of a tested one. Its files look
//      like documentation, but client/src/locales/en.po is compiled into
//      dist/public (lingui.config.ts), so the image built from it is not the
//      image that was tested.
//
// THIS FILE NEVER TAGS. It prints its verdict and exits 1 on any refusal.
//
// Usage (from the repository root, in a clone with full history):
//   node scripts/tag-release-check.mjs --version 1.3.21 [--sha <commit>]
//        [--main-ref origin/main] --ci-runs runs.json --remote-tags tags.txt
//
//   --ci-runs      the JSON body of GET .../actions/workflows/ci.yml/runs?head_sha=<sha>
//   --remote-tags  the output of `git ls-remote --tags origin`
//   --sha          defaults to main's tip
//   --twin-runs    optional: ci's runs at <sha>^2 (same API, head_sha=<sha>^2)
//   --twin-jobs    optional: {"<run id>": jobs[]} for those runs, from
//                  GET .../actions/runs/<id>/jobs?filter=latest
//   --twin-only    answer guard 5's tested-twin branch alone (release.yml asks
//                  it after its own any-green-run check found none). No
//                  version, tags or ci-runs needed.
//
// When GITHUB_OUTPUT is set, a passing run writes sha=, tag= and version= to it.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

/** A plain release number. The tag is `v` followed by this. */
export const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Guard 1. */
export function checkVersionInput(version) {
  if (typeof version !== "string" || version.trim() === "") {
    return ["No version was given. Dispatch with the version to tag, for example 1.3.21."];
  }
  if (version.startsWith("v")) {
    return [`The version is "${version}". Give the number without the v, for example ${version.slice(1)}; the tag adds it.`];
  }
  if (!RELEASE_VERSION.test(version)) {
    return [`"${version}" is not a release number of the form X.Y.Z. A prerelease is tagged by hand (docs/RELEASING.md, step 5).`];
  }
  return [];
}

/** What package.json says. Null when it cannot be read. */
export function packageVersion(packageJson) {
  try {
    const v = JSON.parse(packageJson).version;
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

/** PLATFORM_VERSION, read the way release.yml reads it. */
export function platformVersion(identityTs) {
  const m = /PLATFORM_VERSION = "([^"]+)"/.exec(identityTs ?? "");
  return m ? m[1] : null;
}

/** The default image tag docker-compose.yml starts. Owner-agnostic, like
 *  scripts/release-train.mjs, so a fork publishing under its own owner reads the same. */
export function composeVersion(compose) {
  const m = /ghcr\.io\/[a-z0-9_.-]+\/village-os:([0-9A-Za-z.+-]+)/.exec(compose ?? "");
  return m ? m[1] : null;
}

/** A `## X.Y.Z` heading, alone or followed by a space (the date). The same
 *  test release-train-land.yml and release.yml's notes step apply. */
export function hasChangelogSection(changelog, version) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^## ${escaped}( |$)`, "m").test((changelog ?? "").replace(/\r/g, ""));
}

/** Guard 3. `files` holds the four files' text at the commit, or null for a missing one. */
export function checkVersionSites(version, files) {
  const problems = [];
  const pkg = packageVersion(files.packageJson);
  if (pkg !== version) {
    problems.push(`package.json says ${pkg ?? "nothing readable"}, not ${version}.`);
  }
  const plat = platformVersion(files.identityTs);
  if (plat !== version) {
    problems.push(`PLATFORM_VERSION in server/lib/identity.ts says ${plat ?? "nothing readable"}, not ${version}.`);
  }
  if (!hasChangelogSection(files.changelog, version)) {
    problems.push(`CHANGELOG.md has no section headed "## ${version}". release.yml writes the release notes from it.`);
  }
  const compose = composeVersion(files.compose);
  if (compose !== version) {
    problems.push(`docker-compose.yml starts the village-os image at ${compose ?? "(no image found)"}, not ${version}. release.yml refuses that tag.`);
  }
  return problems;
}

/** Guard 4. `remoteTags` is `git ls-remote --tags origin` output. */
export function tagExists(remoteTags, tag) {
  return (remoteTags ?? "")
    .split("\n")
    .map((line) => line.trim().split(/\s+/)[1])
    .some((ref) => ref === `refs/tags/${tag}` || ref === `refs/tags/${tag}^{}`);
}

export function checkTagFree(remoteTags, tag) {
  return tagExists(remoteTags, tag)
    ? [`The tag ${tag} already exists. A published version is final; release the next number instead.`]
    : [];
}

/** Guard 5. `runs` is the API's `workflow_runs` array for ci on this commit. */
export function greenPushRuns(runs, sha) {
  return (Array.isArray(runs) ? runs : []).filter(
    (r) => r && r.head_sha === sha && r.event === "push" && r.status === "completed" && r.conclusion === "success",
  );
}

export function checkCiGreen(runs, sha, twin = null) {
  if (greenPushRuns(runs, sha).length > 0) return [];
  if (checkTestedTwin(twin).ok) return [];
  const all = (Array.isArray(runs) ? runs : []).filter((r) => r && r.head_sha === sha);
  const seen = all.length
    ? all.map((r) => `${r.event}/${r.status}/${r.conclusion ?? "none"}`).join(", ")
    : "no ci runs at all";
  const twinWhy = twin ? ` Nor is it a tested twin: ${checkTestedTwin(twin).why}.` : "";
  return [`ci has not concluded success on a push run at ${sha} (found: ${seen}).${twinWhy} Wait for ci on main to pass on this commit, then dispatch again.`];
}

/** The jobs ci.yml runs, by name. A run is only a green when all of them are
 *  there: jobs appear progressively, so "every job listed succeeded" is true
 *  of a run that has not created its last jobs yet (CLAUDE.md, the job floor). */
export const FIXED_CI_JOBS = ["verify", "tests-ran-once", "browser-smoke"];
/** The floor: verify, four shards (the fewest ci.yml has ever run), tests-ran-once, browser-smoke. */
export const MIN_CI_JOBS = 7;
const SHARD_JOB = /^test \((\d+)\/(\d+)\)$/;

/** Every job of one ci run present and green. Returns the problems, empty when whole. */
export function checkWholeRun(jobs) {
  const list = Array.isArray(jobs) ? jobs.filter(Boolean) : [];
  const problems = [];
  const names = new Set(list.map((j) => j.name));
  for (const n of FIXED_CI_JOBS) if (!names.has(n)) problems.push(`no ${n} job`);
  const shards = list.map((j) => SHARD_JOB.exec(j.name ?? "")).filter(Boolean);
  const totals = new Set(shards.map((m) => Number(m[2])));
  if (shards.length === 0) problems.push("no test (i/N) shard jobs");
  else if (totals.size !== 1) problems.push(`shard jobs disagree on N (${[...totals].join(", ")})`);
  else {
    const n = [...totals][0];
    const seen = new Set(shards.map((m) => Number(m[1])));
    for (let i = 1; i <= n; i++) if (!seen.has(i)) problems.push(`no test (${i}/${n}) job`);
  }
  if (list.length < MIN_CI_JOBS) problems.push(`${list.length} jobs, under the floor of ${MIN_CI_JOBS}`);
  for (const j of list) {
    if (j.status !== "completed" || j.conclusion !== "success") {
      problems.push(`${j.name} is ${j.status}/${j.conclusion ?? "none"}`);
    }
  }
  return problems;
}

/**
 * Guard 5's second way through. `twin` is null when the commit is not a merge,
 * else { parent, sameTree, runs, jobsByRun }: the second parent, whether the
 * two trees are identical, ci's runs at the parent, and each run's jobs.
 * Returns { ok, why }.
 */
export function checkTestedTwin(twin) {
  if (!twin || !twin.parent) return { ok: false, why: "it is not a merge commit" };
  if (!twin.sameTree) return { ok: false, why: `its tree differs from its second parent ${twin.parent}'s` };
  const green = greenPushRuns(twin.runs, twin.parent);
  if (green.length === 0) return { ok: false, why: `its second parent ${twin.parent} has the same tree but no green ci push run` };
  const reasons = [];
  for (const r of green) {
    const problems = checkWholeRun(twin.jobsByRun?.[String(r.id)]);
    if (problems.length === 0) return { ok: true, why: `its tree is ${twin.parent}'s, which passed ci run ${r.id} whole` };
    reasons.push(`run ${r.id}: ${problems.join("; ")}`);
  }
  return { ok: false, why: `its second parent ${twin.parent} has a green push run, but not a whole one (${reasons.join(" | ")})` };
}

/** Guard 2. */
export function checkOnMain(onMain, sha) {
  return onMain ? [] : [`${sha} is not on main. Only a commit main already carries can be released.`];
}

/**
 * Every guard over facts already gathered. Pure, so the test can drive it.
 * facts: { version, sha, onMain, files, remoteTags, ciRuns, twin? }
 * Returns { ok, tag, problems }.
 */
export function evaluate(facts) {
  const versionProblems = checkVersionInput(facts.version);
  if (versionProblems.length) return { ok: false, tag: null, problems: versionProblems };
  const tag = `v${facts.version}`;
  const problems = [
    ...checkOnMain(facts.onMain, facts.sha),
    ...checkVersionSites(facts.version, facts.files),
    ...checkTagFree(facts.remoteTags, tag),
    ...checkCiGreen(facts.ciRuns, facts.sha, facts.twin ?? null),
  ];
  return { ok: problems.length === 0, tag, problems };
}

// ---------------------------------------------------------------------------
// The command line: gather from git and the two files, then evaluate.
// ---------------------------------------------------------------------------

function git(args, opts = {}) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
}

function gitOk(args) {
  try {
    execFileSync("git", args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function showAt(sha, file) {
  try {
    return execFileSync("git", ["show", `${sha}:${file}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function readJson(file, fallback) {
  if (!file) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** The facts for the tested-twin branch: null when the commit has no second parent. */
export function gatherTwin(sha, argv) {
  let parent = "";
  try {
    parent = git(["rev-parse", "--verify", "--quiet", `${sha}^2^{commit}`]);
  } catch {
    parent = "";
  }
  if (!parent) return null;
  const sameTree = git(["rev-parse", `${sha}^{tree}`]) === git(["rev-parse", `${parent}^{tree}`]);
  return {
    parent,
    sameTree,
    runs: readJson(arg(argv, "--twin-runs"), {}).workflow_runs ?? [],
    jobsByRun: readJson(arg(argv, "--twin-jobs"), {}),
  };
}

export function main(argv) {
  if (argv.includes("--twin-only")) return twinOnly(argv);
  const version = (arg(argv, "--version") ?? "").trim();
  const mainRef = arg(argv, "--main-ref") ?? "origin/main";
  const wantSha = (arg(argv, "--sha") ?? "").trim() || mainRef;
  const runsFile = arg(argv, "--ci-runs");
  const tagsFile = arg(argv, "--remote-tags");
  if (!runsFile || !tagsFile) {
    console.error("usage: node scripts/tag-release-check.mjs --version X.Y.Z [--sha <commit>] [--main-ref origin/main] --ci-runs runs.json --remote-tags tags.txt");
    return 2;
  }

  if (arg(argv, "--sha")?.trim() && !/^[0-9a-f]{7,40}$/i.test(wantSha)) {
    console.error(`::error::"${wantSha}" is not a commit sha. Give a hex sha, or leave it empty for main's tip.`);
    return 1;
  }

  let sha;
  try {
    sha = git(["rev-parse", "--verify", "--quiet", `${wantSha}^{commit}`]);
  } catch {
    sha = "";
  }
  if (!sha) {
    console.error(`::error::"${wantSha}" is not a commit in this repository.`);
    return 1;
  }

  let ciRuns = [];
  try {
    ciRuns = JSON.parse(fs.readFileSync(runsFile, "utf8")).workflow_runs ?? [];
  } catch (e) {
    console.error(`::error::Could not read ci's runs from ${runsFile}: ${e.message}`);
    return 1;
  }

  let twin;
  try {
    twin = gatherTwin(sha, argv);
  } catch (e) {
    console.error(`::error::Could not read the second parent's ci runs: ${e.message}`);
    return 1;
  }

  const verdict = evaluate({
    version,
    sha,
    twin,
    onMain: gitOk(["merge-base", "--is-ancestor", sha, mainRef]),
    files: {
      packageJson: showAt(sha, "package.json"),
      identityTs: showAt(sha, "server/lib/identity.ts"),
      changelog: showAt(sha, "CHANGELOG.md"),
      compose: showAt(sha, "docker-compose.yml"),
    },
    remoteTags: fs.readFileSync(tagsFile, "utf8"),
    ciRuns,
  });

  if (!verdict.ok) {
    for (const p of verdict.problems) console.error(`::error::${p}`);
    console.error(`Not tagging. ${verdict.problems.length} guard(s) refused ${version || "(no version)"} at ${sha}.`);
    return 1;
  }
  const how = greenPushRuns(ciRuns, sha).length ? "ci green on a push run" : `ci green on its tested twin (${checkTestedTwin(twin).why})`;
  console.log(`${verdict.tag} may be tagged at ${sha}: on main, every version site says ${version}, no such tag yet, ${how}.`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `sha=${sha}\ntag=${verdict.tag}\nversion=${version}\n`);
  }
  return 0;
}

/** release.yml's fallback: is this commit a tested twin? Exit 0 yes, 1 no. */
function twinOnly(argv) {
  const want = (arg(argv, "--sha") ?? "").trim();
  let sha = "";
  try {
    sha = want ? git(["rev-parse", "--verify", "--quiet", `${want}^{commit}`]) : "";
  } catch {
    sha = "";
  }
  if (!sha) {
    console.error(`::error::"${want}" is not a commit in this repository.`);
    return 1;
  }
  let twin;
  try {
    twin = gatherTwin(sha, argv);
  } catch (e) {
    console.error(`::error::Could not read the second parent's ci runs: ${e.message}`);
    return 1;
  }
  const v = checkTestedTwin(twin);
  if (!v.ok) {
    console.error(`${sha} is not a tested twin: ${v.why}.`);
    return 1;
  }
  console.log(`${sha} is a tested twin: ${v.why}.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
