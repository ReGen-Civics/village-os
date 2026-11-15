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
 * the split and nothing else: `splitOn` selects `split_json` alone. The
 * percent a member gives, the period, the note and the history never come
 * through. The pay rule itself is `scaleBySplit` (shared/moonRecap.ts), and
 * approval refuses a scaled invoice until it is confirmed (`splitUnconfirmed`).
 */
import type { Queryable } from "../repos/memberTasks";
import { splitOn } from "../repos/memberCommitments";
import type { RoleSplitShare } from "../../shared/commitment";

/** The member's split as it holds on the moon's last day, or null. */
export async function splitForPay(db: Queryable, userId: string, lastDay: string): Promise<RoleSplitShare[] | null> {
  return (await splitOn(db, userId, lastDay)) ?? null;
}
