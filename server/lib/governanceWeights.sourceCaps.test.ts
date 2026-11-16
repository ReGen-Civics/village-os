/**
 * THE CAPS ON VOTING WEIGHT BY SOURCE, and RESTING VOICE, proven on a frozen
 * roll (spec internal/spec/voice-source-caps in the operations repository).
 *
 * In token mode a member weighs their balance of the weight token. With the
 * caps by source on, a ballot counts at most the cash cap of the part that came
 * from cash and at most the other cap of the rest. The ledger is never touched:
 * every balance stays exactly as minted, and each frozen roll row keeps the
 * basis its weight was counted from.
 *
 * Every mint here goes through the ledger's own doors: the Voice faucet for
 * work, `sys:mint` for a steward's hand-mint (marked cash or other), and the
 * reversal door for a clawback. Voice keeps hundredths, so 1 Voice is 100 in
 * the minor units a weight is stored in.
 *
 * No TEST_DATABASE_URL: the DB cases skip loudly, never pass hollowly.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { VILLAGE_VOICE, VOICE_MINT, mint, reverse, villageId } from "./economy";
import { seedEconomy } from "./economySeed";
import { loadTokenRegistry, memberAccount } from "./ledger";
import { loadVariables, setVariable } from "./variables";
import { openBallot } from "./ballots";
import {
  SOURCE_CAP_KEYS,
  WEIGHT_CAP_CASH_KEY,
  WEIGHT_CAP_CASH_ON_KEY,
  WEIGHT_CAP_ON_KEY,
  WEIGHT_CAP_OTHER_KEY,
  WEIGHT_CAP_OTHER_ON_KEY,
  WEIGHT_CAP_PCT_KEY,
  rollEntriesFor,
  standingWeightFor,
  weightCapLine,
  weightModeNow,
  type RollEntry,
} from "./governanceWeights";
import { WEIGHT_KEYS_AFTER_START } from "./dialWrite";
import { leftTheVillage, withoutFormerMembers } from "./formerMember";
import { createExit } from "./exit";
import { markExitResolved } from "../repos/exitNotes";
import { usersRepo } from "../repos/users";
import { HAND_MINT_CASH_SOURCE, HAND_MINT_OTHER_SOURCE } from "../../shared/voiceSourceCaps";
import { VARIABLES_BY_KEY, criticalityOf, ringOf } from "../../shared/gameVariables";

const configured = testDbConfigured();
const V = (whole: number) => whole * 100;

describe("the four dials, as the registry ships them", () => {
  it("ships both switches OFF and both numbers at 0, held at the weight mode's bar", () => {
    const mode = VARIABLES_BY_KEY["governance.weight_mode"]!;
    for (const key of SOURCE_CAP_KEYS) {
      const def = VARIABLES_BY_KEY[key];
      expect(def, `${key} must exist`).toBeTruthy();
      expect(ringOf(def!), key).toBe(ringOf(mode));
      expect(criticalityOf(def!), key).toBe(criticalityOf(mode));
      expect(WEIGHT_KEYS_AFTER_START.has(key), `${key} changes only by proposal once the Game starts`).toBe(true);
    }
    expect(VARIABLES_BY_KEY[WEIGHT_CAP_CASH_ON_KEY]!.default).toBe("false");
    expect(VARIABLES_BY_KEY[WEIGHT_CAP_OTHER_ON_KEY]!.default).toBe("false");
    expect(VARIABLES_BY_KEY[WEIGHT_CAP_CASH_KEY]!.default).toBe("0");
    expect(VARIABLES_BY_KEY[WEIGHT_CAP_OTHER_KEY]!.default).toBe("0");
  });

  it("names each cap that is on, and says nothing while both are off", () => {
    const line = weightCapLine({ mode: "token", token: VILLAGE_VOICE, sourceCaps: { cash: 22000, other: 22000 } }) ?? "";
    expect(line).toContain("at most 22,000 from cash put in and at most 22,000 from other contributions");
    expect(line).toContain("Every balance stays as it was minted");
    expect(weightCapLine({ mode: "token", token: VILLAGE_VOICE, sourceCaps: { cash: 500, other: null } })).toContain("at most 500 from cash put in for");
    expect(weightCapLine({ mode: "token", token: VILLAGE_VOICE, sourceCaps: null })).toBeNull();
    expect(weightCapLine({ mode: "equal", token: null, sourceCaps: { cash: 1, other: 1 } })).toBeNull();
    // Both kinds of cap at once: the source caps first, then the share.
    const both = weightCapLine({ mode: "token", token: VILLAGE_VOICE, capPct: 20, sourceCaps: { cash: 1, other: null } }) ?? "";
    expect(both.indexOf("from cash put in")).toBeLessThan(both.indexOf("more than 20% of the vote"));
  });
});

describe.skipIf(!configured)("caps by source on a frozen roll, and resting Voice (MySQL)", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  let n = 0;

  const A = "u-sc-a"; // 22,000 from work
  const B = "u-sc-b"; // 7,777 cash
  const C = "u-sc-c"; // 30,000 cash + 10,000 work
  const D = "u-sc-d"; // 60,000 cash, 20,000 of it reversed, + 50,000 marked other by hand
  const ROLL = [A, B, C, D];

  const workVoice = (to: string, whole: number, key: string) =>
    mint(pool, { toUserId: to, tokenSlug: VILLAGE_VOICE, amount: V(whole), from: VOICE_MINT, source: "quest_consent", idempotencyKey: key });
  const handVoice = (to: string, whole: number, source: string, key: string) =>
    mint(pool, { toUserId: to, tokenSlug: VILLAGE_VOICE, amount: V(whole), from: "sys:mint", source, idempotencyKey: key });

  async function balanceOf(userId: string): Promise<number> {
    const [rows] = await pool.query<any[]>( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      "SELECT balance FROM token_balances WHERE token_type = ? AND account_id = ?",
      [VILLAGE_VOICE, memberAccount(userId)],
    );
    return Number(rows[0]?.balance ?? 0);
  }

  /** Freeze the roll as `buildElectorate` does, and read the frozen rows back. */
  async function freeze(ids: string[] = ROLL): Promise<Map<string, any>> {
    const snapshot = weightModeNow();
    const entries: RollEntry[] = await rollEntriesFor(pool, ids, snapshot);
    const opened = await openBallot(pool, {
      subjectType: "mechanics",
      subjectRef: `source-cap-test-${++n}`,
      title: `Source cap ballot ${n}`,
      docMarkdown: "# The document as checked",
      method: "custom",
      weightMode: snapshot.mode,
      weightToken: snapshot.token,
      unityPct: 80,
      quorumPct: 20,
      durationDays: 7,
      openedBy: "u-proposer",
      electorate: entries,
    });
    expect(opened.ok, opened.ok ? "" : opened.error).toBe(true);
    if (!opened.ok) throw new Error(opened.error);
    const [rows] = await pool.query<any[]>( // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
      "SELECT user_id, weight, held_weight, held_cash, cap_cash, cap_other FROM ballot_electorate WHERE ballot_id = ?",
      [opened.ballot.id],
    );
    return new Map(rows.map((r) => [String(r.user_id), r]));
  }

  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 }); // module-review-ok: the S5 scratch-schema harness pool, the crews.test.ts shape
    await loadVariables(pool);
    await seedEconomy(pool, villageId());
    await loadTokenRegistry(pool);
    for (const id of [...ROLL, "u-sc-left"]) {
      await usersRepo(pool).add({ id, name: id, email: `${id}@example.test`, passwordHash: "x", paths: [] });
    }
    expect((await workVoice(A, 22_000, "sc:a:work")).ok).toBe(true);
    expect((await handVoice(B, 7_777, HAND_MINT_CASH_SOURCE, "sc:b:cash")).ok).toBe(true);
    expect((await handVoice(C, 30_000, HAND_MINT_CASH_SOURCE, "sc:c:cash")).ok).toBe(true);
    expect((await workVoice(C, 10_000, "sc:c:work")).ok).toBe(true);
    expect((await handVoice(D, 40_000, HAND_MINT_CASH_SOURCE, "sc:d:cash1")).ok).toBe(true);
    expect((await handVoice(D, 20_000, HAND_MINT_CASH_SOURCE, "sc:d:cash2")).ok).toBe(true);
    expect((await handVoice(D, 50_000, HAND_MINT_OTHER_SOURCE, "sc:d:other")).ok).toBe(true);
    // One cash grant taken back through the reversal door: D's cash is 40,000 net.
    const back = await reverse(pool, "sc:d:cash2", {
      from: memberAccount(D), to: "sys:mint", tokenSlug: VILLAGE_VOICE, amount: V(20_000), note: "refunded",
    });
    expect(back.ok, String((back as any).error ?? "")).toBe(true);
    expect((await setVariable(pool, "governance.weight_mode", "token")).ok).toBe(true);
    expect((await setVariable(pool, "governance.weight_token", VILLAGE_VOICE)).ok).toBe(true);
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  it("with both switches off, freezes every balance whole and writes no basis", async () => {
    expect(weightModeNow().sourceCaps ?? null).toBeNull();
    const rows = await freeze();
    for (const id of ROLL) {
      expect(Number(rows.get(id).weight), id).toBe(await balanceOf(id));
      expect(num(rows.get(id).held_weight), `${id} basis`).toBeNull();
      expect(num(rows.get(id).cap_cash), `${id} basis`).toBeNull();
    }
  });

  it("with both caps at 22,000, counts each source up to its cap and freezes the basis", async () => {
    for (const [k, v] of [[WEIGHT_CAP_CASH_ON_KEY, "true"], [WEIGHT_CAP_CASH_KEY, "22000"], [WEIGHT_CAP_OTHER_ON_KEY, "true"], [WEIGHT_CAP_OTHER_KEY, "22000"]]) {
      expect((await setVariable(pool, k, v)).ok, k).toBe(true);
    }
    const before = new Map(await Promise.all(ROLL.map(async (id) => [id, await balanceOf(id)] as const)));
    const rows = await freeze();
    expect(Number(rows.get(A).weight)).toBe(V(22_000));
    expect(Number(rows.get(B).weight)).toBe(V(7_777));
    expect(Number(rows.get(C).weight), "22,000 of 30,000 cash, plus all 10,000 from work").toBe(V(32_000));
    expect(Number(rows.get(D).weight), "both parts over their caps: the 44,000 most anybody counts").toBe(V(44_000));
    // The basis: anyone can recompute the weight from the row.
    expect(num(rows.get(D).held_weight)).toBe(V(90_000));
    expect(num(rows.get(D).held_cash), "the reversed cash grant is netted against its own source").toBe(V(40_000));
    expect(num(rows.get(C).held_cash)).toBe(V(30_000));
    for (const id of ROLL) {
      expect(num(rows.get(id).cap_cash), id).toBe(V(22_000));
      expect(num(rows.get(id).cap_other), id).toBe(V(22_000));
    }
    // The ledger is untouched: nothing was clipped at the mint or at the count.
    for (const id of ROLL) expect(await balanceOf(id), id).toBe(before.get(id));
    // A member's own standing reads the same count, and the balance behind it.
    expect(await standingWeightFor(pool, C, weightModeNow())).toEqual({ weight: V(32_000), held: V(40_000) });
  });

  it("a cap switched off counts its source whole, and the other cap still holds", async () => {
    expect((await setVariable(pool, WEIGHT_CAP_CASH_ON_KEY, "false")).ok).toBe(true);
    try {
      const rows = await freeze();
      expect(Number(rows.get(C).weight), "all 30,000 cash, plus 10,000 work").toBe(V(40_000));
      expect(Number(rows.get(D).weight), "40,000 cash whole, other still at 22,000").toBe(V(62_000));
      expect(num(rows.get(D).cap_cash)).toBeNull();
      expect(num(rows.get(D).cap_other)).toBe(V(22_000));
    } finally {
      await setVariable(pool, WEIGHT_CAP_CASH_ON_KEY, "true");
    }
  });

  it("raising a cap by changing the dial restores the count at the next ballot, with nothing to restore in the ledger", async () => {
    expect((await setVariable(pool, WEIGHT_CAP_CASH_KEY, "50000")).ok).toBe(true);
    try {
      const rows = await freeze();
      expect(Number(rows.get(C).weight)).toBe(V(40_000));
    } finally {
      await setVariable(pool, WEIGHT_CAP_CASH_KEY, "22000");
    }
  });

  it("the share cap still runs after, over the counted weights", async () => {
    expect((await setVariable(pool, WEIGHT_CAP_ON_KEY, "true")).ok).toBe(true);
    expect((await setVariable(pool, WEIGHT_CAP_PCT_KEY, "30")).ok).toBe(true);
    try {
      const rows = await freeze();
      const total = ROLL.reduce((s, id) => s + Number(rows.get(id).weight), 0);
      for (const id of ROLL) expect(Number(rows.get(id).weight) / total, id).toBeLessThanOrEqual(0.3 + 1e-6);
      // The basis still records the caps by source each weight met first.
      expect(num(rows.get(D).cap_cash)).toBe(V(22_000));
    } finally {
      await setVariable(pool, WEIGHT_CAP_ON_KEY, "false");
    }
  });

  it("resting Voice: a member who left keeps the balance, is on no new roll, and counts again once admitted back", async () => {
    const id = "u-sc-left";
    expect((await workVoice(id, 5_000, "sc:left:work")).ok).toBe(true);
    const made = await createExit(pool, { userId: id, kind: "voluntary", openedBy: id, noticeDays: 0 });
    if (!made.ok) throw new Error(made.error);
    await markExitResolved(pool, made.exit.id, null, "");
    const gone = (await usersRepo(pool).byId(id))!;
    expect(await leftTheVillage(pool, gone)).toBe(true);
    expect(await balanceOf(id), "the balance rests, whole").toBe(V(5_000));
    const roll = await withoutFormerMembers(pool, [gone, ...(await Promise.all(ROLL.map((r) => usersRepo(pool).byId(r))))]);
    expect(roll.map((u: any) => u.id)).not.toContain(id);

    const back = await usersRepo(pool).update(id, (u: any) => { u.stageGranted = "member"; });
    expect(await leftTheVillage(pool, back)).toBe(false);
    const again = await withoutFormerMembers(pool, [back]);
    expect(again.map((u: any) => u.id)).toEqual([id]);
    const rows = await freeze([id]);
    expect(Number(rows.get(id).weight), "the whole balance counts again, under the caps").toBe(V(5_000));
  });
});
