/**
 * THE LAUNCH MOVES THE SELECTION ITS VOTE OPENED WITH (audit S3).
 *
 * The launch document tells the roll which powers the launch hands over, read
 * off the stewards' selection when the vote opens. The closer used to read the
 * live selection again at the close, so a selection edited in between crossed
 * powers the roll never read. The copy is now frozen beside the ballot when it
 * opens, and both crossings (at the launch, and the owed one at the first
 * vote-seating) move that copy.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "./db/testDb";
import { HANDOVER_SET } from "../shared/capabilities";
import {
  freezeLaunchSelection,
  frozenLaunchSelection,
  owedLaunchBallotId,
  writeLaunchCrossing,
  writeLaunchSelection,
} from "./lib/launchHandover";
import { crossLaunchSelection, crossOwedLaunchSelection, STEWARD_ROLE_ID } from "./lib/stewardship";

const configured = testDbConfigured();
const [A, B] = HANDOVER_SET;

describe.skipIf(!configured)("the launch's frozen hand-over selection", () => {
  let db: TestDb;
  let pool: Pool;
  const q = async (sql: string, params: unknown[] = []) => (await pool.query<any[]>(sql, params))[0]; // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  const held = async () => (await q("SELECT capability FROM capability_holding ORDER BY capability")).map((r: any) => String(r.capability)); // module-review-ok: fixture SQL against the S5 scratch schema

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 }); // module-review-ok: the suite's own pool onto the scratch schema it provisioned
    await q("INSERT INTO roles (id, name, capabilities) VALUES (?,?,?)", [STEWARD_ROLE_ID, "Steward", JSON.stringify([...HANDOVER_SET])]); // module-review-ok: fixture SQL against the S5 scratch schema
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  beforeEach(async () => {
    await q("DELETE FROM capability_holding"); // module-review-ok: fixture SQL against the S5 scratch schema
    await q("DELETE FROM app_config WHERE config_key LIKE 'launch-%'"); // module-review-ok: fixture SQL against the S5 scratch schema
  });

  it("reads the copy only for the ballot it names", async () => {
    await freezeLaunchSelection(pool, "bal-launch", [A]);
    expect(await frozenLaunchSelection(pool, "bal-launch")).toEqual([A]);
    expect(await frozenLaunchSelection(pool, "bal-other")).toBeNull();
  });

  it("crosses what the vote opened with, not a selection edited since", async () => {
    await freezeLaunchSelection(pool, "bal-launch", [A]);
    await writeLaunchSelection(pool, [A, B], "usr-steward");
    const crossed = await crossLaunchSelection(pool, "bal-launch", "test", "bal-launch");
    expect(crossed.moved).toEqual([A]);
    expect(await held()).toEqual([A]);
  });

  it("an empty frozen selection moves nothing, whatever the live one says", async () => {
    await freezeLaunchSelection(pool, "bal-launch", []);
    await writeLaunchSelection(pool, [A, B], "usr-steward");
    expect((await crossLaunchSelection(pool, "bal-launch", "test", "bal-launch")).moved).toEqual([]);
    expect(await held()).toEqual([]);
  });

  it("a vote opened before the copy existed reads the live selection", async () => {
    await writeLaunchSelection(pool, [B], "usr-steward");
    expect((await crossLaunchSelection(pool, "bal-old", "test", "bal-old")).moved).toEqual([B]);
  });

  it("the owed crossing at the first vote-seating moves the launch's copy", async () => {
    await freezeLaunchSelection(pool, "bal-launch", [A]);
    await writeLaunchSelection(pool, [A, B], "usr-steward");
    await writeLaunchCrossing(pool, "waiting", new Date(), "bal-launch");
    expect(await owedLaunchBallotId(pool)).toBe("bal-launch");
    const crossed = await crossOwedLaunchSelection(pool, "bal-seat");
    expect(crossed?.moved).toEqual([A]);
    expect(await held()).toEqual([A]);
  });
});
