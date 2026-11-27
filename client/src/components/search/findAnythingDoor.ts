/**
 * A DOOR TO FIND ANYTHING from anywhere on a page (the not-found page's "Search the village", and any page that
 * wants one), without importing the search itself.
 *
 *   openFindAnything()        asks the search to open, with the focus in its field
 *   useFindAnythingReady()    true while a search is mounted to answer, so a link shows only when it works
 *
 * The search (FindAnything.tsx) listens for FIND_ANYTHING_EVENT and, while any of its mounts is on the page, sets
 * `window.__findAnythingReady` and says so with FIND_ANYTHING_READY_EVENT; it clears both when its last mount
 * goes. This file imports nothing, so a page that draws a link pays for a few lines and never for the search.
 */
import { useSyncExternalStore } from "react";

/** Dispatched on `window` to open the search. */
export const FIND_ANYTHING_EVENT = "village:find-anything";
/** Dispatched on `window` whenever the search comes or goes; `detail` is the new state. */
export const FIND_ANYTHING_READY_EVENT = "village:find-anything-ready";

declare global {
  interface Window {
    __findAnythingReady?: boolean;
  }
}

/** Open the search. Does nothing when no search is mounted, so call it only behind `useFindAnythingReady`. */
export function openFindAnything(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FIND_ANYTHING_EVENT));
}

/** Whether a search is mounted to answer right now. */
export function findAnythingReady(): boolean {
  return typeof window !== "undefined" && window.__findAnythingReady === true;
}

/** Set by the search alone (FindAnything.tsx), as its first mount arrives and its last one leaves. */
export function setFindAnythingReady(ready: boolean): void {
  if (typeof window === "undefined") return;
  if (ready) window.__findAnythingReady = true;
  else delete window.__findAnythingReady;
  window.dispatchEvent(new CustomEvent(FIND_ANYTHING_READY_EVENT, { detail: ready }));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(FIND_ANYTHING_READY_EVENT, onChange);
  return () => window.removeEventListener(FIND_ANYTHING_READY_EVENT, onChange);
}

/** True while a search is mounted; a link to it renders only then. */
export function useFindAnythingReady(): boolean {
  return useSyncExternalStore(subscribe, findAnythingReady, () => false);
}
