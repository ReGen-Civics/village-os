/**
 * THE UNNAMED GUIDE, in the reader's language. shared/guideName.ts holds the rule (a village's own name, or a
 * neutral label while it has none) and stays pure, because the server reads it too. The labels it carries are
 * English, so a Spanish reader met "Hola, soy the village guide" (front-door review, 24 Nov 2026). Every client
 * surface resolves the name through here, which says the neutral label in the reader's language.
 *
 * A NAME A VILLAGE TYPED IS NEVER TRANSLATED. Amora's guide is "Maia" in every language (the lead, 24 Nov 2026);
 * only the neutral label changes. client/src/lib/guideNameWords.test.ts pins both.
 */
// A value import of the runtime, as client/src/lib/payTbdWords.ts has: precompileEnglish compiles the messages of a
// file that imports it and skips one that only uses `msg`.
import { i18n as appI18n, type I18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { guideName, guideNameAtSentenceStart, UNNAMED_GUIDE, type GuideAudience, type GuideName } from "@shared/guideName";

/** To a founder or admin, mid-sentence: the guide is theirs to name. */
export const UNNAMED_GUIDE_OWN = msg({
  message: "your village guide",
  context: "the village guide's name while the village has not named it, read by a founder or admin, mid-sentence",
});

/** To members and the public, mid-sentence. */
export const UNNAMED_GUIDE_SHARED = msg({
  message: "the village guide",
  context: "the village guide's name while the village has not named it, read by members and the public, mid-sentence",
});

/** The two neutral labels, in the reader's language. */
export function unnamedGuideWords(i18n: I18n = appI18n): { own: string; shared: string } {
  // No language active yet (a module read before the app's i18n starts, or a bare test): the source words.
  if (!i18n.locale) return { own: UNNAMED_GUIDE.own, shared: UNNAMED_GUIDE.shared };
  return { own: i18n._(UNNAMED_GUIDE_OWN), shared: i18n._(UNNAMED_GUIDE_SHARED) };
}

/**
 * `guideName` from shared/guideName.ts, with the neutral label said in the reader's language. A village's own name
 * comes back exactly as it typed it.
 */
export function guideNameIn(source: unknown, audience: GuideAudience, i18n: I18n = appI18n): GuideName {
  const resolved = guideName(source, audience);
  if (resolved.named) return resolved;
  const words = unnamedGuideWords(i18n);
  return { name: resolved.name === UNNAMED_GUIDE.own ? words.own : words.shared, named: false };
}

/**
 * A name that arrived already resolved, from the server or a prop: the English neutral label, lowercase or raised
 * to open a sentence, said in the reader's language with the same first letter; any other name exactly as given.
 */
export function guideLabelIn(name: string, i18n: I18n = appI18n): string {
  const words = unnamedGuideWords(i18n);
  for (const key of ["own", "shared"] as const) {
    if (name === UNNAMED_GUIDE[key]) return words[key];
    if (name === guideNameAtSentenceStart(UNNAMED_GUIDE[key])) return guideNameAtSentenceStart(words[key]);
  }
  return name;
}
