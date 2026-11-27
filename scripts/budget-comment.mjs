#!/usr/bin/env node
/**
 * Tell a pull request what it costs against the three client budgets, before a
 * ceiling fails it.
 *
 * WHY THIS EXISTS. On 26 Nov 2026 the dist total sat at 7984 to 7996 KB of
 * 8000 most of the day, and verify went red on several pull requests for the
 * budget alone. A lane learned its cost only from the red. This posts ONE
 * comment per pull request, edited on every run, with main JS, first-page JS
 * and the dist total: this pull request's number, main's, the change, the
 * ceiling and the headroom.
 *
 * The numbers come from ci.yml's `dist-budget` artifact, written by its verify
 * job on every run: the pull request's own, and the newest from a green push
 * run on main as the baseline. The pull_request run builds the branch MERGED
 * with main, so "change" is this pull request's own cost plus whatever main
 * gained since the baseline run; the comment names both shas.
 *
 *   node scripts/budget-comment.mjs --pr budget.json [--main main.json]
 *        [--sha <run's head sha>] [--post --pr-number N]
 *
 * Without --post it prints the comment. With --post it needs GITHUB_TOKEN and
 * GITHUB_REPOSITORY and creates or edits the one comment marked
 * `<!-- dist-budget -->` on pull request N.
 *
 * THE ARTIFACT IS UNTRUSTED: a pull request's own code wrote it. So the pull
 * request to comment on and the sha come from the workflow_run event (the
 * flags), never from the file, and every number is read through Number(), so
 * a hostile file can put nothing but digits into the comment and cannot aim
 * it at another pull request.
 * Self-test: node scripts/budget-comment.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MARKER = "<!-- dist-budget -->";
/** The local safety margin check-dist-budget.mjs applies below the total's ceiling. */
export const SAFETY_MARGIN_KB = 12;

const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : "0");

const num = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : NaN);
const hex = (v) => (/^[0-9a-f]{7,40}$/.test(String(v ?? "")) ? String(v) : null);

/** Only the numbers and shas render needs, coerced, whatever else the file holds. */
export function sanitize(raw) {
  const keys = ["duKb", "maxTotalDistKb", "mainJsKb", "maxMainJsKb", "bootJsKb", "maxBootJsKb"];
  const out = Object.fromEntries(keys.map((k) => [k, num(raw?.[k])]));
  out.sha = hex(raw?.sha);
  out.baseSha = hex(raw?.baseSha);
  return out;
}

export function render(pr, main) {
  const rows = [
    ["Main JS", "mainJsKb", "maxMainJsKb", "real bytes, one file"],
    ["First-page JS", "bootJsKb", "maxBootJsKb", "real bytes, what index.html loads"],
    ["Total dist/public", "duKb", "maxTotalDistKb", "du -sk on the runner, the gate"],
  ];
  const lines = [
    MARKER,
    "**Client budgets for this pull request** (measured by ci.yml's verify job on this run)",
    "",
    "| | This PR | main | Change | Ceiling | Headroom |",
    "|---|---|---|---|---|---|",
  ];
  const warnings = [];
  for (const [label, key, maxKey, how] of rows) {
    const mine = pr[key];
    const base = Number.isFinite(main?.[key]) ? main[key] : undefined;
    const ceiling = pr[maxKey];
    const headroom = ceiling - mine;
    const change = typeof base === "number" ? `${signed(mine - base)} KB` : "n/a";
    const flag = headroom < 0 ? " :x:" : key === "duKb" && headroom < SAFETY_MARGIN_KB ? " :warning:" : "";
    lines.push(`| ${label} <sub>${how}</sub> | ${mine} KB | ${typeof base === "number" ? `${base} KB` : "n/a"} | ${change} | ${ceiling} KB | ${headroom} KB${flag} |`);
    if (headroom < 0) warnings.push(`**${label} is over its ceiling by ${-headroom} KB.** verify fails on it.`);
    else if (key === "duKb" && headroom < SAFETY_MARGIN_KB) {
      warnings.push(`**The total is inside the ${SAFETY_MARGIN_KB} KB safety margin.** du has read 8 KB above the model on a near-identical tree, so the next run can tip it over. Merge sub-4 KB chunks into their parents, or move art to the uploads volume.`);
    }
  }
  lines.push("");
  if (warnings.length) lines.push(...warnings, "");
  const mainLine = main?.sha ? `main's baseline is the green push run at \`${main.sha.slice(0, 7)}\`` : "no baseline from main yet (main's push runs start keeping one when this lands)";
  lines.push(
    `This run built \`${(pr.sha ?? "unknown").slice(0, 7)}\`, the branch merged with main${pr.baseSha ? ` at \`${pr.baseSha.slice(0, 7)}\`` : ""}; ${mainLine}. If main moved between the two, part of the change is main's.`,
    "Splitting a chunk lowers main JS and RAISES the block-charged total; merging small chunks lowers it. `node scripts/check-dist-budget.mjs` shows both on your own build.",
  );
  return lines.join("\n");
}

async function post(body, prNumber) {
  const repo = process.env.GITHUB_REPOSITORY;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "budget-comment",
  };
  const base = `https://api.github.com/repos/${repo}`;
  const list = await fetch(`${base}/issues/${prNumber}/comments?per_page=100`, { headers });
  if (!list.ok) throw new Error(`listing comments: ${list.status}`);
  const mine = (await list.json()).find((c) => (c.body ?? "").startsWith(MARKER));
  const r = mine
    ? await fetch(`${base}/issues/comments/${mine.id}`, { method: "PATCH", headers, body: JSON.stringify({ body }) })
    : await fetch(`${base}/issues/${prNumber}/comments`, { method: "POST", headers, body: JSON.stringify({ body }) });
  if (!r.ok) throw new Error(`${mine ? "editing" : "posting"} the comment: ${r.status}`);
  return mine ? "edited" : "posted";
}

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export async function main(argv) {
  const prFile = arg(argv, "--pr");
  const mainFile = arg(argv, "--main");
  if (!prFile) {
    console.error("usage: node scripts/budget-comment.mjs --pr budget.json [--main main.json] [--post]");
    return 2;
  }
  const pr = sanitize(JSON.parse(fs.readFileSync(prFile, "utf8")));
  const shaFlag = hex(arg(argv, "--sha"));
  if (shaFlag) pr.sha = shaFlag;
  const main = mainFile && fs.existsSync(mainFile) ? sanitize(JSON.parse(fs.readFileSync(mainFile, "utf8"))) : null;
  if (["duKb", "maxTotalDistKb", "mainJsKb", "maxMainJsKb", "bootJsKb", "maxBootJsKb"].some((k) => !Number.isFinite(pr[k]))) {
    console.error("::error::budget-comment: the budget file is missing a number; nothing posted.");
    return 1;
  }
  const body = render(pr, main);
  if (!argv.includes("--post")) {
    console.log(body);
    return 0;
  }
  const prNumber = num(arg(argv, "--pr-number"));
  if (!(prNumber > 0)) {
    console.log("No pull request number from the event (a push run, or a fork); nothing to post.");
    return 0;
  }
  console.log(`${await post(body, prNumber)} the budget comment on #${prNumber}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`::error::budget-comment: ${err.message}`);
      process.exit(1);
    },
  );
}
