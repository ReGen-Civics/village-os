/**
 * THE SCREENSHOTS A MEMBER SENT WITH THEIR FEEDBACK (0443; the fold of /feedback into the guide's
 * panel, 26 Nov 2026), as erasure reads and clears them.
 *
 * A screenshot is a picture of the member's own screen, so it can show their dashboard, their
 * messages or other people's names. The file lives in the private folder beside the uploads volume
 * (`FEEDBACK_SHOT_DIRNAME`, server/lib/feedback.ts) and only its stamped name is on the row. When a
 * member is erased the files come off first and the names after (server/lib/erasure.ts), so a file
 * that will not come off stops the step with its name still on the row, and a resume finds it.
 *
 * The rows themselves stay: the words of a report are the village's record of what broke, as they
 * were before screenshots existed.
 */
import type { Pool, RowDataPacket } from "mysql2/promise";

/** The stored names of every screenshot this member sent. */
export async function feedbackShotsOfMember(pool: Pool, userId: string): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT `screenshot_file` FROM `feedback_items` WHERE `submitted_by` = ? AND `screenshot_file` IS NOT NULL",
    [userId],
  );
  return rows.map((r) => String(r.screenshot_file));
}

/** Take the name off one report whose file did not reach the folder, so the admin view offers no broken picture. */
export async function clearFeedbackShot(pool: Pool, feedbackId: string): Promise<void> {
  await pool.query("UPDATE `feedback_items` SET `screenshot_file` = NULL WHERE `id` = ?", [feedbackId]);
}

/** Clear the names once the files are off. Idempotent: a second run finds nothing to clear. */
export async function clearFeedbackShotsOfMember(pool: Pool, userId: string): Promise<void> {
  await pool.query("UPDATE `feedback_items` SET `screenshot_file` = NULL WHERE `submitted_by` = ? AND `screenshot_file` IS NOT NULL", [userId]);
}
