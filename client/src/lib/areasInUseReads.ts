/**
 * THE READS BEHIND THE FRONT DOOR'S "IN USE" TEST (lib/areasInUse.ts), in
 * their own chunk so the shell does not carry them. Each public answer is
 * asked once per page load and shared by every caller; a failed read is "not
 * in use", so nothing appears for a newcomer on a guess.
 *
 * `/api/examples` is asked without a token: that is a newcomer's answer, since
 * only an admin's differs and an admin is never a newcomer.
 *
 * ONLY WHAT THE SERVER WOULD ANSWER (the live probe, 25 Nov 2026). Every page
 * used to ask all four, and a visitor read four red 401s in the console on every
 * page: the portal entrance refuses a device that has not entered, and a module
 * kept for members refuses a read with no token. So nothing is asked while the
 * village keeps an entrance this device has not passed, and a read is asked only
 * when its module is public. A read not asked is "not in use", which is what it
 * is to that newcomer: they could not open the page either.
 */
import type { AreaAnswers } from "./areasInUse";
import { pastTheEntrance } from "./entranceStatus";

/** The module that answers each read; `/api/examples` belongs to none. */
export const READ_MODULE = {
  "/api/places": "map",
  "/api/crowdpool/campaigns": "crowdpool",
  "/api/events": "events",
} as const;

/** Whether an events answer holds something real, today or later, beyond the season itself. */
export function eventsInUse(body: unknown, now = Date.now()): boolean {
  const events = (body as { events?: unknown })?.events;
  if (!Array.isArray(events)) return false;
  return events.some((e) => {
    if (!e || typeof e !== "object") return false;
    const ev = e as { isExample?: unknown; kind?: unknown; startsAt?: unknown; endsAt?: unknown };
    if (ev.isExample === true || ev.kind === "season") return false;
    const until = Date.parse(String(ev.endsAt ?? ev.startsAt ?? ""));
    return Number.isFinite(until) && until >= now;
  });
}

const read = (url: string): Promise<any> =>
  fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

const listed = (body: any, key: string): boolean => Array.isArray(body?.[key]) && body[key].length > 0;

const NOTHING_KNOWN: AreaAnswers = { exampleModules: null, places: false, campaigns: false, events: false };


const answers = new Map<string, Promise<AreaAnswers>>();

/**
 * Every answer the test needs, read once per page load for one set of public modules. `publicModules` is the ids
 * the module catalog serves as public to this reader (`lifecycle === "public"`).
 */
export function readAreas(publicModules: ReadonlySet<string>): Promise<AreaAnswers> {
  const key = Array.from(publicModules).sort().join(",");
  const held = answers.get(key);
  if (held) return held;
  const ask = (url: keyof typeof READ_MODULE) => (publicModules.has(READ_MODULE[url]) ? read(url) : Promise.resolve(null));
  const made: Promise<AreaAnswers> = pastTheEntrance().then((open): AreaAnswers | Promise<AreaAnswers> =>
    !open
      ? NOTHING_KNOWN
      : Promise.all([read("/api/examples"), ask("/api/places"), ask("/api/crowdpool/campaigns"), ask("/api/events")]).then(([ex, places, campaigns, events]): AreaAnswers => ({
          exampleModules: Array.isArray(ex?.modules) ? ex.modules.filter((m: unknown): m is string => typeof m === "string") : null,
          places: listed(places, "places"),
          campaigns: listed(campaigns, "campaigns"),
          events: eventsInUse(events),
        })),
  );
  answers.set(key, made);
  return made;
}

/** For tests: forget the answers. */
export function forgetAreasInUse(): void {
  answers.clear();
}
