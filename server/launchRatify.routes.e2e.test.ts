/**
 * THE RATIFYING LAUNCH VOTE, driven over HTTP against the built server.
 *
 * Rye, 27 Nov 2026 (the Admin Garden plan): the first village is "issuing on
 * purpose", and it holds "one ratifying launch vote that does not restart
 * issuance".
 *
 * The village here is in the first village's state: migration 0112 found it
 * issuing before the launch vote existed and recorded `game-start` with no
 * ballot behind it, and no launch was ever recorded. Until this change `POST
 * /api/admin/launch/propose` answered 409 for it, so it could never hold the
 * vote that seats its stewards and hands its powers over.
 *
 * The harm metric for this file is one sentence, and every clause of it is
 * driven against the built server:
 *
 *   A village that is already issuing may ask its launch vote once; the vote
 *   says in its own document that issuance does not restart; when it carries,
 *   the launch is on the record and the day issuance began has not moved by a
 *   second; and a village short of founders, which can make no more once it is
 *   issuing, gets there by its own highest vote.
 *
 * THE CASES RUN IN ORDER. One village walks the whole path. Run the whole file,
 * never a `-t` slice.
 *
 * Boots the BUILT `dist/index.js` against a throwaway schema, so run
 * `pnpm build` first or you are testing stale code. Skips loudly without
 * TEST_DATABASE_URL.
 */
import fs from "fs";
import os from "os";
import path from "path";
import mysql from "mysql2/promise";
import { spawn, type ChildProcess } from "child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testPool, provisionTestDb, testDbConfigured, type TestDb, waitForPortFree } from "./db/testDb";
import { waitForHealth } from "./db/e2eBoot";
import { clearTheJourney, makeFounders } from "./db/launchGovernanceFixture";
import { TIER_FLOORS } from "../shared/governanceEngine";

const DB_CONFIGURED = testDbConfigured();
if (!DB_CONFIGURED) {
  console.warn("[launchRatify.routes] TEST_DATABASE_URL not set - DB-backed tests SKIPPED.");
}

const DIST = path.resolve(process.cwd(), "dist/index.js");

/** This suite's port window. `scripts/check-e2e-ports.mjs` holds it apart from every other file's. */
const PORT = 12200 + (process.pid % 250);
const BASE = `http://localhost:${PORT}`;
const ADMIN = "launchratify-admin";
const PASSWORD = "LaunchRatifyTest123!";

/** The day this village began issuing, long before any vote. It must come out of the vote exactly as it went in. */
const ISSUING_SINCE = "2026-03-14T09:26:53Z";
const NOTE_0112 =
  "This village was already issuing tokens before the launch vote existed. Migration 0112 read that from the ledger and recorded the Game as started, with no ballot behind it.";

let child: ChildProcess | undefined;
let testDb: TestDb | undefined;
let dataDir = "";
let pool: mysql.Pool;
const logs: string[] = [];

let founderToken = "";
let founderId = "";
let wrenToken = "";
let wrenId = "";
let idaToken = "";
let idaId = "";
let tamToken = "";
let tamId = "";
let ratifyingBallot = "";

interface Answer { status: number; json: any }

