/**
 * THE DAY A NEW MEMBER STARTS, AND THE ALL-HANDS THEY JOIN (the lead, 27 Nov 2026: "we'll do our accepting of
 * proposals on friday and they would start on monday and be invited to the monday all hands meeting ... following the
 * start of the next season or immediately if directed by Ops").
 *
 * The start day is the village's all-hands weekday (Monday by default), the first one AFTER the day the proposal is
 * accepted and on or after the day the role starts (the season's first day, or the moon's). The meeting's day, time,
 * zone and link are village settings (shared/gameVariables.ts `org.all_hands_*`); no village's link sits here.
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
