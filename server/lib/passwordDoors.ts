/**
 * The two doors that open on ADMIN_PASSWORD alone: `POST /api/admin/bootstrap`
 * (creates the founder while nobody holds the role) and
 * `GET /api/admin/export/database` (hands out every member's data).
 *
 * WHAT WAS WRONG (audit S2). Both were throttled per IP only, so a guesser
 * with a pool of addresses had no bound at all; and the export checked its
 * per-IP limit AFTER comparing, so a correct guess past the limit still got
 * the whole database. And nothing set a floor on the password itself.
 *
 * THE RULE NOW, for both doors:
 *   1. A password under ADMIN_PASSWORD_MIN_LENGTH is refused for these doors,
 *      with a log line naming the variable. The rest of the app is unaffected.
 *   2. Before any compare, three buckets are checked: the caller's IP, and two
 *      GLOBAL buckets for the door (an hour and a day), so a pool of addresses
 *      shares one budget. Only failures are recorded, so a correct password
 *      never spends anyone's budget.
 *   3. The global buckets FAIL CLOSED: a count that could not be taken refuses
 *      the door. Both doors need the database anyway, and a guard that opens
 *      when its own table is unreachable is no bound on guesses.
 *
 * The cost of the global bucket is deliberate: a stranger who spends it locks
 * the door for everybody, the operator included, for up to a day. A locked
 * export or bootstrap is an inconvenience; a guessed one is the village.
 */
import type { Pool } from "mysql2/promise";
import { countInWindow, recordHit } from "../repos/rateHits";
import { underTestRunner } from "./secretFloors";

export const ADMIN_PASSWORD_MIN_LENGTH = 20;

export type PasswordDoor = "bootstrap" | "village-export";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Failed attempts allowed per window. Per-IP, then for the door as a whole. */
export const DOOR_LIMITS: Record<PasswordDoor, { perIpHour: number; globalHour: number; globalDay: number }> = {
  bootstrap: { perIpHour: 5, globalHour: 6, globalDay: 24 },
  "village-export": { perIpHour: 10, globalHour: 6, globalDay: 24 },
};

/**
 * True when the configured password is too short to guard these doors. The
 * test runner is exempt (server/lib/secretFloors.ts says why and how narrowly).
 */
export function adminPasswordTooShort(password: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (underTestRunner(env)) return false;
  return typeof password !== "string" || password.length < ADMIN_PASSWORD_MIN_LENGTH;
}

/** The log line for a refused short password. Never carries the value. */
export function shortPasswordLogLine(door: PasswordDoor, length: number): string {
  return (
    `[${door}] refused: ADMIN_PASSWORD is ${length} characters, under the ${ADMIN_PASSWORD_MIN_LENGTH} this door requires. ` +
    "Set a longer one (node -e \"console.log(require('crypto').randomBytes(24).toString('base64url'))\") and redeploy."
  );
}

/** What a client is told when the password is too short. No length, no value. */
export const SHORT_PASSWORD_ANSWER =
  `This deployment's ADMIN_PASSWORD is too short to open this door. Set one of at least ${ADMIN_PASSWORD_MIN_LENGTH} characters in the environment, redeploy, and try again.`;

export interface DoorCounter {
  count(bucket: string, windowMs: number): Promise<number | null>;
  record(bucket: string): Promise<void>;
}

export function poolCounter(pool: Pool): DoorCounter {
  return {
    count: (bucket, windowMs) => countInWindow(pool, bucket, windowMs),
    record: (bucket) => recordHit(pool, bucket),
  };
}

function buckets(door: PasswordDoor, ip: string) {
  return {
    ip: `${door}-fail-ip:${ip}`,
    hour: `${door}-fail-all:hour`,
    day: `${door}-fail-all:day`,
  };
}

/**
 * Check-only, before the compare. Returns which bucket is spent, or null when
 * the caller may try. The per-IP bucket fails open like every other per-IP
 * limit; the global ones fail closed (see the header).
 */
export async function passwordDoorThrottled(
  counter: DoorCounter,
  door: PasswordDoor,
  ip: string,
): Promise<"ip" | "hour" | "day" | null> {
  const lim = DOOR_LIMITS[door];
  const b = buckets(door, ip);
  const day = await counter.count(b.day, DAY);
  if (day === null || day >= lim.globalDay) return "day";
  const hour = await counter.count(b.hour, HOUR);
  if (hour === null || hour >= lim.globalHour) return "hour";
  const perIp = await counter.count(b.ip, HOUR);
  if (perIp !== null && perIp >= lim.perIpHour) return "ip";
  return null;
}

/** Record one failed attempt against all three buckets. */
export async function recordPasswordDoorFailure(counter: DoorCounter, door: PasswordDoor, ip: string): Promise<void> {
  const b = buckets(door, ip);
  await counter.record(b.ip);
  await counter.record(b.hour);
  await counter.record(b.day);
}
