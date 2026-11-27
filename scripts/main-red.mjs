#!/usr/bin/env node
/**
 * Main is red: say so once, loudly, with the cause, where every lane will see it.
 *
 * WHY THIS EXISTS. On 26 Nov 2026 main's push run went red five times. Every
 * pull_request run merges main, so each open pull request inherited the red,
 * thirteen showed as sent back at once, and five lanes each re-diagnosed the
 * same failure. Nothing said "this is main's, not yours".
 *
 * WHAT IT DOES, run by .github/workflows/main-red.yml when ci.yml finishes a
 * push run on main:
 *   RED    ONE issue titled "main is red", labelled main-red, reopened for a new
 *          episode or updated within one, carrying the sha, the run and a CAUSE
 *          LINE: the failing test files (from the shard logs and tests-ran-once)
 *          and every other failed job with its first failed step.
 *          Then ONE comment on each open, non-draft pull request whose own
 *          latest ci run failed ONLY in ways main is failing (its failure set
 *          is a subset of main's). Edited, never re-posted, within an episode.
 *   GREEN  the issue gets the green sha and is closed, and each of those
 *          comments is edited to say main is green again.
 * An EPISODE runs from the first red to the next green; its id is the first
 * red sha, kept in the issue body.
 *
 * WHAT IT CANNOT SEE: why main is red. The cause line names what failed, not
 * the fix. A pull request red in its own way as well is left alone, on purpose:
 * that red is the lane's.
 *
 *   GITHUB_TOKEN=... node scripts/main-red.mjs --run <ci run id> [--repo o/r] [--dry-run]
 *
 * --dry-run reads everything and prints what it would write, writing nothing.
 * Self-test: node scripts/main-red.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFailLines, withRetry } from "./flake-report.mjs";

export const TITLE = "main is red";
export const LABEL = "main-red";
const SHARD_JOB = /^test \(\d+\/\d+\)$/;
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;
const STAMP = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s/;
/** check-test-shards.mjs: `  path/to/file.test.ts: failed in shard 3` (or skipped). */
const RAN_ONCE_LINE = /^\s+(\S+\.(?:test|spec)\.[cm]?[jt]sx?): (?:failed|skipped)\b.*shard \d+/;

const clean = (log) => String(log).split("\n").map((l) => l.replace(STAMP, "").replace(ANSI, ""));

/** The failing test files tests-ran-once names. */
export function parseRanOnce(log) {
  return [...new Set(clean(log).map((l) => RAN_ONCE_LINE.exec(l)?.[1]).filter(Boolean))];
}

/**
 * A run's failure signature: what failed, independent of which shard it landed
 * in. `logs` maps a job id to its log text.
 */
export function signature(jobs, logs) {
  const sig = new Set();
  for (const j of jobs) {
    if (j.conclusion !== "failure" && j.conclusion !== "timed_out") continue;
    const step = (j.steps ?? []).find((s) => s.conclusion === "failure")?.name ?? "(no failed step recorded)";
    if (SHARD_JOB.test(j.name)) {
      const files = parseFailLines(logs[j.id] ?? "").map((t) => t.split(" > ")[0]);
      if (step === "Test" && files.length) for (const f of files) sig.add(`test ${f}`);
      else sig.add(`test shard / ${step}`);
    } else if (j.name === "tests-ran-once") {
      const files = parseRanOnce(logs[j.id] ?? "");
      if (files.length) for (const f of files) sig.add(`test ${f}`);
      else sig.add(`tests-ran-once / ${step}`);
    } else {
      sig.add(`${j.name} / ${step}`);
    }
  }
  return sig;
}

export const isSubset = (a, b) => a.size > 0 && [...a].every((x) => b.has(x));

export function causeLine(sig) {
  const items = [...sig].sort();
  return items.length ? items.join("; ") : "no failed job recorded (cancelled or timed out before a step failed?)";
}

const EPISODE = /<!-- main-red-episode: ([0-9a-f]{7,40}) -->/;
export const episodeOf = (issueBody) => EPISODE.exec(issueBody ?? "")?.[1] ?? null;
export const prMarker = (episode) => `<!-- main-red: ${episode} -->`;

export function issueBody({ episode, sha, runUrl, cause, subject }) {
  return [
    `<!-- main-red-episode: ${episode} -->`,
    `**main is red at \`${sha.slice(0, 7)}\`** (${subject}).`,
    "",
    `**Cause:** ${cause}`,
    "",
    `Run: ${runUrl}`,
    `Red since \`${episode.slice(0, 7)}\`.`,
    "",
    "Every pull_request run merges main, so open pull requests failing ONLY in these ways are not red on their own account; each has a comment pointing here. Fix main first. This issue closes itself when main's next push run is green.",
  ].join("\n");
}

