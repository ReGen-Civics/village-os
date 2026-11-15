/**
 * A PAGE THAT OUTLIVES A DEPLOY, AND GETS ITSELF BACK.
 *
 * Every release replaces the hashed `/assets/*.js` chunks. A tab, or a phone's
 * home-screen app, opened before the deploy still runs the old entry, and the
 * first time it lazy-loads a page it asks for a chunk that no longer exists.
 * The import fails and the member sees a broken page on a site that works
 * fine for everyone who opened it a minute later. That is what "down on my
 * phone, fine on my laptop" was, right after a deploy.
 *
 * The cure is a reload: `index.html` is served no-cache, so a fresh load runs
 * the new entry and asks for chunks that exist. So the first failed chunk
 * reloads the page, ONCE. A sessionStorage marker remembers that we just did,
 * and a second failure inside the window shows the reload card instead
 * (components/ErrorBoundary.tsx), because a chunk that fails twice is not a
 * stale build any more (offline, a CDN fault) and reloading again would loop.
 * No storage at all means no marker, so no automatic reload either: we cannot
 * prove it would not loop, and the card is a fine answer.
 *
 * This module is on the first page on purpose (main.tsx and the error
 * boundary import it): code that recovers from a missing chunk cannot itself
 * live in a chunk. It is a few hundred bytes and imports nothing.
 */

/** The marker: when this tab last reloaded itself for a missing chunk. */
export const RELOAD_MARKER = "village.stale-chunk-reload";

/**
 * How long a reload counts as "just now". A fresh load on a slow phone link
 * can take most of a minute before the member taps their way to the next lazy
 * page, so the window is generous; after it, a later deploy in the same tab
 * gets its own one reload.
 */
export const RELOAD_WINDOW_MS = 2 * 60 * 1000;

/**
 * The words each engine uses for a dynamic module that did not arrive. Matched
 * loosely on the message, because that is all a cross-engine error shares.
 */
const CHUNK_FAILURES = [
  /Failed to fetch dynamically imported module/i, // Chromium
  /Importing a module script failed/i, // Safari, iOS
  /error loading dynamically imported module/i, // Firefox
  /Unable to preload CSS/i, // Vite's own preload helper
  /Loading (?:CSS )?chunk [\w-]+ failed/i,
];

export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const name = typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
  if (name === "ChunkLoadError") return true;
  const message =
    typeof err === "string" ? err : typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "";
  return CHUNK_FAILURES.some((re) => re.test(message));
}

/** The slice of sessionStorage this needs, so a test can hand in its own. */
export interface MarkerStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RecoveryEnv {
  store: () => MarkerStore | null;
  reload: () => void;
  now: () => number;
  /**
   * False when the browser knows it has no connection. Offline, a chunk that
   * fails to arrive says nothing about the build, and a reload would land on
   * the browser's own offline page and lose the page the member was on
   * (performance QA sweep, resilience P2-4). Absent means online.
   */
  online?: () => boolean;
}

const browserEnv: RecoveryEnv = {
  store: () => {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  },
  reload: () => window.location.reload(),
  now: () => Date.now(),
  online: () => isOnline(),
};

/** False only when the browser says it is offline; a browser that cannot tell counts as online. */
export function isOnline(): boolean {
  try {
    return typeof navigator === "undefined" || navigator.onLine !== false;
  } catch {
    return true;
  }
}

let reloadPending = false;

/** True once this page has asked for a reload, so the boundary can stay quiet while it happens. */
export function isReloadPending(): boolean {
  return reloadPending;
}

/**
 * Reload once for a missing chunk. Returns true when a reload was started (or
 * already is), false when the member should see the reload card.
 */
export function reloadOnceForStaleChunk(env: RecoveryEnv = browserEnv): boolean {
  if (reloadPending) return true;
  if (env.online?.() === false) return false;
  try {
    const store = env.store();
    if (!store) return false;
    const now = env.now();
    const last = Number(store.getItem(RELOAD_MARKER));
    if (Number.isFinite(last) && last > 0 && now - last < RELOAD_WINDOW_MS) return false;
    store.setItem(RELOAD_MARKER, String(now));
    // Read it back: Safari's old private mode accepted a write and kept nothing.
    if (store.getItem(RELOAD_MARKER) !== String(now)) return false;
  } catch {
    return false;
  }
  reloadPending = true;
  env.reload();
  return true;
}

/** Test seam: forget that this page asked for a reload. */
export function resetStaleChunkStateForTests(): void {
  reloadPending = false;
}

/**
 * Listen for Vite's own signal. Vite fires `vite:preloadError` when a lazy
 * page's chunk, or a file it depends on, fails to load. We reload once and
 * let the error carry on otherwise, so the boundary still sees it and shows
 * the card when a reload is not allowed.
 */
export function installStaleChunkRecovery(target: Pick<Window, "addEventListener"> = window, env: RecoveryEnv = browserEnv): void {
  // Every preload error is a chunk or a file it needs failing to arrive, so
  // the message is not consulted here; the boundary matches on it instead.
  target.addEventListener("vite:preloadError", () => {
    reloadOnceForStaleChunk(env);
  });
}
