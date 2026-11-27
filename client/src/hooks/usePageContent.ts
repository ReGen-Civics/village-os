import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { readVillageSection } from "@/hooks/useVillageContent";
import { useGameConfig } from "@/lib/gameApi";
import { storyPageOffAlone } from "@/lib/brochure";
import { pageSectionKey, type PageSpec, type PageVars, type ResolvedItem, type ResolvedPage } from "@shared/pageContent/types";
import { fillPage, resolvePageRaw } from "@shared/pageContent/resolve";
import { fallbackLangOf, overlayPageRaw, readPageTranslation, type PageTranslationWire } from "@shared/contentTranslationOverlay";
import { useLocale } from "@/i18n/LocaleProvider";
import { markMachineTranslated } from "@/i18n/machineTranslation";
import { pageVarsFrom } from "@shared/pageContent/vars";
import { withPathNames } from "@shared/pageContent/pathNames";
import { servedPathsFrom } from "@/hooks/useVillagePaths";
import { translatedPaths, usePathFields } from "@/hooks/usePathWords";

/**
 * The `{words}` a page field may use, from the village's own settings. The
 * rules live in shared/pageContent/vars.ts, because the server fills the same
 * words into the Work With Us acknowledgement email.
 */
export function usePageVars(): PageVars | null {
  const config = useGameConfig();
  return useMemo(() => (config ? pageVarsFrom(config) : null), [config]);
}

/**
 * One page's words, resolved: what the village saved, its defaults for
 * everything else, `{words}` filled in. Null until both the config and the
 * saved section have answered, so a page never paints the defaults and then
 * swaps in the village's own words a moment later.
 */
/**
 * The page with every link box that points at a story page this village
 * switched off left blank (shared/brochure.ts). Every link box in a spec is
 * optional, and a blank one draws no button, so a page switched off in Admin,
 * Pages takes the buttons that lead to it away with it, wherever they are.
 *
 * Only the pages switched off one by one count here: every page that reads its
 * words through this hook is itself a story page, and renders only while the
 * master switch is on.
 */
export function withoutLinksToHiddenPages(spec: PageSpec, page: ResolvedPage, shown: (href: string) => boolean): ResolvedPage {
  const out: Record<string, ResolvedPage[string]> = {};
  for (const section of spec.sections) {
    const resolved = page[section.id];
    if (!resolved) continue;
    const fields: Record<string, string> = { ...resolved.fields };
    for (const f of section.fields) if (f.kind === "link" && !shown(fields[f.key] ?? "")) fields[f.key] = "";
    const lists: Record<string, ReadonlyArray<ResolvedItem>> = { ...resolved.lists };
    for (const list of section.lists ?? []) {
      const links = list.fields.filter((f) => f.kind === "link");
      if (!links.length || !lists[list.key]) continue;
      lists[list.key] = lists[list.key].map((row) => {
        const next: Record<string, string> = { ...row };
        for (const f of links) if (!shown(next[f.key] ?? "")) next[f.key] = "";
        return next as ResolvedItem;
      });
    }
    out[section.id] = { hidden: resolved.hidden, fields, lists };
  }
  return { ...page, ...out };
}

/**
 * A page's words in the reader's language, where the village has translated
 * them (Rye, 15 Nov 2026). Asked for only in a language other than English,
 * and never by an editor: Admin, Pages reads the section itself. Null while
 * unanswered, an empty translation when there is none or the read fails, so a
 * page in Spanish waits for its words once and never flashes English first.
 */
const NO_TRANSLATION: PageTranslationWire = { fields: {}, machine: [], locale: "en" };

export function readPageTranslationFor(section: string, locale: string): Promise<PageTranslationWire> {
  if (locale === "en") return Promise.resolve(NO_TRANSLATION);
  return fetch(`/api/content/${encodeURIComponent(section)}/translation`, { headers: { "X-Village-Locale": locale } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const t = readPageTranslation(d?.translation);
      return t && t.locale === locale ? t : NO_TRANSLATION;
    })
    .catch(() => NO_TRANSLATION);
}

/**
 * The translation each page section last received, so a page can mark the
 * blocks that are still in English (`usePageLang`) without a second request.
 */
const lastTranslation = new Map<string, PageTranslationWire>();
const translationListeners = new Set<() => void>();
let translationVersion = 0;
function rememberTranslation(section: string, t: PageTranslationWire) {
  lastTranslation.set(section, t);
  translationVersion++;
  translationListeners.forEach((l) => l());
}
function subscribeTranslations(l: () => void) {
  translationListeners.add(l);
  return () => translationListeners.delete(l);
}

/**
 * A BINDING PAGE'S READING COPY, AND THE ENGLISH ONE TAP AWAY (the lead, 26 Nov 2026). The server sends a
 * binding page's accepted reading copy marked `readingCopy`; the page lays it over its English like any
 * translation and says, in both languages, that the English text is the binding version. A reader who
 * taps to read the English sees the binding text itself until they tap back, on every binding page.
 */
