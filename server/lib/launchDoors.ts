/**
 * THE ADMIN DOORS THAT CLOSE WHEN THE GAME STARTS (launch security decisions
 * D1 and D2, 2026-11-15; awaiting Rye's confirmation).
 *
 * Each decision sits behind ONE exported constant that defaults to the secure
 * choice. If the answer is no, the flip is that one line, and every route that
 * asks reads the predicate below, so no route keeps its own copy of the rule.
 *
 * "After launch" is `readGameStart(pool).started` (server/lib/gameStart.ts),
 * the same reader that gates issuance, so a village that was live before the
 * launch ballot existed reads as started here too.
 *
 * ── D1: ADMIN_HAND_MINT_CLOSES_AT_LAUNCH ───────────────────────────────────
 *
 * `POST /api/admin/tokens/:slug/mint` is guarded by `isAdmin` alone, and no
 * capability names it, so the village can never be handed it and no vote can
 * close it. After launch tokens come only from the rules the village voted
 * on. The second-steward approval of a waiting grant
 * (`POST /api/admin/mint-requests/:id/approve`) is the same hand mint signed
 * twice, so it closes with it. Declining a waiting grant stays open, and
 * putting a waiting grant to the village (`server/routes/mintRequestVotes.ts`)
 * is the village's own vote and stays open.
 *
 * Treasury stocking (`POST /api/admin/exchange/stock`) also posts out of
 * `sys:mint`, and it is NOT closed here: it is gated by `exchange.manage`, a
 * capability the village can hold, so its door already has a vote path.
 *
 * ── D2: GOVERNANCE_DIALS_AND_ADMIN_ROLES_CLOSE_AT_LAUNCH ───────────────────
 *
 * (a) The dials that decide how votes pass (`isVoteRuleDial`) refuse the dial
 *     write (`server/lib/dialWrite.ts`) after launch. They change by the
 *     mechanics proposal path, which writes through `setVariable` and never
 *     through `writeDial`. The founder seated as a steward who breaks the
 *     glass (`verdict.reachedPast`) keeps the door: that path writes a public
 *     record of itself and is the village's emergency exit by ruling.
 * (b) Making or removing admins: an account's role, a power group's admin
 *     access switch, seating or unseating someone in a group that opens the
 *     panel, and linking such a group to an org role, all refuse an admin
 *     acting as an admin after launch. The env break-glass
 *     (`BREAK_GLASS_ADMIN_EMAIL` on `POST /api/admin/bootstrap`) is hosting,
 *     outside the village's rules, and is untouched.
 */
import type { Pool, PoolConnection } from "mysql2/promise";
import { isMetaSetting } from "../../shared/ballotSubjects";
import { readGameStart } from "./gameStart";

/** D1. true: an admin's hand mint is refused once the Game has started. */
export const ADMIN_HAND_MINT_CLOSES_AT_LAUNCH = true;

/** D2. true: vote-rule dials and admin-making close to the admin panel once the Game has started. */
export const GOVERNANCE_DIALS_AND_ADMIN_ROLES_CLOSE_AT_LAUNCH = true;

/** Has this village's Game started. The one reader, so every door asks the same question. */
export async function gameHasStarted(conn: Pool | PoolConnection): Promise<boolean> {
  return (await readGameStart(conn)).started;
}

// ── D1 ────────────────────────────────────────────────────────────────────

export const HAND_MINT_CLOSED_AT_LAUNCH =
  "The village started its Game, so tokens are minted only by the rules the village voted on. " +
  "A hand mint from the admin panel is closed. Propose a mint rule, or put a waiting grant to the village.";

/** Whether a hand mint is refused, given whether the Game has started. */
export function handMintClosed(started: boolean, closes: boolean = ADMIN_HAND_MINT_CLOSES_AT_LAUNCH): boolean {
  return closes && started;
}

/** The 409 body a closed hand mint answers. */
export const HAND_MINT_CLOSED_BODY = { error: HAND_MINT_CLOSED_AT_LAUNCH, code: "hand_mint_closed_at_launch" } as const;

// ── D2 (a) ────────────────────────────────────────────────────────────────

/**
 * Vote-rule dials outside the META_SETTING class. `isMetaSetting` already
 * names unity, quorum, every tier and subject floor, the highest tier, the
 * veto map and windows, who counts toward quorum, and when a proposal may
 * reach the vote. These are the rest of "how a vote passes".
 *
 * `governance.auto_apply_enabled` is deliberately absent: it is the founder's
 * emergency brake (founder ring), and closing it would leave no brake.
 */
export const VOTE_RULE_DIAL_EXTRAS: readonly string[] = [
  "governance.launch_min_electorate",
  "governance.default_method",
  "governance.consent_window_days",
  "governance.steward_veto_tiers",
  "governance.hypha_threshold",
];

/** Whether this dial decides how a vote passes, who counts, or who may bring one. */
export function isVoteRuleDial(key: string): boolean {
  const k = String(key ?? "");
  return isMetaSetting(k) || VOTE_RULE_DIAL_EXTRAS.includes(k);
}

export const VOTE_RULE_DIAL_CLOSED_AT_LAUNCH =
  "The village started its Game, so how its votes pass is the village's to decide. " +
  "This dial changes only by the village's vote now. Raise it as a proposal.";

/**
 * Whether the dial write refuses this key. `brokeTheGlass` is the founder
 * seated as a steward reaching past the village (`verdict.reachedPast`), which
 * keeps its door.
 */
export function voteRuleDialClosed(
  key: string,
  started: boolean,
  brokeTheGlass: boolean,
  closes: boolean = GOVERNANCE_DIALS_AND_ADMIN_ROLES_CLOSE_AT_LAUNCH,
): boolean {
  return closes && started && !brokeTheGlass && isVoteRuleDial(key);
}

// ── D2 (b) ────────────────────────────────────────────────────────────────

export const ADMIN_ROLES_CLOSED_AT_LAUNCH =
  "The village started its Game, so an admin can no longer make or remove admins from the panel. " +
  "Who administers the village is the village's to decide.";

/** For a group that opens the panel: where the village's own door is. */
export const ADMIN_GROUP_HOLDERS_CLOSED_AT_LAUNCH =
  "The village started its Game, and this group opens the admin panel, so an admin can no longer seat or unseat anybody in it. " +
  "A village does that with a role_seat or role_unseat ballot.";

/** Whether an admin acting as an admin is refused making or removing an admin. */
export function adminRolesClosed(started: boolean, closes: boolean = GOVERNANCE_DIALS_AND_ADMIN_ROLES_CLOSE_AT_LAUNCH): boolean {
  return closes && started;
}

/** The 409 body for the account-role and admin-access doors. */
export const ADMIN_ROLES_CLOSED_BODY = { error: ADMIN_ROLES_CLOSED_AT_LAUNCH, code: "admin_roles_closed_at_launch" } as const;
