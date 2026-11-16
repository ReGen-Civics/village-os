/**
 * THE DIALS THAT DECIDE HOW VOTES PASS CLOSE TO THE PANEL WHEN THE GAME STARTS
 * (launch security decision D2a, 2026-11-15; Rye: ON).
 *
 * The rule sits behind ONE exported constant that defaults to the secure
 * choice, so turning it off is that one line, and the dial write
 * (`server/lib/dialWrite.ts`) is the only place that asks.
 *
 * "After launch" is `readGameStart(pool).started` (server/lib/gameStart.ts),
 * the same reader that gates issuance, so a village that was live before the
 * launch ballot existed reads as started here too.
 *
 * After launch the dials named by `isVoteRuleDial` refuse the dial write. They
 * change by the mechanics proposal path, which writes through `setVariable`
 * and never through `writeDial`. The founder seated as a steward who breaks
 * the glass (`verdict.reachedPast`) keeps the door: that path writes a public
 * record of itself and is the village's emergency exit by ruling.
 *
 * D1 (the hand mint) became the `token.mint` power instead
 * (server/lib/tokenMintHandover.ts). D2b (making and removing admins) is
 * deferred: admin grants stay under the 1 Nov steward rule, and an
 * `admin_grant` ballot is a follow-up after launch.
 */
import { isMetaSetting } from "../../shared/ballotSubjects";

/** D2a. true: the vote-rule dials close to the dial write once the Game has started. */
export const GOVERNANCE_DIALS_CLOSE_AT_LAUNCH = true;

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
  closes: boolean = GOVERNANCE_DIALS_CLOSE_AT_LAUNCH,
): boolean {
  return closes && started && !brokeTheGlass && isVoteRuleDial(key);
}
