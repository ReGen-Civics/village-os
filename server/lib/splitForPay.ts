/**
 * THE ONE DOOR FROM A MEMBER'S COMMITMENT INTO PAY (Rye, 14 Nov 2026).
 *
 * commitmentBoundary.test.ts walls every pay path off from the commitment
 * history (lane E1: "nothing that pays reads a commitment"). Rye's answer A
 * narrows that wall for one path only: when a member's roles are paid through
 * separate applications, each role's pay scales by its share of their time,
 * from the split, and a Treasurer confirms the scaled amounts at End of Moon
 * before anything is paid.
 *
 * So this file is the only crossing the boundary test allows, and it carries
 * the split and the total it divides: `splitOn` selects `pct` and
 * `split_json` from the one word in force. WIDENED ONCE (Rye, 15 Nov 2026,
 * "no double cut"): an agreement is already priced at its own commitment, so
 * the split must read what share of the person it gives each agreement, and
 * that is the total times the share. The total travels only with a split, the
 * period, the note and the history never come through. The pay rule itself is `scaleBySplit` (shared/moonRecap.ts), and
 * approval refuses a scaled invoice until it is confirmed (`splitUnconfirmed`).
 */
import type { Queryable } from "../repos/memberTasks";
import { splitOn } from "../repos/memberCommitments";
import type { RoleSplitShare } from "../../shared/commitment";

/** The member's split as it holds on the moon's last day, with the total it divides; both null with no split. */
export async function splitForPay(db: Queryable, userId: string, lastDay: string): Promise<{ split: RoleSplitShare[] | null; givenPct: number | null }> {
  const word = await splitOn(db, userId, lastDay);
  return word ? { split: word.split, givenPct: word.pct } : { split: null, givenPct: null };
}
