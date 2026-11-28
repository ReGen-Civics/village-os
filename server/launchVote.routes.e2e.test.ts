/**
 * THE BUTTON THAT STOPPED MARKING AND STARTED ASKING (R74), driven over HTTP.
 *
 * The founder's ruling of September: "the 'mark the village launched' button
 * actually generates the first proposal". R67 says what the vote is FOR: "a
 * game needs 3 people minimum to play (to actually issue tokens) so they can
 * do everything else to set up the game on their own."
 *
 * WHO ANSWERS IT, AND WHEN IT CARRIES, changed on 2026-11-27. Rye: the launch
 * carries with "Not everyone, but at least 3 members holding the founder
 * role", and it "doesn't need to wait 7 days". The details he accepted: only
 * founders vote; it carries the moment a third founder says yes, unless a
 * founder has said no; a no holds it until that founder withdraws it. This
 * file used to pin 100% unity and 100% quorum over every member, closed by
 * hand after the window. It now pins the new rule end to end.
 *
 * The harm metric for this file is one sentence, and every clause of it is
 * driven against the built server:
 *
 *   A village sets its whole Game up alone and can issue nothing; a member who
 *   is not a founder is not asked; two founder yeses carry nothing; a
 *   founder's no holds it; and the third founder's yes starts the Game in that
 *   same request, with nobody choosing the moment.
 *
 * THE CASES RUN IN ORDER. One village walks the whole path: too few founders,
 * then a vote that ended on two yeses, then one that ended with a no standing,
 * then the one that carried. Run the whole file, never a `-t` slice.
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
import { HANDOVER_SET } from "../shared/capabilities";
import { PURPOSE_EXAMPLE } from "../shared/governingPurpose";
import { CONFLICT_DOOR_READY, recordEveryCanvasBlock } from "./db/launchGovernanceFixture";

const DB_CONFIGURED = testDbConfigured();
if (!DB_CONFIGURED) {
  console.warn("[launchVote.routes] TEST_DATABASE_URL not set - DB-backed tests SKIPPED.");
}

const DIST = path.resolve(process.cwd(), "dist/index.js");

/**
 * This suite's port window. It is checked, not asserted.
 *
 * A hand-written survey used to live here, ending with RE-GREP BEFORE
 * TRUSTING THIS. Nobody re-grepped, the tree moved, and the paragraph went on
 * claiming the window was clear when it had not been for over a week. Worse,
 * every one of those surveys grepped for `process.pid %` and so never saw the
 * stub ports (GOOGLE_PORT, BARE_PORT, STUB_PORT) or the fixed 8127 that
 * actually caused a failure.
 *
 * `scripts/check-e2e-ports.mjs` is that survey, executable, run in CI. It
 * refuses any two windows in different files that overlap at all, any fixed
 * port, and anything reaching into Linux's ephemeral range. Change the number
 * below and it will tell you.
 */
const PORT = 17100 + (process.pid % 400);
const BASE = `http://localhost:${PORT}`;
const ADMIN = "launchvote-admin";
const PASSWORD = "LaunchVoteTest123!";

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
/** Tam stays an ordinary member throughout: the person this vote does not ask. */
let tamToken = "";
let tamId = "";
/** Wren's claim on a quest, carried between the first case and the last. */
let claimId = "";

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

/**
 * Give somebody the founder role, through the route an admin page calls. A
 * founder is the only one who may before launch, and the address was never
 * proved by a claim link, which the route asks the founder to say out loud.
 */
async function makeFounder(userId: string): Promise<void> {
  const r = await call("PUT", `/api/admin/users/${userId}/role`, { body: { role: "founder", addressUnprovedOk: true } });
  expect(r.status, JSON.stringify(r.json)).toBe(200);
}

