/**
 * R157: A BADGE AWARDED BEFORE THE HANDOVER STOPS CARRYING A POWER THE VILLAGE
 * THEN HOLDS.
 *
 * Once the village holds a key, an administrator may not award, revoke or edit
 * a badge carrying it (the 409s in server/routes/badges.ts), so an award made
 * before the handover could be removed by nothing but a vote and kept granting
 * the power meanwhile. The gate now counts a badge's grant on a held key only
 * when a village vote made the award (`badgeVoteCapabilities`), and the earned
 * engine awards no badge carrying a held key.
 *
 * The first block is the pure gate. The second runs against a scratch schema.
 * Every person here is invented.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type mysql from "mysql2/promise";
import {
  ALL_CAPABILITIES,
  BADGE_GRANTABLE,
  TRANSFERABLE,
  capabilityDecision,
  type Capability,
  type CapabilityCtx,
} from "../../shared/capabilities";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "../db/testDb";
import { awardBadge, awardFirstTierNow, badgeGrantsFor, evaluateEarnedBadges, isVoteAward, voteAwardStamp } from "./badges";
import { liveHoldersNow } from "./holdersNow";

/** A key a badge may grant and the village may hold, chosen from the maps so the test follows them. */
const KEY = ALL_CAPABILITIES.find((c) => BADGE_GRANTABLE[c] && TRANSFERABLE[c]) as Capability;

const ctx = (over: Partial<CapabilityCtx>): CapabilityCtx => ({
  stageIndex: 0,
  stageIndexOf: () => -1,
  roleCapabilities: [],
  stageUnlockOverrides: { [KEY]: "none" },
  ...over,
});

describe("the gate's badge step on a key the village holds", () => {
  it("found a key that is both badge-grantable and transferable", () => {
    expect(KEY).toBeTruthy();
  });

  it("before the handover any live award grants the key", () => {
    expect(capabilityDecision(KEY, ctx({ badgeCapabilities: [KEY] })).allowed).toBe(true);
  });

  it("after the handover an award no vote made grants nothing", () => {
    const d = capabilityDecision(KEY, ctx({ badgeCapabilities: [KEY], villageHeld: [KEY] }));
    expect(d.allowed).toBe(false);
    expect(d.villageHolds).toBe(true);
  });

  it("after the handover an award a vote made still grants it", () => {
    const d = capabilityDecision(KEY, ctx({ badgeCapabilities: [KEY], badgeVoteCapabilities: [KEY], villageHeld: [KEY] }));
    expect(d).toMatchObject({ allowed: true, source: "badge" });
  });

  it("an admin wearing a pre-handover badge is judged like anybody else", () => {
    expect(capabilityDecision(KEY, ctx({ isAdmin: true, badgeCapabilities: [KEY], villageHeld: [KEY] })).allowed).toBe(false);
  });

  it("reads the stamp only in its own shape", () => {
    expect(isVoteAward(voteAwardStamp("bal-1"))).toBe(true);
    expect(isVoteAward("ballot:")).toBe(false);
    expect(isVoteAward("u-admin")).toBe(false);
    expect(isVoteAward(null)).toBe(false);
  });
});

const configured = testDbConfigured();

