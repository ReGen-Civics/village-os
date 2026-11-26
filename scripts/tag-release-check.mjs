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
//      question release.yml asks again before it builds anything. A merge
//      commit's own run on main is never cancelled (25 Nov 2026), so that run
//      is the one to wait for.
//
//      RETIRED on 26 Nov 2026 (the lead, item 1b): the TESTED TWIN, which also
//      passed a merge commit whose tree equalled its second parent's when that
//      parent (an integration branch) had a whole green push run. It rescued a
//      merge commit whose own run was cancelled (712becf, 1.3.66); that
//      cannot happen since 25 Nov, and integration branches get no push run
//      since 26 Nov, so the twin had no way through left.
//
//      NOT accepted: a docs-bot commit on top of a tested one. Its files look
//      like documentation, but client/src/locales/en.po is compiled into
//      dist/public (lingui.config.ts), so the image built from it is not the
//      image that was tested. Since 26 Nov it has no ci run at all (ci.yml's
//      paths-ignore; isBotCommit in scripts/lib/generatedDocs.mjs), so:
//        - with no --sha, the commit is main's newest commit that is NOT the
//          bot's: the merge commit whose own push run judged the landing;
//        - a --sha naming the bot's commit is refused, and the refusal names
//          the commit to tag instead.
//
// THIS FILE NEVER TAGS. It prints its verdict and exits 1 on any refusal.
//
// Usage (from the repository root, in a clone with full history):
//   node scripts/tag-release-check.mjs --version 1.3.21 [--sha <commit>]
//        [--main-ref origin/main] --ci-runs runs.json --remote-tags tags.txt
//
//   --ci-runs      the JSON body of GET .../actions/workflows/ci.yml/runs?head_sha=<sha>
//   --remote-tags  the output of `git ls-remote --tags origin`
//   --sha          defaults to main's tip, or below it past the docs bot's commits
//   --untold-target <ref>  print the commit to tag when no sha was given:
//                  <ref>, or below it past the docs bot's commits, and exit
//
// When GITHUB_OUTPUT is set, a passing run writes sha=, tag= and version= to it.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { BOT_COMMIT_SUBJECT, isBotCommit } from "./lib/generatedDocs.mjs";

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

export function checkCiGreen(runs, sha) {
  if (greenPushRuns(runs, sha).length > 0) return [];
  const all = (Array.isArray(runs) ? runs : []).filter((r) => r && r.head_sha === sha);
  const seen = all.length
    ? all.map((r) => `${r.event}/${r.status}/${r.conclusion ?? "none"}`).join(", ")
    : "no ci runs at all";
  return [`ci has not concluded success on a push run at ${sha} (found: ${seen}). Wait for ci on main to pass on this commit, then dispatch again.`];
}

/** Guard 2. */
export function checkOnMain(onMain, sha) {
  return onMain ? [] : [`${sha} is not on main. Only a commit main already carries can be released.`];
}

/**
 * Every guard over facts already gathered. Pure, so the test can drive it.
 * facts: { version, sha, onMain, files, remoteTags, ciRuns, botParent? }
 * Returns { ok, tag, problems }.
 */
/**
 * Guard 5, before any run is read: the docs bot's commit has no ci run to read
 * (ci.yml's paths-ignore). `botParent` is its parent's sha, or null when the
 * commit is not the bot's.
 */
export function checkNotBotCommit(sha, botParent) {
  if (!botParent) return [];
  return [
    `${sha} is the docs bot's commit ("${BOT_COMMIT_SUBJECT}"), which gets no ci run since 26 Nov 2026 (ci.yml, paths-ignore). Tag the commit under it, ${botParent}, whose own push run judged this landing: dispatch again with sha=${botParent}, or with no sha at all.`,
  ];
}

export function evaluate(facts) {
  const versionProblems = checkVersionInput(facts.version);
  if (versionProblems.length) return { ok: false, tag: null, problems: versionProblems };
  const tag = `v${facts.version}`;
  const botProblems = checkNotBotCommit(facts.sha, facts.botParent ?? null);
  const problems = [
    ...checkOnMain(facts.onMain, facts.sha),
    ...checkVersionSites(facts.version, facts.files),
    ...checkTagFree(facts.remoteTags, tag),
    ...(botProblems.length ? botProblems : checkCiGreen(facts.ciRuns, facts.sha)),
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

/** isBotCommit's facts about one commit, from git. */
export function commitFacts(sha) {
  const parents = git(["rev-list", "--parents", "-n", "1", sha]).split(/\s+/).length - 1;
  return {
    subject: git(["log", "-1", "--format=%s", sha]),
    parents,
    paths: parents === 1 ? git(["diff-tree", "--no-commit-id", "--name-only", "-r", sha]).split("\n").filter(Boolean) : [],
  };
}

/** The commit to tag when no sha was given: `tip`, or below it past the docs bot's commits. */
export function untoldTarget(tip, isBot = (c) => isBotCommit(commitFacts(c))) {
  let sha = tip;
  while (isBot(sha)) sha = git(["rev-parse", `${sha}^1`]);
  return sha;
}

export function main(argv) {
  if (argv.includes("--untold-target")) {
    // tag-release.yml's shell, given no sha: print the commit to tag instead of main's tip.
    console.log(untoldTarget(git(["rev-parse", "--verify", `${arg(argv, "--untold-target")}^{commit}`])));
    return 0;
  }
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

  // An untold sha means main's tip, and the tip is usually the docs bot's
  // commit, which has no run: walk down to the merge commit that has one.
  // A told sha is taken as given, and guard 5 refuses it if it is the bot's.
  let botParent = null;
  if (!arg(argv, "--sha")?.trim()) {
    const tip = sha;
    sha = untoldTarget(tip);
    if (sha !== tip) console.log(`main's tip ${tip} is the docs bot's commit, which gets no ci run; the commit to tag is ${sha}.`);
  } else if (isBotCommit(commitFacts(sha))) {
    botParent = git(["rev-parse", `${sha}^1`]);
  }

  let ciRuns = [];
  try {
    ciRuns = JSON.parse(fs.readFileSync(runsFile, "utf8")).workflow_runs ?? [];
  } catch (e) {
    console.error(`::error::Could not read ci's runs from ${runsFile}: ${e.message}`);
    return 1;
  }

  const verdict = evaluate({
    version,
    sha,
    botParent,
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
  console.log(`${verdict.tag} may be tagged at ${sha}: on main, every version site says ${version}, no such tag yet, ci green on a push run.`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `sha=${sha}\ntag=${verdict.tag}\nversion=${version}\n`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