export function prComment({ episode, sha, cause, issueNumber, green }) {
  const lines = [
    prMarker(episode),
    `**This pull request's red matches main's.** main is red at \`${sha.slice(0, 7)}\`, and every failure in this pull request's latest ci run is one main has too.`,
    "",
    `**Cause on main:** ${cause}`,
    "",
    `Tracked in #${issueNumber}. Nothing to fix here for these; once main is green, merge main into this branch.`,
  ];
  if (green) lines.push("", `**Update:** main is green again at \`${green.slice(0, 7)}\`. Merge main into this branch and its next run should clear.`);
  return lines.join("\n");
}

/**
 * Everything the run should write, as a list of actions, from facts already
 * gathered. Pure, so the self-test drives it.
 *   facts: { run, mainSig, issue, prs: [{ number, sig, comment }] }
 *   issue: { number, state, body } | null; comment: { id, body } | null
 */
export function decide(facts) {
  const { run, mainSig, issue, prs } = facts;
  const actions = [];
  const sha = run.head_sha;
  const subject = (run.head_commit?.message ?? "").split("\n")[0] || "no commit message";
  if (run.conclusion === "success") {
    if (!issue || issue.state !== "open") return actions;
    const episode = episodeOf(issue.body) ?? sha;
    actions.push({ kind: "issue-comment", number: issue.number, body: `main is green again at \`${sha.slice(0, 7)}\` (${subject}): ${run.html_url}. Closing.` });
    actions.push({ kind: "issue-close", number: issue.number });
    for (const pr of prs) {
      if (pr.comment && pr.comment.body.includes(prMarker(episode)) && !pr.comment.body.includes("**Update:** main is green again")) {
        actions.push({ kind: "pr-comment-edit", pr: pr.number, id: pr.comment.id, body: `${pr.comment.body}\n\n**Update:** main is green again at \`${sha.slice(0, 7)}\`. Merge main into this branch and its next run should clear.` });
      }
    }
    return actions;
  }
  if (run.conclusion !== "failure" && run.conclusion !== "timed_out") return actions;
  const continuing = issue && issue.state === "open";
  const episode = continuing ? episodeOf(issue.body) ?? sha : sha;
  const cause = causeLine(mainSig);
  const body = issueBody({ episode, sha, runUrl: run.html_url, cause, subject });
  if (!issue) actions.push({ kind: "issue-create", title: TITLE, body, label: LABEL });
  else if (!continuing) actions.push({ kind: "issue-reopen", number: issue.number, body });
  else if (issue.body !== body) actions.push({ kind: "issue-update", number: issue.number, body });
  const issueNumber = issue?.number ?? "NEW";
  for (const pr of prs) {
    if (!isSubset(pr.sig, mainSig)) continue;
    const text = prComment({ episode, sha, cause, issueNumber });
    if (pr.comment && pr.comment.body.includes(prMarker(episode))) {
      if (pr.comment.body !== text) actions.push({ kind: "pr-comment-edit", pr: pr.number, id: pr.comment.id, body: text });
    } else {
      actions.push({ kind: "pr-comment-create", pr: pr.number, body: text });
    }
  }
  return actions;
}

// ---------------------------------------------------------------------------
// Gathering and writing, through the GitHub REST API.
// ---------------------------------------------------------------------------

function client(token, repo) {
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "main-red" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = (p) => `https://api.github.com${p.startsWith("/repos") ? p : `/repos/${repo}${p}`}`;
  const call = async (method, p, body) => {
    // Reads retry GitHub's transient 5xx and 429; writes are sent once, so a
    // retried POST can never post a comment twice.
    const send = () => fetch(url(p), { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: "follow" });
    const r = method === "GET" ? await withRetry(send) : await send();
    if (method === "GET" && (r.status === 404 || r.status === 410) && p.endsWith("/logs")) return "";
    if (!r.ok && !(method === "POST" && p.endsWith("/labels") && r.status === 422)) throw new Error(`${method} ${p}: ${r.status} ${r.statusText}`);
    return p.endsWith("/logs") ? r.text() : r.status === 204 ? null : r.json();
  };
  return { get: (p) => call("GET", p), post: (p, b) => call("POST", p, b), patch: (p, b) => call("PATCH", p, b) };
}