async function call(
  method: string,
  route: string,
  opts: { body?: unknown; token?: string | null } = {},
): Promise<Answer> {
  const token = opts.token === undefined ? founderToken : opts.token;
  const res = await fetch(BASE + route, { // module-review-ok: the test client dialling the built server on localhost, as every e2e suite does
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function register(name: string, slug: string): Promise<{ token: string; id: string }> {
  const r = await call("POST", "/api/auth/register", {
    token: "",
    body: { name, email: `${slug}-${PORT}@example.test`, password: PASSWORD, paths: ["resident"] },
  });
  expect(r.status, `${name} must register`).toBe(200);
  return { token: String(r.json?.token ?? ""), id: String(r.json?.user?.id ?? "") };
}

/** Push a ballot's window into the past: the clock, never a status change. */
const expire = async (ballotId: string) => {
  await pool.query("UPDATE ballots SET closes_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ?", [ballotId]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
};

/** The game-start document exactly as it stands, read raw. */
const gameStartRow = async (): Promise<any | null> => {
  const [rows] = await pool.query<any[]>("SELECT value FROM app_config WHERE config_key = 'game-start'"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  if (!rows[0]) return null;
  return typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
};

const launchBallots = async (): Promise<Array<{ id: string; status: string; title: string; unity: number; quorum: number; roll: number; doc: string }>> => {
  const [rows] = await pool.query<any[]>( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    "SELECT id, status, title, unity_pct, quorum_pct, electorate_count, doc_markdown FROM ballots WHERE subject_type = 'village_launch' ORDER BY created_at, id",
  );
  return rows.map((r) => ({
    id: String(r.id), status: String(r.status), title: String(r.title), unity: Number(r.unity_pct), quorum: Number(r.quorum_pct),
    roll: Number(r.electorate_count), doc: String(r.doc_markdown ?? ""),
  }));
};

const rollOf = async (ballotId: string): Promise<string[]> => {
  const [rows] = await pool.query<any[]>("SELECT user_id FROM ballot_electorate WHERE ballot_id = ? ORDER BY user_id", [ballotId]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  return rows.map((r) => String(r.user_id)).sort();
};

const vote = (ballotId: string, token: string, choice: string) =>
  call("POST", `/api/governance/ballots/${ballotId}/vote`, { token, body: { choice } });

const variable = async (key: string): Promise<string | null> => {
  const [rows] = await pool.query<any[]>("SELECT value FROM game_variables WHERE config_key = ?", [key]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  return rows[0] ? String(rows[0].value) : null;
};

beforeAll(async () => {
  if (!DB_CONFIGURED) return;
  if (!fs.existsSync(DIST)) {
    throw new Error(`${DIST} is missing. Run \`pnpm build\` before the ratifying launch vote route test.`);
  }
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "village-launchratify-"));
  /*
   * NOT STARTED at boot, so the founder can build the village and name a
   * second founder the way a founder does. The 0112-shaped `game-start` row is
   * written in the first case, which is the moment this village becomes one
   * that was issuing before the vote existed.
   */
  testDb = await provisionTestDb({ gameStarted: false });
  pool = testPool(testDb, { connectionLimit: 4 }); // module-review-ok: the suite's own pool onto the scratch schema it provisioned

  await waitForPortFree(PORT);
  child = spawn(process.execPath, [DIST], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      // No background scheduler: the five-minute governance job is not this suite's subject, and its first tick would run 28 jobs against the schema under test.
      SCHEDULER_ENABLED: "0",
      DATA_DIR: dataDir,
      DATABASE_URL: testDb.url,
      ADMIN_PASSWORD: ADMIN,
      AUTH_TOKEN_SECRET: "launchratify-token-secret", // module-review-ok: a fixture signing secret for a throwaway server on a scratch schema, same as every e2e suite
      FRONTEND_URL: BASE,
      VILLAGE_SECRETS_KEY: "2e".repeat(32), // module-review-ok: fixture sealing key, same as every e2e suite
      RESEND_API_KEY: "",
      ANTHROPIC_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d) => logs.push(String(d)));
  child.stderr?.on("data", (d) => logs.push(String(d)));
  await waitForHealth({ base: BASE, logs, child });

  const boot = await call("POST", "/api/admin/bootstrap", {
    token: "",
    body: { password: ADMIN, email: `founder-${PORT}@example.test`, name: "Mara Fenn" },
  });
  const claim = decodeURIComponent(String(boot.json?.claimUrl ?? "").match(/token=([^&]+)/)?.[1] ?? "");
  const setPw = await call("POST", "/api/auth/set-password", { token: "", body: { token: claim, password: PASSWORD } });
  founderToken = String(setPw.json?.token ?? "");
  founderId = String(setPw.json?.user?.id ?? "");
  expect(founderToken, "founder must hold a session").toBeTruthy();

  await clearTheJourney(call, { name: "Wealden" });

  const wren = await register("Wren Ashby", "wren");
  wrenToken = wren.token; wrenId = wren.id;
  const ida = await register("Ida Kestrel", "ida");
  idaToken = ida.token; idaId = ida.id;
  const tam = await register("Tam Reyes", "tam");
  tamToken = tam.token; tamId = tam.id;
  for (const id of [founderId, wrenId, idaId, tamId]) {
    const r = await call("PUT", `/api/admin/players/${id}/stage`, { body: { stageId: "member" } });
    expect(r.status, `${id} reaches member`).toBe(200);
  }
  // TWO founders, which is one short of the rule as shipped. Ida and Tam are members.
  await makeFounders(call, [wrenId]);
}, 240_000);

afterAll(async () => {
  child?.kill();
  await pool?.end();
  if (dataDir && fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true });
  await testDb?.drop();
});

describe.skipIf(!DB_CONFIGURED)("a village that was issuing before the launch vote existed", () => {
  it("becomes one: game-start is set with no ballot behind it, and no launch is on record", async () => {
    // What migration 0112 wrote for every village already issuing, to the byte.
    await pool.query("INSERT INTO app_config (config_key, value) VALUES ('game-start', ?)", [ // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      JSON.stringify({ startedAt: ISSUING_SINCE, ballotId: null, startedBy: null, note: NOTE_0112 }),
    ]);
    const facts = await call("GET", "/api/admin/launch");
    expect(facts.status, JSON.stringify(facts.json)).toBe(200);
    expect(facts.json?.gameStart).toMatchObject({ started: true, startedAt: ISSUING_SINCE, ballotId: null });
    expect(facts.json?.launchedAt).toBeNull();
    expect(facts.json?.launchedByBallotId).toBeNull();
    // THE VOTE IT MAY HOLD IS A RATIFYING ONE, and the page is told the day that does not move.
    expect(facts.json?.vote?.ratifying).toBe(true);
    expect(facts.json?.vote?.issuingSince).toBe(ISSUING_SINCE);
  });

  it("issues today, with no vote: the ratifying vote is not what turns issuance on", async () => {
    const mint = await call("POST", "/api/admin/tokens/credits/mint", {
      body: { toUserId: tamId, amount: 5, reason: "Wealden has been issuing since March." },
    });
    expect(mint.status, JSON.stringify(mint.json)).toBe(200);
    expect(mint.json?.toBalance).toBe(500);
  });

  it("is short of founders, can make no more, and is told the way through", async () => {
    const facts = await call("GET", "/api/admin/launch");
    expect(facts.json?.vote?.roll).toBe("founders");
    expect(facts.json?.vote?.onTheRoll).toBe(2);
    const tooFew = String(facts.json?.vote?.tooFew);
    expect(tooFew).toContain("2 founding members are on the roll today. One more founding member");
    // NO VILLAGE IS LEFT WITHOUT A PATH (Rye, 2026-11-06), and this one's is not a founder's any more.
    expect(tooFew).toContain(
      "The way through: nobody new can be given the founder role now that this village is issuing, so the village changes who the launch asks, by a vote at its highest tier that every member answers.",
    );
    expect(tooFew).not.toContain("gives the Founder access");

    const refused = await call("POST", "/api/admin/launch/propose");
    expect(refused.status).toBe(409);
    expect(String(refused.json?.error)).toContain("One more founding member");
    expect(String(refused.json?.error), "it is refused for its roll, and no longer for being started").not.toContain("already started its Game");

    // The founder's own two doors are shut, which is why the path is a vote.
    const mintFounder = await call("PUT", `/api/admin/users/${idaId}/role`, { body: { role: "founder", addressUnprovedOk: true } });
    expect(mintFounder.status).toBe(409);
    expect(String(mintFounder.json?.error)).toContain("founder role ended");
    const flip = await call("PUT", "/api/admin/variables/governance.launch_roll", { body: { value: "members" } });
    expect(flip.status).toBe(409);
    expect(flip.json?.code).toBe("vote_rule_dial_closed_at_launch");
    expect(flip.json?.proposeInstead).toBe(true);
    expect(await launchBallots()).toEqual([]);
  });

  it("THE VOTE PATH: every member votes, at the highest tier, to have the launch ask every member", async () => {
    const made = await call("POST", "/api/game/mechanics/proposals", {
      body: {
        title: "Ask every member on our launch",
        rationale: "Two of us hold the founder role and the launch asks three. Nobody new can be made a founder now, so we ask all of us.",
        changes: [{ key: "governance.launch_roll", to: "members" }],
      },
    });
    expect(made.status, `propose: ${JSON.stringify(made.json)}`).toBe(200);
    const opened = await call("POST", `/api/governance/mechanics/${String(made.json?.id)}/open-ballot`, {
      body: { purposeAlignment: "Every member who lives by this village's rules answers whether it is launched, in the open." },
    });
    expect(opened.status, `open: ${JSON.stringify(opened.json)}`).toBe(200);
    // Who the launch asks is constitutional, so this vote carries the highest floor.
    expect(opened.json?.ballot?.unityPct).toBeGreaterThanOrEqual(TIER_FLOORS.constitutional.unityPct);
    expect(opened.json?.ballot?.quorumPct).toBeGreaterThanOrEqual(TIER_FLOORS.constitutional.quorumPct);
    const ballotId = String(opened.json?.ballot?.id ?? "");
    // An ORDINARY vote: all four members are on its roll, founder or not.
    expect(await rollOf(ballotId)).toEqual([founderId, wrenId, idaId, tamId].sort());
    for (const t of [founderToken, wrenToken, idaToken, tamToken]) expect((await vote(ballotId, t, "yes")).status).toBe(200);
    // And it waits for its window like every ordinary vote: nothing carried at once.
    expect(await variable("governance.launch_roll")).toBeNull();
    await expire(ballotId);
    const closed = await call("POST", `/api/governance/ballots/${ballotId}/close`, { body: { outcomeNote: "All four of us agreed." } });
    expect(closed.json?.outcome, JSON.stringify(closed.json)).toBe("passed");
    await pool.query("UPDATE ballots SET lands_at = DATE_SUB(NOW(), INTERVAL 1 HOUR), veto_closes_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ?", [ballotId]); // module-review-ok: fixture SQL against the suite's own scratch schema
    expect((await call("POST", "/api/admin/cycles/close", { body: {} })).status).toBe(200);
    expect(await variable("governance.launch_roll")).toBe("members");

    const facts = await call("GET", "/api/admin/launch");
    expect(facts.json?.vote?.roll).toBe("members");
    expect(facts.json?.vote?.onTheRoll).toBe(4);
    expect(facts.json?.vote?.tooFew).toBeNull();
    expect(facts.json?.vote?.ratifying).toBe(true);
  });
});

describe.skipIf(!DB_CONFIGURED)("the ratifying vote", () => {
  it("opens, names itself a ratification, and says in its own document that issuance does not restart", async () => {
    const before = await gameStartRow();
    const asked = await call("POST", "/api/admin/launch/propose", { body: { slate: [founderId] } });
    expect(asked.status, JSON.stringify(asked.json)).toBe(200);
    const rows = await launchBallots();
    expect(rows).toHaveLength(1);
    ratifyingBallot = rows[0].id;
    expect(rows[0].status).toBe("open");
    // The vote keeps its name (Rye, 2026-11-28: "Let's stay with start the game").
    expect(rows[0].title).toBe("Start the Game in Wealden");
    expect(rows[0].unity).toBe(100);
    // Three of four: the village's number over the roll it chose.
    expect(rows[0].quorum).toBe(75);
    expect(rows[0].roll).toBe(4);
    expect(await rollOf(ratifyingBallot)).toEqual([founderId, wrenId, idaId, tamId].sort());

    const doc = rows[0].doc;
    expect(doc).toContain("# Start the Game");
    expect(doc).toContain("Wealden has been issuing tokens since 2026-03-14, from before the launch vote existed. This vote starts its Game on the record, and the day it carries is the Game's birthday.");
    expect(doc).toContain("## What was already running");
    expect(doc).toContain("Token issuance. It does not restart, and the day it began stays 2026-03-14.");
    expect(doc).toContain("nobody's balance moves because of this vote");
    // EVERY "ISSUANCE STARTS" SENTENCE IS GONE FROM THIS CASE.
    expect(doc).not.toContain("Token issuance turns on");
    expect(doc).not.toContain("This vote is what starts it");
    expect(doc).not.toMatch(/ratif/i);
    // The rest of the launch is the same act, at the roll this village chose.
    expect(doc).toContain("Every member who holds a voice votes on this, each counted once. It carries the moment 3 of them have said yes, unless one of them has said no.");
    expect(doc).toContain("Who carries the steward role");
    // Opening it changed nothing about the day issuance began.
    expect(await gameStartRow()).toEqual(before);

    // The notice and the pulse say ratify, never start.
    const [opening] = await pool.query<any[]>("SELECT title FROM notifications WHERE dedupe_key LIKE ? AND type = 'ballot_opened'", [`bal:${ratifyingBallot}:%`]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    expect(opening.length).toBeGreaterThan(0);
    for (const n of opening) expect(String(n.title)).toBe("The village is deciding whether to start its Game");
  });

  it("a no holds it, and when the no is withdrawn the third yes carries it at once", async () => {
    expect((await vote(ratifyingBallot, founderToken, "yes")).json?.carried).toBe(false);
    expect((await vote(ratifyingBallot, wrenToken, "yes")).json?.carried).toBe(false);
    // Tam, a member, is on this roll because the village asked every member.
    const held = await vote(ratifyingBallot, tamToken, "no");
    expect(held.status, JSON.stringify(held.json)).toBe(200);
    expect(held.json?.carried).toBe(false);
    expect((await call("GET", "/api/admin/launch")).json?.launchedAt).toBeNull();

    const third = await vote(ratifyingBallot, tamToken, "yes");
    expect(third.status, JSON.stringify(third.json)).toBe(200);
    expect(third.json?.carried).toBe(true);
    expect(third.json?.ballot?.status).toBe("passed");
  });

  it("THE DAY ISSUANCE BEGAN HAS NOT MOVED, and game-start still carries no ballot", async () => {
    // Byte for byte what migration 0112 wrote, before any of this.
    expect(await gameStartRow()).toEqual({ startedAt: ISSUING_SINCE, ballotId: null, startedBy: null, note: NOTE_0112 });
    const anon = await call("GET", "/api/game/mechanics", { token: null });
    expect(anon.json?.gameStart?.started).toBe(true);
    expect(anon.json?.gameStart?.startedAt).toBe(ISSUING_SINCE);
  });

  it("puts the launch on the record, with the ballot that did it", async () => {
    const status = await call("GET", "/api/admin/launch");
    expect(String(status.json?.launchedAt)).toBeTruthy();
    expect(status.json?.launchedByBallotId).toBe(ratifyingBallot);
    expect(new Date(String(status.json?.launchedAt)).getTime(), "the launch is recorded now, months after issuance began").toBeGreaterThan(new Date(ISSUING_SINCE).getTime());
    // The vote has been held, so there is no ratifying vote left to hold.
    expect(status.json?.vote?.ratifying).toBe(false);

    const [told] = await pool.query<any[]>( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      "SELECT title, body FROM notifications WHERE dedupe_key = ?",
      [`bal:${ratifyingBallot}:launch-carried`],
    );
    expect(told).toHaveLength(1);
    expect(String(told[0].title)).toBe("The village started its Game: Start the Game in Wealden");
    // One line of ceremony, then what was already running. Never that issuance opens today.
    expect(String(told[0].body)).toBe("The Game has begun. Happy birthday, Wealden. Token issuance was already open, since 2026-03-14, and that day has not moved.");
    const [pulse] = await pool.query<any[]>( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      "SELECT text FROM health_events WHERE kind = 'governance' AND entity_type = 'ballot' AND entity_ref = ? AND text LIKE 'The village %'",
      [ratifyingBallot],
    );
    expect(pulse.map((p) => String(p.text))).toContain("The village started its Game: its launch vote carried.");
    expect(pulse.map((p) => String(p.text)).some((t) => /issuance (is open|opens|turns on|starts)/i.test(t)), "no line says issuance opens today").toBe(false);
  });

  it("seats the founder who was named and accepted, exactly as a first launch does", async () => {
    // The founder was on the slate and voted yes without standing, so nobody is seated by this vote.
    // What is asserted is that the seating RAN: its audit line is on the record for this ballot.
    const deadline = Date.now() + 15_000;
    let lines: string[] = [];
    while (Date.now() < deadline) {
      const [rows] = await pool.query<any[]>("SELECT text FROM health_events WHERE kind = 'audit' AND text LIKE 'launch:%'"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      lines = rows.map((r) => String(r.text));
      if (lines.some((l) => l === `launch:ratified-by-ballot:${ratifyingBallot}`)) break;
      await new Promise((r) => setTimeout(r, 150));
    }
    expect(lines).toContain(`launch:ratified-by-ballot:${ratifyingBallot}`);
    expect(lines.some((l) => l.startsWith("launch:started-by-ballot:")), "nothing records this as the vote that started issuance").toBe(false);
    expect(lines.some((l) => l.startsWith("launch:token-mint:")), "the token.mint hand-over was attempted, as at any launch").toBe(true);
  });

  it("is held ONCE: a second one is refused as already started", async () => {
    const again = await call("POST", "/api/admin/launch/propose");
    expect(again.status).toBe(409);
    expect(String(again.json?.error)).toContain("already started its Game");
    expect(await launchBallots()).toHaveLength(1);
  });
});