/** Who a ballot froze onto its roll, read raw. */
const rollOf = async (ballotId: string): Promise<string[]> => {
  const [rows] = await pool.query<any[]>("SELECT user_id FROM ballot_electorate WHERE ballot_id = ? ORDER BY user_id", [ballotId]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  return rows.map((r) => String(r.user_id)).sort();
};

/** Push a ballot's window into the past: the clock, never a status change. */
const expire = async (ballotId: string) => {
  await pool.query("UPDATE ballots SET closes_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = ?", [ballotId]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
};

/** Every launch ballot this village has, read raw and never off a payload. */
const launchBallots = async (): Promise<Array<{ id: string; status: string; unity: string; quorum: string; roll: number }>> => {
  const [rows] = await pool.query<any[]>( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    "SELECT id, status, unity_pct, quorum_pct, electorate_count FROM ballots WHERE subject_type = 'village_launch' ORDER BY created_at, id",
  );
  return rows.map((r) => ({
    id: String(r.id),
    status: String(r.status),
    unity: String(r.unity_pct),
    quorum: String(r.quorum_pct),
    roll: Number(r.electorate_count),
  }));
};

/** The game-start document exactly as it stands, read raw. */
const gameStartRow = async (): Promise<any | null> => {
  const [rows] = await pool.query<any[]>( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    "SELECT value FROM app_config WHERE config_key = 'game-start'",
  );
  if (!rows[0]) return null;
  return typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
};

/**
 * Every steward seat this village holds, read raw.
 *
 * THIS IS THE ASSERTION THAT THE CLOSER ACTUALLY CALLS THE SEATING, and it is
 * here rather than beside the unit tests for a reason worth writing down.
 * `seatCatalystsAsStewards` said in its own header for eight weeks that the
 * launch closer called it, was covered by a whole passing suite, and was
 * called by nothing outside that suite. A green function nobody calls is a
 * green about code that never runs, so the wiring gets driven over HTTP,
 * through a real vote, against the built server.
 */
const stewardSeats = async (): Promise<Array<{ userId: string; endsAt: number | null; grantedBy: string | null }>> => {
  const [rows] = await pool.query<any[]>( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    "SELECT user_id, UNIX_TIMESTAMP(term_ends_at) AS ends, granted_by FROM role_holders WHERE role_id = 'steward' ORDER BY user_id",
  );
  return rows.map((r) => ({
    userId: String(r.user_id),
    endsAt: r.ends === null ? null : Number(r.ends) * 1000,
    grantedBy: r.granted_by === null ? null : String(r.granted_by),
  }));
};

/** One claim's status, read from the table and never off a payload. */
const claimStatus = async (id: string): Promise<string | null> => {
  const [rows] = await pool.query<any[]>("SELECT status FROM quest_claims WHERE id = ?", [id]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  return rows[0] ? String(rows[0].status) : null;
};

/**
 * Ask the founder to hand-mint. The simplest issuance a route can be told to do.
 * In credits: Gratitude is refused by name before the launch is asked (Rye,
 * 2026-10-23: it is only ever sent member to member).
 */
const tryToIssue = (reason: string) =>
  call("POST", "/api/admin/tokens/credits/mint", {
    body: { toUserId: wrenId, amount: 5, reason },
  });

/**
 * One vote, and on the Birthing, whether this member stands for the seat.
 *
 * Rye, 2026-09-24: a founding member says at the launch vote that they want the
 * inaugural steward's seat. This drives that over HTTP, against the built
 * server, which is the only way to know the route actually carries the field:
 * a unit test writing the column by hand proves the seating and nothing about
 * the door in.
 */
async function vote(
  ballotId: string,
  token: string,
  choice: string,
  standsForSteward?: boolean,
): Promise<Answer> {
  return await call("POST", `/api/governance/ballots/${ballotId}/vote`, {
    token,
    body: standsForSteward === undefined ? { choice } : { choice, standsForSteward },
  });
}

beforeAll(async () => {
  if (!DB_CONFIGURED) return;
  if (!fs.existsSync(DIST)) {
    throw new Error(`${DIST} is missing. Run \`pnpm build\` before the launch vote route test.`);
  }
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "village-launchvote-"));
  /*
   * A village that has NOT started its Game, which is the whole premise. Every
   * other DB-backed suite gets the harness default, which is a village mid-life.
   */
  testDb = await provisionTestDb({ gameStarted: false });
  pool = testPool(testDb, { connectionLimit: 4 }); // module-review-ok: the suite's own pool onto the scratch schema it provisioned

  // Refuse a port a stranger is already holding, and wait out the previous
  // suite's server if it has not let go yet. The boot poll below breaks on ANY
  // 200 on this port, so without this an orphan answers it and the whole
  // scenario runs against the wrong server. See waitForPortFree in ./db/testDb.
  await waitForPortFree(PORT);
  child = spawn(process.execPath, [DIST], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      // No background scheduler. It arms `setTimeout(tick, 15s)` at boot, and on
      // that first tick every job with no scheduled_jobs row is due, so 28 jobs run
      // in series against the scratch schema this suite is asserting on. Every e2e
      // file in the suite outlives 15 seconds of server uptime under load and none
      // under it alone, which is an unrecorded wall-clock deadline on 40 suites.
      // server/synthesisBatch.routes.e2e.test.ts leaves it armed, because the tick
      // is its subject.
      SCHEDULER_ENABLED: "0",
      DATA_DIR: dataDir,
      DATABASE_URL: testDb.url,
      ADMIN_PASSWORD: ADMIN,
      AUTH_TOKEN_SECRET: "launchvote-token-secret", // module-review-ok: a fixture signing secret for a throwaway server on a scratch schema, same as every e2e suite
      // A launch vote needs the site-address row (R108), and this village is meant to be ready.
      FRONTEND_URL: BASE,
      VILLAGE_SECRETS_KEY: "1f".repeat(32), // module-review-ok: fixture sealing key, same as every e2e suite
      RESEND_API_KEY: "",
      ANTHROPIC_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d) => logs.push(String(d)));
  child.stderr?.on("data", (d) => logs.push(String(d)));

  // Reports the last /health answer and when the server logged that it was
  // listening, and stops at once if the child died. See ./db/e2eBoot.ts.
  await waitForHealth({ base: BASE, logs, child });

  const boot = await call("POST", "/api/admin/bootstrap", {
    token: "",
    body: { password: ADMIN, email: `founder-${PORT}@example.test`, name: "Launch Founder" },
  });
  const claim = decodeURIComponent(String(boot.json?.claimUrl ?? "").match(/token=([^&]+)/)?.[1] ?? "");
  const setPw = await call("POST", "/api/auth/set-password", { token: "", body: { token: claim, password: PASSWORD } });
  founderToken = String(setPw.json?.token ?? "");
  founderId = String(setPw.json?.user?.id ?? "");
  expect(founderToken, "founder must hold a session").toBeTruthy();

  const on = await call("PUT", "/api/admin/modules/governance/lifecycle", {
    body: { lifecycle: "members", examples: false },
  });
  expect(on.status, "governance must be on for this suite").toBe(200);

  const wren = await register("Wren Ashby", "wren");
  wrenToken = wren.token; wrenId = wren.id;

  // Everybody reaches member, which is the rung `ballot.vote` unlocks at, so
  // each holds a voice on an ordinary vote. The launch roll does not read it:
  // that roll is the founders, and Wren is not one yet.
  for (const id of [founderId, wrenId]) {
    const r = await call("PUT", `/api/admin/players/${id}/stage`, { body: { stageId: "member" } });
    expect(r.status, `${id} reaches member`).toBe(200);
  }

  /*
   * THE JOURNEY, CLEARED. These are the blocking items a fresh village of this
   * shape still holds, and clearing them is exactly the founder's solitary
   * setup that R67 says comes before the vote.
   */
  const brand = await call("PUT", "/api/admin/brand", {
    body: { project: { name: "Larksfield", tagline: "A village on the fen", location: "Norfolk" } },
  });
  expect(brand.status, JSON.stringify(brand.json)).toBe(200);

  const policy = await call("PUT", "/api/admin/exit-policy", {
    body: {
      placeholder: false,
      voluntary: {
        noticePeriodDays: 21,
        valuationMethod: "Larksfield pays out a leaving member at the value the last cycle settled, in full, within one lunation.",
        unwindSteps: [
          "Bring back anything borrowed from the barn",
          "Finish or hand on the work you are holding",
          "The stewards settle what is owed and write it down",
        ],
      },
      involuntary: {
        decidingDomainId: "",
        appealDomainId: "",
        process: "Two stewards sit with the person first. Nothing formal begins until that conversation has happened.",
      },
      restorative: {
        intakeContactRole: "",
        steps: [
          "Somebody who was not involved hears both people",
          "The village agrees what would put it right",
          "Whoever asked for this says whether it did",
        ],
        // The conflict door, which blocks the vote: server/db/launchGovernanceFixture.ts.
        ...CONFLICT_DOOR_READY,
      },
    },
  });
  expect(policy.status, JSON.stringify(policy.json)).toBe(200);

  // What closing means, named AND adopted: blocking since Rye's ruling of
  // 2026-09-25. Its own "no" and "yes" are server/closingPolicy.routes.e2e.test.ts.
  expect((await call("PUT", "/api/admin/exit-policy/closing", {
    body: { policyId: "own-words", statement: "If Larksfield closes, the barn and the land pass to the parish trust and the cash is shared among the members still here.", adopt: true },
  })).status).toBe(200);

  const backups = await call("POST", "/api/admin/launch/confirm", {
    body: { id: "backups-drilled", done: true },
  });
  expect(backups.status, JSON.stringify(backups.json)).toBe(200);

  /*
   * THE VILLAGE'S CLOCK, WHICH BLOCKS THE LAUNCH VOTE SINCE READINESS R059.
   * The platform keeps UTC until a founder answers, and confirming the zone
   * already showing is an answer, so this village keeps UTC and says so.
   */
  const zone = (await call("GET", "/api/admin/seasons")).json;
  const confirmedZone = await call("PUT", "/api/admin/seasons", {
    body: { seasons: zone.seasons, cadence: zone.cadence, timezone: zone.timezone, confirmTimezone: true },
  });
  expect(confirmedZone.status, JSON.stringify(confirmedZone.json)).toBe(200);

  /*
   * THE FOUNDER'S ANSWER ABOUT THE VILLAGE-WIDE ISSUANCE CAP, WHICH IS NEW AND
   * BLOCKS THE VOTE UNTIL IT IS GIVEN.
   *
   * Rye ruled that founders are asked for the cap on this journey and "can opt
   * to not set a cap at that moment". This village declines, which is the
   * second real answer: it names no number of its own and the platform's cap
   * keeps binding every door. The row is BLOCKING precisely so that declining
   * and never looking cannot be the same outcome, so a setup that greens the
   * checklist has to answer it, exactly as a founder does.
   */
  expect((await call("POST", "/api/admin/launch/confirm", {
    body: { id: "issuance-cap", done: "declined" },
  })).status).toBe(200);

  /*
   * THE GOVERNING PURPOSE STATEMENT, WHICH BLOCKS THE LAUNCH VOTE (0219).
   *
   * Rye ruled that a village writes what it is for before it births, and the
   * row is BLOCKING, so a suite that launches a village has to satisfy it the
   * way a real founder does. There is no manual confirm to tick here: the
   * check reads the document and runs the same validator the wizard runs, so
   * the statement has to actually be written.
   *
   * That refusal is not left unobserved by satisfying it here. It has its own
   * case in `server/governingPurpose.routes.e2e.test.ts`, which drives the
   * door shut and asserts the sentence a founder reads, plus the two
   * plausible non-answers the floor exists to refuse.
   */
  expect((await call("PUT", "/api/admin/purpose", {
    body: { statement: PURPOSE_EXAMPLE },
  })).status).toBe(200);

  // EVERY CANVAS BLOCK ON RECORD, which blocks the vote (2026-09-27). One reading
  // each, at Absent with its sentence, through the real route. The refusal is
  // driven row by row in server/lib/launchGovernance.db.test.ts.
  await recordEveryCanvasBlock(call);
}, 240_000);