async function runSignature(api, runId) {
  const { jobs } = await api.get(`/actions/runs/${runId}/jobs?filter=latest&per_page=100`);
  const logs = {};
  for (const j of jobs) {
    if ((j.conclusion === "failure" || j.conclusion === "timed_out") && (SHARD_JOB.test(j.name) || j.name === "tests-ran-once")) {
      logs[j.id] = await api.get(`/actions/jobs/${j.id}/logs`);
    }
  }
  return signature(jobs, logs);
}

export async function gather(api, runId) {
  const run = await api.get(`/actions/runs/${runId}`);
  const mainSig = run.conclusion === "success" ? new Set() : await runSignature(api, runId);
  const found = await api.get(`/issues?labels=${LABEL}&state=all&per_page=10&sort=updated`);
  const issue = found.find((i) => i.title === TITLE && !i.pull_request) ?? null;
  const prs = [];
  const open = await api.get(`/pulls?state=open&base=main&per_page=100`);
  for (const pr of open) {
    if (pr.draft) continue;
    const comments = await api.get(`/issues/${pr.number}/comments?per_page=100`);
    const comment = comments.find((c) => /<!-- main-red: [0-9a-f]+ -->/.test(c.body ?? "")) ?? null;
    let sig = new Set();
    if (run.conclusion !== "success") {
      const { workflow_runs: runs } = await api.get(`/actions/workflows/ci.yml/runs?event=pull_request&head_sha=${pr.head.sha}&per_page=5`);
      const latest = runs.find((r) => r.status === "completed");
      if (latest && latest.conclusion === "failure") sig = await runSignature(api, latest.id);
    }
    prs.push({ number: pr.number, sig, comment: comment && { id: comment.id, body: comment.body } });
  }
  return { run, mainSig, issue: issue && { number: issue.number, state: issue.state, body: issue.body }, prs };
}

async function apply(api, actions) {
  let issueNumber = null;
  for (const a of actions) {
    if (a.kind === "issue-create") {
      await api.post("/labels", { name: LABEL, color: "b60205", description: "main's push run is red" });
      issueNumber = (await api.post("/issues", { title: a.title, body: a.body, labels: [LABEL] })).number;
    } else if (a.kind === "issue-reopen") {
      await api.patch(`/issues/${a.number}`, { state: "open", body: a.body });
    } else if (a.kind === "issue-update") {
      await api.patch(`/issues/${a.number}`, { body: a.body });
    } else if (a.kind === "issue-comment") {
      await api.post(`/issues/${a.number}/comments`, { body: a.body });
    } else if (a.kind === "issue-close") {
      await api.patch(`/issues/${a.number}`, { state: "closed", state_reason: "completed" });
    } else if (a.kind === "pr-comment-create") {
      await api.post(`/issues/${a.pr}/comments`, { body: issueNumber ? a.body.replace("#NEW", `#${issueNumber}`) : a.body });
    } else if (a.kind === "pr-comment-edit") {
      await api.patch(`/issues/comments/${a.id}`, { body: a.body });
    }
  }
}

function arg(argv, name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
}

export async function main(argv) {
  const runId = arg(argv, "--run");
  const repo = arg(argv, "--repo", process.env.GITHUB_REPOSITORY);
  const dryRun = argv.includes("--dry-run");
  if (!runId || !/^\d+$/.test(runId) || !repo) {
    console.error("usage: GITHUB_TOKEN=... node scripts/main-red.mjs --run <ci run id> [--repo owner/name] [--dry-run]");
    return 2;
  }
  const api = client(process.env.GITHUB_TOKEN || process.env.GH_TOKEN, repo);
  const facts = await gather(api, runId);
  const actions = decide(facts);
  const report = [
    `## main-red: run ${runId} at ${facts.run.head_sha.slice(0, 7)} concluded ${facts.run.conclusion}`,
    "",
    `Cause: ${facts.run.conclusion === "success" ? "(green)" : causeLine(facts.mainSig)}`,
    "",
    actions.length ? `${dryRun ? "Would do" : "Did"}:` : "Nothing to write.",
    ...actions.map((a) => `- ${a.kind}${a.pr ? ` on #${a.pr}` : a.number ? ` #${a.number}` : ""}`),
  ].join("\n");
  if (!dryRun) await apply(api, actions);
  console.log(report);
  if (dryRun) for (const a of actions) if (a.body) console.log(`\n--- ${a.kind}${a.pr ? ` #${a.pr}` : ""}\n${a.body}`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`::error::main-red: ${err.message}`);
      process.exit(1);
    },
  );
}
