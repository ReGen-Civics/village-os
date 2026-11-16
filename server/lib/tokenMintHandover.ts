/**
 * `token.mint` CROSSES TO THE FOUNDING STEWARDS AND THE TREASURY ROLE AT LAUNCH
 * (Rye, 2026-11-15: "Founders and Treasurers can mint tokens from after launch
 * ... they can mint tokens from pay requests and give bonuses and more in
 * tokens from the start, later we'll pass this power to the village.").
 *
 * Before launch nobody holds the key, so the gate's admin step answers it and
 * the admin hand mint behaves as it always has. From launch the key is
 * VILLAGE-HELD (a `capability_holding` row naming the steward role), which
 * switches the admin short-circuit off: a bare admin is refused, and anybody
 * whose role carries the key passes at the gate's role step. Both roles are
 * given the key, so the founders seated as stewards and the Treasury holders
 * mint, and nobody else does. The stewards pass it on later by the ordinary
 * hand-over (`HANDOVER_SET`), and this file never touches a holding it finds.
 *
 * TWO CALLERS. The launch closer in server/index.ts, right after the founders
 * take the steward role. And a boot step for a village recorded as started by
 * migration 0112 (started before the launch ballot existed, so `ballotId` is
 * null and the closer never ran for it), guarded by its own marker so a power
 * the village later returns by vote is never taken back by a reboot.
 *
 * WITH NOBODY TO HOLD IT, NOTHING MOVES. If neither role exists, or neither has
 * a live holder, the key stays unheld, the admin keeps hand minting, and a
 * warning says why. Moving it would leave a village where nobody can mint at
 * all and no record of anybody deciding that.
 *
 * Idempotent: a holding already on file returns at once, and granting the key
 * to a role that carries it writes nothing. The roles are written through the
 * roles repository (`replaceRoles`) so the running process sees the change at
 * once; a raw UPDATE would be invisible to the role cache until the next boot.
 */
import type { Pool } from "mysql2/promise";
import type { Capability } from "../../shared/capabilities";
import { capabilityHoldings, moveCapabilityToVillage, STEWARD_ROLE_ID } from "./capabilityHolding";

export const TOKEN_MINT: Capability = "token.mint";

/**
 * The seeded Treasury role's id. The same string as `TREASURY_ROLE_ID` in
 * server/lib/starterRoles.ts, spelled here because importing that file reaches
 * shared/seatSettings.ts, which no value-moving module may import
 * (shared/seatSettings.boundary.test.ts). server/tokenMintHandover.db.test.ts
 * pins the two equal.
 */
export const TOKEN_MINT_TREASURY_ROLE_ID = "treasury";

/** The roles that hold `token.mint` from launch, the steward first: it names the holding. */
export const TOKEN_MINT_ROLE_IDS: readonly string[] = [STEWARD_ROLE_ID, TOKEN_MINT_TREASURY_ROLE_ID];

/** The boot step's marker, for a village recorded as started by migration 0112. */
export const TOKEN_MINT_0112_MARKER = "token-mint-to-stewards-and-treasury-0112-2026-11-15";

interface RoleLike {
  id: string;
  capabilities?: unknown;
  isExample?: boolean;
}

export interface TokenMintHandoverDeps {
  pool: Pool;
  /** Every role, from the roles repository's cache. */
  roles(): RoleLike[];
  /** Writes every role whole through the repository, which refreshes its cache. */
  replaceRoles(rows: any[]): Promise<unknown>;
  /** How many people hold this role right now, lapsed terms left out. */
  liveHolders(roleId: string): number;
  warn?(line: string): void;
}

export type TokenMintHandover =
  | { moved: true; holderRoleId: string; grantedTo: string[] }
  | { moved: false; reason: "already-held"; holderRoleId: string }
  | { moved: false; reason: "nobody-to-hold-it"; warning: string };

export const TOKEN_MINT_STAYS_WITH_ADMIN =
  "token.mint stays with the admin: this village has no steward or Treasury role with anybody in it, " +
  "so moving the power would leave nobody able to mint. Seat somebody in either role and it moves on the next boot.";

function capsOf(role: RoleLike): string[] {
  const raw = role.capabilities;
  if (Array.isArray(raw)) return raw.map(String);
  try {
    const parsed = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function handTokenMintToStewardsAndTreasury(
  deps: TokenMintHandoverDeps,
  opts: { ballotId: string | null; note: string },
): Promise<TokenMintHandover> {
  const held = (await capabilityHoldings(deps.pool)).find((h) => h.capability === TOKEN_MINT);
  if (held) return { moved: false, reason: "already-held", holderRoleId: held.holderRoleId };

  const all = deps.roles();
  const present = TOKEN_MINT_ROLE_IDS.filter((id) => all.some((r) => r.id === id && r.isExample !== true));
  if (!present.some((id) => deps.liveHolders(id) > 0)) {
    (deps.warn ?? ((l: string) => console.warn(l)))(`[token.mint] ${TOKEN_MINT_STAYS_WITH_ADMIN}`);
    return { moved: false, reason: "nobody-to-hold-it", warning: TOKEN_MINT_STAYS_WITH_ADMIN };
  }

  // The roles carry the key first: a holding names a role that must already grant it.
  const grantedTo = present.filter((id) => !capsOf(all.find((r) => r.id === id)!).includes(TOKEN_MINT));
  if (grantedTo.length) {
    await deps.replaceRoles(all.map((r) => (grantedTo.includes(r.id) ? { ...r, capabilities: [...capsOf(r), TOKEN_MINT] } : r)));
  }
  const holderRoleId = present[0];
  const out = await moveCapabilityToVillage(deps.pool, {
    capability: TOKEN_MINT,
    holderRoleId,
    movedByBallotId: opts.ballotId,
    note: opts.note,
  });
  if (!out.ok) throw new Error(`[token.mint] the hand-over could not be recorded: ${out.error}`);
  return { moved: true, holderRoleId, grantedTo };
}

/**
 * The boot step for a village migration 0112 recorded as started. It runs until
 * the key has moved once (or a holding is already on file), then never again.
 */
export async function handTokenMintOverFor0112(
  deps: TokenMintHandoverDeps & {
    gameStart(): Promise<{ started: boolean; ballotId: string | null }>;
    applied(): string[];
    markApplied(id: string): Promise<unknown>;
  },
): Promise<TokenMintHandover | null> {
  if (deps.applied().includes(TOKEN_MINT_0112_MARKER)) return null;
  const gs = await deps.gameStart();
  if (!gs.started || gs.ballotId !== null) return null;
  const out = await handTokenMintToStewardsAndTreasury(deps, {
    ballotId: null,
    note: "This village started before the launch vote existed, so the founding stewards and the Treasury role took token.mint at boot (Rye, 2026-11-15).",
  });
  if (out.moved || out.reason === "already-held") await deps.markApplied(TOKEN_MINT_0112_MARKER);
  return out;
}
