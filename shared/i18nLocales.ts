/**
 * The languages Village OS offers (internal spec i18n, US4 and §8 R15, R34).
 *
 * `source` is English: it lives in the code as the message. `reviewed` means a
 * person reviews the catalog string by string; a string not yet reviewed is
 * labelled "Translated automatically" (V.12). Machine locales (P2) are added
 * here only once their script has a tested font stack and, for right-to-left
 * scripts, the shell and core pages mirror (R15, R34).
 *
 * Pseudo locales (en-XA longer and accented, ar-XB right to left) exist for the
 * overflow sweep and are never offered to members.
 */
export type LocaleTier = "source" | "reviewed" | "machine" | "pseudo";

export type LocaleEntry = { tag: string; tier: LocaleTier };

export const LOCALES: readonly LocaleEntry[] = [
  { tag: "en", tier: "source" },
  { tag: "es", tier: "reviewed" },
];

export const PSEUDO_LOCALES: readonly LocaleEntry[] = [
  { tag: "en-XA", tier: "pseudo" },
  { tag: "ar-XB", tier: "pseudo" },
];

/**
 * ADDING A LANGUAGE (docs/I18N.md): an entry in LOCALES and a PO file at
 * client/src/locales/<tag>.po. Everything else reads this list: the Lingui
 * config, the default-language dial's choices, the per-village switch for each
 * language, the server's catalog route and the picker.
 *
 * OFFER_FLOOR: a language joins LOCALES only once its PO file translates at
 * least this share of the messages, so the picker never lists a language that
 * would show a visitor mostly English. shared/i18nLocaleCoverage.test.ts holds
 * every entry to it; scripts/i18n-coverage.mjs shows the share per page.
 */
export const OFFER_FLOOR = 0.3;

/** The dial that lets one village offer or withhold one language (Admin, Settings, Language). */
export function offerLocaleKey(tag: string): string {
  return `village.offer_locale.${tag}`;
}

/**
 * The languages THIS village offers: the source always, each other language
 * unless the village switched it off. `isOn` reads that language's dial.
 */
export function villageLocaleTags(isOn: (tag: string) => boolean): string[] {
  return LOCALES.filter((l) => l.tier === "source" || isOn(l.tag)).map((l) => l.tag);
}

/** Tags a member may choose (and the server accepts as a saved choice). */
export function offeredLocaleTags(withPseudo = false): string[] {
  return [...LOCALES, ...(withPseudo ? PSEUDO_LOCALES : [])].map((l) => l.tag);
}

/** The tier of a tag, or null when Village OS does not offer it. */
export function tierOf(tag: string, withPseudo = false): LocaleTier | null {
  return [...LOCALES, ...(withPseudo ? PSEUDO_LOCALES : [])].find((l) => l.tag === tag)?.tier ?? null;
}

/**
 * A language's own name for itself ("Español", "العربية"), from Intl, first
 * letter capitalised the way that language capitalises it. The tag when Intl
 * has no name for it.
 */
export function autonym(tag: string): string {
  try {
    const name = new Intl.DisplayNames([tag], { type: "language" }).of(tag);
    if (!name || name === tag) return tag;
    return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1);
  } catch {
    return tag;
  }
}
