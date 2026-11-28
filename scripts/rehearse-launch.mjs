/**
 * THE LAUNCH REHEARSAL: a whole launch, walked on a throwaway village.
 *
 * Three founder accounts take a village from set up to launched through the
 * real routes of a freshly booted build, on a scratch database, and every step
 * is checked and written down. It is the launch a village is about to hold,
 * run where nothing can be hurt, so the people holding the real one have read
 * what each click does.
 *
 *   pnpm build
 *   node --import tsx scripts/rehearse-launch.mjs
 *
 * WHAT IT WALKS, in order:
 *
 *   1. A founder sets the village up and clears the journey to launch.
 *   2. Two more accounts are given the founder role. A fourth stays a member.
 *   3. The calendar is written the way the first village's is: a founding
 *      season with no end date, and the next season queued for a later day.
 *   4. By default the village is then put in the first village's state: it is
 *      ALREADY ISSUING and has never held its vote (what migration 0112 wrote).
 *      Its vote keeps the name Start the Game and never restarts issuance: the
 *      day it carries is the Game's birthday. `--first` skips this and
 *      rehearses a first launch, where the vote starts issuance.
 *   5. The list of what the carry will change is read, before the vote.
 *   6. A founder opens the vote and names themselves for the steward role.
 *   7. The vote: one yes, then A NO THAT HOLDS IT, then a second yes that
 *      carries nothing while the no stands. The no is WITHDRAWN by changing
 *      the answer, and that third yes carries the vote in the same request.
 *   8. What the launch did: the launch on the record, the day issuance began
 *      unmoved (ratifying), the season turned, the steward seated for the
 *      whole new season, Moon 1, the pay period unmoved, and one door tried
 *      from both sides.
 *
 * Options:
 *   --first          rehearse a first launch instead of a village already issuing
 *   --out <file>     where the transcript is written (default .rehearsal/launch/<stamp>.md)
 *   --keep           leave the scratch schema in place afterwards, for looking around
 *
 * Environment:
 *   REHEARSAL_DB_SERVER   mysql://user:pass@127.0.0.1:3306 (default: the server TEST_DATABASE_URL in .env names)
 *   REHEARSAL_SCHEMA      scratch schema, must start with village_rehearsal (default village_rehearsal_launch)
 *   REHEARSAL_PORT        the server's port (default 5873)
 *
 * IT NEVER TOUCHES A REAL VILLAGE. The base URL must be loopback and the
 * database a loopback scratch schema with the rehearsal prefix, by the same two
 * refusals the nightly rehearsal uses (scripts/rehearsal/guard.mjs). The schema
 * is dropped and recreated at the start. No mail is sent and no AI is called.
 *
 * Exit code: 0 when every check held, 1 when any did not, 2 when the rehearsal
 * could not start.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";
import { assertLocalBase, assertScratchDb, SCRATCH_PREFIX } from "./rehearsal/guard.mjs";
import { clearTheJourney, makeFounders } from "../server/db/launchGovernanceFixture.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const FIRST = flag("first");
const PORT = Number(process.env.REHEARSAL_PORT || 5873);
const BASE = `http://localhost:${PORT}`;
const SCHEMA = process.env.REHEARSAL_SCHEMA || `${SCRATCH_PREFIX}_launch`;
const ADMIN_PASSWORD = "rehearsal-admin-not-real"; // module-review-ok: a throwaway password for the rehearsal's own scratch schema, never a real credential
const PASSWORD = "RehearsalLaunch123!"; // module-review-ok: the made-up accounts' password on the scratch schema
/** The day the rehearsed village began issuing, long before any vote. It must come out of the vote as it went in. */
const ISSUING_SINCE = "2026-03-14T09:26:53Z";

/** The database server, without a schema: the one named, or the one the test suites already use. */
function dbServer() {
  if (process.env.REHEARSAL_DB_SERVER) return process.env.REHEARSAL_DB_SERVER.replace(/\/+$/, "");
  const envFile = path.join(ROOT, ".env");
  const m = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8").match(/^TEST_DATABASE_URL=(.+)$/m) : null;
  if (!m) throw new Error("no REHEARSAL_DB_SERVER and no TEST_DATABASE_URL in .env: name the local MySQL to rehearse on");
  const u = new URL(m[1].trim());
  return `mysql://${u.username}:${u.password}@${u.host}`;
}

