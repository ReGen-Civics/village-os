/**
 * A LETTER TO THE PEOPLE WAITING FOR ONE ROLE (the lead, 20 Nov 2026).
 *
 * The coming-soon waitlist (shared/roleWaitlist.ts) keeps who asked to hear
 * when a role opens. This is the way to tell them. The admin side shows the
 * list grouped by role, and for one role a person drafts a letter on screen,
 * reads it, and presses send. Nothing is ever sent by a job, by an agent or
 * on a schedule: the one route that sends takes the person's own press and
 * the count they were shown.
 *
 *   GET  /api/admin/roles/waitlist-letters            counts per role and the letters sent so far
 *   POST /api/admin/roles/waitlist-letters/send       one letter to everyone waiting for one role
 *
 * A letter goes only to the people who ticked "write to me" on the sign-up (`lettersRecipients`);
 * a sign-up from before the tick existed is never written to, and the screen says "N of M said yes".
 *
 * Who may send is the capability `comms.manage` (shared/capabilities.ts):
 * the village's letters to people who agreed to hear from it.
 *
 * Every letter ends with a line the sender cannot remove: a one-click link
 * that takes the address off the waitlist (purpose `waitlist_remove`). An
 * address on the suppression list is skipped.
 *
 * Pure: no pool, no clock, no Node builtins.
 */
import type { ApplicantLanguage } from "./applicantWords";
import type { WaitlistRow } from "./roleWaitlist";

export const WAITLIST_LETTER_LIMITS = {
  subject: 150,
  body: 5000,
  /** The most people one press writes to. A longer list is written to in parts. */
  recipients: 150,
  /** Presses one admin may make in the window. */
  perWindow: 20,
  windowMs: 60 * 60 * 1000,
} as const;

export const WAITLIST_LETTER_PROBLEMS = {
  role: "Choose the role whose waitlist you are writing to.",
  subject: `Write a subject, up to ${WAITLIST_LETTER_LIMITS.subject} characters.`,
  body: `Write the letter, up to ${WAITLIST_LETTER_LIMITS.body} characters.`,
  confirm: "Read the letter and press send yourself. Nothing is sent without that press.",
  count: "The list changed since you read it. Read the count again and press send once more.",
  tooMany: `That is more than ${WAITLIST_LETTER_LIMITS.recipients} people. Write to them in parts.`,
  nobody: "Nobody who said yes to letters is waiting for this role right now.",
} as const;

/** The people waiting for one role, as the admin list groups them. */
export interface WaitlistGroup {
  roleId: string;
  name: string;
  /** Distinct addresses waiting. A person who signed up twice counts once. */
  count: number;
  /** Of those, how many said yes to letters. A letter goes to this many. */
  yes: number;
  rows: WaitlistRow[];
}