afterAll(async () => {
  child?.kill();
  await pool?.end();
  if (dataDir && fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true });
  await testDb?.drop();
});

describe.skipIf(!DB_CONFIGURED)("a village sets itself up alone, and can issue nothing", () => {
  it("refuses every issuance before the vote, and says why in words a steward can read", async () => {
    const before = await tryToIssue("A hand-mint before the village has started its Game");
    expect(before.status).toBe(400);
    expect(String(before.json?.error)).toContain("has not started its Game");
    expect(String(before.json?.error)).toContain("launch vote carries");
    expect(await gameStartRow()).toBeNull();
  });

  it("tells every member the Game has not started, with no admin login", async () => {
    const anon = await call("GET", "/api/game/mechanics", { token: null });
    expect(anon.status).toBe(200);
    expect(anon.json?.gameStart?.started).toBe(false);
    expect(anon.json?.gameStart?.ballotId).toBeNull();
  });

  it("refuses to consent a quest, and leaves the claim where a later consent can find it", async () => {
    /*
     * THE ONE ISSUING PATH THAT COULD LOSE A MEMBER'S WORK. Every other faucet
     * caller finds out late and says so; this one would have flipped the claim
     * to `consented` first, and consenting again is a 409 on a claim that is
     * no longer submitted. So the route asks before it writes, and this drives
     * that: the refusal, and the claim still standing at `submitted`.
     */
    const quest = await call("POST", "/api/admin/quests", {
      body: { title: "Clear the beck", valueMinor: 1000000 },
    });
    expect(quest.status, JSON.stringify(quest.json)).toBe(200);
    const claimed = await call("POST", `/api/game/quests/${quest.json.id}/claim`, { token: wrenToken, body: {} });
    expect(claimed.status, JSON.stringify(claimed.json)).toBe(200);
    claimId = String(claimed.json.id);
    expect((await call("POST", `/api/game/quests/${quest.json.id}/submit`, {
      token: wrenToken,
      body: { note: "Beck cleared and the banks reseeded." },
    })).status).toBe(200);

    const consent = await call("POST", `/api/admin/quest-claims/${claimId}/consent`, {
      body: { approve: true, amount: 10 },
    });
    expect(consent.status).toBe(409);
    expect(String(consent.json?.error)).toContain("has not started its Game");
    expect(await claimStatus(claimId)).toBe("submitted");
  });

  it("will not open the vote with one founder on the roll, and says how many more and who", async () => {
    const status = await call("GET", "/api/admin/launch");
    expect(status.status).toBe(200);
    expect(status.json?.blockingOpen, JSON.stringify(status.json?.items?.filter((i: any) => i.severity === "blocking" && i.state !== "ok"))).toBe(0);
    // THE ROLL IS THE FOUNDERS (Rye, 2026-11-27). Wren is a member who holds a
    // voice on every ordinary vote, and she is not counted here.
    expect(status.json?.vote?.onTheRoll).toBe(1);
    expect(status.json?.vote?.founders).toEqual([{ id: founderId, name: "Launch" }]);
    expect(status.json?.vote?.yesNeeded).toBe(3);
    expect(String(status.json?.vote?.tooFew)).toContain("One founding member is on the roll today. 2 more founding members");
    expect(String(status.json?.vote?.tooFew)).toContain("On the roll: Launch.");
    // NO VILLAGE IS LEFT WITHOUT A PATH (Rye, 2026-11-06). Before the Game starts the path is a founder's.
    expect(String(status.json?.vote?.tooFew)).toContain(
      "The way through: a founder gives the Founder access to more people on their card in Admin, People, or sets the launch to ask every member in the governance settings.",
    );
    expect(status.json?.vote?.roll).toBe("founders");

    const early = await call("POST", "/api/admin/launch/propose");
    expect(early.status).toBe(409);
    expect(String(early.json?.error)).toContain("2 more founding members");
    expect(early.json?.onTheRoll).toBe(1);
    expect(await launchBallots()).toEqual([]);
  });

  it("counts a second founder the moment the role is given, and still not a member", async () => {
    await makeFounder(wrenId);
    const two = await call("GET", "/api/admin/launch");
    expect(two.json?.vote?.onTheRoll).toBe(2);
    expect(String(two.json?.vote?.tooFew)).toContain("2 founding members are on the roll today. One more founding member");
    // Named, in a stable order by account id, so only the membership is asserted here.
    expect(String(two.json?.vote?.tooFew)).toMatch(/On the roll: (Launch and Wren|Wren and Launch)\./);
    expect((two.json?.vote?.founders as Array<{ id: string }>).map((f) => f.id).sort()).toEqual([founderId, wrenId].sort());

    // Tam joins, reaches member and holds a voice on every ordinary vote. The launch roll does not move.
    const tam = await register("Tam Reyes", "tam");
    tamToken = tam.token; tamId = tam.id;
    expect((await call("PUT", `/api/admin/players/${tamId}/stage`, { body: { stageId: "member" } })).status).toBe(200);
    const still = await call("GET", "/api/admin/launch");
    expect(still.json?.vote?.onTheRoll, "a member is not a founder").toBe(2);
    expect((await call("POST", "/api/admin/launch/propose")).status).toBe(409);
    expect(await launchBallots()).toEqual([]);
  });

  it("who the launch asks is the village's own setting, so two founders and a member are not stuck (Rye, 2026-11-06)", async () => {
    // Two founders and Tam, a member who holds a voice. On the rule as shipped the roll is the two founders.
    const set = (value: string) => call("PUT", "/api/admin/variables/governance.launch_roll", { body: { value } });
    expect((await set("everyone")).status, "only the two values the setting has").toBeGreaterThanOrEqual(400);
    expect((await set("members")).status).toBe(200);
    try {
      const asked = await call("GET", "/api/admin/launch");
      expect(asked.json?.vote?.roll).toBe("members");
      // Every member who holds a voice: the two founders and Tam. Three is enough to be asked.
      expect(asked.json?.vote?.onTheRoll).toBe(3);
      expect((asked.json?.vote?.founders as Array<{ id: string }>).map((f) => f.id).sort()).toEqual([founderId, wrenId, tamId].sort());
      expect(asked.json?.vote?.tooFew).toBeNull();
      expect(String(asked.json?.vote?.why)).toContain("Every member who holds a voice votes on starting the Game, each counted once.");
      expect(asked.json?.vote?.notOnTheRoll).toEqual([]);
    } finally {
      expect((await set("founders")).status).toBe(200);
    }
    // Control: back on the rule as shipped, the same village is one founder short again.
    const shipped = await call("GET", "/api/admin/launch");
    expect(shipped.json?.vote?.roll).toBe("founders");
    expect(shipped.json?.vote?.onTheRoll).toBe(2);
    expect(String(shipped.json?.vote?.tooFew)).toContain("One more founding member");
    expect(await launchBallots()).toEqual([]);
  });

  it("the head count is the village's own dial, held at the floor of three (Rye, 2026-11-06; D3)", async () => {
    const set = (value: string) => call("PUT", "/api/admin/variables/governance.launch_min_electorate", { body: { value } });
    expect((await set("0")).status, "never below one").toBeGreaterThanOrEqual(400);
    expect((await set("2")).status).toBe(200);
    try {
      const status = await call("GET", "/api/admin/launch");
      expect(status.json?.vote?.minElectorate, "LAUNCH_MIN_ELECTORATE_FLOOR holds the dial at three").toBe(3);
      expect(String(status.json?.vote?.tooFew), "two on the roll is still one short").toContain("One more founding member");
      const early = await call("POST", "/api/admin/launch/propose");
      expect(early.status).toBe(409);
    } finally {
      expect((await set("3")).status).toBe(200);
    }
    // Control: back at the default, the same two are one short again.
    const again = await call("GET", "/api/admin/launch");
    expect(again.json?.vote?.minElectorate).toBe(3);
    expect(String(again.json?.vote?.tooFew)).toContain("One more founding member");
    expect(await launchBallots()).toEqual([]);
  });
});

