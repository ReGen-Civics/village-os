/**
 * A LAUNCH-CHECKLIST ANSWER NEVER ERASES THE LAUNCH (audit S3).
 *
 * `confirmManual` read the whole `launch-state` document and wrote the whole of
 * it back. The launch closer writes `launchedAt` into the same document, so a
 * confirm that read before the close and wrote after it erased the launch. It
 * now writes only its own row's keys, and only while the village has not
 * launched; after the launch it is refused.
 *
 * The race is staged exactly: a pool that runs the closer's write the moment
 * the confirm has read the document, which is the window the old code lost in.
 */
import mysql from "mysql2/promise";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testPool, provisionTestDb, testDbConfigured, type TestDb } from "../db/testDb";
import { LAUNCHED_CONFIRM_REFUSAL, confirmManual, launchedAtOf, launchedByBallotIdOf, recordLaunchCarried } from "./launch";
import { LAUNCH_REQUIREMENTS } from "../../shared/launchRequirements";

const configured = testDbConfigured();

const MANUAL = LAUNCH_REQUIREMENTS.find((r) => r.checkKey.startsWith("manual:"))!.id;
const DECLINABLE = LAUNCH_REQUIREMENTS.find((r) => r.declinable)!.id;

let db: TestDb;
let pool: mysql.Pool;

const doc = async (): Promise<any> => {
  const [[row]]: any = await pool.query("SELECT value FROM app_config WHERE config_key = 'launch-state'"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  if (!row) return null;
  return typeof row.value === "string" ? JSON.parse(row.value) : row.value;
};

describe.skipIf(!configured)("a checklist answer and the launch close", () => {
  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 }); // module-review-ok: the S5 scratch-schema harness pool
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM app_config WHERE config_key = 'launch-state'"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  });

  it("writes only its own row and keeps the other answers", async () => {
    expect(await confirmManual(pool, MANUAL, "usr-founder", true)).toEqual({ ok: true, answer: "done" });
    expect(await confirmManual(pool, DECLINABLE, "usr-founder", "declined")).toEqual({ ok: true, answer: "declined" });
    const d = await doc();
    expect(d.manualConfirms[MANUAL].by).toBe("usr-founder");
    expect(d.declines[DECLINABLE].by).toBe("usr-founder");
    expect(await confirmManual(pool, MANUAL, "usr-founder", false)).toEqual({ ok: true, answer: "retracted" });
    const after = await doc();
    expect(after.manualConfirms[MANUAL]).toBeUndefined();
    expect(after.declines[DECLINABLE].by, "a retract touches its own row only").toBe("usr-founder");
  });

  it("answers an older document that carries neither map", async () => {
    await pool.query("INSERT INTO app_config (config_key, value) VALUES ('launch-state', ?)", [JSON.stringify({ launchedAt: null })]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    expect((await confirmManual(pool, MANUAL, "usr-founder", true)).ok).toBe(true);
    expect((await doc()).manualConfirms[MANUAL].by).toBe("usr-founder");
  });

  it("is refused after the launch, and the launch stands", async () => {
    await confirmManual(pool, MANUAL, "usr-founder", true);
    await recordLaunchCarried(pool, { ballotId: "bal-launch", closedBy: "usr-closer" });
    const r = await confirmManual(pool, MANUAL, "usr-founder", false);
    expect(r).toEqual({ ok: false, error: LAUNCHED_CONFIRM_REFUSAL });
    expect(await launchedByBallotIdOf(pool)).toBe("bal-launch");
    expect((await doc()).manualConfirms[MANUAL].by, "the record of the answer stays").toBe("usr-founder");
  });

  it("loses the race to the closer without erasing the launch", async () => {
    let fired = false;
    const racing = new Proxy(pool, {
      get(target, prop, receiver) {
        if (prop !== "query") return Reflect.get(target, prop, receiver);
        return async (sql: any, params?: any) => {
          const out = await (target as any).query(sql, params);
          if (!fired && typeof sql === "string" && sql.startsWith("SELECT value FROM app_config WHERE config_key = 'launch-state'")) {
            fired = true;
            await recordLaunchCarried(target, { ballotId: "bal-launch", closedBy: "usr-closer" });
          }
          return out;
        };
      },
    }) as mysql.Pool;
    const r = await confirmManual(racing, MANUAL, "usr-founder", true);
    expect(fired).toBe(true);
    expect(r).toEqual({ ok: false, error: LAUNCHED_CONFIRM_REFUSAL });
    expect(await launchedAtOf(pool)).not.toBeNull();
    expect(await launchedByBallotIdOf(pool)).toBe("bal-launch");
  });
});
