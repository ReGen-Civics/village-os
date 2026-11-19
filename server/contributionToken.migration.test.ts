/**
 * 0411 RUN, NOT REVIEWED: the contribution token's untouched seeded name moves to the platform default, and a
 * village's own name never does (the lead, 19 Nov 2026: members never read "equity" for this token).
 *
 * The file is read off disk and executed through the runner's own `splitStatements`, so this exercises the bytes
 * that run at boot. The provisioned schema has already applied 0411 once.
 */
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "./db/testDb";
import { splitStatements } from "./db/migrate";

const configured = testDbConfigured();
if (!configured) {
  // eslint-disable-next-line no-console
  console.warn("[contributionToken.migration] TEST_DATABASE_URL not set. This suite SKIPPED.");
}

const MIGRATION = path.join(process.cwd(), "drizzle", "0411_the_contribution_token_is_not_called_equity.sql");

describe.skipIf(!configured)("0411, the contribution token is not called equity", () => {
  let db: TestDb;
  let pool: mysql.Pool;

  const runMigration = async () => {
    for (const sql of splitStatements(fs.readFileSync(MIGRATION, "utf-8"))) {
      await pool.query(sql); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    }
  };
  const token = async () => {
    const [rows] = await pool.query<any[]>("SELECT `slug`, `name`, `description`, `kind` FROM `tokens` WHERE `slug` = 'earned-equity'"); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
    return rows[0];
  };
  const rename = (name: string) => pool.query("UPDATE `tokens` SET `name` = ? WHERE `slug` = 'earned-equity'", [name]); // module-review-ok: fixture standing in for a founder's rename in Admin then Tokens

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 2 });
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  it("is one statement, and a fresh village reads the platform default", async () => {
    expect(splitStatements(fs.readFileSync(MIGRATION, "utf-8"))).toHaveLength(1);
    expect(await token()).toMatchObject({ slug: "earned-equity", name: "Contribution tokens", kind: "equity" });
  });

  it("moves the untouched seeded name, leaves the description alone, and a second run changes nothing", async () => {
    await rename("Earned Equity");
    const description = (await token()).description;
    await runMigration();
    expect(await token()).toMatchObject({ name: "Contribution tokens", description });
    await runMigration();
    expect((await token()).name).toBe("Contribution tokens");
  });

  it("keeps a village's own name", async () => {
    await rename("Harbour");
    await runMigration();
    expect((await token()).name).toBe("Harbour");
  });
});