// ── The transcript ──────────────────────────────────────────────────────────

const lines = [];
let failed = 0;
let checks = 0;
const say = (text = "") => {
  lines.push(text);
  console.log(text);
};
const heading = (text) => say(`\n## ${text}\n`);
/** One checked fact. A failure is recorded and the walk carries on, so one run shows everything that is wrong. */
function check(label, ok, detail = "") {
  checks += 1;
  if (!ok) failed += 1;
  say(`- ${ok ? "PASS" : "**FAIL**"}  ${label}${detail ? `  \n  ${detail}` : ""}`);
  return ok;
}

// ── Talking to the server ───────────────────────────────────────────────────

let founderToken = "";
async function call(method, route, opts = {}) {
  const token = opts.token === undefined ? founderToken : opts.token;
  const res = await fetch(BASE + route, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

/** A fresh village is joined by invitation, so the founder invites each person and they register with it. */
async function register(name, slug) {
  const email = `${slug}@example.test`;
  const inv = await call("POST", "/api/invites", { body: { email, name } });
  const invite = inv.json?.token ?? new URLSearchParams(String(inv.json?.path ?? "").split("?")[1] ?? "").get("invite");
  if (!invite) throw new Error(`${name} could not be invited: ${inv.status} ${JSON.stringify(inv.json)}`);
  const r = await call("POST", "/api/auth/register", { token: "", body: { name, email, password: PASSWORD, paths: ["resident"], invite } });
  if (r.status !== 200) throw new Error(`${name} could not register: ${r.status} ${JSON.stringify(r.json)}`);
  return { token: String(r.json?.token ?? ""), id: String(r.json?.user?.id ?? ""), name };
}

async function waitForHealth(child, logFile) {
  const until = Date.now() + 240_000;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error(`the server exited with ${child.exitCode} before it answered; read ${logFile}`);
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`the server did not answer /health within four minutes; read ${logFile}`);
}

const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// ── The walk ────────────────────────────────────────────────────────────────

async function walk(pool) {
  const vote = (ballotId, who, body) => call("POST", `/api/governance/ballots/${ballotId}/vote`, { token: who.token, body });
  const facts = async () => (await call("GET", "/api/admin/launch")).json;
  const row = async (sql, params = []) => (await pool.query(sql, params))[0];
  const doc = async (key) => {
    const rows = await row("SELECT value FROM app_config WHERE config_key = ?", [key]);
    return rows[0] ? (typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value) : null;
  };

  heading("1. A founder sets the village up");
  const boot = await call("POST", "/api/admin/bootstrap", { token: "", body: { password: ADMIN_PASSWORD, email: "mara@example.test", name: "Mara Fenn" } });
  const claim = decodeURIComponent(String(boot.json?.claimUrl ?? "").match(/token=([^&]+)/)?.[1] ?? "");
  const setPw = await call("POST", "/api/auth/set-password", { token: "", body: { token: claim, password: PASSWORD } });
  founderToken = String(setPw.json?.token ?? "");
  const mara = { token: founderToken, id: String(setPw.json?.user?.id ?? ""), name: "Mara Fenn" };
  check("the first founder holds a session", !!founderToken);
  await clearTheJourney(call, { name: "Wealden" });
  check("the journey to launch reads clear", true, "governance on, the village named, the exit policy and closing written, the backup drill and the clock confirmed, the issuance cap answered, the purpose written, every canvas block read");

  heading("2. Three founders and a member");
  say("The founder invites three people, and each joins with their invitation.\n");
  const wren = await register("Wren Ashby", "wren");
  const ida = await register("Ida Kestrel", "ida");
  const tam = await register("Tam Reyes", "tam");
  for (const p of [mara, wren, ida, tam]) {
    const r = await call("PUT", `/api/admin/players/${p.id}/stage`, { body: { stageId: "member" } });
    if (r.status !== 200) throw new Error(`${p.name} could not be made a member: ${r.status}`);
  }
  await makeFounders(call, [wren.id, ida.id]);
  let f = await facts();
  check("three founding members are on the launch roll", f?.vote?.onTheRoll === 3, `on the roll: ${(f?.vote?.founders ?? []).map((x) => x.name).join(", ")}`);
  check("Tam, a member, is not asked on this vote", !(f?.vote?.founders ?? []).some((x) => x.id === tam.id));
  check("the roll is enough to open the vote", f?.vote?.tooFew === null, String(f?.vote?.tooFew ?? ""));

  heading("3. The calendar: a founding season with no end, and the next one queued");
  const season = (await call("GET", "/api/season", { token: null })).json;
  const today = String(season?.today ?? "");
  const admin = (await call("GET", "/api/admin/seasons")).json;
  const rootingWasToStart = addDays(today, 40);
  const rootingEnd = addDays(today, 130);
  const saved = await call("PUT", "/api/admin/seasons", {
    body: {
      cadence: admin.cadence,
      timezone: admin.timezone,
      seasons: [
        { id: "foundations", name: "Season of Foundations", startsOn: addDays(today, -60), endsOn: "" },
        { id: "rooting", name: "Season of Rooting", startsOn: rootingWasToStart, endsOn: rootingEnd },
      ],
    },
  });
  check("the calendar saved", saved.status === 200, String(saved.json?.error ?? ""));
  check("Season of Foundations is running, with no end date", saved.json?.current?.id === "foundations" && saved.json?.openEnded === true);
  check(`Season of Rooting is queued for ${rootingWasToStart}`, saved.json?.upcoming?.id === "rooting");

  if (!FIRST) {
    heading("4. The village is already issuing, and has never held its vote");
    say("This is the first village's own state. The row below is what migration 0112 wrote for every village that was issuing before the launch vote existed. It is the one step here that no route performs, so it is written straight to the scratch schema.\n");
    await pool.query("INSERT INTO app_config (config_key, value) VALUES ('game-start', ?)", [
      JSON.stringify({ startedAt: ISSUING_SINCE, ballotId: null, startedBy: null, note: "This village was already issuing tokens before the launch vote existed." }),
    ]);
    f = await facts();
    check("the Game reads as started, with no ballot behind it", f?.gameStart?.started === true && f?.gameStart?.ballotId === null);
    check("no launch is on the record", f?.launchedAt === null && f?.launchedByBallotId === null);
    check("it may hold its Start the Game vote, once, and that vote will not restart issuance", f?.vote?.ratifying === true, `issuing since ${String(f?.vote?.issuingSince ?? "").slice(0, 10)}`);
    const mint = await call("POST", "/api/admin/tokens/credits/mint", { body: { toUserId: tam.id, amount: 5, reason: "Rehearsal: this village issues before its vote." } });
    check("it issues today, with no vote: a hand mint lands", mint.status === 200, String(mint.json?.error ?? ""));
  } else {
    heading("4. A first launch: nothing can be issued yet");
    const mint = await call("POST", "/api/admin/tokens/credits/mint", { body: { toUserId: tam.id, amount: 5, reason: "Rehearsal: before the vote." } });
    check("a hand mint is refused before the vote", mint.status !== 200, String(mint.json?.error ?? "").slice(0, 160));
  }
  const cycleBefore = (await call("GET", "/api/game/cycle", { token: null })).json;
  const gameStartBefore = JSON.stringify(await doc("game-start"));

  heading("5. What the carry will change, read before the vote");
  const before = (await call("GET", "/api/admin/launch/carry-changes")).json;
  say(`> ${before?.summary}\n`);
  for (const c of before?.changes ?? []) {
    say(`- **${c.title}** (${c.standing}). Today: ${c.today} After: ${c.after}${c.loses?.length ? ` Would lose it: ${c.loses.map((p) => p.name).join(", ")}.` : ""}`);
  }
  say("");
  for (const a of before?.attention ?? []) say(`- To look at: ${a.text}`);
  say("");
  check("the list names this vote correctly", before?.kind === (FIRST ? "first" : "ratifying"));
  check("the list says the season will turn to Season of Rooting", String((before?.changes ?? []).find((c) => c.id === "season")?.after ?? "").startsWith("Season of Rooting begins that day"));
  check("the list names the admins who would lose the module switch", ((before?.changes ?? []).find((c) => c.id === "module-switch")?.loses ?? []).length === 3);

  heading("6. A founder opens the vote, and names who carries the steward role");
  const asked = await call("POST", "/api/admin/launch/propose", { body: { slate: [mara.id] } });
  check("the vote opened", asked.status === 200, String(asked.json?.error ?? ""));
  const ballots = await row("SELECT id, title, doc_markdown, quorum_pct, unity_pct, electorate_count FROM ballots WHERE subject_type = 'village_launch' AND status = 'open'");
  const ballot = ballots[0];
  const ballotId = String(ballot?.id ?? "");
  say(`\nThe ballot is titled "${ballot?.title}". It is frozen to ${ballot?.electorate_count} people.\n`);
  const text = String(ballot?.doc_markdown ?? "");
  check("the vote keeps its name, Start the Game, whichever village holds it", String(ballot?.title) === "Start the Game in Wealden" && text.includes("# Start the Game") && !/ratif/i.test(text));
  check(
    FIRST ? "the document says issuance turns on" : "the document says issuance was already running and does not restart",
    FIRST ? text.includes("Token issuance turns on.") : text.includes("## What was already running") && text.includes("It does not restart, and the day it began stays"),
  );
  check("the document carries no sentence of the other kind", FIRST ? !text.includes("What was already running") : !text.includes("Token issuance turns on"));
  if (!FIRST) check("the document says the day it carries is the Game's birthday", text.includes("the day it carries is the Game's birthday"));
  check("the document says which season the carry begins", text.includes("Season of Rooting begins that day, taking over from Season of Foundations."));
  check("the document says how long a steward holds the role", text.includes(`for the whole of Season of Rooting, until ${rootingEnd}.`));
  check("the document states the rule", text.includes("It carries the moment 3 of them have said yes, unless one of them has said no."));
  check("Tam, a member, cannot answer it", (await vote(ballotId, tam, { choice: "yes" })).status !== 200);
  // Whoever runs pay must be on the steward list (Rye, 2026-11-28). The list names one founder, so the read warns about the other two.
  const withList = (await call("GET", "/api/admin/launch/carry-changes")).json;
  const leftOut = (withList?.attention ?? []).find((a) => a.id === "pay-left-out");
  check("the read warns that the steward list leaves out two people who set pay today", (leftOut?.accounts ?? []).length === 2, String(leftOut?.text ?? ""));

  heading("7. The vote: a yes, a no that holds it, and the no withdrawn");
  const first = await vote(ballotId, mara, { choice: "yes", standsForSteward: true });
  check("Mara says yes and accepts the steward role: one yes carries nothing", first.status === 200 && first.json?.carried === false);
  const no = await vote(ballotId, wren, { choice: "no" });
  check("Wren says no", no.status === 200 && no.json?.carried === false);
  const second = await vote(ballotId, ida, { choice: "yes" });
  check("Ida says yes: two yeses and a no carry nothing", second.status === 200 && second.json?.carried === false);
  f = await facts();
  check("THE NO HOLDS IT: no launch is on the record", f?.launchedAt === null);
  check("the season has not turned", (await call("GET", "/api/season", { token: null })).json?.current?.id === "foundations");
  const closeEarly = await call("POST", `/api/governance/ballots/${ballotId}/close`, { body: { outcomeNote: "Rehearsal: trying to close it by hand." } });
  check("nobody can close it by hand while the no stands", closeEarly.status !== 200 || closeEarly.json?.outcome !== "passed", String(closeEarly.json?.error ?? "").slice(0, 200));
  const withdrawn = await vote(ballotId, wren, { choice: "yes" });
  check("WREN WITHDRAWS THE NO by changing the answer, and that third yes carries it in the same request", withdrawn.status === 200 && withdrawn.json?.carried === true, `ballot status: ${withdrawn.json?.ballot?.status}`);
  const late = await vote(ballotId, ida, { choice: "no" });
  check("once it has carried, no answer moves", late.status !== 200);

  heading("8. What the launch did");
  // The closer's audit lines are written without being waited for, so they are waited for here.
  let audit = [];
  const until = Date.now() + 20_000;
  while (Date.now() < until) {
    audit = (await row("SELECT text FROM health_events WHERE kind = 'audit' AND text LIKE 'launch:%'")).map((r) => String(r.text));
    if (audit.some((l) => l.startsWith(FIRST ? "launch:started-by-ballot:" : "launch:ratified-by-ballot:"))) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  f = await facts();
  check("the launch is on the record, with the ballot that did it", !!f?.launchedAt && f?.launchedByBallotId === ballotId, `launched at ${f?.launchedAt}`);
  if (FIRST) {
    check("the Game started by this ballot", f?.gameStart?.started === true && f?.gameStart?.ballotId === ballotId);
  } else {
    check("THE DAY ISSUANCE BEGAN HAS NOT MOVED: game-start is byte for byte what it was", JSON.stringify(await doc("game-start")) === gameStartBefore, `still ${ISSUING_SINCE}`);
  }
  const after = (await call("GET", "/api/season", { token: null })).json;
  check(`THE SEASON TURNED: Season of Rooting began today, ${today}`, after?.current?.id === "rooting" && after?.current?.startsOn === today);
  const stored = (await doc("season"))?.seasons ?? [];
  check("that is the one date that moved: the founding season still has no end date", stored[0]?.id === "foundations" && stored[0]?.endsOn === "" && stored[1]?.endsOn === rootingEnd);
  const stewards = await row("SELECT user_id, season_id, DATE_FORMAT(term_ends_at, '%Y-%m-%dT%H:%i:%sZ') AS ends, granted_by FROM role_holders WHERE role_id = 'steward'");
  check("Mara holds the steward role, by this ballot, for the season that began today", stewards.length === 1 && String(stewards[0].user_id) === mara.id && String(stewards[0].granted_by) === ballotId && String(stewards[0].season_id) === "rooting");
  const told = await row("SELECT body FROM notifications WHERE user_id = ? AND type = 'role_appointed'", [mara.id]);
  check(`she was told the role ends on ${rootingEnd}, with the season`, told.some((n) => String(n.body).includes(`The role ends on ${rootingEnd}, with the season`)));
  const cycleAfter = (await call("GET", "/api/game/cycle", { token: null })).json;
  check("THE PAY PERIOD DID NOT MOVE: the same id and the same bounds", cycleAfter?.id === cycleBefore?.id && cycleAfter?.startsAt === cycleBefore?.startsAt && cycleAfter?.endsAt === cycleBefore?.endsAt, `${cycleAfter?.id}`);
  check("Moon 1 is that pay period: the launch fell inside it", new Date(f?.launchedAt) >= new Date(cycleAfter?.startsAt) && new Date(f?.launchedAt) < new Date(cycleAfter?.endsAt));
  check("the season turn is on the admin record, with no role moved", audit.some((l) => l === `launch:season-turned:foundations->rooting:${today}:seats-moved:0`), audit.filter((l) => l.startsWith("launch:season")).join(" | "));
  check("the token.mint hand-over ran", audit.some((l) => l.startsWith("launch:token-mint:")), audit.filter((l) => l.startsWith("launch:token-mint")).join(" | "));
  const pulse = (await row("SELECT text FROM health_events WHERE kind IN ('governance','season')")).map((r) => String(r.text));
  check("the village was told on its pulse", pulse.some((t) => t.includes("The village started its Game: its launch vote carried.")) && pulse.includes("The season has turned: Season of Rooting"));
  const carried = await row("SELECT body FROM notifications WHERE dedupe_key = ?", [`bal:${ballotId}:launch-carried`]);
  if (!FIRST) {
    check("no line says issuance opens today", !pulse.some((t) => /issuance (is open|opens|turns on|starts)/i.test(t)));
    check("whoever opened it was told: The Game has begun. Happy birthday, Wealden.", carried.some((n) => String(n.body).startsWith("The Game has begun. Happy birthday, Wealden. Token issuance was already open, since 2026-03-14")), String(carried[0]?.body ?? ""));
  }

  say("\nOne door, tried from both sides, against what the list said before the vote:\n");
  const wrenTries = await call("PUT", "/api/admin/modules/events/lifecycle", { token: wren.token, body: { lifecycle: "members", examples: false } });
  check("Wren, a founder who is not a steward, can no longer turn a module on", wrenTries.status === 403 && wrenTries.json?.proposeInstead === true, String(wrenTries.json?.error ?? "").slice(0, 200));
  const maraTries = await call("PUT", "/api/admin/modules/events/lifecycle", { body: { lifecycle: "members", examples: false } });
  check("Mara, seated as a steward, turns the same module on", maraTries.status === 200, String(maraTries.json?.error ?? ""));
  const done = (await call("GET", "/api/admin/launch/carry-changes")).json;
  check("the list now says the launch has carried, with nothing left to change", done?.kind === "carried" && (done?.changes ?? []).length === 0, String(done?.summary ?? ""));
  const again = await call("POST", "/api/admin/launch/propose", { body: { slate: [mara.id] } });
  check("the vote is held once: a second one is refused", again.status === 409, String(again.json?.error ?? "").slice(0, 160));
}

// ── Boot, walk, tear down ───────────────────────────────────────────────────

async function main() {
  const server = dbServer();
  assertLocalBase(BASE);
  assertScratchDb(server, SCHEMA);
  const dist = path.join(ROOT, "dist", "index.js");
  if (!fs.existsSync(dist)) throw new Error("no dist/index.js: run pnpm build first");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = path.resolve(opt("out", path.join(ROOT, ".rehearsal", "launch", `${stamp}.md`)));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "village-rehearse-launch-"));
  const logFile = path.join(dataDir, "server.log");

  say(`# Launch rehearsal, ${FIRST ? "a first launch" : "the Start the Game vote of a village already issuing"}`);
  say(`\nRun ${new Date().toISOString()} on a throwaway village: schema \`${SCHEMA}\` on this machine, server at ${BASE}. Nothing here reaches a real village.\n`);

  const admin = await mysql.createConnection(`${server}/mysql`);
  await admin.query(`DROP DATABASE IF EXISTS \`${SCHEMA}\``);
  await admin.query(`CREATE DATABASE \`${SCHEMA}\``);
  await admin.end();

  const serverLog = fs.createWriteStream(logFile);
  const child = spawn(process.execPath, [dist], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      SCHEDULER_ENABLED: "0",
      DATA_DIR: dataDir,
      DATABASE_URL: `${server}/${SCHEMA}`,
      ADMIN_PASSWORD,
      AUTH_TOKEN_SECRET: "rehearse-launch-token-secret-not-a-real-one-0000", // module-review-ok: a fixture signing secret for a throwaway server on a scratch schema (a fresh village refuses one under 32 characters)
      FRONTEND_URL: BASE,
      VILLAGE_SECRETS_KEY: "5b".repeat(32), // module-review-ok: fixture sealing key for the scratch schema
      RESEND_API_KEY: "",
      ANTHROPIC_API_KEY: "",
    },
  });
  child.stdout.pipe(serverLog);
  child.stderr.pipe(serverLog);

  let pool;
  try {
    await waitForHealth(child, logFile);
    pool = mysql.createPool(`${server}/${SCHEMA}`);
    await walk(pool);
  } finally {
    child.kill();
    await pool?.end().catch(() => {});
    if (!flag("keep")) {
      const drop = await mysql.createConnection(`${server}/mysql`);
      await drop.query(`DROP DATABASE IF EXISTS \`${SCHEMA}\``).catch(() => {});
      await drop.end();
    }
  }

  heading("Result");
  say(failed === 0 ? `Every check held: ${checks} of ${checks}.` : `${failed} of ${checks} checks did not hold. Read each FAIL above.`);
  fs.writeFileSync(out, `${lines.join("\n")}\n`);
  console.log(`\n[rehearse-launch] transcript written to ${out}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("[rehearse-launch] could not run:", e?.message ?? e);
  process.exit(2);
});
