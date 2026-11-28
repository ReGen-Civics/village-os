/**
 * "I'VE BOOKED IT" (the lead, 27 Nov 2026: "I've booked it button for now for booked call dates - build it simply and
 * naturally into the flow").
 *
 * Booking happens on the role's own calendar, which the platform never reads. So the applicant may say, with one quiet
 * tap beside the booking button, the date and time they picked. It is stored on the conversation itself
 * (`application_interviews.booked_at`, through `markBooked`), which is what the team's walkthrough and the role
 * measures read as "booked". It is optional: the flow is the same if nobody ever taps it.
 *
 * PURE: the rule for an acceptable time, and the words, in English and Spanish. A time is acceptable when it is in the
 * future and no more than `BOOKED_MAX_DAYS` ahead: the server checks it again whatever the page sent.
 */
import type { ApplicantLanguage } from "./applicantWords";

/** How far ahead a booked call may be. An application closes undecided at 90 days by default. */
export const BOOKED_MAX_DAYS = 90;
const DAY = 86_400_000;

export type BookedError = "when" | "past" | "far";

/** The time a person said their call is booked for, or why it cannot be. Accepts an ISO instant. */
export function readBookedAt(raw: unknown, now: Date): { ok: true; at: Date } | { ok: false; error: BookedError } {
  const s = typeof raw === "string" ? raw.trim().slice(0, 40) : "";
  // An instant only: a date and time with its zone (Z or an offset), so the server never guesses the zone.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(s)) return { ok: false, error: "when" };
  const at = new Date(s);
  if (Number.isNaN(at.getTime())) return { ok: false, error: "when" };
  if (at.getTime() <= now.getTime()) return { ok: false, error: "past" };
  if (at.getTime() > now.getTime() + BOOKED_MAX_DAYS * DAY) return { ok: false, error: "far" };
  return { ok: true, at };
}

/** A booked call said in one zone, "Tue 3 Dec, 10:00". */
export function sayBookedAt(at: Date, zone: string | undefined, lang: ApplicantLanguage): string {
  return new Intl.DateTimeFormat(lang === "es" ? "es" : "en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", ...(zone ? { timeZone: zone } : {}) }).format(at);
}

/** The same moment in the village's zone: the time alone on the same day, else the day too. */
export function sayVillageTime(at: Date, local: string | undefined, village: string, lang: ApplicantLanguage): string {
  const day = (z: string | undefined) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", ...(z ? { timeZone: z } : {}) }).format(at);
  if (day(local) !== day(village)) return sayBookedAt(at, village, lang);
  return new Intl.DateTimeFormat(lang === "es" ? "es" : "en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: village }).format(at);
}

export interface BookedWords {
  /** The quiet action beside "Book with <role>". */
  action: string;
  ask: string;
  hint: string;
  save: string;
  cancel: string;
  change: string;
  saving: string;
  /** "Booked: Tue 3 Dec, 10:00 your time (11:00 Costa Rica time)"; `village` is null when both zones agree. */
  booked(local: string, village: string | null, villageZone: string): string;
  /** The same moment in the village's zone, under the field while they pick. */
  preview(village: string, villageZone: string): string;
  errors: Record<BookedError | "closed" | "failed", string>;
  /** The task row's state once booked. */
  state: string;
}

export const BOOKED_WORDS: Record<ApplicantLanguage, BookedWords> = {
  en: {
    action: "I've booked it",
    ask: "When is your call?",
    hint: "The date and time you picked, in your own time zone.",
    save: "Save",
    cancel: "Cancel",
    change: "Change",
    saving: "Saving",
    booked: (local, village, zone) => (village ? `Booked: ${local} your time (${village} ${zone})` : `Booked: ${local} ${zone}`),
    preview: (village, zone) => `That's ${village} ${zone}.`,
    errors: {
      when: "Pick the date and time of your call.",
      past: "That time has passed. Pick the time of your call.",
      far: `Pick a time within the next ${BOOKED_MAX_DAYS} days.`,
      closed: "This conversation isn't open for booking now.",
      failed: "That didn't save. Try again in a moment.",
    },
    state: "Booked",
  },
  es: {
    action: "Ya reservé", // needs-native-review: "I've booked it", 27 Nov 2026
    ask: "¿Cuándo es su llamada?", // needs-native-review: "I've booked it", 27 Nov 2026
    hint: "La fecha y la hora que eligió, en su propia zona horaria.", // needs-native-review: "I've booked it", 27 Nov 2026
    save: "Guardar",
    cancel: "Cancelar",
    change: "Cambiar",
    saving: "Guardando",
    booked: (local, village, zone) => (village ? `Reservada: ${local} su hora (${village} ${zone})` : `Reservada: ${local} ${zone}`), // needs-native-review: "I've booked it", 27 Nov 2026
    preview: (village, zone) => `Eso es ${village} ${zone}.`, // needs-native-review: "I've booked it", 27 Nov 2026
    errors: {
      when: "Elija la fecha y la hora de su llamada.", // needs-native-review: "I've booked it", 27 Nov 2026
      past: "Esa hora ya pasó. Elija la hora de su llamada.", // needs-native-review: "I've booked it", 27 Nov 2026
      far: `Elija una hora dentro de los próximos ${BOOKED_MAX_DAYS} días.`, // needs-native-review: "I've booked it", 27 Nov 2026
      closed: "Esta conversación no está abierta para reservar ahora.", // needs-native-review: "I've booked it", 27 Nov 2026
      failed: "No se guardó. Inténtelo de nuevo en un momento.", // needs-native-review: "I've booked it", 27 Nov 2026
    },
    state: "Reservada", // needs-native-review: "I've booked it", 27 Nov 2026
  },
};
