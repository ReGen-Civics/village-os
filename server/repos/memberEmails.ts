/**
 * The SQL for a member's extra addresses (`member_emails`, 0430) and the
 * delivery choice beside them (`users.email_delivery`). The contract is
 * shared/memberEmails.ts; the rules a route asks before it calls in here are
 * server/lib/memberEmails.ts.
 *
 * EVERY ROW HERE IS AN ADDRESS SOMEBODY PROVED. Nothing writes a row before
 * the code mailed to the address came back (the pending code lives in the
 * member's own `prefs`, never in this table), so a row cannot squat an address
 * nobody owns, and there is no "unverified" state for a reader to forget to
 * filter out.
 *
 * TWO WRITES TOUCH `users` OUTSIDE server/repos/users.ts, and both are here on
 * purpose: making an extra address the main one moves `users.email` and its
 * proof in the same transaction that moves the old main address into this
 * table, and the delivery choice is one column the members repository never
 * names. Neither can be a `members.update`, because that writes every column
 * it knows from the record and cannot share a transaction with this table.
 */
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { deliveryExtra, normalizeAddress, type EmailDelivery, type ExtraAddress } from "../../shared/memberEmails";

const isDuplicate = (err: unknown): boolean => (err as { code?: string } | null)?.code === "ER_DUP_ENTRY";

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());

/** Every extra address an account holds, oldest first. */
export async function extrasFor(pool: Pool | PoolConnection, userId: string): Promise<ExtraAddress[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT email, verified_at, gets_mail FROM member_emails WHERE user_id = ? ORDER BY created_at, email",
    [userId],
  );
  return rows.map((r) => ({ email: String(r.email), verifiedAt: iso(r.verified_at), getsMail: Number(r.gets_mail) === 1 }));
}

/**
 * The account an extra address belongs to, and the address exactly as it was
 * proved. The address handed in is compared by the column's collation, which
 * folds case and accents, so a caller that will SEND to the answer must send to
 * `email` here and never to what was typed.
 */
export async function ownerOfAddress(pool: Pool, email: string): Promise<{ userId: string; email: string } | null> {
  const key = normalizeAddress(email);
  if (!key) return null;
  const [rows] = await pool.query<RowDataPacket[]>("SELECT user_id, email FROM member_emails WHERE email = ? LIMIT 1", [key]);
  return rows[0] ? { userId: String(rows[0].user_id), email: String(rows[0].email) } : null;
}

/** Whether the address is ANY account's main address. Collation-compared, like `users.email` everywhere. */
export async function mainAddressOwner(pool: Pool, email: string): Promise<string | null> {
  const key = normalizeAddress(email);
  if (!key) return null;
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE email = ? LIMIT 1", [key]);
  return rows[0] ? String(rows[0].id) : null;
}

/** The raw choice stored on the account: `main`, `other`, `both`, or null for never chosen. */
export async function deliveryChoiceOf(pool: Pool, userId: string): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT email_delivery FROM users WHERE id = ?", [userId]);
  return rows[0]?.email_delivery == null ? null : String(rows[0].email_delivery);
}

/** What the post office needs to work out where one member's mail goes, in two reads. Null for no such account. */
export async function deliveryFactsOf(
  pool: Pool,
  userId: string,
): Promise<{ main: string; delivery: string | null; extras: ExtraAddress[] } | null> {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT email, email_delivery FROM users WHERE id = ?", [userId]);
  if (!rows[0]) return null;
  const delivery = rows[0].email_delivery == null ? null : String(rows[0].email_delivery);
  // An account that never chose anything needs no second read: its mail goes where it always went.
  const extras = delivery && delivery !== "main" ? await extrasFor(pool, userId) : [];
  return { main: String(rows[0].email), delivery, extras };
}

/**
 * Attach a proved address. `taken` when the address already belongs to an
 * account (this table's primary key refuses the second writer, so two members
 * racing for one address cannot both win).
 */
export async function attachAddress(
  pool: Pool,
  row: { userId: string; email: string; verifiedAt: Date },
): Promise<{ ok: true } | { ok: false; reason: "taken" }> {
  try {
    await pool.query("INSERT INTO member_emails (email, user_id, verified_at, gets_mail) VALUES (?, ?, ?, 0)", [
      normalizeAddress(row.email),
      row.userId,
      row.verifiedAt,
    ]);
    return { ok: true };
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, reason: "taken" };
    throw err;
  }
}

