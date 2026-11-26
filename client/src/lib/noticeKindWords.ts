/**
 * A NOTICE KIND'S WORDS, LOADED WHEN THE BELL OPENS.
 *
 * The blurbs and batched lines (shared/notificationKindWords.ts) are most of
 * the notice catalogue's weight, and nobody reads them until the bell's panel
 * is open. The bell rides every page's first view, so they load then: on the
 * first open, or a moment earlier when a pointer or focus reaches the bell.
 * Loaded once and kept. A failed load is forgotten, so the next open tries
 * again; until then the feed shows its plain line (client/src/lib/notificationFeed.ts).
 */
import { useEffect, useState } from "react";
import type { KindWordsOf } from "./notificationFeed";

let loaded: KindWordsOf | null = null;
let pending: Promise<KindWordsOf> | null = null;

/** Start loading the words, or hand back the ones already here. */
export function loadNoticeKindWords(): Promise<KindWordsOf> {
  if (loaded) return Promise.resolve(loaded);
  if (!pending) {
    // The words in the reader's language (noticeKindWordsI18n.ts mirrors shared/notificationKindWords.ts).
    pending = import("./noticeKindWordsI18n").then(
      (m) => (loaded = m.kindWordsIn()),
      (err) => {
        pending = null;
        throw err;
      },
    );
  }
  return pending;
}

/** The words once `wanted` (the panel is open) and they have loaded, else null. */
export function useNoticeKindWords(wanted: boolean): KindWordsOf | null {
  const [words, setWords] = useState<KindWordsOf | null>(() => loaded);
  useEffect(() => {
    if (!wanted || words) return;
    let live = true;
    loadNoticeKindWords().then(
      (w) => {
        if (live) setWords(() => w);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [wanted, words]);
  return words;
}
