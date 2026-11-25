/**
 * THE BROWSER CRASH TABLES (drizzle/0433): every query on `client_crash_signatures` and `client_crash_sightings`.
 * The rules that read them are server/lib/crashTriage.ts; the route is server/routes/clientCrash.ts.
 */
import crypto from "node:crypto";
import type { Pool } from "mysql2/promise";
import { browserKind, framesAreOurs, stableFrame } from "../../shared/crashNoise";
import { signatureId, type DigestGroup, type SignatureState, type SignatureView, type Sighting, type TriageDials } from "../lib/crashTriage";

const asDate = (v: unknown): Date | null => (v == null ? null : v instanceof Date ? v : new Date(String(v)));

/** Keeps one report: the signature's counts move, a sighting row is written, and the window's visitors are counted. */
export async function recordSighting(pool: Pool, s: Sighting, dials: TriageDials): Promise<SignatureState> {
  const id = signatureId(s.message, s.frames);
  const ours = !s.staleBuild && framesAreOurs(s.frames) ? 1 : 0;
  const topFrame = stableFrame(s.frames[0]);
  await pool.query(
    "INSERT INTO client_crash_signatures (id, message, top_frame, ours, first_seen_at, last_seen_at, seen_count) VALUES (?,?,?,?,?,?,1) " +
      "ON DUPLICATE KEY UPDATE last_seen_at = ?, seen_count = seen_count + 1, ours = GREATEST(ours, ?)",
    [id, s.message.slice(0, 300), topFrame, ours, s.now, s.now, s.now, ours],
  );
  const sightingId = `ccs-${crypto.randomBytes(10).toString("hex")}`;
  await pool.query(
    "INSERT INTO client_crash_sightings (id, signature_id, visitor, browser, route, at) VALUES (?,?,?,?,?,?)",
    [sightingId, id, s.visitor, s.browser.slice(0, 40), s.route.slice(0, 200), s.now],
  );
  const since = new Date(s.now.getTime() - dials.spreadMinutes * 60_000);
  const [[row]]: any = await pool.query(
    "SELECT message, top_frame, ours, first_seen_at, last_seen_at, seen_count, emailed_at, emails_sent FROM client_crash_signatures WHERE id = ?",
    [id],
  );
  const [[count]]: any = await pool.query(
    "SELECT COUNT(DISTINCT visitor) AS n FROM client_crash_sightings WHERE signature_id = ? AND at >= ?",
    [id, since],
  );
  return {
    id,
    message: String(row?.message ?? s.message),
    topFrame: String(row?.top_frame ?? topFrame),
    ours: Number(row?.ours ?? ours) === 1,
    firstSeenAt: asDate(row?.first_seen_at) ?? s.now,
    lastSeenAt: asDate(row?.last_seen_at) ?? s.now,
    seenCount: Number(row?.seen_count ?? 1),
    emailedAt: asDate(row?.emailed_at),
    emailsSent: Number(row?.emails_sent ?? 0),
    visitorsInWindow: Number(count?.n ?? 1),
    sightingId,
  };
}

/**
 * Takes the signature's email for this window, or learns another report already took it. A conditional UPDATE, so
 * two reports arriving together send one email. Returns the email's number (its dedupe key's last part), or null.
 */
export async function claimEmail(pool: Pool, state: SignatureState, dials: TriageDials, now: Date): Promise<number | null> {
  const before = new Date(now.getTime() - dials.emailEveryHours * 3600_000);
  const [r]: any = await pool.query(
    "UPDATE client_crash_signatures SET emailed_at = ?, emails_sent = emails_sent + 1 WHERE id = ? AND (emailed_at IS NULL OR emailed_at <= ?)",
    [now, state.id, before],
  );
  if (!r?.affectedRows) return null;
  await pool.query("UPDATE client_crash_sightings SET emailed = 1 WHERE id = ?", [state.sightingId]);
  return state.emailsSent + 1;
}

/** How far back the digest looks, so a digest that failed for a week does not send a month. */
const DIGEST_REACH_HOURS = 48;

