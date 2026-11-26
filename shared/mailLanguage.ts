/**
 * WHICH LANGUAGE A PLATFORM EMAIL IS WRITTEN IN. Pure. (The coordinator, 26 Nov 2026: "emails in the reader's
 * language", the design agreed the same day.)
 *
 * Only the mail the platform itself writes takes this: the sign-in code, the address proof, the password letters,
 * the notices. A village's own words (its Words screen, its journeys and letters) stay as the village wrote them.
 * The applicant's letters keep their own rule (shared/applicantLanguage.ts), which this follows.
 *
 * The rule, first source we can write in wins:
 *   1. the member's saved language (users.prefs.locale, PUT /api/profile/locale);
 *   2. the address book's language for that address (comms_contacts.locale), for a person with no account;
 *   3. the language the site was in when they asked for this very letter (a sign-in code), never for a later one;
 *   4. the village's default language (village.default_locale);
 *   5. English.
 * A language with no words here is skipped, and the next source is read. `es-CR` matches `es`.
 */
import { matchLocale } from "./i18nResolve";

export const MAIL_LANGUAGES = ["en", "es"] as const;
export type MailLanguage = (typeof MAIL_LANGUAGES)[number];

export type MailLanguageSource = "member" | "contact" | "request" | "village_default" | "english";

export interface MailLanguageSources {
  member?: string | null;
  contact?: string | null;
  request?: string | null;
  villageDefault?: string | null;
}

const match = (tag: string | null | undefined): MailLanguage | null => (typeof tag === "string" && tag ? (matchLocale(tag, MAIL_LANGUAGES) as MailLanguage | null) : null);

export function mailLanguage(s: MailLanguageSources): { language: MailLanguage; source: MailLanguageSource } {
  const steps: Array<[MailLanguageSource, MailLanguage | null]> = [
    ["member", match(s.member)],
    ["contact", match(s.contact)],
    ["request", match(s.request)],
    ["village_default", match(s.villageDefault)],
  ];
  for (const [source, language] of steps) if (language) return { language, source };
  return { language: "en", source: "english" };
}

/** A member's saved language, read off their record as the profile route writes it. */
export function savedLanguage(member: { prefs?: unknown } | null | undefined): string | null {
  const locale = (member?.prefs as { locale?: unknown } | null | undefined)?.locale;
  return typeof locale === "string" ? locale : null;
}
