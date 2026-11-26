#!/usr/bin/env node
/**
 * Which tests fail and then pass on the same code? Ranked, so the worst get fixed.
 *
 * WHY THIS EXISTS. On 26 Nov 2026 thirteen pull requests were red at once, and
 * lanes re-diagnosed the same reds one by one. Some were main's own red; others
 * were tests that fail on one run and pass on the next with no code change. A
 * flake costs a whole CI cycle every time it fires, and nobody fixes what
 * nobody has counted. This counts.
 *
 * WHAT COUNTS AS A FLAKE. Two runs of ci.yml are of the SAME CODE when they
 * share a key:
 *   push run          its head sha
 *   pull_request run  its head sha AND its base sha (the run tests the head
 *                     merged with main, so a new main is new code)
 * Every attempt of one run (a re-run) is the same code too. Within a key that
 * has at least one fully green attempt, every failed attempt is a FLAKE EVENT,
 * and each failed job in it is attributed:
 *   a `test (i/N)` shard   to each failing test, read from the shard's log
 *                          (vitest's ` FAIL  file > describe > test` lines)
 *   any other job          to "<job> / <first failed step>"
 * A key that never went green is a real failure, not a flake, and is left out.
 *
 * WHAT IT CANNOT SEE: a flake that fired on code that was never run again; a
 * pull_request run whose API record has no base sha (it is keyed on the head
 * alone and said so in the output); logs GitHub has already expired.
 *
 *   GITHUB_TOKEN=... node scripts/flake-report.mjs [--days 3] [--repo owner/name] [--json]
 *
 * Reads only. In Actions it needs `actions: read`. A day of this repository is
 * about 150 runs, so --days 3 is roughly 500 API calls; GITHUB_TOKEN allows 1000
 * an hour.
 * Self-test: node scripts/flake-report.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHARD_JOB = /^test \(\d+\/\d+\)$/;
/** vitest's default reporter: ` FAIL  path/to/file.test.ts > describe > test`. ANSI codes are stripped first. */
const FAIL_LINE = /^\s*FAIL\s+(\S+\.(?:test|spec)\.[cm]?[jt]sx?)(?:\s+>\s+(.+?))?\s*$/;
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;
/** GitHub prefixes every log line with an ISO timestamp. */
const STAMP = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s/;

/** Which runs tested the same code. */
export function keyOf(run) {
  if (run.event === "pull_request") {
    const base = run.pull_requests?.[0]?.base?.sha;
    return base ? `${run.head_sha}@${base}` : `${run.head_sha}@?`;
  }
  return run.head_sha;
}

/** One attempt's verdict from its jobs. Cancelled or unfinished attempts carry no verdict. */
export function outcomeOf(jobs) {
  if (!jobs.length || jobs.some((j) => j.status !== "completed" || j.conclusion === "cancelled")) return null;
  const failed = jobs.filter((j) => j.conclusion === "failure" || j.conclusion === "timed_out");
  return {
    green: failed.length === 0 && jobs.every((j) => j.conclusion === "success" || j.conclusion === "skipped"),
    failedJobs: failed.map((j) => ({
      id: j.id,
      name: j.name,
      step: (j.steps ?? []).find((s) => s.conclusion === "failure")?.name ?? "(no failed step recorded)",
    })),
  };
}

/** Failed attempts on code that also went green: the flake events. */
export function findFlakeEvents(attempts) {
  const byKey = new Map();
  for (const a of attempts) {
    if (!a.outcome) continue;
    if (!byKey.has(a.key)) byKey.set(a.key, []);
    byKey.get(a.key).push(a);
  }
  const events = [];
  for (const [key, list] of byKey) {
    if (!list.some((a) => a.outcome.green)) continue;
    for (const a of list) if (!a.outcome.green && a.outcome.failedJobs.length) events.push({ key, ...a });
  }
  return events;
}

/** The failing tests a shard's log names, as "file > describe > test", deduplicated. */
export function parseFailLines(log) {
  const out = new Set();
  for (const raw of String(log).split("\n")) {
    const line = raw.replace(STAMP, "").replace(ANSI, "");
    const m = FAIL_LINE.exec(line);
    if (m) out.add(m[2] ? `${m[1]} > ${m[2]}` : m[1]);
  }
  return [...out];
}

/** Count per culprit: events, distinct code keys, an example run. Worst first. */
export function rank(attributed) {
  const by = new Map();
  for (const { culprit, key, url } of attributed) {
    const e = by.get(culprit) ?? { culprit, events: 0, keys: new Set(), example: url };
    e.events += 1;
    e.keys.add(key);
    by.set(culprit, e);
  }
  return [...by.values()]
    .map((e) => ({ culprit: e.culprit, events: e.events, codes: e.keys.size, example: e.example }))
    .sort((a, b) => b.events - a.events || b.codes - a.codes || (a.culprit < b.culprit ? -1 : 1));
}

