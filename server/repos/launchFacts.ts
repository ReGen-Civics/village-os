/**
 * The one read the launch facts need that no other reader already makes:
 * whether anybody holds this village yet.
 *
 * `POST /api/admin/bootstrap` asks the same question before it lets the shared
 * password do anything, by loading every member and looking for an admin or a
 * founder. The facts are read on every admin screen, so this asks the database
 * for one row instead of all of them. Same two roles, same meaning.
 */
import type { Pool, RowDataPacket } from "mysql2/promise";

/** True once an account with the admin or the founder role exists. */
export async function villageIsClaimed(pool: Pool): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT 1 AS held FROM users WHERE role IN ('admin', 'founder') LIMIT 1",
  );
  return rows.length > 0;
}
