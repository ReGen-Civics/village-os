/**
 * The accept reward for a proposal sent from a public form, matched by the
 * address typed into it (audit, 15 Nov 2026). Anybody can sign up at a
 * stranger's address first, so a match by address pays only an account that
 * OWNS the address: it proved it, or it is an accepted member
 * (server/lib/applicantAccount.ts). A bare account is treated as no account.
 */
import type mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testPool, provisionTestDb, testDbConfigured, type TestDb } from "../db/testDb";
import { loadTokenRegistry } from "./ledger";
import { villageId } from "./economy";
import { seedEconomy } from "./economySeed";
import { applyAcceptReward } from "./proposalAward";
import { loadVariables } from "./variables";
import { usersRepo } from "../repos/users";

const configured = testDbConfigured();

describe.skipIf(!configured)("a proposal's accept reward, matched by its typed address", () => {
  let db: TestDb;
  let pool: mysql.Pool;

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 6 }); // module-review-ok: the S5 scratch-schema harness pool
    await loadTokenRegistry(pool);
    await seedEconomy(pool, villageId());
    await loadTokenRegistry(pool);
    await loadVariables(pool);
  });

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  const cash = { minor: 5000, currency: "USD" };
  const deps = () => ({ members: usersRepo(pool), boostFor: async () => ({}), activity: async () => {} });
  const cashTo = async (id: string) => {
    const [rows] = await pool.query<any[]>("SELECT COUNT(*) AS n FROM `cash_owed` WHERE `user_id` = ?", [id]); // module-review-ok: fixture SQL against the S5 scratch schema
    return Number(rows[0]?.n ?? 0);
  };
  const account = async (id: string, extra: Record<string, unknown> = {}) => {
    await usersRepo(pool).add({ id, name: id, email: `${id}@example.test`, passwordHash: "x", paths: [], ...extra } as any);
    return id;
  };
  const sent = (id: string, who: string) => ({ id, userId: null, data: { work: "Bread", email: `${who}@example.test` } });

  it("never pays a bare account that only typed the address, and records nothing on it", async () => {
    const bare = await account("aw-bare");
    const out = await applyAcceptReward(pool, deps(), sent("sub-aw-bare", bare), "steward-one", cash);
    expect(out).toEqual({ rewarded: false });
    expect(await cashTo(bare)).toBe(0);
    expect((await usersRepo(pool).byId(bare))?.recognitionBalance ?? 0).toBe(0);
  });

  it("pays an account that proved the address", async () => {
    const proved = await account("aw-proved", { emailVerifiedAt: "2026-01-01T00:00:00.000Z" });
    expect(await applyAcceptReward(pool, deps(), sent("sub-aw-proved", proved), "steward-one", cash)).toEqual({ rewarded: true });
    expect(await cashTo(proved)).toBe(1);
  });

  it("pays an accepted member with no proof on record (every member from before 0304)", async () => {
    const member = await account("aw-member");
    await usersRepo(pool).update(member, (u: any) => {
      u.membershipGranted = true;
    });
    expect(await applyAcceptReward(pool, deps(), sent("sub-aw-member", member), "steward-one", cash)).toEqual({ rewarded: true });
    expect(await cashTo(member)).toBe(1);
  });

  it("a proposal sent while signed in pays its own account, as before", async () => {
    const own = await account("aw-signed-in");
    expect(await applyAcceptReward(pool, deps(), { id: "sub-aw-own", userId: own, data: { work: "Bread" } }, "steward-one", cash)).toEqual({ rewarded: true });
    expect(await cashTo(own)).toBe(1);
  });
});
