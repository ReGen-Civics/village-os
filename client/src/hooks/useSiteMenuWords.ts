import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { readPageTranslation } from "@shared/contentTranslationOverlay";
import { PAGE_SECTION_PREFIX } from "@shared/pageContent/types";

/**
 * THE VILLAGE'S OWN MENU NAMES, IN THE READER'S LANGUAGE (the lead's Spanish audit, 26 Nov 2026).
 *
 * The menu names a village gives its story pages (Admin, Pages, Whole site, "Names in the menu") reach the shell
 * already resolved, in /api/game/config `site.menu`. They are page content, so their translation is the site
 * section's page translation (content_translations, kind page_section, ref `page-site`), addressed
 * `menu.pages.<place>.label` and `menu.pages.<place>.subtitle`. This lays that translation over `site.menu`, the
 * way usePageContent lays one over a page, without carrying the page resolver into every page's first view.
 * English asks nothing; a failed read keeps every name as the village wrote it.
 */
type MenuWords = Record<string, { label: string; subtitle: string }>;
const SITE_SECTION = `${PAGE_SECTION_PREFIX}site`;
const ADDRESS = /^menu\.pages\.([^.]+)\.(label|subtitle)$/;
const cache = new Map<string, Promise<Record<string, string>>>();

function readSiteFields(locale: string): Promise<Record<string, string>> {
  let p = cache.get(locale);
  if (!p) {
    p = fetch(`/api/content/${encodeURIComponent(SITE_SECTION)}/translation`, { headers: { "X-Village-Locale": locale } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const t = readPageTranslation(d?.translation);
        return t && t.locale === locale ? t.fields : {};
      })
      .catch(() => {
        cache.delete(locale);
        return {};
      });
    cache.set(locale, p);
  }
  return p;
}

/** `menu` with each translated label and subtitle laid over it; the same object when there is nothing to lay. */
export function overlaySiteMenu<M extends MenuWords | undefined>(menu: M, fields: Readonly<Record<string, string>>): M {
  if (!menu) return menu;
  let out: MenuWords | null = null;
  // The server addresses a row by its place in the list (menu.pages.0.subtitle, shared/contentTranslation.ts);
  // `site.menu` keeps the list's order (server/lib/pageMeta.ts siteWords), so a place names one page.
  const order = Object.keys(menu);
  for (const [address, words] of Object.entries(fields)) {
    const m = ADDRESS.exec(address);
    const href = m ? (/^\d+$/.test(m[1]) ? order[Number(m[1])] : m[1]) : undefined;
    if (!m || !href || !words.trim() || !menu[href]) continue;
    out ??= { ...menu };
    out[href] = { ...out[href], [m[2]]: words };
  }
  return (out ?? menu) as M;
}

export function useSiteMenuWords<M extends MenuWords | undefined>(menu: M): M {
  const { locale } = useLocale();
  const [got, setGot] = useState<{ locale: string; fields: Record<string, string> } | null>(null);
  useEffect(() => {
    if (locale === "en" || locale.startsWith("en-")) return;
    let alive = true;
    void readSiteFields(locale).then((fields) => alive && setGot({ locale, fields }));
    return () => {
      alive = false;
    };
  }, [locale]);
  return got && got.locale === locale ? overlaySiteMenu(menu, got.fields) : menu;
}
