import { I18nProvider } from "@lingui/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { offeredLocaleTags } from "@shared/i18nLocales";
import { removeStored, storedText, writeStored } from "@/lib/safeStorage";
import { fetchCatalog as fetchCatalogFromServer, type CatalogResponse } from "./catalog";
import { activateLocale, i18n } from "./i18n";
import { resolveLocale, SOURCE_LOCALE } from "./resolveLocale";

/**
 * Picks the language, loads its catalog, and lets anyone change it
 * (internal spec i18n, US1 and US2; §8 R16, R32).
 *
 * The saved choice lives in localStorage AND a cookie of the same name: the
 * cookie lets the server put the right `<html lang>` in the very first byte it
 * sends (spliceMeta), the localStorage copy survives a cookie purge. A
 * member's saved choice (their profile) is passed in as `sources.saved` and
 * wins over both.
 */
export const LOCALE_STORAGE_KEY = "vos_locale";
/** Waits before each retry of a catalog that failed to load (a dropped signal on a phone). Then it stops until the browser says it is online again. */
export const CATALOG_RETRY_MS = [2000, 5000, 15000, 30000, 60000] as const;
const YEAR_SECONDS = 365 * 24 * 60 * 60;

export type LocaleSources = {
  /** The signed-in member's saved choice, when there is one. */
  saved?: string | null;
  /** `navigator.languages`, in order. */
  browser?: readonly string[];
  /** The village's default language. */
  villageDefault?: string | null;
};

type LocaleContextValue = {
  locale: string;
  /** null forgets the saved choice and follows the browser again. */
  setLocale: (tag: string | null) => void;
  supported: readonly string[];
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Outside a provider (a component test renders the header on its own) the
 * language is whatever the global instance holds, English by default, and a
 * choice is only remembered in this browser. The app always has a provider.
 */
const OUTSIDE_PROVIDER: LocaleContextValue = {
  get locale() {
    return i18n.locale || SOURCE_LOCALE;
  },
  setLocale: (tag) => rememberChoice(tag),
  supported: offeredLocaleTags(),
};

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext) ?? OUTSIDE_PROVIDER;
}

function browserLanguages(): string[] {
  if (typeof navigator === "undefined") return [];
  const list = Array.isArray(navigator.languages) ? navigator.languages.filter(Boolean) : [];
  return list.length > 0 ? [...list] : navigator.language ? [navigator.language] : [];
}

function rememberChoice(tag: string | null): void {
  if (tag) {
    writeStored("local", LOCALE_STORAGE_KEY, tag);
    document.cookie = `${LOCALE_STORAGE_KEY}=${encodeURIComponent(tag)}; path=/; max-age=${YEAR_SECONDS}; samesite=lax`;
  } else {
    removeStored("local", LOCALE_STORAGE_KEY);
    document.cookie = `${LOCALE_STORAGE_KEY}=; path=/; max-age=0; samesite=lax`;
  }
}