describe.skipIf(!configured)("pre-handover badge awards against a real schema", () => {
  let db: TestDb;
  let pool: mysql.Pool;
  const q = async (sql: string, params: unknown[] = []) => (await pool.query<any[]>(sql, params))[0]; // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  const notify = async () => ({ sent: true });

  beforeAll(async () => {
    db = await provisionTestDb();
    pool = testPool(db, { connectionLimit: 4 });
    await q( // module-review-ok: fixture SQL against the S5 scratch schema
      "INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `handle`) VALUES (?,?,?,'x',?), (?,?,?,'x',?)",
      ["m-wren", "Wren Alder", "wren@example.test", "wren", "m-kai", "Kai Moss", "kai@example.test", "kai"],
    );
    await q( // module-review-ok: fixture SQL against the S5 scratch schema
      "INSERT INTO `badges` (`id`, `name`, `kind`, `capabilities`, `denies`, `active`) VALUES ('keeper','Keeper','granted',?, '[]', 1)",
      [JSON.stringify([KEY])],
    );
    await q( // module-review-ok: fixture SQL against the S5 scratch schema
      "INSERT INTO `badges` (`id`, `name`, `kind`, `capabilities`, `denies`, `rule`, `active`) VALUES ('steady','Steady','earned',?, '[]', ?, 1)",
      [JSON.stringify([KEY]), JSON.stringify({ metric: "quests_consented", threshold: 1 })],
    );
    await q( // module-review-ok: fixture SQL against the S5 scratch schema
      "INSERT INTO `quest_claims` (`id`, `quest_id`, `user_id`, `status`) VALUES ('qc-1','q-1','m-kai','consented')",
    );
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await db?.drop();
  });

  beforeEach(async () => {
    await q("DELETE FROM `badge_awards`"); // module-review-ok: fixture SQL against the S5 scratch schema
    await q("DELETE FROM `badge_events`"); // module-review-ok: fixture SQL against the S5 scratch schema
    await q("DELETE FROM `capability_holding`"); // module-review-ok: fixture SQL against the S5 scratch schema
  });

  const holdKey = () =>
    q("INSERT INTO `capability_holding` (`capability`, `holder_role_id`) VALUES (?, 'keepers')", [KEY]); // module-review-ok: fixture SQL against the S5 scratch schema

  const reads = () => ({
    badgesLive: () => true,
    dormantBadgeIds: async () => [],
    badgeRows: async () =>
      q("SELECT a.user_id, a.awarded_by, a.badge_id, b.capabilities, b.denies FROM badge_awards a JOIN badges b ON b.id = a.badge_id"), // module-review-ok: fixture SQL against the S5 scratch schema
    roleHolders: () => [],
    roles: () => [],
    villageHeld: async () => (await q("SELECT capability FROM capability_holding")).map((r: any) => String(r.capability)), // module-review-ok: fixture SQL against the S5 scratch schema
  });

  it("an admin's award reports the key but not as the village's", async () => {
    await awardBadge(pool, notify, { badge: { id: "keeper", name: "Keeper", kind: "granted" }, userId: "m-wren", awardedBy: "u-admin", note: null, expiresAt: null });
    const grants = await badgeGrantsFor(pool, "m-wren");
    expect(grants.capabilities).toEqual([KEY]);
    expect(grants.voteCapabilities).toEqual([]);
    await holdKey();
    expect(await liveHoldersNow(reads(), KEY)).toEqual([]);
  });

  it("a carried vote stamps its award, and the stamp survives the handover", async () => {
    await awardBadge(pool, notify, {
      badge: { id: "keeper", name: "Keeper", kind: "granted" }, userId: "m-wren", awardedBy: null, actorUserId: "m-kai",
      ballotId: "bal-1-abc", note: "By a vote of the whole village (bal-1-abc).", expiresAt: null,
    });
    const [row] = await q("SELECT awarded_by FROM badge_awards WHERE user_id = 'm-wren'"); // module-review-ok: fixture SQL against the S5 scratch schema
    expect(row.awarded_by).toBe("ballot:bal-1-abc");
    expect((await badgeGrantsFor(pool, "m-wren")).voteCapabilities).toEqual([KEY]);
    await holdKey();
    expect(await liveHoldersNow(reads(), KEY)).toEqual(["m-wren"]);
  });

  it("a vote re-awarding an admin's badge makes it the village's", async () => {
    await awardBadge(pool, notify, { badge: { id: "keeper", name: "Keeper", kind: "granted" }, userId: "m-wren", awardedBy: "u-admin", note: null, expiresAt: null });
    await awardBadge(pool, notify, { badge: { id: "keeper", name: "Keeper", kind: "granted" }, userId: "m-wren", awardedBy: null, ballotId: "bal-2-abc", note: null, expiresAt: null });
    expect((await badgeGrantsFor(pool, "m-wren")).voteCapabilities).toEqual([KEY]);
  });

  it("the earned engine awards a power-carrying badge before the handover and holds it back after", async () => {
    const before = await evaluateEarnedBadges(pool);
    expect(before.newTiers).toEqual([{ badgeId: "steady", userId: "m-kai", tier: 1 }]);
    await q("DELETE FROM `badge_awards`"); // module-review-ok: fixture SQL against the S5 scratch schema
    await q("DELETE FROM `badge_events`"); // module-review-ok: fixture SQL against the S5 scratch schema
    await holdKey();
    const after = await evaluateEarnedBadges(pool);
    expect(after.newTiers).toEqual([]);
    expect(after.heldBack).toEqual(["steady"]);
    expect(await q("SELECT * FROM badge_awards")).toEqual([]); // module-review-ok: fixture SQL against the S5 scratch schema
    expect(await awardFirstTierNow(pool, "steady", "m-kai")).toBe(false);
  });
});
