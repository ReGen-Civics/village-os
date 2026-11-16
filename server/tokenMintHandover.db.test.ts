/**
 * `token.mint` crossing to the founding stewards and the Treasury role
 * (server/lib/tokenMintHandover.ts; Rye, 2026-11-15), against a real schema.
 *
 * The roles live in a stand-in repository here; the holding is the real
 * `capability_holding` table, which is what switches the admin short-circuit
 * off at the gate.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "mysql2/promise";
import { provisionTestDb, testDbConfigured, testPool, type TestDb } from "./db/testDb";
import {
  handTokenMintOverFor0112,
  handTokenMintToStewardsAndTreasury,
  TOKEN_MINT,
  TOKEN_MINT_0112_MARKER,
  TOKEN_MINT_STAYS_WITH_ADMIN,
  type TokenMintHandoverDeps,
} from "./lib/tokenMintHandover";
import { HANDOVER_SET, isBadgeGrantable, TRANSFERABLE } from "../shared/capabilities";

const DB = testDbConfigured();
let testDb: TestDb | undefined;
let pool: Pool;

interface Role { id: string; capabilities: string[]; isExample?: boolean }

function world(roles: Role[], holders: Record<string, number>) {
  const state = { roles: roles.map((r) => ({ ...r })), warnings: [] as string[], applied: [] as string[] };
  const deps: TokenMintHandoverDeps = {
    pool,
    roles: () => state.roles,
    replaceRoles: async (rows) => {
      state.roles = rows as Role[];
      // The holding refuses a role that does not carry the key in the TABLE, so the stand-in writes it there too.
      for (const r of state.roles) {
        await pool.query("UPDATE roles SET capabilities = ? WHERE id = ?", [JSON.stringify(r.capabilities), r.id]); // module-review-ok: the scratch schema this suite provisioned
      }
    },
    liveHolders: (roleId) => holders[roleId] ?? 0,
    warn: (l) => { state.warnings.push(l); },
  };
  return { state, deps };
}

async function seedRoles(roles: Role[]) {
  await pool.query("DELETE FROM roles WHERE id IN ('steward', 'treasury')"); // module-review-ok: the scratch schema this suite provisioned
  for (const r of roles) {
    await pool.query( // module-review-ok: the same
      "INSERT INTO roles (id, name, description, capabilities, sort_order) VALUES (?,?,?,?,0)",
      [r.id, r.id, `${r.id} fixture`, JSON.stringify(r.capabilities)],
    );
  }
}

async function holding(): Promise<string[]> {
  const [rows] = await pool.query<any[]>("SELECT holder_role_id FROM capability_holding WHERE capability = ?", [TOKEN_MINT]); // module-review-ok: fixture SQL against the S5 scratch schema, never a production table
  return rows.map((r: any) => String(r.holder_role_id));
}

beforeAll(async () => {
  if (!DB) return;
  testDb = await provisionTestDb();
  pool = testPool(testDb, { connectionLimit: 2 }); // module-review-ok: the suite's own pool onto the scratch schema it provisioned
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await testDb?.drop();
});

beforeEach(async () => {
  if (!DB) return;
  await pool.query("DELETE FROM capability_holding WHERE capability = ?", [TOKEN_MINT]); // module-review-ok: the same
});

describe("token.mint is a handover power", () => {
  it("is transferable, so it is in HANDOVER_SET, and no badge reaches it", () => {
    expect(TRANSFERABLE["token.mint"]).toBe(true);
    expect(HANDOVER_SET).toContain("token.mint");
    expect(isBadgeGrantable("token.mint")).toBe(false);
  });
});

describe.skipIf(!DB)("the hand-over at launch", () => {
  const both: Role[] = [{ id: "steward", capabilities: ["ballot.vote"] }, { id: "treasury", capabilities: ["cash.pay"] }];

  it("gives the key to both roles and records the holding under the steward", async () => {
    await seedRoles(both);
    const { state, deps } = world(both, { steward: 2, treasury: 1 });
    const out = await handTokenMintToStewardsAndTreasury(deps, { ballotId: "bal-launch", note: "launch" });
    expect(out).toEqual({ moved: true, holderRoleId: "steward", grantedTo: ["steward", "treasury"] });
    expect(await holding()).toEqual(["steward"]);
    for (const r of state.roles) expect(r.capabilities, r.id).toContain(TOKEN_MINT);
  });

  it("is idempotent, and never touches a holding it finds", async () => {
    await seedRoles(both);
    const first = world(both, { steward: 1, treasury: 1 });
    await handTokenMintToStewardsAndTreasury(first.deps, { ballotId: "bal-launch", note: "launch" });
    const again = world(first.state.roles, { steward: 1, treasury: 1 });
    const out = await handTokenMintToStewardsAndTreasury(again.deps, { ballotId: "bal-launch", note: "launch" });
    expect(out).toEqual({ moved: false, reason: "already-held", holderRoleId: "steward" });
    expect(await holding()).toEqual(["steward"]);
  });

  it("with no steward role, the Treasury role holds it", async () => {
    const onlyTreasury: Role[] = [{ id: "treasury", capabilities: [] }];
    await seedRoles(onlyTreasury);
    const { deps } = world(onlyTreasury, { treasury: 1 });
    const out = await handTokenMintToStewardsAndTreasury(deps, { ballotId: null, note: "x" });
    expect(out).toMatchObject({ moved: true, holderRoleId: "treasury" });
    expect(await holding()).toEqual(["treasury"]);
  });

  it("with nobody in either role, nothing moves, the admin keeps it, and a warning says why", async () => {
    await seedRoles(both);
    const { state, deps } = world(both, {});
    const out = await handTokenMintToStewardsAndTreasury(deps, { ballotId: "bal-launch", note: "launch" });
    expect(out).toEqual({ moved: false, reason: "nobody-to-hold-it", warning: TOKEN_MINT_STAYS_WITH_ADMIN });
    expect(await holding()).toEqual([]);
    expect(state.warnings.join(" ")).toContain("stays with the admin");
    for (const r of state.roles) expect(r.capabilities, r.id).not.toContain(TOKEN_MINT);
  });
});

describe.skipIf(!DB)("the boot step for a village migration 0112 recorded as started", () => {
  const both: Role[] = [{ id: "steward", capabilities: [] }, { id: "treasury", capabilities: [] }];
  const boot = (deps: TokenMintHandoverDeps, applied: string[], gs: { started: boolean; ballotId: string | null }) =>
    handTokenMintOverFor0112({ ...deps, gameStart: async () => gs, applied: () => applied, markApplied: async (id) => { applied.push(id); } });

  it("moves the key once and marks it done", async () => {
    await seedRoles(both);
    const applied: string[] = [];
    const out = await boot(world(both, { steward: 1 }).deps, applied, { started: true, ballotId: null });
    expect(out).toMatchObject({ moved: true, holderRoleId: "steward" });
    expect(applied).toEqual([TOKEN_MINT_0112_MARKER]);
  });

  it("once marked, a returned power is never taken back by a reboot", async () => {
    await seedRoles(both);
    const out = await boot(world(both, { steward: 1 }).deps, [TOKEN_MINT_0112_MARKER], { started: true, ballotId: null });
    expect(out).toBeNull();
    expect(await holding()).toEqual([]);
  });

  it("leaves a village launched by its ballot, and one not started, to the launch closer", async () => {
    await seedRoles(both);
    expect(await boot(world(both, { steward: 1 }).deps, [], { started: true, ballotId: "bal-real" })).toBeNull();
    expect(await boot(world(both, { steward: 1 }).deps, [], { started: false, ballotId: null })).toBeNull();
    expect(await holding()).toEqual([]);
  });

  it("with nobody to hold it, it warns and tries again on the next boot", async () => {
    await seedRoles(both);
    const applied: string[] = [];
    const out = await boot(world(both, {}).deps, applied, { started: true, ballotId: null });
    expect(out).toMatchObject({ moved: false, reason: "nobody-to-hold-it" });
    expect(applied).toEqual([]);
  });
});