export function LocaleProvider({
  children,
  sources = {},
  fetchCatalog = fetchCatalogFromServer,
  timeoutMs = 1500,
  fallback = null,
  onChoose,
}: {
  children: ReactNode;
  sources?: LocaleSources;
  fetchCatalog?: (locale: string) => Promise<CatalogResponse>;
  timeoutMs?: number;
  /** Shown while the first catalog loads, up to `timeoutMs` (never English text: R32). */
  fallback?: ReactNode;
  /** Called when someone picks a language (null: follow the browser), e.g. to save it to a member's profile. */
  onChoose?: (tag: string | null) => void;
}) {
  const supported = useMemo(() => offeredLocaleTags(import.meta.env.DEV), []);
  const browser = useMemo(() => sources.browser ?? browserLanguages(), [sources.browser]);
  const [locale, setActive] = useState(SOURCE_LOCALE);
  const [ready, setReady] = useState(false);
  const loadSeq = useRef(0);
  // Whether the visitor has typed into a field. A tap or a scroll is not typing (Spanish phone QA, 15 Nov 2026).
  const typed = useRef(false);
  // A catalog that arrived after they typed, held for their next step.
  const pending = useRef<{ seq: number; tag: string; messages: Record<string, unknown> } | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryNow = useRef<(() => void) | null>(null);

  const choose = useCallback(
    (saved: string | null | undefined) =>
      resolveLocale({ supported, saved, browser, villageDefault: sources.villageDefault }),
    [supported, browser, sources.villageDefault],
  );

  const show = useCallback(
    (tag: string, messages: Record<string, unknown>) => {
      activateLocale(tag, messages, browser[0]);
      setActive(tag);
      setReady(true);
    },
    [browser],
  );

  /**
   * Load `tag`. On the first load a slow catalog falls back to English after
   * `timeoutMs`. A late catalog is applied when it lands, a scroll or a tap
   * notwithstanding; once the visitor has typed into a field it waits for
   * their next step (a press of a button or a link, or Back), so no label
   * changes under a sentence being written. A failed load shows English and
   * is tried again, with growing waits, and at once when the browser comes
   * back online (Spanish phone QA, 15 Nov 2026: on a slow phone a whole visit
   * used to stay in English).
   */
  const load = useCallback(
    (tag: string, firstLoad: boolean) => {
      const seq = ++loadSeq.current;
      clearTimeout(retry.current);
      retryNow.current = null;
      pending.current = null;
      if (tag === SOURCE_LOCALE) {
        show(SOURCE_LOCALE, {});
        return;
      }
      let fallenBack = false;
      const fallBack = () => {
        if (fallenBack) return;
        fallenBack = true;
        show(SOURCE_LOCALE, {});
      };
      const timer = firstLoad
        ? setTimeout(() => {
            if (seq === loadSeq.current) fallBack();
          }, timeoutMs)
        : undefined;
      const attempt = (tries: number) => {
        retryNow.current = null;
        fetchCatalog(tag).then(
          (res) => {
            clearTimeout(timer);
            if (seq !== loadSeq.current) return;
            const messages = res.messages ?? {};
            if (fallenBack && typed.current) pending.current = { seq, tag, messages };
            else show(tag, messages);
          },
          () => {
            clearTimeout(timer);
            if (seq !== loadSeq.current) return;
            fallBack();
            const wait = CATALOG_RETRY_MS[tries];
            const again = () => {
              clearTimeout(retry.current);
              if (seq === loadSeq.current) attempt(tries + 1);
            };
            retryNow.current = again;
            if (wait !== undefined) retry.current = setTimeout(again, wait);
          },
        );
      };
      attempt(0);
    },
    [fetchCatalog, show, timeoutMs],
  );

  useEffect(() => {
    // A member's saved choice is mirrored into this browser, so the next cold
    // start (and the server's first byte) is already in their language.
    if (sources.saved) rememberChoice(sources.saved);
    load(choose(sources.saved ?? storedText("local", LOCALE_STORAGE_KEY)), true);
    // A member's saved choice arriving after sign-in re-runs this.
  }, [choose, load, sources.saved]);

  useEffect(() => {
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.matches("input, textarea, select") || t.isContentEditable);
    const onInput = (e: Event) => {
      if (isField(e.target)) typed.current = true;
    };
    // The next step: a held catalog is applied once the press has done its work.
    const applyHeld = () => {
      const held = pending.current;
      if (!held) return;
      setTimeout(() => {
        if (pending.current !== held) return;
        pending.current = null;
        if (held.seq === loadSeq.current) show(held.tag, held.messages);
      }, 0);
    };
    const onClick = (e: Event) => {
      if (e.target instanceof Element && e.target.closest("a, button, [role='button']")) applyHeld();
    };
    const onOnline = () => retryNow.current?.();
    document.addEventListener("input", onInput, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", applyHeld);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", applyHeld);
      window.removeEventListener("online", onOnline);
      clearTimeout(retry.current);
    };
  }, [show]);

  const setLocale = useCallback(
    (tag: string | null) => {
      rememberChoice(tag);
      onChoose?.(tag);
      load(choose(tag), false);
    },
    [choose, load, onChoose],
  );

  const value = useMemo(() => ({ locale, setLocale, supported }), [locale, setLocale, supported]);

  return (
    <LocaleContext.Provider value={value}>
      <I18nProvider i18n={i18n}>{ready ? children : fallback}</I18nProvider>
    </LocaleContext.Provider>
  );
}
