/**
 * WHICH LANGUAGE THE BROWSER'S SPEECH SERVICE LISTENS FOR (Spanish phone QA, 15 Nov 2026).
 *
 * It used to be the phone's own language alone. A Spanish speaker on a phone set to English who chose
 * Español on the site was heard as English, and the words came back as nonsense to correct. The language
 * they chose to read in is the better guess for the language they speak: it wins when it is a real
 * language other than the source one. Otherwise the phone's language, as before. A phone already set to
 * a regional form of the chosen language (es-CR for es) keeps its region.
 */
import { i18n } from "@/i18n/i18n";

/** Pseudo-locales for testing layout, never a language anyone speaks. */
const PSEUDO = new Set(["en-XA", "ar-XB"]);

export function speechLang(chosen: string | null | undefined = i18n.locale, phone: string | null | undefined = typeof navigator !== "undefined" ? navigator.language : null): string {
  const fallback = phone || "en-US";
  if (!chosen || PSEUDO.has(chosen)) return fallback;
  const base = chosen.split("-")[0].toLowerCase();
  if (base === "en") return fallback;
  if (phone && phone.split("-")[0].toLowerCase() === base) return phone;
  return chosen;
}
