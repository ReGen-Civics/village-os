/**
 * The role-journey measures on a real schema (L11). Tolerant of lanes that have
 * not landed: the application, onboarding and renewal tables may not exist here,
 * and that reads as nothing, never as an error. A visitor is 401, a member who leads no circle
 * 403, and what an admin gets carries no person.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "./db/testDb";
import { register } from "./routes/roleMeasures";
import { applicationFacts, holderFacts } from "./repos/roleMeasures";
import { MEASURE_KEYS } from "../shared/roleMeasures";

const configured = testDbConfigured();
if (!configured) console.warn("[roleMeasures.db] TEST_DATABASE_URL not set - DB cases SKIPPED. A skip is not a pass.");

describe.skipIf(!configured)("role measures, on a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let who: string | null = null;
  let admin = false;
  let handler: (req: any, res: any) => Promise<unknown>;
  const call = async () => {
    const out: { status: number; body: any } = { status: 200, body: undefined };
    const res: any = { status: (c: number) => ((out.status = c), res), json: (b: unknown) => ((out.body = b), res) };
    await handler({ headers: {} }, res);
    return out;
  };

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    register({ get: (path: string, h: any) => path === "/api/role-measures" && (handler = h) } as any, {
      getPool: () => pool as any,
      authedUser: async () => (who ? ({ id: who } as any) : null),
      isAdmin: async () => !!who && admin,
      overLimit: async () => false,
    });
  });
  afterAll(async () => {
    await pool?.end();
    await db?.drop?.();
  });

  it("reads tables that are missing as no facts", async () => {
    await pool.query("DROP TABLE IF EXISTS application_steps, onboarding_paths, onboarding_items, role_moon_renewals"); // module-review-ok: fixture DDL on the scratch schema
    expect(await applicationFacts(pool as any)).toEqual([]);
    expect(await holderFacts(pool as any)).toEqual([]);
  });

  it("refuses a visitor", async () => {
    who = null;
    expect((await call()).status).toBe(401);
  });

  it("refuses a signed-in member who is not an admin", async () => {
    who = "m-1";
    admin = false;
    const out = await call();
    expect(out.status).toBe(403);
    expect(out.body.rows).toBeUndefined();
  });

  it("lets a circle's lead in through a kept lead seat, and refuses a rested or example one", async () => {
    await pool.query("INSERT INTO `circles` (`id`, `name`, `aliases`, `is_example`) VALUES ('c-lead', 'Lead circle', '[]', 0)"); // module-review-ok: fixture rows on the scratch schema, for the lead-seat scope
    await pool.query("INSERT INTO `org_roles` (`id`, `circle_id`, `name`, `active`, `is_example`) VALUES ('r-lead', 'c-lead', 'Lead seat', 1, 0)"); // module-review-ok: fixture rows
    await pool.query("UPDATE `circles` SET `lead_role_id` = 'r-lead' WHERE `id` = 'c-lead'"); // module-review-ok: fixture rows
    await pool.query( // module-review-ok: fixture rows
      "INSERT INTO `org_role_assignments` (`id`, `org_role_id`, `holder_kind`, `user_id`, `holder_key`, `is_example`) VALUES ('s-lead', 'r-lead', 'member', 'lead-1', 'member:lead-1', 0)",
    );
    // The rows go whatever the assertions say, so a failure here never leaves a lead seat for the next test.
    try {
      who = "lead-1";
      admin = false;
      const kept = await call();
      expect(kept.status).toBe(200);
      expect(kept.body.scope).toBe("circles");
      // The circle rests the seat: its live holder reads nothing.
      await pool.query("UPDATE `org_roles` SET `active` = 0 WHERE `id` = 'r-lead'"); // module-review-ok: fixture rows
      expect((await call()).status).toBe(403);
      // An example lead seat opens nothing either.
      await pool.query("UPDATE `org_roles` SET `active` = 1, `is_example` = 1 WHERE `id` = 'r-lead'"); // module-review-ok: fixture rows
      expect((await call()).status).toBe(403);
    } finally {
      await pool.query("DELETE FROM `org_role_assignments` WHERE `id` = 's-lead'"); // module-review-ok: fixture rows
      await pool.query("UPDATE `circles` SET `lead_role_id` = NULL WHERE `id` = 'c-lead'"); // module-review-ok: fixture rows
      await pool.query("DELETE FROM `org_roles` WHERE `id` = 'r-lead'"); // module-review-ok: fixture rows
      await pool.query("DELETE FROM `circles` WHERE `id` = 'c-lead'"); // module-review-ok: fixture rows
    }
  });

  it("gives an admin rows with the declared keys and no person", async () => {
    who = "a-1";
    admin = true;
    await pool.query("CREATE TABLE IF NOT EXISTS application_steps (id bigint AUTO_INCREMENT PRIMARY KEY, application_ref varchar(64), kind varchar(16), subject varchar(32) DEFAULT '', stamped_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))"); // module-review-ok: fixture table for the scratch schema
    await pool.query("INSERT INTO application_steps (application_ref, kind, stamped_at) VALUES ('op-aaa','confirmed','2026-01-01 00:00:00'),('op-aaa','first_reply','2026-01-01 05:00:00')"); // module-review-ok: fixture rows
    const out = await call();
    expect(out.status).toBe(200);
    expect(out.body.rows).toHaveLength(1);
    const keys = Object.keys(out.body.rows[0]).filter((k) => k !== "circleName").sort();
    expect(keys).toEqual([...MEASURE_KEYS.row].sort());
    expect(JSON.stringify(out.body)).not.toMatch(/op-aaa|a-1/);
    await pool.query("DROP TABLE application_steps"); // module-review-ok: fixture DDL on the scratch schema
  });
});
