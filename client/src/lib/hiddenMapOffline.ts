/**
 * The hidden map page, kept on the phone for when there is no signal.
 *
 * THE SHELL. `client/public/hidden-map-sw.js`, scoped to `/hidden-map`, keeps
 * the page's own files and the public reads (theme, game config, the language
 * catalog): network first for the page, so a deploy is never hidden online.
 * Registered only from the map page, and only once the page has the module's
 * answer, so a village that never switches the module on never installs it.
 * Built on the protocols module's worker; `sw.js` spares any `<page>-shell-v<n>`
 * cache, so this one is `hidden-map-shell-v1`.
 *
 * WHAT IS NEVER KEPT. No member data and no map tile goes into Cache Storage:
 * a cached tile set would tell the next person on a shared phone where this
 * member was looking, which is close to where they planted. The pins are not
 * kept either. With no signal the page opens to logging a place, and its
 * captures wait in the outbox (`hiddenMapOutbox.ts`).
 *
 * THE WORDS SNAPSHOT. For that cold open the page needs the village's words
 * (the map's name, the layers, the kinds) and the member's own dials. This
 * keeps exactly those, per member, in localStorage under `village.offline.*`,
 * the key family `/reset` clears. No pin, count, place or opening time.
 */
import type { MapMe } from "./hiddenMapApi";

export const HIDDEN_MAP_SW = "/hidden-map-sw.js";
export const HIDDEN_MAP_SCOPE = "/hidden-map";
const SNAPSHOT = "village.offline.hidden-map";

/** The fields of /me a cold offline open needs, and nothing that says where or how many. */
const KEEP = [
  "title", "labels", "kinds", "kindPrompts", "precisions", "defaultPrecision", "basemap", "maxZoom", "vouchesPerPin",
  "needed", "plantingPays",
] as const;

export function writeMapSnapshot(owner: string, me: MapMe): void {
  try {
    const kept: Record<string, unknown> = {};
    for (const k of KEEP) kept[k] = (me as any)[k];
    window.localStorage.setItem(`${SNAPSHOT}.${owner}`, JSON.stringify(kept));
  } catch {
    /* a private window: no cold open offline, which is fine */
  }
}

/** The snapshot as a closed map with nothing on it: the page offers logging a place, and no more. */
export function readMapSnapshot(owner: string): MapMe | null {
  try {
    const raw = window.localStorage.getItem(`${SNAPSHOT}.${owner}`);
    if (!raw) return null;
    const kept = JSON.parse(raw);
    return {
      ...kept,
      open: false,
      vouchedCount: 0,
      ownPins: 0,
      allPins: 0,
      planters: 0,
      keeper: false,
      mayApproveExports: false,
      openLayers: [],
      teaser: false,
      openedAt: null,
      openedBefore: 0,
    } as MapMe;
  } catch {
    return null;
  }
}

function loadedUrls(): string[] {
  const out = new Set<string>();
  try {
    for (const e of performance.getEntriesByType("resource")) {
      try {
        const u = new URL(e.name, location.href);
        if (u.origin === location.origin) out.add(u.pathname + u.search);
      } catch {
        /* skip one odd entry */
      }
    }
  } catch {
    /* no performance timeline */
  }
  for (const el of Array.from(document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[href]"))) {
    const raw = el instanceof HTMLScriptElement ? el.src : el.href;
    try {
      const u = new URL(raw, location.href);
      if (u.origin === location.origin) out.add(u.pathname + u.search);
    } catch {
      /* skip */
    }
  }
  return Array.from(out);
}

let started = false;

/** Register the worker and warm it. Safe to call on every render; it acts once per page load. */
export function keepHiddenMapOffline(): void {
  if (started || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  started = true;
  const warm = (worker: ServiceWorker | null | undefined) => {
    worker?.postMessage({ type: "hidden-map-warm", urls: loadedUrls() });
  };
  navigator.serviceWorker
    .register(HIDDEN_MAP_SW, { scope: HIDDEN_MAP_SCOPE })
    .then((reg) => {
      const w = reg.active ?? reg.waiting ?? reg.installing;
      if (reg.active) warm(reg.active);
      else
        w?.addEventListener("statechange", () => {
          if (w.state === "activated") warm(w);
        });
    })
    .catch(() => {
      /* No offline copy this visit; the page works online as before. */
    });
}

/** For tests. */
export function resetHiddenMapOfflineForTests(): void {
  started = false;
}
