/**
 * NO WRITE AT ALL INSIDE A READ-ONLY REQUEST (server/db/readOnlyRequest.ts; the admin live view).
 *
 * Pinned against a fake pool that records what reached it: a GET handler that writes is refused under the mark and
 * allowed without it, a connection the pool hands out is held to the same rule, reads pass, an unknown statement is
 * refused rather than guessed at, and a write made deliberately outside the mark (the audit line) still lands.
 */
import { describe, expect, it } from "vitest";
import { guardPool, isWriteSql, outsideReadOnly, ReadOnlyRequestError, runReadOnly } from "./readOnlyRequest";

function fakePool() {
  const ran: string[] = [];
  const conn = { query: async (sql: string) => { ran.push(`conn:${sql}`); return [[], []]; }, release() {} };
  const pool = {
    query: async (sql: unknown) => { ran.push(typeof sql === "string" ? sql : String((sql as { sql: string }).sql)); return [[], []]; },
    execute: async (sql: string) => { ran.push(`exec:${sql}`); return [[], []]; },
    getConnection: async () => conn,
  };
  return { pool: guardPool(pool), ran };
}

/** A GET handler of the shape the scan found: it reads, then writes an audit row. */
async function handlerThatWrites(pool: ReturnType<typeof fakePool>["pool"]): Promise<string> {
  await pool.query("SELECT * FROM `quests`");
  await pool.query("INSERT INTO `health_events` (`kind`) VALUES ('viewed')");
  return "answered";
}

describe("a read-only request", () => {
  it("refuses a GET handler's write under the mark, and allows it without", async () => {
    const a = fakePool();
    await expect(runReadOnly("the admin live view", () => handlerThatWrites(a.pool))).rejects.toBeInstanceOf(ReadOnlyRequestError);
    expect(a.ran).toEqual(["SELECT * FROM `quests`"]);

    const b = fakePool();
    await expect(handlerThatWrites(b.pool)).resolves.toBe("answered");
    expect(b.ran).toHaveLength(2);
  });

  it("holds a checked-out connection and execute to the same rule", async () => {
    const { pool, ran } = fakePool();
    await runReadOnly("test", async () => {
      const conn = await pool.getConnection();
      await expect(conn.query("UPDATE `users` SET `name` = 'x'")).rejects.toBeInstanceOf(ReadOnlyRequestError);
      await expect(pool.execute("DELETE FROM `quests`")).rejects.toBeInstanceOf(ReadOnlyRequestError);
      await conn.query("SELECT GET_LOCK('a', 2)");
    });
    expect(ran).toEqual(["conn:SELECT GET_LOCK('a', 2)"]);
  });

  it("lets the audit line through when it steps outside the mark on purpose", async () => {
    const { pool, ran } = fakePool();
    await runReadOnly("the admin live view", async () => {
      await outsideReadOnly(() => pool.query("INSERT INTO `health_events` (`kind`) VALUES ('audit')"));
    });
    expect(ran).toEqual(["INSERT INTO `health_events` (`kind`) VALUES ('audit')"]);
  });
});

describe("isWriteSql", () => {
  it("reads only what only reads", () => {
    for (const sql of ["SELECT 1", "  select * from x", "/* c */ SELECT 1", "-- c\nSELECT 1", "SHOW TABLES", "WITH a AS (SELECT 1) SELECT * FROM a", "(SELECT 1) UNION (SELECT 2)", "START TRANSACTION", "COMMIT", { sql: "SELECT 1" }]) {
      expect([sql, isWriteSql(sql)]).toEqual([sql, false]);
    }
  });

  it("treats every other statement as a write, an unknown one included", () => {
    for (const sql of ["INSERT INTO x VALUES (1)", "update x set a=1", "DELETE FROM x", "REPLACE INTO x VALUES (1)", "CREATE TABLE x (a int)", "DROP TABLE x", "TRUNCATE x", "SET @a = 1", "CALL p()", "SELECT * FROM x FOR UPDATE", "SELECT 1 INTO OUTFILE '/tmp/x'", "", { sql: "DELETE FROM x" }, 42]) {
      expect([sql, isWriteSql(sql)]).toEqual([sql, true]);
    }
  });
});
