/**
 * THE RATIFYING LAUNCH VOTE: who may hold one, and what it never moves.
 *
 * Rye, 27 Nov 2026: the first village holds "one ratifying launch vote that
 * does not restart issuance". Pins `server/lib/launchRatify.ts` against the
 * real `game-start` and `launch-state` documents on the S5 harness:
 *
 *  - a village migration 0112 recorded (issuing, no ballot) may ratify;
 *  - a village that has not started, one that started by its own vote, and the
 *    test fixture's started village may not;
 *  - recording the ratification writes the launch and leaves `game-start`
 *    byte for byte as it was, so the day issuance began does not move and its
 *    ballot id stays null, which is what `handTokenMintOverFor0112` keys on;
 *  - once ratified, the village may not ratify again.
 *
 * No TEST_DATABASE_URL: the database cases skip, and an unfiltered run fails on
 * the way out (house rule).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "mysql2/promise";
import { testPool, provisionTestDb, testDbConfigured, type TestDb } from "../db/testDb";
import { readGameStart, recordGameStart, founderPowerStands } from "./gameStart";
import { launchBallotCarried, launchedAtOf, launchedByBallotIdOf, recordLaunchCarried } from "./launch";
import { isRatifying, issuingSinceDay, ratifyStanding, RATIFY_WORDS } from "./launchRatify";
import { nobodyStood, stewardsHeld } from "./launchSeating";

const DB = testDbConfigured();
if (!DB) console.warn("[launchRatify.db] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

let testDb: TestDb;
let pool: Pool;

const ISSUING_SINCE = "2026-03-14T09:26:53Z";
const ROW_0112 = {
  startedAt: ISSUING_SINCE,
  ballotId: null,
  startedBy: null,
  note: "This village was already issuing tokens before the launch vote existed. Migration 0112 read that from the ledger and recorded the Game as started, with no ballot behind it.",
};

const setGameStart = async (doc: unknown | null) => {
  await pool.query("DELETE FROM app_config WHERE config_key = 'game-start'"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  if (doc) await pool.query("INSERT INTO app_config (config_key, value) VALUES ('game-start', ?)", [JSON.stringify(doc)]); // module-review-ok: the same
};
const rawGameStart = async (): Promise<unknown> => {
  const [rows] = await pool.query<any[]>("SELECT value FROM app_config WHERE config_key = 'game-start'"); // module-review-ok: the same
  if (!rows[0]) return null;
  return typeof rows[0].value === "string" ? JSON.parse(rows[0].value) : rows[0].value;
};

beforeAll(async () => {
  if (!DB) return;
  testDb = await provisionTestDb({ gameStarted: false });
  pool = testPool(testDb, { connectionLimit: 2 }); // module-review-ok: the suite's own pool onto the scratch schema it provisioned
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await testDb?.drop();
});

beforeEach(async () => {
  if (!DB) return;
  await setGameStart(null);
  await pool.query("DELETE FROM app_config WHERE config_key = 'launch-state'"); // module-review-ok: the same
});

describe("which ballot is a ratifying one, read from the fact", () => {
  const started = (ballotId: string | null) => ({ started: true, startedAt: ISSUING_SINCE, ballotId, startedBy: null, note: "" });
  const notStarted = { started: false, startedAt: null, ballotId: null, startedBy: null, note: "" };

  it("a village that was issuing before this ballot is being ratified", () => {
    expect(isRatifying(started(null), "bal-now")).toBe(true);
  });
  it("a village this ballot started is not, however often the closer is run again", () => {
    expect(isRatifying(started("bal-now"), "bal-now")).toBe(false);
  });
  it("a village that has not started is starting, not ratifying", () => {
    expect(isRatifying(notStarted, "bal-now")).toBe(false);
  });
  it("reads the day issuance began for a sentence, and says nothing when it cannot", () => {
    expect(issuingSinceDay(ISSUING_SINCE)).toBe("2026-03-14");
    expect(issuingSinceDay(null)).toBe("");
    expect(issuingSinceDay("soon")).toBe("");
  });
  it("says ratify where a first launch says issuance starts, in every sentence it holds", () => {
    const all = [
      RATIFY_WORDS.title("Wealden"), RATIFY_WORDS.deciding, RATIFY_WORDS.carriedTitle("Ratify the launch of Wealden"),
      RATIFY_WORDS.carriedBody(ISSUING_SINCE), RATIFY_WORDS.carriedBody(null), RATIFY_WORDS.carriedPulse,
      RATIFY_WORDS.shortTitle, RATIFY_WORDS.shortBody, RATIFY_WORDS.notRatifiedTitle,
    ];
    for (const s of all) {
      expect(s, s).not.toMatch(/start(s|ed)? (its|the) Game/i);
      expect(s, s).not.toMatch(/issuance (is )?(open|opens|turns on|starts) from today/i);
      expect(s, s).not.toMatch(/[–—]/);
    }
    expect(RATIFY_WORDS.carriedBody(ISSUING_SINCE)).toBe("The launch is on the record. Token issuance began on 2026-03-14, and that date has not moved.");
  });
});

describe("the steward seating, on a ratifying carry", () => {
  it("says the launch was ratified in every sentence it writes, and never that the Game started", () => {
    const ratified = [
      stewardsHeld("The running season has no end date.", true),
      nobodyStood(0, 0, true),
      nobodyStood(2, 2, true),
      nobodyStood(2, 0, true),
    ];
    for (const s of ratified) {
      expect(s, s).toContain("The village ratified its launch");
      expect(s, s).not.toContain("started its Game");
    }
    // Control: a first launch reads exactly as it did, and the default is a first launch.
    for (const s of [stewardsHeld("The running season has no end date."), nobodyStood(0, 0), nobodyStood(2, 2), nobodyStood(2, 0)]) {
      expect(s, s).toContain("The village started its Game");
      expect(s, s).not.toContain("ratified");
    }
  });
});

describe.skipIf(!DB)("who may hold a ratifying vote (MySQL)", () => {
  it("a village migration 0112 recorded may: issuing, with no ballot and no launch on record", async () => {
    await setGameStart(ROW_0112);
    const standing = await ratifyStanding(pool);
    expect(standing.mayRatify).toBe(true);
    expect(standing.issuingSince).toBe(ISSUING_SINCE);
    // The founder role already ended for it when issuance began (R90), which is why its path is a vote.
    expect(await founderPowerStands(pool)).toBe(false);
  });

  it("a village that has not started may not: its vote starts the Game", async () => {
    const standing = await ratifyStanding(pool);
    expect(standing.mayRatify).toBe(false);
    expect(standing.issuingSince).toBeNull();
  });

  it("a village that started by its own vote may not, and neither may the test fixture's", async () => {
    await recordGameStart(pool, { ballotId: "bal-real", startedBy: "u-closer", note: "The village voted to start its Game." });
    expect((await ratifyStanding(pool)).mayRatify).toBe(false);
    await setGameStart({ ...ROW_0112, ballotId: "bal-fixture", startedBy: "test-harness" });
    expect((await ratifyStanding(pool)).mayRatify).toBe(false);
  });
});

describe.skipIf(!DB)("what a ratification writes, and what it never moves (MySQL)", () => {
  it("records the launch and leaves game-start byte for byte as migration 0112 wrote it", async () => {
    await setGameStart(ROW_0112);
    const before = await rawGameStart();

    // What the launch closer does on a ratifying carry: the second write alone.
    const recorded = await recordLaunchCarried(pool, { ballotId: "bal-ratify", closedBy: "governance", at: new Date("2026-12-29T18:00:00Z") });
    expect(recorded.alreadyRecorded).toBe(false);

    // THE DAY ISSUANCE BEGAN HAS NOT MOVED, and no ballot was written onto it.
    expect(await rawGameStart()).toEqual(before);
    const fact = await readGameStart(pool);
    expect(fact.startedAt).toBe(ISSUING_SINCE);
    expect(fact.ballotId, "what handTokenMintOverFor0112 keys on").toBeNull();

    // The launch is on the record, at the day of the vote, with the ballot that did it.
    expect(await launchedAtOf(pool)).toBe("2026-12-29T18:00:00.000Z");
    expect(await launchedByBallotIdOf(pool)).toBe("bal-ratify");
    expect(await launchBallotCarried(pool)).toBe(true);
  });

  it("is held once: a ratified village may not ratify again, and a second record changes nothing", async () => {
    await setGameStart(ROW_0112);
    await recordLaunchCarried(pool, { ballotId: "bal-ratify", closedBy: "governance", at: new Date("2026-12-29T18:00:00Z") });
    expect((await ratifyStanding(pool)).mayRatify).toBe(false);
    const again = await recordLaunchCarried(pool, { ballotId: "bal-second", closedBy: "governance", at: new Date("2027-01-05T00:00:00Z") });
    expect(again.alreadyRecorded).toBe(true);
    expect(await launchedByBallotIdOf(pool)).toBe("bal-ratify");
    expect(await launchedAtOf(pool)).toBe("2026-12-29T18:00:00.000Z");
  });

  it("control: a first launch still writes both, so the two cases are told apart by the fact", async () => {
    const startedNow = await recordGameStart(pool, { ballotId: "bal-first", startedBy: "governance", note: "The village voted to start its Game." });
    await recordLaunchCarried(pool, { ballotId: "bal-first", closedBy: "governance" });
    expect(startedNow.ballotId).toBe("bal-first");
    expect(isRatifying(await readGameStart(pool), "bal-first")).toBe(false);
    expect((await ratifyStanding(pool)).mayRatify).toBe(false);
  });
});
