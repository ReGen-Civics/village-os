/**
 * THE WAYS TO GET TO KNOW US, AS THINGS TO DO (Rye, 15 Nov 2026).
 *
 * Step 1 of the application ("Get to know us") lists the ways a village asks
 * people to meet it first. Rye: "This should show links to all of these
 * things... most people seeing this might not have done these things
 * already." So each way gets one clear act, and a person who is completely
 * new is offered the Steward path first ("just direct them to the [Steward]
 * path to go explore... but also feel free to put in an application if you
 * are already feeling like you're a strong fit").
 *
 * WHERE EACH LINK COMES FROM, live data first:
 *   - the next community call, land tour and potluck: the next public event
 *     on the village calendar whose title names it (`KNOW_US_MATCH`), else the
 *     link the village wrote in Admin;
 *   - the last recording: the link the village wrote. The recordings store
 *     holds every call the village transcribes, internal ones too, so nothing
 *     here picks one to publish on its own;
 *   - the Steward path: the village's link, /steward by default.
 * A way with no link and no event shows no act: never a dead link.
 *
 * PURE: the server hands in the settings and the events; the page reads the
 * answer back with `knowUsLinksOf`, which never throws.
 */
import { safeHref } from "./otherWays";

/** The links, each a village setting under "The founding team" in shared/gameVariables.ts. */
export const KNOW_US_LINK_KEYS = {
  recording: "org.founding_recording_link",
  call: "org.founding_call_link",
  tour: "org.founding_tour_link",
  potluck: "org.founding_potluck_link",
  stewardPath: "org.founding_steward_path_link",
} as const;

export type KnowUsLinkKey = (typeof KNOW_US_LINK_KEYS)[keyof typeof KNOW_US_LINK_KEYS];

/** Where a completely new person is sent while the village has written no Steward path link. */
export const STEWARD_PATH_FALLBACK = "/steward";

/** The words an event's title must hold to count as the next of each way, lower case. */
export const KNOW_US_MATCH = {
  call: ["community call", "webinar", "llamada comunitaria", "seminario web"],
  tour: ["land tour", "tour of the land", "recorrido", "tour"],
  potluck: ["potluck", "comida compartida"],
} as const;

export type KnowUsWay = keyof typeof KNOW_US_MATCH;

/** The next event of a way: its title, when, where, and where it points. */
export interface KnowUsNext {
  title: string;
  startsAt: string;
  place: string | null;
  href: string;
}

export interface KnowUsAct {
  /** Where the act goes: the next event's link, else the village's own link. Null: no act. */
  href: string | null;
  next: KnowUsNext | null;
}

export interface KnowUsLinks {
  recording: string | null;
  call: KnowUsAct;
  tour: KnowUsAct;
  potluck: KnowUsAct;
  stewardPath: string;
}

/** An event as the calendar lists it, the fields read here. */
export interface KnowUsEvent {
  title: string;
  startsAt: string;
  locationText?: string | null;
  link?: string | null;
  status?: string | null;
}

const NONE: KnowUsAct = { href: null, next: null };
export const NO_KNOW_US_LINKS: KnowUsLinks = { recording: null, call: NONE, tour: NONE, potluck: NONE, stewardPath: STEWARD_PATH_FALLBACK };

/** A link the village wrote: a page of this site or an https address, else null. */
function linkOf(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim().slice(0, 500) : "";
  if (!s) return null;
  const href = safeHref(s, "");
  return href || null;
}

/** The first event, from `now` on, whose title holds one of the way's words. Not cancelled. */
export function nextOfWay(events: readonly KnowUsEvent[], way: KnowUsWay, now: Date): KnowUsNext | null {
  const words = KNOW_US_MATCH[way];
  const found = events
    .filter((e) => e && typeof e.title === "string" && typeof e.startsAt === "string" && e.status !== "cancelled")
    .filter((e) => Date.parse(e.startsAt) >= now.getTime())
    .filter((e) => {
      const title = e.title.toLowerCase();
      return words.some((w) => title.includes(w));
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
  if (!found) return null;
  return {
    title: found.title.trim().slice(0, 120),
    startsAt: new Date(Date.parse(found.startsAt)).toISOString(),
    place: typeof found.locationText === "string" && found.locationText.trim() ? found.locationText.trim().slice(0, 120) : null,
    href: linkOf(found.link) ?? "/events",
  };
}

/** The links from the village's settings and its upcoming public events. */
export function knowUsLinksFrom(get: (key: KnowUsLinkKey) => string, events: readonly KnowUsEvent[], now: Date): KnowUsLinks {
  const act = (way: KnowUsWay, key: KnowUsLinkKey): KnowUsAct => {
    const next = nextOfWay(events, way, now);
    return { href: next?.href ?? linkOf(get(key)), next };
  };
  return {
    recording: linkOf(get(KNOW_US_LINK_KEYS.recording)),
    call: act("call", KNOW_US_LINK_KEYS.call),
    tour: act("tour", KNOW_US_LINK_KEYS.tour),
    potluck: act("potluck", KNOW_US_LINK_KEYS.potluck),
    stewardPath: linkOf(get(KNOW_US_LINK_KEYS.stewardPath)) ?? STEWARD_PATH_FALLBACK,
  };
}

function actOf(raw: unknown): KnowUsAct {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const n = o.next && typeof o.next === "object" ? (o.next as Record<string, unknown>) : null;
  const next: KnowUsNext | null =
    n && typeof n.title === "string" && typeof n.startsAt === "string" && !Number.isNaN(Date.parse(n.startsAt))
      ? { title: n.title.slice(0, 120), startsAt: n.startsAt, place: typeof n.place === "string" ? n.place.slice(0, 120) : null, href: linkOf(n.href) ?? "/events" }
      : null;
  return { href: next?.href ?? linkOf(o.href), next };
}

/** The links as the form's answer carries them, read back safely: anything missing is no act. */
export function knowUsLinksOf(raw: unknown): KnowUsLinks {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    recording: linkOf(o.recording),
    call: actOf(o.call),
    tour: actOf(o.tour),
    potluck: actOf(o.potluck),
    stewardPath: linkOf(o.stewardPath) ?? STEWARD_PATH_FALLBACK,
  };
}
