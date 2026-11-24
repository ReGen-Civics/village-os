/**
 * THE READS BEHIND THE FRONT DOOR'S "IN USE" TEST (lib/areasInUse.ts), in
 * their own chunk so the shell does not carry them. Each public answer is
 * asked once per page load and shared by every caller; a failed read is "not
 * in use", so nothing appears for a newcomer on a guess.
 *
 * `/api/examples` is asked without a token: that is a newcomer's answer, since
 * only an admin's differs and an admin is never a newcomer.
 */
import type { AreaAnswers } from "./areasInUse";

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

let answers: Promise<AreaAnswers> | null = null;

/** Every answer the test needs, read once per page load. */
export function readAreas(): Promise<AreaAnswers> {
  if (!answers) {
    answers = Promise.all([read("/api/examples"), read("/api/places"), read("/api/crowdpool/campaigns"), read("/api/events")]).then(([ex, places, campaigns, events]) => ({
      exampleModules: Array.isArray(ex?.modules) ? ex.modules.filter((m: unknown): m is string => typeof m === "string") : null,
      places: listed(places, "places"),
      campaigns: listed(campaigns, "campaigns"),
      events: eventsInUse(events),
    }));
  }
  return answers;
}

/** For tests: forget the answers. */
export function forgetAreasInUse(): void {
  answers = null;
}
