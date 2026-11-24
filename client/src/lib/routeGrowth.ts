/**
 * ROOT: moving from page to page (LIVING MOTION, motion lane).
 *
 * When the reader goes to another page, a fine root grows across the top of
 * the screen from where they tapped, and the new page arrives: Layout's
 * <main id="main"> fades up from 55%. The first page of a visit is never
 * animated: it is what a shared link opens on, and it should simply be there.
 *
 * The arrival needs nothing from Layout. After the first move, <html> carries
 * data-m-arrived, and index.css fades in every #main that mounts from then on
 * (the router's ErrorBoundary is keyed on the address, so each page mounts a
 * fresh one, and a CSS animation starts when its element appears). The page
 * being left is marked data-m-stay first, so it never dims while it waits to
 * unmount behind a lazy chunk.
 *
 * Why not the View Transitions API: it would have to wrap every navigation in
 * a synchronous React commit, and with lazy pages behind Suspense the browser
 * would cross-fade into the loading screen rather than the page. This needs
 * nothing from the router: wouter patches history.pushState to dispatch a
 * "pushState" event (wouter/esm/use-browser-location.js), and back and forward
 * fire "popstate". Only a change of PATHNAME counts, so a filter written to
 * the query or a jump to a #section grows nothing.
 *
 * The line is one element on <body>, outside React, flipped between two
 * attribute values so each navigation restarts it (index.css, LIVING MOTION).
 * With "reduce motion" the CSS draws nothing and nothing arrives.
 */

let navigated = false;
let lastPath = "";
let originX = 0;
let line: HTMLElement | null = null;

/** True once the reader has moved from the page they arrived on. */
export function pageArrives(): boolean {
  return navigated;
}

function grow() {
  const path = window.location.pathname;
  if (path === lastPath) return;
  lastPath = path;
  navigated = true;
  document.getElementById("main")?.setAttribute("data-m-stay", "");
  document.documentElement.setAttribute("data-m-arrived", "");
  if (!line) {
    line = document.createElement("span");
    line.className = "m-root-line";
    line.setAttribute("aria-hidden", "true");
    document.body.appendChild(line);
  }
  line.style.setProperty("--m-ox", `${Math.round(originX * 100)}%`);
  line.dataset.grow = line.dataset.grow === "a" ? "b" : "a";
  originX = 0;
}

/** Call once at boot. Returns the uninstall, for tests. */
export function installRouteGrowth(): () => void {
  lastPath = window.location.pathname;
  const onPointer = (e: PointerEvent) => {
    originX = window.innerWidth > 0 ? Math.min(1, Math.max(0, e.clientX / window.innerWidth)) : 0;
  };
  window.addEventListener("pointerdown", onPointer, { passive: true, capture: true });
  window.addEventListener("pushState", grow);
  window.addEventListener("popstate", grow);
  return () => {
    window.removeEventListener("pointerdown", onPointer, { capture: true });
    window.removeEventListener("pushState", grow);
    window.removeEventListener("popstate", grow);
    line?.remove();
    line = null;
    navigated = false;
    document.documentElement.removeAttribute("data-m-arrived");
  };
}