/** Every report recorded and not emailed, not yet in a digest: counted by signature, browser kind and page. */
export async function digestGroups(pool: Pool, now: Date): Promise<{ groups: DigestGroup[]; ids: string[] }> {
  const since = new Date(now.getTime() - DIGEST_REACH_HOURS * 3600_000);
  const [rows]: any = await pool.query(
    "SELECT s.id, s.signature_id, s.browser, s.route, g.message FROM client_crash_sightings s " +
      "JOIN client_crash_signatures g ON g.id = s.signature_id " +
      "WHERE s.emailed = 0 AND s.digested_at IS NULL AND s.at >= ? AND s.at <= ? ORDER BY s.at",
    [since, now],
  );
  const by = new Map<string, DigestGroup>();
  const ids: string[] = [];
  for (const r of rows as any[]) {
    ids.push(String(r.id));
    const browser = browserKind(String(r.browser ?? ""));
    const key = `${r.signature_id}|${browser}|${r.route}`;
    const g = by.get(key) ?? { signatureId: String(r.signature_id), message: String(r.message ?? ""), browser, route: String(r.route ?? "/"), count: 0 };
    g.count++;
    by.set(key, g);
  }
  return { groups: Array.from(by.values()).sort((a, b) => b.count - a.count), ids };
}

/** Marks the digest's reports counted, so the next one starts after them. */
export async function markDigested(pool: Pool, ids: readonly string[], now: Date): Promise<void> {
  for (let i = 0; i < ids.length; i += 500) {
    const part = ids.slice(i, i + 500);
    await pool.query(`UPDATE client_crash_sightings SET digested_at = ? WHERE id IN (${part.map(() => "?").join(",")})`, [now, ...part]);
  }
}

/** The latest signatures, with the browsers and pages that reported them this week. Admin only. */
export async function signatureViews(pool: Pool, limit = 20): Promise<SignatureView[]> {
  const [sigs]: any = await pool.query(
    "SELECT id, message, top_frame, ours, first_seen_at, last_seen_at, seen_count, emailed_at FROM client_crash_signatures ORDER BY last_seen_at DESC LIMIT ?",
    [limit],
  );
  if (!(sigs as any[]).length) return [];
  const ids = (sigs as any[]).map((s) => String(s.id));
  const [seen]: any = await pool.query(
    `SELECT DISTINCT signature_id, browser, route FROM client_crash_sightings WHERE signature_id IN (${ids.map(() => "?").join(",")}) AND at >= (NOW() - INTERVAL 7 DAY)`,
    ids,
  );
  const browsers = new Map<string, Set<string>>();
  const routes = new Map<string, Set<string>>();
  for (const r of seen as any[]) {
    const id = String(r.signature_id);
    (browsers.get(id) ?? browsers.set(id, new Set()).get(id)!).add(browserKind(String(r.browser ?? "")));
    (routes.get(id) ?? routes.set(id, new Set()).get(id)!).add(String(r.route ?? "/"));
  }
  return (sigs as any[]).map((s) => ({
    id: String(s.id),
    message: String(s.message),
    topFrame: String(s.top_frame ?? ""),
    ours: Number(s.ours) === 1,
    firstSeenAt: (asDate(s.first_seen_at) ?? new Date(0)).toISOString(),
    lastSeenAt: (asDate(s.last_seen_at) ?? new Date(0)).toISOString(),
    seenCount: Number(s.seen_count ?? 0),
    emailedAt: asDate(s.emailed_at)?.toISOString() ?? null,
    browsers: Array.from(browsers.get(String(s.id)) ?? []).slice(0, 5),
    routes: Array.from(routes.get(String(s.id)) ?? []).slice(0, 5),
  }));
}

// ── Retention ──────────────────────────────────────────────────────────────

/**
 * Forgets reports older than `days`, and any signature no report has named since. Bounded per run, so a first sweep
 * over a long backlog never holds the table; the next day's run takes the rest.
 */
export async function sweepSightings(pool: Pool, now: Date, days: number): Promise<{ sightings: number; signatures: number }> {
  const before = new Date(now.getTime() - days * 24 * 3600_000);
  const [a]: any = await pool.query("DELETE FROM client_crash_sightings WHERE at < ? LIMIT 5000", [before]);
  const [b]: any = await pool.query("DELETE FROM client_crash_signatures WHERE last_seen_at < ? LIMIT 5000", [before]);
  return { sightings: Number(a?.affectedRows ?? 0), signatures: Number(b?.affectedRows ?? 0) };
}