/**
 * A test name read from a log, made safe inside a code span in a table cell:
 * backslashes first (or an escaped pipe could be unescaped by the name itself),
 * then pipes, which would end the cell; a backtick would end the code span, so
 * it becomes a plain quote, and a line break would end the row.
 */
export function tableCell(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/`/g, "'").replace(/[\r\n]+/g, " ");
}

export function markdown(ranked, { days, runs, attempts, events, unkeyed }) {
  const lines = [
    `## Flaky CI, last ${days} day(s)`,
    "",
    `${runs} ci.yml run(s), ${attempts} attempt(s) with a verdict, ${events} flake event(s): a failed attempt on code that also went fully green.`,
  ];
  if (unkeyed) lines.push(`${unkeyed} pull_request run(s) had no base sha in the API and were keyed on their head alone.`);
  lines.push("");
  if (!ranked.length) {
    lines.push("No flakes found in this window.");
    return lines.join("\n");
  }
  lines.push("| # | Fails, then passes on the same code | Events | Distinct code | Example |", "|---|---|---|---|---|");
  ranked.forEach((r, i) => lines.push(`| ${i + 1} | \`${tableCell(r.culprit)}\` | ${r.events} | ${r.codes} | [run](${r.example}) |`));
  lines.push("", "Fix the cause. A retry, a skip or a looser assertion is not a fix.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Gathering, from the GitHub REST API.
// ---------------------------------------------------------------------------

function client(token) {
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "flake-report" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const base = "https://api.github.com";
  return {
    async json(p) {
      const r = await fetch(`${base}${p}`, { headers });
      if (!r.ok) throw new Error(`GET ${p}: ${r.status} ${r.statusText}`);
      return r.json();
    },
    async text(p) {
      const r = await fetch(`${base}${p}`, { headers, redirect: "follow" });
      if (r.status === 410 || r.status === 404) return "";
      if (!r.ok) throw new Error(`GET ${p}: ${r.status} ${r.statusText}`);
      return r.text();
    },
  };
}

export async function gather(api, repo, days) {
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const runs = [];
  for (let page = 1; page < 50; page += 1) {
    const body = await api.json(`/repos/${repo}/actions/workflows/ci.yml/runs?created=%3E%3D${since}&per_page=100&page=${page}`);
    runs.push(...body.workflow_runs);
    if (body.workflow_runs.length < 100) break;
  }
  const attempts = [];
  for (const run of runs) {
    if (run.status !== "completed") continue;
    for (let n = 1; n <= (run.run_attempt ?? 1); n += 1) {
      const body = await api.json(`/repos/${repo}/actions/runs/${run.id}/attempts/${n}/jobs?per_page=100`);
      attempts.push({ key: keyOf(run), runId: run.id, attempt: n, url: `${run.html_url}/attempts/${n}`, outcome: outcomeOf(body.jobs ?? []) });
    }
  }
  return { runs, attempts, unkeyed: runs.filter((r) => keyOf(r).endsWith("@?")).length };
}

export async function attribute(api, repo, events) {
  const out = [];
  for (const ev of events) {
    for (const job of ev.outcome.failedJobs) {
      if (SHARD_JOB.test(job.name)) {
        const tests = parseFailLines(await api.text(`/repos/${repo}/actions/jobs/${job.id}/logs`));
        if (tests.length) for (const t of tests) out.push({ culprit: t, key: ev.key, url: ev.url });
        else out.push({ culprit: `${job.name} / ${job.step} (log gone or no FAIL line)`, key: ev.key, url: ev.url });
      } else {
        out.push({ culprit: `${job.name} / ${job.step}`, key: ev.key, url: ev.url });
      }
    }
  }
  return out;
}

function arg(argv, name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
}

export async function main(argv) {
  const days = Number(arg(argv, "--days", "3"));
  const repo = arg(argv, "--repo", process.env.GITHUB_REPOSITORY);
  if (!repo || !Number.isFinite(days) || days <= 0) {
    console.error("usage: GITHUB_TOKEN=... node scripts/flake-report.mjs [--days 3] [--repo owner/name] [--json]");
    return 2;
  }
  const api = client(process.env.GITHUB_TOKEN || process.env.GH_TOKEN);
  const { runs, attempts, unkeyed } = await gather(api, repo, days);
  const events = findFlakeEvents(attempts);
  const ranked = rank(await attribute(api, repo, events));
  if (argv.includes("--json")) {
    console.log(JSON.stringify({ days, runs: runs.length, attempts: attempts.filter((a) => a.outcome).length, events: events.length, unkeyed, ranked }, null, 2));
  } else {
    const md = markdown(ranked, { days, runs: runs.length, attempts: attempts.filter((a) => a.outcome).length, events: events.length, unkeyed });
    console.log(md);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`::error::flake-report: ${err.message}`);
      process.exit(1);
    },
  );
}
