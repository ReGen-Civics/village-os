/**
 * The main-red alarm's own proof (scripts/main-red.mjs), on API-shaped fixtures.
 * It must:
 *   - name the failing test files, independent of the shard they landed in;
 *   - open ONE issue for a red, update it within an episode, reopen it for a new one;
 *   - comment only on a pull request whose failures are ALL main's, and edit
 *     that comment, never re-post it, within an episode;
 *   - leave a pull request red on its own account alone;
 *   - close the issue and update the comments when main is green;
 *   - do nothing on a green main with no open issue, or on a cancelled run.
 *
 * Run: node scripts/main-red.test.mjs
 */
import assert from "node:assert";
import { causeLine, decide, episodeOf, isSubset, parseRanOnce, prComment, prMarker, signature } from "./main-red.mjs";

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const job = (id, name, conclusion, step) => ({ id, name, conclusion, steps: step ? [{ name: step, conclusion: "failure" }] : [] });
const RED = "a187ce034ca1f518fcf74f6b4eba6df888cf4055";
const RED2 = "7366a88bf02eeb5537765b27887855e03e6158e6";
const GREEN = "e7ff8961111111111111111111111111111111111";
const run = (sha, conclusion) => ({ head_sha: sha, conclusion, html_url: `https://x/runs/${sha.slice(0, 4)}`, created_at: "2026-11-26T17:40:48Z", head_commit: { message: "Regenerate the generated docs and catalogs\n\nbody" } });

check("tests-ran-once's lines name the failing files", () => {
  const log = "2026-11-26T03:00:12.6869431Z check-test-shards: 1 file(s) did not run exactly once and pass:\n2026-11-26T03:00:12.6870205Z   server/routes/roleStartAgreements.test.ts: failed in shard 3\n";
  assert.deepStrictEqual(parseRanOnce(log), ["server/routes/roleStartAgreements.test.ts"]);
});

check("the signature names test files whatever the shard, and other jobs by their failed step", () => {
  const jobs = [
    job(1, "verify", "failure", "Translation catalogs"),
    job(2, "test (3/6)", "failure", "Test"),
    job(3, "test (5/6)", "failure", "Build"),
    job(4, "tests-ran-once", "failure", "Every test file ran exactly once and passed"),
    job(5, "browser-smoke", "success"),
  ];
  const logs = {
    2: "2026-11-26T00:00:00Z  FAIL  client/src/lib/guideNameWords.test.tsx > the label > in Spanish",
    4: "  client/src/lib/guideNameWords.test.tsx: failed in shard 3\n",
  };
  assert.deepStrictEqual([...signature(jobs, logs)].sort(), [
    "test client/src/lib/guideNameWords.test.tsx",
    "test shard / Build",
    "verify / Translation catalogs",
  ]);
});

check("subset means every failure of the pull request is one main has, and an empty set is not a match", () => {
  const main = new Set(["verify / Translation catalogs", "test a.test.ts"]);
  assert.ok(isSubset(new Set(["test a.test.ts"]), main));
  assert.ok(!isSubset(new Set(["test a.test.ts", "test b.test.ts"]), main));
  assert.ok(!isSubset(new Set(), main));
});

const mainSig = new Set(["verify / Translation catalogs"]);

check("a first red opens ONE issue and comments only on pull requests red the same way", () => {
  const actions = decide({
    run: run(RED, "failure"),
    mainSig,
    issue: null,
    prs: [
      { number: 11, sig: new Set(["verify / Translation catalogs"]), comment: null },
      { number: 12, sig: new Set(["verify / Translation catalogs", "test own.test.ts"]), comment: null },
      { number: 13, sig: new Set(), comment: null },
    ],
  });
  assert.deepStrictEqual(actions.map((a) => [a.kind, a.pr ?? a.number ?? null]), [["issue-create", null], ["pr-comment-create", 11]]);
  assert.strictEqual(episodeOf(actions[0].body), RED);
  assert.match(actions[0].body, /\*\*Cause:\*\* verify \/ Translation catalogs/);
  assert.match(actions[1].body, /Tracked in #NEW/);
});

check("within an episode the issue is updated and the comment edited, never re-posted", () => {
  const first = decide({ run: run(RED, "failure"), mainSig, issue: null, prs: [] })[0].body;
  const existing = prComment({ episode: RED, sha: RED, cause: causeLine(mainSig), issueNumber: 40 });
  const actions = decide({
    run: run(RED2, "failure"),
    mainSig: new Set(["verify / Translation catalogs", "test b.test.ts"]),
    issue: { number: 40, state: "open", body: first },
    prs: [{ number: 11, sig: new Set(["verify / Translation catalogs"]), comment: { id: 900, body: existing } }],
  });
  assert.deepStrictEqual(actions.map((a) => a.kind), ["issue-update", "pr-comment-edit"]);
  assert.strictEqual(episodeOf(actions[0].body), RED, "the episode keeps its first red sha");
  assert.strictEqual(actions[1].id, 900);
  assert.ok(actions[1].body.includes(prMarker(RED)));
});

check("the same red reported twice writes nothing the second time", () => {
  const body = decide({ run: run(RED, "failure"), mainSig, issue: null, prs: [] })[0].body;
  const comment = prComment({ episode: RED, sha: RED, cause: causeLine(mainSig), issueNumber: 40 });
  const actions = decide({ run: run(RED, "failure"), mainSig, issue: { number: 40, state: "open", body }, prs: [{ number: 11, sig: mainSig, comment: { id: 900, body: comment } }] });
  assert.deepStrictEqual(actions, []);
});

check("a red after a green reopens the same issue as a new episode", () => {
  const actions = decide({ run: run(RED2, "failure"), mainSig, issue: { number: 40, state: "closed", body: "<!-- main-red-episode: aaaaaaa -->" }, prs: [] });
  assert.deepStrictEqual(actions.map((a) => a.kind), ["issue-reopen"]);
  assert.strictEqual(episodeOf(actions[0].body), RED2);
});

check("green closes the issue and updates this episode's comments, once", () => {
  const issue = { number: 40, state: "open", body: `<!-- main-red-episode: ${RED} -->` };
  const comment = { id: 900, body: prComment({ episode: RED, sha: RED, cause: "x", issueNumber: 40 }) };
  const actions = decide({ run: run(GREEN, "success"), mainSig: new Set(), issue, prs: [{ number: 11, sig: new Set(), comment }] });
  assert.deepStrictEqual(actions.map((a) => a.kind), ["issue-comment", "issue-close", "pr-comment-edit"]);
  assert.match(actions[2].body, /main is green again at `e7ff896`/);
  const again = decide({ run: run(GREEN, "success"), mainSig: new Set(), issue: { ...issue, state: "closed" }, prs: [{ number: 11, sig: new Set(), comment: { id: 900, body: actions[2].body } }] });
  assert.deepStrictEqual(again, []);
});

check("a cancelled run and a green main with no issue write nothing", () => {
  assert.deepStrictEqual(decide({ run: run(RED, "cancelled"), mainSig, issue: null, prs: [] }), []);
  assert.deepStrictEqual(decide({ run: run(GREEN, "success"), mainSig: new Set(), issue: null, prs: [] }), []);
});

console.log(`main-red.test: ${passed}/9 checks passed`);
