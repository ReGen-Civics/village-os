/**
 * The three priorities documents (shared/priorities.ts) and the one read of
 * the org chart the board needs. Every statement for the feature lives here;
 * the rules are server/lib/priorities.ts.
 *
 * A document is one `app_config` row holding JSON. Every write here reads the
 * row FOR UPDATE inside the caller's transaction and writes it back whole, so
 * two members setting their line at the same moment are decided one after the
 * other and neither line is lost. A missing row is created empty first, so
 * there is always a row to lock.
 */
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export type Queryable = Pool | PoolConnection;

function parsed(v: unknown): unknown {
  if (typeof v !== "string") return v ?? null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/** A document as stored, or null when the village has none yet. No lock. */
export async function readDoc(q: Queryable, key: string): Promise<unknown> {
  const [rows] = await q.query<RowDataPacket[]>("SELECT `value` FROM `app_config` WHERE `config_key` = ? LIMIT 1", [key]);
  return rows.length ? parsed(rows[0].value) : null;
}

/** A document locked for this transaction, made empty first when it does not exist. */
export async function lockDoc(conn: PoolConnection, key: string): Promise<unknown> {
  await conn.query("INSERT IGNORE INTO `app_config` (`config_key`, `value`) VALUES (?, '{}')", [key]);
  const [rows] = await conn.query<RowDataPacket[]>("SELECT `value` FROM `app_config` WHERE `config_key` = ? FOR UPDATE", [key]);
  return rows.length ? parsed(rows[0].value) : null;
}

/** Write a document the caller locked. */
export async function writeDoc(conn: PoolConnection, key: string, value: unknown): Promise<void> {
  await conn.query("UPDATE `app_config` SET `value` = ? WHERE `config_key` = ?", [JSON.stringify(value), key]);
}

/** The village's roles an item on the board can name as its owner. Standing examples are left out. */
export async function boardRoles(q: Queryable): Promise<Array<{ id: string; name: string }>> {
  const [rows] = await q.query<RowDataPacket[]>("SELECT `id`, `name` FROM `org_roles` WHERE `is_example` = 0 ORDER BY `name`, `id`");
  return rows.map((r) => ({ id: String(r.id), name: String(r.name ?? "") }));
}