describe.skipIf(!DB_CONFIGURED)("the third founder arrives and the vote can be asked", () => {
  /*
   * THE BIRTHING IS A KEY MOMENT (plan 4.2, Wave 4). Switching governance on in
   * the setup above was one too, and it is the same moment in the same moon, so
   * its notices are cleared here: what the case after the propose reads is the
   * Birthing's own raise and nothing the setup left.
   */
  beforeAll(async () => {
    if (!DB_CONFIGURED) return;
    await pool.query("DELETE FROM notifications WHERE type = 'canvas_revisit'"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  });

  it("opens at unity 100 and three of three as its participation, with the roll frozen to the three founders", async () => {
    const ida = await register("Ida Kestrel", "ida");
    idaToken = ida.token; idaId = ida.id;
    await makeFounder(idaId);
    const ready = await call("GET", "/api/admin/launch");
    expect(ready.json?.vote?.onTheRoll).toBe(3);
    expect(ready.json?.vote?.tooFew).toBeNull();
    expect(String(ready.json?.vote?.why)).toContain("Only founding members vote on starting the Game.");

    /*
     * THE SLATE IS PART OF THE PROPOSAL (0220). Rye, 2026-09-24: "whoever is
     * clicking the 'launch village' button then selects from a list of members
     * in the proposal to carry the steward role so then it's there in the
     * proposal to be voted on." Driven through the real door, because a unit
     * test writing the rows by hand proves the seating and nothing about the
     * route that writes them.
     */
    const asked = await call("POST", "/api/admin/launch/propose", { body: { slate: [founderId] } });
    expect(asked.status, JSON.stringify(asked.json)).toBe(200);

    const rows = await launchBallots();
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe("open");
    // "No founder has said no", and the village's number frozen as a share of this roll: three of three.
    expect(Number(rows[0].unity)).toBe(100);
    expect(Number(rows[0].quorum)).toBe(100);
    // Four people hold a voice in this village. Three of them are founders, and the roll is those three.
    expect(rows[0].roll).toBe(3);
    expect(await rollOf(rows[0].id)).toEqual([founderId, idaId, wrenId].sort());
    expect(await rollOf(rows[0].id)).not.toContain(tamId);
    // Each founder counts once, whatever the village's weight mode is.
    const [frozen] = await pool.query<any[]>("SELECT weight_mode, total_weight FROM ballots WHERE id = ?", [rows[0].id]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    expect(String(frozen[0].weight_mode)).toBe("equal");
    expect(Number(frozen[0].total_weight)).toBe(3);
  });

  it("asks the admins, before the vote: look at Power, Resourcing, Legal and Impact again", async () => {
    // The propose records `launch:proposed:<ballot>`, and the moment hangs off
    // that event (server/lib/canvasRevisit.ts). Fire and forget, so wait for
    // the rows and a second read that agrees. Three founders are three admins
    // now, so each of the four notices reaches each of them.
    const read = async () => {
      const [r] = await pool.query<any[]>( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
        "SELECT user_id, title, body, actor_user_id FROM notifications WHERE type = 'canvas_revisit' ORDER BY title",
      );
      return r;
    };
    const deadline = Date.now() + 20_000;
    while ((await read()).length < 12 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 150));
    await new Promise((r) => setTimeout(r, 600));
    const rows = await read();
    expect([...new Set(rows.map((r) => r.title))]).toEqual([
      "Before you raise: look at Impact again.",
      "Before you raise: look at Legal again.",
      "Before you raise: look at Power again.",
      "Before you raise: look at Resourcing again.",
    ]);
    // Before the handover, and with nobody holding the canvas pen, the admins alone: Tam hears nothing.
    expect(new Set(rows.map((r) => String(r.user_id)))).toEqual(new Set([founderId, wrenId, idaId]));
    expect(rows).toHaveLength(12);
    expect(rows.every((r) => r.actor_user_id === null && !/\d/.test(String(r.body)))).toBe(true);
  });

  it("puts the slate AND the rule IN the frozen document, so a member reads what is being decided and by whom", async () => {
    // "so it's there in the proposal to be voted on" is a requirement about
    // `ballots.doc_markdown`, which is the string every member reads.
    const [running] = await launchBallots();
    const read = await call("GET", `/api/governance/ballots/${running.id}`, { token: tamToken });
    expect(read.status, JSON.stringify(read.json)).toBe(200);
    const doc = String(read.json?.docMarkdown);
    expect(doc).toContain("Who carries the steward role");
    expect(doc, "the person who chose the list is named in it").toContain("chose who it puts forward");
    expect(doc, "and what accepting costs is in it too").toContain(
      `all ${HANDOVER_SET.length} of the powers this village has to give`,
    );
    // The rule of 2026-11-27, in the document a member opens a year later.
    expect(doc).toContain("Only founding members vote on this. It carries the moment 3 of them have said yes, unless one of them has said no.");
    expect(doc).toContain("3 founding members are on the roll today: ");
    for (const name of ["Launch", "Wren", "Ida"]) expect(doc, `${name} is named on the roll`).toContain(name);
    expect(doc).toContain("A member who is not a founding member is not asked on this one vote");
    expect(doc).toContain("Each person on this roll counts once");
    // And that this rule is the village's own to change (Rye, 2026-11-06).
    expect(doc).toContain("How many must say yes, and who is asked, are this village's own settings.");
    expect(doc, "the every-seat rule is gone").not.toContain("Everyone on the roll votes yes");
  });

  it("does not take a vote from a member who is not a founder, and says why in the launch's own words", async () => {
    const [running] = await launchBallots();
    const refused = await vote(running.id, tamToken, "yes");
    expect(refused.status).toBe(409);
    expect(String(refused.json?.error)).toContain("Only founding members vote on the village's launch");
    // The known positive: a founder's vote on the same ballot is taken, two cases below.
    const [votes] = await pool.query<any[]>("SELECT COUNT(*) AS n FROM ballot_votes WHERE ballot_id = ?", [running.id]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    expect(Number(votes[0].n)).toBe(0);
  });

  it("shows a DECLINE to an ordinary member, which is what Rye asked for", async () => {
    /*
     * Rye, 2026-09-24: "founders only for this first season ... and show the
     * declines". SHOWN means shown to the VILLAGE. Tam is an ordinary member
     * who is not on the slate, not on the roll and did not choose either, and
     * he is the reader this control is about.
     */
    const [running] = await launchBallots();
    const declined = await call("POST", `/api/governance/ballots/${running.id}/steward-slate`, {
      token: founderToken,
      body: { accept: false },
    });
    expect(declined.status, JSON.stringify(declined.json)).toBe(200);
    expect(declined.json?.answer).toBe("declined");

    const seen = await call("GET", `/api/governance/ballots/${running.id}/steward-slate`, { token: tamToken });
    expect(seen.status, JSON.stringify(seen.json)).toBe(200);
    expect(seen.json?.members?.length).toBe(1);
    expect(seen.json?.members?.[0]?.answer, "an ordinary member can see it").toBe("declined");
    expect(seen.json?.members?.[0]?.declinedAt, "with the time it was given").toBeTruthy();
    expect(seen.json?.members?.[0]?.mine, "and it is not his").toBe(false);
    expect(String(seen.json?.proposedBy), "the page can say whose list this was").toBeTruthy();
    expect(seen.json?.powerCount).toBe(HANDOVER_SET.length);

    // AND SOMEBODY THE PROPOSAL NEVER NAMED HAS NOTHING TO ANSWER. The known
    // positive is the 200 four lines up, from the same route. Ida is a founder
    // on the roll, and the proposal still did not name her.
    const notNamed = await call("POST", `/api/governance/ballots/${running.id}/steward-slate`, {
      token: idaToken,
      body: { accept: true },
    });
    expect(notNamed.status).toBe(409);
    expect(String(notNamed.json?.error)).toContain("did not name you");
  });

  it("refuses a second one while the first is running", async () => {
    const again = await call("POST", "/api/admin/launch/propose");
    expect(again.status).toBe(409);
    expect(String(again.json?.error)).toContain("already voting");
    expect((await launchBallots()).length).toBe(1);
  });

  it("is a founder's act to open, and nobody else's", async () => {
    const notFounder = await call("POST", "/api/admin/launch/propose", { token: tamToken });
    expect(notFounder.status).toBe(403);
  });
});

describe.skipIf(!DB_CONFIGURED)("two founders say yes and the third never answers", () => {
  it("does not carry on two, nobody can close it early by hand, and the clock closes it as no_quorum", async () => {
    const [running] = await launchBallots();
    const first = await vote(running.id, founderToken, "yes");
    expect(first.status).toBe(200);
    expect(first.json?.carried).toBe(false);
    const second = await vote(running.id, wrenToken, "yes");
    expect(second.status).toBe(200);
    expect(second.json?.carried, "two yeses are not three").toBe(false);
    expect((await launchBallots())[0].status).toBe("open");

    // NOBODY CHOOSES THE MOMENT. The founder is an admin and may close an
    // ordinary ballot early; this one is refused, because Ida can still answer.
    const early = await call("POST", `/api/governance/ballots/${running.id}/close`, {
      body: { outcomeNote: "Ida is away." },
    });
    expect(early.status, JSON.stringify(early.json)).toBe(400);
    expect(String(early.json?.error)).toContain("stays open for its whole window");
    expect((await launchBallots())[0].status).toBe("open");

    await expire(running.id);
    const closed = await call("POST", `/api/governance/ballots/${running.id}/close`, {
      body: { outcomeNote: "Ida was away and the window ended on two yeses." },
    });
    expect(closed.status, JSON.stringify(closed.json)).toBe(200);
    expect(closed.json?.outcome).toBe("no_quorum");

    expect(await gameStartRow()).toBeNull();
    const status = await call("GET", "/api/admin/launch");
    expect(status.json?.launchedAt).toBeNull();
    const stillRefused = await tryToIssue("A hand-mint after a vote that missed");
    expect(stillRefused.status).toBe(400);
    expect(String(stillRefused.json?.error)).toContain("has not started its Game");
  });

  it("can be asked again the same hour, on a new freeze", async () => {
    /*
     * FOUNDERS ONLY, FOR THIS FIRST SEASON, refused at the door. Tam is a
     * member, and the known positive is the proposal two lines below, which
     * opens with no slate at all.
     */
    const badSlate = await call("POST", "/api/admin/launch/propose", { body: { slate: [tamId] } });
    expect(badSlate.status, JSON.stringify(badSlate.json)).toBe(409);
    expect(String(badSlate.json?.error)).toContain("Only founding members");
    expect((await launchBallots()).length, "and it opened nothing on its way out").toBe(1);

    const again = await call("POST", "/api/admin/launch/propose");
    expect(again.status, JSON.stringify(again.json)).toBe(200);
    const rows = await launchBallots();
    expect(rows.length).toBe(2);
    expect(rows[0].status).toBe("no_quorum");
    expect(rows[1].status).toBe("open");
    // The ballot that missed keeps its own frozen roll and its own dials.
    expect(rows[0].roll).toBe(3);
    expect(Number(rows[1].unity)).toBe(100);
    expect(Number(rows[1].quorum)).toBe(100);

    // The journey page can say the village asked before.
    const status = await call("GET", "/api/admin/launch");
    expect(status.json?.vote?.past?.length).toBe(1);
    expect(status.json?.vote?.past?.[0]?.status).toBe("no_quorum");
    expect(status.json?.vote?.openBallot?.id).toBe(rows[1].id);
  });
});

describe.skipIf(!DB_CONFIGURED)("a founder says no, and the no is still standing when the window ends", () => {
  it("is held while it is open, and closes as failed with the Game where it was", async () => {
    const rows = await launchBallots();
    const running = rows[rows.length - 1];
    expect((await vote(running.id, founderToken, "yes")).status).toBe(200);
    expect((await vote(running.id, wrenToken, "yes")).status).toBe(200);
    const no = await vote(running.id, idaToken, "no");
    expect(no.status).toBe(200);
    expect(no.json?.carried).toBe(false);

    // HELD IS NOT FAILED. Ida may still withdraw her no, so nobody closes it over her head.
    const early = await call("POST", `/api/governance/ballots/${running.id}/close`, {
      body: { outcomeNote: "Ida said no." },
    });
    expect(early.status, JSON.stringify(early.json)).toBe(400);
    expect(String(early.json?.error)).toContain("somebody who said no can still change their answer");
    expect((await launchBallots()).at(-1)?.status).toBe("open");

    await expire(running.id);
    const closed = await call("POST", `/api/governance/ballots/${running.id}/close`, {
      body: { outcomeNote: "Ida wants the exit terms rewritten before we begin." },
    });
    expect(closed.status, JSON.stringify(closed.json)).toBe(200);
    expect(closed.json?.outcome).toBe("failed");
    expect(await gameStartRow()).toBeNull();
  });
});

describe.skipIf(!DB_CONFIGURED)("a no that holds, is withdrawn, and the third yes carries it", () => {
  it("carries the moment the third founder says yes, and that is the moment token issuance opens", async () => {
    const opened = await call("POST", "/api/admin/launch/propose", { body: { slate: [founderId] } });
    expect(opened.status, JSON.stringify(opened.json)).toBe(200);
    const rows = await launchBallots();
    const running = rows[rows.length - 1];
    expect(running.status).toBe("open");

    /*
     * THE FOUNDER ACCEPTS THE NOMINATION AND WREN SETS THE FLAG WITHOUT ONE,
     * which is the whole of 0220 driven through the real door. Since the slate
     * exists, `standsForSteward` means "I accept the nomination this proposal
     * made of me", so Wren's is an answer to a question nobody asked her and
     * the seating below has to ignore it. She IS a founding member now, so the
     * slate rule alone is what stops her; the unit control that isolates the
     * slate rule from the founder rule is in `server/stewardSlate.db.test.ts`.
     */
    const stood = await vote(running.id, founderToken, "yes", true);
    expect(stood.status, JSON.stringify(stood.json)).toBe(200);
    expect(stood.json?.standsForSteward, "the route recorded the acceptance, and said so").toBe(true);
    const wrenStood = await vote(running.id, wrenToken, "yes", true);
    expect(wrenStood.status).toBe(200);
    expect(wrenStood.json?.standsForSteward, "anybody may set it; the seating is where it is weighed").toBe(true);

    // IDA SAYS NO, AND THE NO HOLDS IT. Two yeses and a no, and nothing has started.
    const held = await vote(running.id, idaToken, "no");
    expect(held.status).toBe(200);
    expect(held.json?.carried).toBe(false);
    expect(await gameStartRow()).toBeNull();

    // A FOUNDER MAY CHANGE YES TO NO UNTIL IT CARRIES, and back again.
    expect((await vote(running.id, wrenToken, "no", true)).json?.carried).toBe(false);
    expect((await vote(running.id, wrenToken, "yes", true)).json?.carried).toBe(false);

    // IDA WITHDRAWS HER NO BY SAYING YES. That is the third yes with no no
    // standing, so it carries in this request: nobody closes it, the window
    // has days left, and the response says so.
    const third = await vote(running.id, idaToken, "yes");
    expect(third.status, JSON.stringify(third.json)).toBe(200);
    expect(third.json?.carried).toBe(true);
    expect(third.json?.ballot?.status).toBe("passed");

    const [closedRow] = await pool.query<any[]>( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      "SELECT status, closed_by, outcome_note, closes_at > NOW() AS before_window_end FROM ballots WHERE id = ?",
      [running.id],
    );
    expect(String(closedRow[0].status)).toBe("passed");
    expect(String(closedRow[0].closed_by), "the rule closed it, and no person did").toBe("governance");
    expect(String(closedRow[0].outcome_note)).toContain("Enough of the people on the roll had said yes and nobody on it had said no");
    expect(Number(closedRow[0].before_window_end), "it did not wait for its window").toBe(1);

    // ONCE IT HAS CARRIED, NO ANSWER MOVES.
    const tooLate = await vote(running.id, idaToken, "no");
    expect(tooLate.status).toBe(409);
    expect(String(tooLate.json?.error)).toContain("Voting ended when it closed");

    // The two facts, written by the carry and by nothing else.
    const started = await gameStartRow();
    expect(started?.ballotId).toBe(running.id);
    expect(String(started?.startedAt)).toBeTruthy();
    const status = await call("GET", "/api/admin/launch");
    expect(String(status.json?.launchedAt)).toBeTruthy();
    expect(status.json?.launchedByBallotId).toBe(running.id);
    expect(status.json?.gameStart?.started).toBe(true);

    // And the thing the whole vote was about.
    const now = await tryToIssue("The village started its Game, so this can land");
    expect(now.status, JSON.stringify(now.json)).toBe(200);
    // Five credits, in the ledger's minor units at credits' two decimals.
    expect(now.json?.toBalance).toBe(500);
  });

  it("seats the founder who was NAMED and accepted, with a term, and leaves the others where they were", async () => {
    /*
     * Rye, 2026-09-23: "Seat them at launch." Rye, 2026-09-24: for "whomever of
     * the founding members ... carry the inaugural role", who say so by "self
     * signaling at founding". The carry is the only thing that has run since
     * the previous case, so a seat here was written by the closer and by
     * nothing else.
     *
     * Larksfield's roll is three founders, and BOTH the first founder and Wren
     * asked for the seat. Only the first was named on the slate, so this
     * drives the slate rule on a real founding member.
     */
    const rows = await launchBallots();
    const carried = rows[rows.length - 1];
    expect(carried.status).toBe("passed");

    const seats = await stewardSeats();
    expect(seats.map((s) => s.userId), "the founder who was named and accepted, and nobody else").toEqual([founderId]);
    expect(seats[0].endsAt, "no seat may enter with an indefinite time").not.toBeNull();
    expect(seats[0].endsAt!).toBeGreaterThan(Date.now());
    expect(seats[0].grantedBy, "the village put them here, not an administrator").toBe(carried.id);

    // Wren asked and was not named. The known positive for that empty answer
    // is the seat above, written by the same call.
    const [wrenAsked] = await pool.query<any[]>( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      "SELECT stands_for_steward FROM ballot_votes WHERE ballot_id = ? AND user_id = ?",
      [carried.id, wrenId],
    );
    expect(Number(wrenAsked[0]?.stands_for_steward), "they really did set it, through the route").toBe(1);

    /*
     * THE SEAT IS WORTH SOMETHING, AND IT IS WORTH ALL NINETEEN.
     *
     * Rye, 2026-09-24: the founding stewards "hold all powers at launch", which
     * he confirmed means all nineteen entrustable powers. Two facts and not
     * one: the role CARRIES each power, or nobody in it could act, and the
     * village HOLDS each power, or an administrator walks through the gate
     * with nothing anywhere saying they reached past anybody.
     *
     * Compared as whole sets against `HANDOVER_SET`, because `toContain` on one
     * key is green on a seat carrying eighteen, and eighteen is the shape of
     * the defect this lane closes.
     */
    const [roles] = await pool.query<any[]>("SELECT capabilities FROM roles WHERE id = 'steward'"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    const caps = typeof roles[0]?.capabilities === "string" ? JSON.parse(roles[0].capabilities) : roles[0]?.capabilities;
    expect([...caps].sort(), "the role carries every one of them").toEqual([...HANDOVER_SET].sort());
    // Rye, 2026-11-01: the launch hands the village only what the stewards
    // selected, and this village selected nothing. The one exception is
    // token.mint (Rye, 2026-11-15): it always crosses at launch, held by the
    // steward role, so a bare admin stops hand minting (server/lib/tokenMintHandover.ts).
    const [holdings] = await pool.query<any[]>("SELECT capability, holder_role_id FROM capability_holding"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    expect(holdings.map((h: any) => [String(h.capability), String(h.holder_role_id)]), "and only token.mint is held, by the steward role").toEqual([["token.mint", "steward"]]);

    // And the founder was told, on the same spine every other seating uses.
    const [rung] = await pool.query<any[]>( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      "SELECT title FROM notifications WHERE user_id = ? AND type = 'role_appointed'",
      [founderId],
    );
    expect(rung, "a seat nobody was told about is not a seating").toHaveLength(1);
    expect(String(rung[0].title)).toContain("Steward");

    /*
     * AND THE RUNNING PROCESS KNOWS, which is a separate fact from the rows
     * above. `roles` and `role_holders` are served from an in-process cache
     * built at boot, the capability gate reads it, and the seating writes
     * underneath it. Without the reload this payload would still be serving
     * the pre-launch answer while the database says otherwise, and the founder
     * would hold a seat nothing could see until somebody restarted the server.
     */
    const me = await call("GET", "/api/game/me");
    expect(me.status, JSON.stringify(me.json)).toBe(200);
    expect(
      ((me.json?.roles ?? []) as Array<{ id: string }>).map((r) => r.id),
      "the cache the gate reads, not the table",
    ).toContain("steward");
  });

  it("tells the founders on the roll that it carried, and puts one line on the pulse", async () => {
    const rows = await launchBallots();
    const carried = rows[rows.length - 1];
    // The roll is rung without an await, so wait for it.
    const read = async () => {
      const [r] = await pool.query<any[]>( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
        "SELECT user_id, type, title, body FROM notifications WHERE dedupe_key LIKE ? ORDER BY user_id",
        [`bal:${carried.id}:%`],
      );
      return r;
    };
    const deadline = Date.now() + 15_000;
    while ((await read()).filter((r: any) => String(r.type) === "ballot_carried").length < 2 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 150));
    }
    const told = await read();
    // Whoever opened it hears it in the launch's own words; the other two founders hear the roll's line.
    const opener = told.find((r: any) => String(r.user_id) === founderId && String(r.title).startsWith("The village started its Game"));
    expect(opener, JSON.stringify(told)).toBeTruthy();
    expect(String(opener.body)).toBe("Token issuance is open from today. Enough of the roll said yes, and nobody on it said no.");
    const rolled = told.filter((r: any) => String(r.type) === "ballot_carried").map((r: any) => String(r.user_id)).sort();
    expect(rolled).toEqual([idaId, wrenId].sort());
    // Tam was not on the roll and is not rung as if he had been asked.
    expect(told.some((r: any) => String(r.user_id) === tamId)).toBe(false);

    const [pulse] = await pool.query<any[]>( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      "SELECT COUNT(*) AS n FROM health_events WHERE kind = 'governance' AND text = 'The village started its Game: its launch vote carried.'",
    );
    expect(Number(pulse[0].n)).toBe(1);
  });

  it("pays the work that was waiting, because the claim was never stranded", async () => {
    // The other half of the guard in the first describe. Wren's quest was
    // submitted before the village started and is consented now, at full value.
    const consent = await call("POST", `/api/admin/quest-claims/${claimId}/consent`, {
      body: { approve: true, amount: 10 },
    });
    expect(consent.status, JSON.stringify(consent.json)).toBe(200);
    expect(await claimStatus(claimId)).toBe("consented");
  });

  it("says so to every member, with no admin login", async () => {
    const anon = await call("GET", "/api/game/mechanics", { token: null });
    expect(anon.json?.gameStart?.started).toBe(true);
    expect(String(anon.json?.gameStart?.ballotId)).toMatch(/^bal-/);
  });

  it("keeps the record when a manual checklist item is ticked afterwards", async () => {
    /*
     * The clobber this file exists to catch. `confirmManual` used to read the
     * launch-state document whole and put it back whole, so an admin ticking a
     * checklist item after the vote carried could erase the launch. It now
     * writes only its own row and refuses once the village has launched (audit
     * S3, server/lib/launchConfirmLaunched.test.ts stages the race), so after
     * the launch both answers are refused and the record stands.
     */
    const before = (await call("GET", "/api/admin/launch")).json;
    expect(String(before.launchedAt)).toBeTruthy();

    for (const done of [false, true]) {
      const r = await call("POST", "/api/admin/launch/confirm", { body: { id: "backups-drilled", done } });
      expect(r.status, JSON.stringify(r.json)).toBe(400);
      expect(String(r.json?.error)).toMatch(/already launched/);
    }

    const after = (await call("GET", "/api/admin/launch")).json;
    expect(after.launchedAt).toBe(before.launchedAt);
    expect(after.launchedByBallotId).toBe(before.launchedByBallotId);
    expect(after.gameStart?.started).toBe(true);
  });

  it("AFTER LAUNCH a keystone key waits for a second person, and nothing is saved until then", async () => {
    // The setup game's co-sign (server/routes/plantingRequests.ts): the launch ballot carried above.
    const KEY = "sk_live_launchvote_cosign_77aa";
    const put = await call("PUT", "/api/admin/integrations/stripe_secret_key", { body: { value: KEY } });
    expect(put.status, JSON.stringify(put.json)).toBe(202);
    expect(put.json?.asked).toBe(true);
    expect(JSON.stringify(put.json)).not.toContain(KEY);
    const integrations = await call("GET", "/api/admin/integrations");
    expect((integrations.json?.secrets as any[]).find((s) => s.key === "stripe_secret_key")?.configured).toBe(false);
    const waiting = await call("GET", "/api/admin/planting-requests");
    expect(waiting.status, JSON.stringify(waiting.json)).toBe(200);
    const mine = (waiting.json?.waiting as any[]).find((w) => w.slot === "stripe_secret_key");
    expect(mine?.last4).toBe("77aa");
    expect(JSON.stringify(waiting.json)).not.toContain(KEY);
    // The person who asked cannot be the second person, and a member who is not an admin cannot co-sign.
    expect((await call("POST", `/api/admin/planting-requests/${mine.id}/cosign`)).status).toBe(409);
    expect((await call("POST", `/api/admin/planting-requests/${mine.id}/cosign`, { token: tamToken })).status).toBe(403);
    // Clearing a key is never held: a leaked key can always be pulled at once.
    expect((await call("PUT", "/api/admin/integrations/stripe_secret_key", { body: { value: "" } })).status).toBe(200);
    // The asker withdraws, and the request leaves the list.
    expect((await call("POST", `/api/admin/planting-requests/${mine.id}/decline`)).status).toBe(200);
    expect(((await call("GET", "/api/admin/planting-requests")).json?.waiting as any[]).length).toBe(0);
  });

  it("cannot be started twice", async () => {
    const again = await call("POST", "/api/admin/launch/propose");
    expect(again.status).toBe(409);
    expect(String(again.json?.error)).toContain("already started its Game");
  });

  it("closes the launch's two settings to the panel once the Game has started: only the village's vote moves them", async () => {
    // Before the Game started the founder set both (two cases in the first
    // describe). The same writes now are refused and pointed at a proposal.
    for (const [key, value] of [["governance.launch_roll", "members"], ["governance.launch_min_electorate", "5"]] as const) {
      const r = await call("PUT", `/api/admin/variables/${key}`, { body: { value } });
      expect(r.status, `${key}: ${JSON.stringify(r.json)}`).toBe(409);
      expect(r.json?.code, key).toBe("vote_rule_dial_closed_at_launch");
      expect(r.json?.proposeInstead, key).toBe(true);
    }
  });
});
