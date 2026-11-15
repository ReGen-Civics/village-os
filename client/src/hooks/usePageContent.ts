import { useEffect, useMemo, useState } from "react";
import { readVillageSection } from "@/hooks/useVillageContent";
import { useGameConfig } from "@/lib/gameApi";
import { storyPageOffAlone } from "@/lib/brochure";
import { pageSectionKey, type PageSpec, type PageVars, type ResolvedItem, type ResolvedPage } from "@shared/pageContent/types";
import { fillPage, resolvePageRaw } from "@shared/pageContent/resolve";
import { overlayPageRaw, readPageTranslation, type PageTranslationWire } from "@shared/contentTranslationOverlay";
import { useLocale } from "@/i18n/LocaleProvider";
import { markMachineTranslated } from "@/i18n/machineTranslation";
import { pageVarsFrom } from "@shared/pageContent/vars";
import { withPathNames } from "@shared/pageContent/pathNames";
import { servedPathsFrom } from "@/hooks/useVillagePaths";

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
      if (alive) setTranslated({ locale, t });
    });
    return () => {
      alive = false;
    };
  }, [spec, locale]);
  const translation = translated && translated.locale === locale ? translated.t : null;
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
    const page = withPathNames(spec, stored.doc, fillPage(raw, vars), servedPathsFrom(config));
    return withoutLinksToHiddenPages(spec, page, (href) => !storyPageOffAlone(config, href));
  }, [spec, stored, vars, config, translation]);
}