let bindingEnglish = false;
const NONE: PageTranslationWire = { fields: {}, machine: [], locale: "en" };
/** The translation a page lays over its words: none while a reading copy's reader chose the English. */
const shownTranslation = (t: PageTranslationWire | null) => (t?.readingCopy && bindingEnglish ? { ...NONE, locale: t.locale } : t);

export function usePageReadingCopy(spec: PageSpec): { active: boolean; showingEnglish: boolean; toggle: () => void } {
  useSyncExternalStore(subscribeTranslations, () => translationVersion, () => 0);
  const t = lastTranslation.get(pageSectionKey(spec));
  const active = !!t?.readingCopy && Object.keys(t.fields).length > 0;
  return {
    active,
    showingEnglish: active && bindingEnglish,
    toggle: () => {
      bindingEnglish = !bindingEnglish;
      translationVersion++;
      translationListeners.forEach((l) => l());
    },
  };
}

/**
 * `lang` for a block of the village's words on this page: the source
 * language's tag while that block has no translation in the reader's language,
 * undefined once it does (shared/contentTranslationOverlay.ts, fallbackLangOf).
 *
 *   const langOf = usePageLang(STEWARD_JOURNEY);
 *   <section lang={langOf("hero")}>...
 */
export function usePageLang(spec: PageSpec): (address: string) => string | undefined {
  const { locale } = useLocale();
  const version = useSyncExternalStore(subscribeTranslations, () => translationVersion, () => 0);
  const section = pageSectionKey(spec);
  return useCallback(
    (address: string) => fallbackLangOf(shownTranslation(lastTranslation.get(section) ?? null), locale, address),
    // `version` moves when a translation arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [section, locale, version],
  );
}

/**
 * The fields a page lays over its English in the reader's language, for a page that resolves its own words
 * (the membership letter page): {} in English or while unread, and the reading copy only while its reader has
 * not chosen the binding English.
 */
export function usePageTranslationFields(spec: PageSpec): Readonly<Record<string, string>> {
  const { locale } = useLocale();
  const version = useSyncExternalStore(subscribeTranslations, () => translationVersion, () => 0);
  useEffect(() => {
    let alive = true;
    void readPageTranslationFor(pageSectionKey(spec), locale).then((t) => alive && rememberTranslation(pageSectionKey(spec), t.locale === locale ? t : { ...t, locale }));
    return () => {
      alive = false;
    };
  }, [spec, locale]);
  return useMemo(() => {
    const t = shownTranslation(lastTranslation.get(pageSectionKey(spec)) ?? null);
    return t && t.locale === locale ? t.fields : NONE.fields;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, locale, version]);
}

export function usePageContent(spec: PageSpec): ResolvedPage | null {
  const config = useGameConfig();
  const vars = usePageVars();
  const { locale } = useLocale();
  const [stored, setStored] = useState<{ doc: unknown } | null>(null);
  const [translated, setTranslated] = useState<{ locale: string; t: PageTranslationWire } | null>(null);
  useEffect(() => {
    let alive = true;
    readVillageSection(pageSectionKey(spec)).then((doc) => {
      if (alive) setStored({ doc });
    });
    return () => {
      alive = false;
    };
  }, [spec]);
  useEffect(() => {
    let alive = true;
    readPageTranslationFor(pageSectionKey(spec), locale).then((t) => {
      if (!alive) return;
      rememberTranslation(pageSectionKey(spec), t.locale === locale ? t : { ...t, locale });
      setTranslated({ locale, t });
    });
    return () => {
      alive = false;
    };
  }, [spec, locale]);
  // A binding page's reading copy steps aside while its reader chose the English (usePageReadingCopy).
  const version = useSyncExternalStore(subscribeTranslations, () => translationVersion, () => 0);
  const translation = useMemo(
    () => shownTranslation(translated && translated.locale === locale ? translated.t : null),
    // `version` moves when the reader switches between the reading copy and the English.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [translated, locale, version],
  );
  const pathFields = usePathFields();
  // Words a machine drafted are marked (machineTranslation.tsx): the layout's note shows while any are on the page.
  const machine = (translation?.machine.length ?? 0) > 0;
  useEffect(() => {
    const key = pageSectionKey(spec);
    markMachineTranslated(key, machine);
    return () => markMachineTranslated(key, false);
  }, [spec, machine]);
  // A box that names a path shows the village's path words (Admin, Paths &
  // Stages) until the village writes its own (shared/pageContent/pathNames.ts).
  return useMemo(() => {
    if (!vars || !stored || !translation) return null;
    const raw = overlayPageRaw(resolvePageRaw(spec, stored.doc), translation.fields);
    const page = withPathNames(spec, stored.doc, fillPage(raw, vars), translatedPaths(servedPathsFrom(config), pathFields));
    return withoutLinksToHiddenPages(spec, page, (href) => !storyPageOffAlone(config, href));
  }, [spec, stored, vars, config, translation, pathFields]);
}
