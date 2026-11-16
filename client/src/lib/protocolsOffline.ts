/**
 * The protocols pages, kept on the phone for when there is no signal.
 *
 * Called only by the protocols page, and only once it knows the module is on,
 * so a village that never switches the module on never registers anything new
 * (spec S3.4). The worker it registers is `client/public/protocols-sw.js`,
 * whose header says why it can never serve a stale page online or answer for a
 * page outside `/protocols`.
 *
 * WARMING. On the first visit the page's scripts loaded before the worker
 * existed. Once the worker is in charge, the page hands it the list of what it
 * loaded (this origin's performance entries), and the worker keeps the hashed
 * assets and the public reads among them. The next visit opens offline.
 *
 * THE INSTALLED APP. While the page is open, the document's manifest link
 * points at `/api/protocols-app.webmanifest`, which starts at `/protocols` and
 * is scoped to it, so "add to home screen" from here installs the checklists
 * and they open with no signal. The village's own manifest comes back when the
 * page closes.
 */

export const PROTOCOLS_SW = "/protocols-sw.js";
export const PROTOCOLS_SCOPE = "/protocols";
export const PROTOCOLS_MANIFEST = "/api/protocols-app.webmanifest";

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
export function keepProtocolsOffline(): void {
  if (started || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  started = true;
  const warm = (worker: ServiceWorker | null | undefined) => {
    worker?.postMessage({ type: "protocols-warm", urls: loadedUrls() });
  };
  navigator.serviceWorker
    .register(PROTOCOLS_SW, { scope: PROTOCOLS_SCOPE })
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

/** Point the manifest link at the protocols app while mounted. Returns the restore. */
export function pointManifestAtProtocols(): () => void {
  if (typeof document === "undefined") return () => {};
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) return () => {};
  const before = link.getAttribute("href");
  link.setAttribute("href", PROTOCOLS_MANIFEST);
  return () => {
    if (before !== null && link.getAttribute("href") === PROTOCOLS_MANIFEST) link.setAttribute("href", before);
  };
}

/** For tests. */
export function resetProtocolsOfflineForTests(): void {
  started = false;
}
