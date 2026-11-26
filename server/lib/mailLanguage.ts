/**
 * THE LANGUAGE OF A PLATFORM EMAIL, read from where the rule says (shared/mailLanguage.ts): the member's saved
 * language, the address book, the request the letter answers, the village's default, English.
 *
 * Reads only. A source that cannot be read is skipped with a warning, never an error: a letter in English is
 * always better than no letter.
 */
import type { Pool } from "mysql2/promise";
import { emailKeyOf } from "../../shared/comms/address";
import { mailLanguage, savedLanguage, type MailLanguage } from "../../shared/mailLanguage";
import { contactByEmailKey } from "../repos/commsContacts";
import { stringVar } from "./variables";

function villageDefault(): string | null {
  try {
    const v = stringVar("village.default_locale");
    return typeof v === "string" && v ? v : null;
  } catch {
    return null;
  }
}

/** A letter to a member: their saved language, then the village's default, then English. */
export function languageOfMember(member: object | null | undefined): MailLanguage {
  return mailLanguage({ member: savedLanguage(member as { prefs?: unknown } | null | undefined), villageDefault: villageDefault() }).language;
}

/**
 * A letter to an address that may or may not be a member's: the member's saved language, the address book's,
 * the language of the request this letter answers, the village's default, English.
 */
export async function languageForAddress(
  pool: Pool | null,
  email: string,
  i: { member?: { prefs?: unknown } | null; request?: string | null } = {},
): Promise<MailLanguage> {
  let contact: string | null = null;
  if (pool && !savedLanguage(i.member)) {
    try {
      contact = (await contactByEmailKey(pool, emailKeyOf(email)))?.locale ?? null;
    } catch (e) {
      console.warn("[mail-language] the address book's language could not be read", e);
    }
  }
  return mailLanguage({ member: savedLanguage(i.member), contact, request: i.request ?? null, villageDefault: villageDefault() }).language;
}
