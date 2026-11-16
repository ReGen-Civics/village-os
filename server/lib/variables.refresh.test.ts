/**
 * THE CACHE FOLLOWS THE TABLE (15 Nov 2026, `refreshVariables` in server/lib/variables.ts).
 *
 * A second server on the same database (the previous release, still serving during a deploy) saves a dial: this
 * process sees it on its next refresh. And a refresh whose read was in flight across one of this process's own
 * writes is dropped, so it can never put back the value the write just replaced. A stand-in pool, so the read
 * can be held open exactly across the write; the built server proves the interval end to end in
 * server/proposedChanges.routes.e2e.test.ts.
 */
import { describe, expect, it } from "vitest";
import type { Pool } from "mysql2/promise";
import { loadVariables, rawValue, refreshVariables, setVariable, variablesRefreshSeconds } from "./variables";

type Row = { config_key: string; value: string };

/** A pool whose SELECTs answer the given table, or wait on `hold` when one is set. */
function standIn() {
  const table = new Map<string, string>();
  let hold: Promise<void> | null = null;
  const pool = {
    async query(sql: string, args: unknown[] = []) {
      if (sql.startsWith("SELECT")) {
        const rows: Row[] = Array.from(table, ([config_key, value]) => ({ config_key, value }));
        if (hold) await hold;
        return [rows, []];
      }
      if (sql.startsWith("DELETE")) table.delete(String(args[0]));
      else table.set(String(args[0]), String(args[1]));
      return [{ affectedRows: 1 }, []];
    },
  };
  return {
    pool: pool as unknown as Pool,
    table,
    holdReads() {
      let release = () => {};
      hold = new Promise<void>((resolve) => (release = resolve));
      return () => {
        hold = null;
        release();
      };
    },
  };
}

describe("the variables cache follows the table", () => {
  it("a dial another process saved is served after the next refresh, and not before", async () => {
    const db = standIn();
    await loadVariables(db.pool);
    expect(rawValue("org.applicant_reply_days")).toBe("7");
    db.table.set("org.applicant_reply_days", "12"); // the other server's write: the table, never this cache
    expect(rawValue("org.applicant_reply_days")).toBe("7");
    expect(await refreshVariables(db.pool)).toBe(true);
    expect(rawValue("org.applicant_reply_days")).toBe("12");
    db.table.delete("org.applicant_reply_days"); // and put back to the default by the other server
    await refreshVariables(db.pool);
    expect(rawValue("org.applicant_reply_days")).toBe("7");
  });

  it("a refresh that read the table before this process's own write never puts the old value back", async () => {
    const db = standIn();
    await loadVariables(db.pool);
    const release = db.holdReads();
    const refreshing = refreshVariables(db.pool); // has read the table (no row yet) and is waiting to apply it
    const saved = await setVariable(db.pool, "org.applicant_reply_days", "10");
    expect(saved.ok).toBe(true);
    release();
    expect(await refreshing).toBe(false);
    expect(rawValue("org.applicant_reply_days")).toBe("10");
    expect(await refreshVariables(db.pool)).toBe(true);
    expect(rawValue("org.applicant_reply_days")).toBe("10");
  });

  it("a refresh that cannot read keeps the cache it had", async () => {
    const db = standIn();
    db.table.set("org.applicant_reply_days", "9");
    await loadVariables(db.pool);
    const broken = { query: async () => { throw new Error("connection lost"); } } as unknown as Pool;
    expect(await refreshVariables(broken)).toBe(false);
    expect(rawValue("org.applicant_reply_days")).toBe("9");
  });

  it("reads its interval from VARIABLES_REFRESH_SECONDS: 30 when unset, 0 turns it off", () => {
    expect(variablesRefreshSeconds({})).toBe(30);
    expect(variablesRefreshSeconds({ VARIABLES_REFRESH_SECONDS: "0" })).toBe(0);
    expect(variablesRefreshSeconds({ VARIABLES_REFRESH_SECONDS: "5" })).toBe(5);
    expect(variablesRefreshSeconds({ VARIABLES_REFRESH_SECONDS: "soon" })).toBe(30);
  });
});