/** The waitlist grouped by role, largest first, then by name. A row naming three roles is in three groups. */
export function waitlistByRole(rows: readonly WaitlistRow[]): WaitlistGroup[] {
  const groups = new Map<string, WaitlistGroup>();
  for (const row of rows) {
    for (const role of row.roles) {
      const g = groups.get(role.id) ?? { roleId: role.id, name: role.name, count: 0, yes: 0, rows: [] };
      g.rows.push(row);
      groups.set(role.id, g);
    }
  }
  return Array.from(groups.values())
    .map((g) => ({ ...g, count: new Set(g.rows.map((r) => r.email)).size, yes: lettersRecipients(g.rows).length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** The words for why the button is closed, in each language the screen speaks. `switch` names where it opens. */
export const BLOCKED_WORDS: Record<ApplicantLanguage, Record<"noSender" | "paused" | "off" | "preview" | "unreadable", string>> = {
  en: {
    noSender: "This village has no email sender set up yet. Set one up under Email settings first.",
    paused: "The village's email is paused. Take the pause off in the Comms settings first.",
    off: "Letters are closed because the Comms module is off. Turn it on to Members or Public in Admin, Modules, Comms.",
    preview: "Letters are closed while the Comms module is in Preview, because a letter sent now would go to the rehearsal inbox and not to the people. Set Comms to Members or Public in Admin, Modules, Comms.",
    unreadable: "The village's email state could not be read, so nothing is sent.",
  },
  es: {
    noSender: "Esta aldea aún no tiene un remitente de correo. Configúrelo primero en los ajustes de correo.",
    paused: "El correo de la aldea está en pausa. Quite la pausa en los ajustes de Comms primero.",
    off: "Las cartas están cerradas porque el módulo Comms está apagado. Enciéndalo en Miembros o Público en Admin, Módulos, Comms.",
    preview: "Las cartas están cerradas mientras el módulo Comms está en Vista previa, porque una carta enviada ahora iría a la bandeja de ensayo y no a las personas. Ponga Comms en Miembros o Público en Admin, Módulos, Comms.",
    unreadable: "No se pudo leer el estado del correo de la aldea, así que no se envía nada.",
  },
};

/**
 * One address per person: the newest row of each address, so a repeat sign-up is written to once.
 * The newest row's tick decides, so a person who later signs up without it is not written to.
 */
export function oneRowPerAddress<T extends { email: string; createdAt: string }>(rows: readonly T[]): T[] {
  const seen = new Map<string, T>();
  for (const r of rows) {
    const had = seen.get(r.email);
    if (!had || r.createdAt > had.createdAt) seen.set(r.email, r);
  }
  return Array.from(seen.values());
}

/** The people a letter for one role goes to: one row per address, only those whose newest row said yes to letters. */
export function lettersRecipients<T extends { email: string; createdAt: string; consent: boolean }>(rows: readonly T[]): T[] {
  return oneRowPerAddress(rows).filter((r) => r.consent === true);
}

export interface WaitlistLetterAsk {
  roleId: string;
  subject: string;
  body: string;
  /** The count the person was shown. */
  expectedCount: number;
  lang: ApplicantLanguage;
}

export type WaitlistLetterRead = { ok: true; value: WaitlistLetterAsk } | { ok: false; field: "roleId" | "subject" | "body" | "confirm"; problem: string };

/** The request, read. `confirm` must be the literal `true`: the person's own press. */
export function readWaitlistLetter(raw: unknown): WaitlistLetterRead {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const roleId = typeof o.roleId === "string" ? o.roleId.trim() : "";
  if (!roleId) return { ok: false, field: "roleId", problem: WAITLIST_LETTER_PROBLEMS.role };
  const subject = typeof o.subject === "string" ? o.subject.replace(/\s+/g, " ").trim() : "";
  if (!subject || subject.length > WAITLIST_LETTER_LIMITS.subject) return { ok: false, field: "subject", problem: WAITLIST_LETTER_PROBLEMS.subject };
  const body = typeof o.body === "string" ? o.body.replace(/\r\n/g, "\n").trim() : "";
  if (!body || body.length > WAITLIST_LETTER_LIMITS.body) return { ok: false, field: "body", problem: WAITLIST_LETTER_PROBLEMS.body };
  if (o.confirm !== true) return { ok: false, field: "confirm", problem: WAITLIST_LETTER_PROBLEMS.confirm };
  const expectedCount = typeof o.expectedCount === "number" && Number.isInteger(o.expectedCount) ? o.expectedCount : -1;
  const lang: ApplicantLanguage = o.lang === "es" ? "es" : "en";
  return { ok: true, value: { roleId, subject, body, expectedCount, lang } };
}

/** The line every letter ends with, and the page the link opens. `link` is the one-click removal. */
export const UNSUBSCRIBE_LINES: Record<ApplicantLanguage, (village: string, link: string) => string> = {
  en: (village, link) => `You get this because you asked ${village} to tell you when this role opens. To come off the waitlist, open this link: ${link}`,
  es: (village, link) => `Recibe esto porque le pidió a ${village} que le avisara cuando se abra este rol. Para salir de la lista de espera, abra este enlace: ${link}`,
};

/** The page's words for the removal link (`/email/a`), by language. */
export const REMOVE_PAGE_WORDS: Record<ApplicantLanguage, { title(village: string): string; ask: string; button: string; keep: string; doneTitle: string; done: string; gone: string }> = {
  en: {
    title: (village) => `Come off ${village}'s waitlist`,
    ask: "Press the button and we take this address off the waitlist for every role. Nothing happens unless you press.",
    button: "Take me off the waitlist",
    keep: "Keep me on the waitlist",
    doneTitle: "You are off the waitlist",
    done: "We took this address off the waitlist. You will not get letters about roles opening.",
    gone: "This address is not on the waitlist.",
  },
  es: {
    title: (village) => `Salir de la lista de espera de ${village}`,
    ask: "Pulse el botón y quitamos esta dirección de la lista de espera de todos los roles. No pasa nada hasta que pulse.",
    button: "Quitarme de la lista de espera",
    keep: "Dejarme en la lista de espera",
    doneTitle: "Salió de la lista de espera",
    done: "Quitamos esta dirección de la lista de espera. No recibirá cartas sobre roles que se abren.",
    gone: "Esta dirección no está en la lista de espera.",
  },
};

/** One line of the sent log, written for admins. It names the role, the subject and the counts, and no address. */
export function waitlistLetterLogLine(i: { role: string; subject: string; sent: number; skipped: number; failed: number }): string {
  const parts = [`${i.sent} sent`];
  if (i.skipped) parts.push(`${i.skipped} skipped`);
  if (i.failed) parts.push(`${i.failed} not delivered`);
  return `Letter to the waitlist for ${i.role.slice(0, 80)}: "${i.subject.slice(0, 150)}" (${parts.join(", ")})`;
}

export const WAITLIST_LETTER_EVENT = "waitlist_letter";
