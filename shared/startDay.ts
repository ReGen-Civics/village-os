/**
 * THE DAY A NEW MEMBER STARTS, AND THE ALL-HANDS THEY JOIN (the lead, 27 Nov 2026: "we'll do our accepting of
 * proposals on friday and they would start on monday and be invited to the monday all hands meeting ... following the
 * start of the next season or immediately if directed by Ops").
 *
 * The start day is the village's all-hands weekday (Monday by default): `startOf` below holds the rule. The meeting's
 * day, time, zone and link are village settings (shared/gameVariables.ts `org.all_hands_*`); no village's link sits here.
 *
 * PURE: civil dates (YYYY-MM-DD) in, civil dates out.
 */
import type { ApplicantLanguage } from "./applicantWords";

export const ALL_HANDS_VARIABLES = {
  day: "org.all_hands_day",
  time: "org.all_hands_time",
  zone: "org.all_hands_timezone",
  link: "org.all_hands_link",
} as const;

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** The weekday a village names (English or Spanish), 0 for Sunday; Monday when it names none we know. */
export function weekdayIndex(name: unknown): number {
  const n = String(name ?? "").trim().toLowerCase();
  const en = WEEKDAYS.indexOf(n);
  if (en >= 0) return en;
  const es = WEEKDAYS_ES.indexOf(n);
  return es >= 0 ? es : 1;
}

const toDate = (iso: string): Date => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
const toIso = (d: Date): string => d.toISOString().slice(0, 10);

/** The first `weekday` strictly after `acceptedIso`, and on or after `roleStartsIso` when it is given. */
export function startDayOf(roleStartsIso: string | null, acceptedIso: string, weekday = 1): string {
  const after = toDate(acceptedIso);
  after.setUTCDate(after.getUTCDate() + 1);
  const floor = roleStartsIso && /^\d{4}-\d{2}-\d{2}/.test(roleStartsIso) ? toDate(roleStartsIso) : null;
  const d = floor && floor > after ? floor : after;
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return toIso(d);
}

/** The first `weekday` on or after `iso`: the next all-hands, today's when today is the day. */
export function allHandsOnOrAfter(iso: string, weekday = 1): string {
  const d = toDate(iso);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return toIso(d);
}

/** The weekday a civil date falls on, 0 for Sunday. A letter names a date's weekday from the date, never from a setting. */
export function weekdayOfIso(iso: string): number {
  return toDate(iso).getUTCDay();
}

/**
 * THE START RULE, IN ONE PLACE (the lead, 27 Nov 2026; the coordinator, e2e round 3). For an application that went
 * through the conversation flow:
 *
 *   by default, in every term mode   the role starts on the first all-hands weekday on or after the NEXT season's
 *                                    start, and that day is the all-hands they join;
 *   Ops chose "start now"            the role starts the day it is adopted, and they are invited to the NEXT
 *                                    all-hands: the first all-hands weekday on or after that day, from the calendar.
 *
 * No moon's last day and no acceptance day ever stands in for an all-hands day (round 3: "Monday 28 November", a
 * Saturday). A role adopted outside the conversation flow keeps the village's older rule, which is not this file's.
 */
export type StartRule = "next_season" | "start_now" | "no_season";
export interface StartDay {
  /** The civil day the role starts. */
  iso: string;
  rule: StartRule;
  /** The civil day of the all-hands they are invited to. */
  allHandsIso: string;
}
export function startOf(i: { acceptedIso: string; weekday: number; seasonStarts: readonly string[]; startNow: boolean }): StartDay {
  const accepted = i.acceptedIso.slice(0, 10);
  if (i.startNow) return { iso: accepted, rule: "start_now", allHandsIso: allHandsOnOrAfter(accepted, i.weekday) };
  const next = [...i.seasonStarts].filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d) && d.slice(0, 10) > accepted).sort()[0] ?? null;
  const iso = startDayOf(next ? next.slice(0, 10) : null, accepted, i.weekday);
  return { iso, rule: next ? "next_season" : "no_season", allHandsIso: iso };
}

/** The team's words for which rule chose the day. English, like every team line. `w` is the all-hands weekday. */
export const START_RULE_WORDS: Record<StartRule, (weekday: string) => string> = {
  next_season: (w) => `the first ${w} on or after the next season begins`,
  start_now: () => "the day they were adopted, because Ops chose to start now",
  no_season: (w) => `the first ${w} after acceptance, because no next season is set`,
};

/** A weekday's name in the applicant's language. */
export function weekdayName(index: number, lang: ApplicantLanguage | null | undefined): string {
  const list = lang === "es" ? WEEKDAYS_ES : WEEKDAYS;
  const n = list[((index % 7) + 7) % 7];
  return lang === "es" ? n : n.charAt(0).toUpperCase() + n.slice(1);
}

/** "Costa Rica time" from "America/Costa_Rica", in the applicant's language. */
export function zoneLabel(zone: unknown, lang: ApplicantLanguage | null | undefined): string {
  const z = String(zone ?? "").trim();
  const city = (z.split("/").pop() ?? z).replace(/_/g, " ").trim();
  if (!city) return "";
  return lang === "es" ? `hora de ${city}` : `${city} time`;
}

/**
 * The instant a wall-clock time in a zone falls on ("2026-11-30", "12:00", "America/Costa_Rica"), or null when it
 * cannot be read. Pages show it in the reader's own zone with the village's beside it (the lead: "Yes local times!").
 */
export function zonedInstant(dayIso: string, time: string, zone: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time ?? "").trim());
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(dayIso)) return null;
  const [y, mo, d] = dayIso.split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d, Number(m[1]), Number(m[2]));
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
    return new Date(guess - (asIfUtc - guess));
  } catch {
    return null;
  }
}

/** A calendar invite (.ics) for the all-hands on the start day: one hour, in the village's zone, with its link. */
export function allHandsInvite(i: { uid: string; dayIso: string; time: string; zone: string; title: string; link: string | null; now: Date }): string | null {
  const at = zonedInstant(i.dayIso, i.time, i.zone);
  if (!at) return null;
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(at.getTime() + 60 * 60 * 1000);
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//village//all-hands//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${i.uid}`,
    `DTSTAMP:${stamp(i.now)}`,
    `DTSTART:${stamp(at)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(i.title)}`,
    ...(i.link ? [`URL:${i.link}`, `LOCATION:${esc(i.link)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