/** Detach one of the account's own extra addresses. False when it holds no such address. */
export async function detachAddress(pool: Pool, userId: string, email: string): Promise<boolean> {
  const [r] = await pool.query<any>("DELETE FROM member_emails WHERE user_id = ? AND email = ?", [userId, normalizeAddress(email)]);
  return Number(r?.affectedRows ?? 0) > 0;
}

/**
 * Store where the member's mail goes. Under `other` and `both`, `to` names the
 * extra address that receives it, and exactly that one is marked.
 */
export async function setDelivery(pool: Pool, userId: string, delivery: EmailDelivery, to: string | null): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("UPDATE users SET email_delivery = ? WHERE id = ?", [delivery, userId]);
    if (to) {
      await conn.query("UPDATE member_emails SET gets_mail = CASE WHEN email = ? THEN 1 ELSE 0 END WHERE user_id = ?", [
        normalizeAddress(to),
        userId,
      ]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export type MakeMainResult = { ok: true; oldMain: string } | { ok: false; reason: "not_attached" | "main_unproved" | "too_long" };

/**
 * Make one of the account's extra addresses its MAIN address, in one
 * transaction with both rows locked: the extra row goes, `users.email` and its
 * proof become the extra address's, and the old main address comes into this
 * table with the proof it had. Nothing is lost and nothing unproved is
 * attached, which is why an account whose main address was never proved is
 * refused: the old main would become an extra address nobody proved.
 *
 * WHERE THE MAIL GOES IS KEPT. A member whose mail went to `other`, and who
 * makes that very address the main one, now wants `main`. Under `both` the two
 * addresses are the same two, so the old main address is the one marked. Any
 * other choice is left alone.
 */
export async function makeMainAddress(pool: Pool, userId: string, email: string): Promise<MakeMainResult> {
  const key = normalizeAddress(email);
  // `users.email` is varchar(255); an address longer than that can be an extra one and never the main one.
  if (key.length > 254) return { ok: false, reason: "too_long" };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [users] = await conn.query<RowDataPacket[]>(
      "SELECT email, email_verified_at, email_delivery FROM users WHERE id = ? FOR UPDATE",
      [userId],
    );
    const u = users[0];
    const [extras] = await conn.query<RowDataPacket[]>(
      "SELECT email, verified_at, gets_mail FROM member_emails WHERE user_id = ? ORDER BY created_at, email FOR UPDATE",
      [userId],
    );
    const target = extras.find((r) => String(r.email) === key);
    if (!u || !target) {
      await conn.rollback();
      return { ok: false, reason: "not_attached" };
    }
    if (u.email_verified_at == null) {
      await conn.rollback();
      return { ok: false, reason: "main_unproved" };
    }
    const oldMain = normalizeAddress(u.email);
    const wasDeliveryTarget =
      deliveryExtra(extras.map((r) => ({ email: String(r.email), getsMail: Number(r.gets_mail) === 1 }))) === key;
    const delivery = u.email_delivery == null ? null : String(u.email_delivery);
    const nextDelivery = delivery === "other" && wasDeliveryTarget ? "main" : delivery;
    const oldMainGetsMail = delivery === "both" && wasDeliveryTarget ? 1 : 0;

    await conn.query("DELETE FROM member_emails WHERE email = ? AND user_id = ?", [key, userId]);
    if (oldMainGetsMail) await conn.query("UPDATE member_emails SET gets_mail = 0 WHERE user_id = ?", [userId]);
    await conn.query("INSERT INTO member_emails (email, user_id, verified_at, gets_mail) VALUES (?, ?, ?, ?)", [
      oldMain,
      userId,
      u.email_verified_at,
      oldMainGetsMail,
    ]);
    await conn.query("UPDATE users SET email = ?, email_verified_at = ?, email_delivery = ? WHERE id = ?", [
      key,
      target.verified_at,
      nextDelivery,
      userId,
    ]);
    await conn.commit();
    return { ok: true, oldMain };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** The erasure's step: every extra address goes with the person, and the choice with them. */
export async function forgetMemberEmails(pool: Pool, userId: string): Promise<void> {
  await pool.query("DELETE FROM member_emails WHERE user_id = ?", [userId]);
  await pool.query("UPDATE users SET email_delivery = NULL WHERE id = ?", [userId]);
}
