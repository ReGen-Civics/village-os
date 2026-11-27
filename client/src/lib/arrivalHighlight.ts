/**
 * ARRIVAL HIGHLIGHT (wayfinding lane, 27 Nov 2026): when a page opens at a #hash, or a link lands on an anchor (an
 * email, a notice, the menu), the section it names glows briefly, so the reader sees where they landed.
 *
 * The work, loaded with its hook just after the first paint (App.tsx mounts hooks/useArrivalHighlight.ts lazily), so
 * the first page pays nothing for it.
 *
 * What it promises:
 *   - A soft ring in the page's own colour (`--ring`: deep teal on the Weathered map's paper, gold on the night
 *     sheet, each world's own in dark) for ARRIVAL_MS, then a fade.
 *   - Under prefers-reduced-motion, no animation at all: a still outline for ARRIVAL_MS, then gone.
 *   - Nothing moves. A box-shadow and an outline take no room, so no layout shifts. On the Weathered map a card's
 *     torn edge is a mask that would cut the ring off, so the mask lifts while it glows, as it already does on focus.
 *   - Focus is never touched. A page that moves focus to its section (lib/sectionAnchor.ts) keeps doing so.
 *   - The Living Map's hash is an address, not an anchor, so /map is left alone (components/ScrollToTop.tsx).
 *
 * The target is the element the hash names by id. A tabbed page (Places' #photos and #reports, the season's #plan,
 * #join and #aligned) draws the tab's panel as `<prefix>-panel-<hash>`, so that panel answers for it.
 */
import { hashTarget } from "@/components/ScrollToTop";
import { prefersReducedMotion } from "@/components/natural/useReducedMotion";

/** How long the ring holds before it fades, and how long the still outline stays. */
export const ARRIVAL_MS = 1200;
/** The fade after the hold. */
export const FADE_MS = 400;
/** How long to wait for a lazy page to draw its section before giving up. */
export const FIND_FOR_MS = 5000;
const FIND_EVERY_MS = 100;
/** A beat after the section appears, so the scroll that brings it into view has begun. */
const SETTLE_MS = 150;

export const ARRIVED_ATTR = "data-arrived";
const STYLE_ID = "arrival-highlight";
const OWN_SHADOW = "--arrival-own-shadow";

const RING = "color-mix(in srgb, var(--ring, currentColor) 65%, transparent)";
const HALO = "color-mix(in srgb, var(--ring, currentColor) 28%, transparent)";
const HOLD = Math.round((ARRIVAL_MS / (ARRIVAL_MS + FADE_MS)) * 100);

/** The rules, written once into the head. Tokens only: each world's `--ring` is its own colour. */
export const ARRIVAL_CSS = [
  `[${ARRIVED_ATTR}]{-webkit-mask-box-image:none!important;mask-border:none!important}`,
  `[${ARRIVED_ATTR}="glow"]{animation:arrival-glow ${ARRIVAL_MS + FADE_MS}ms ease-out both}`,
  `@keyframes arrival-glow{`,
  `0%{box-shadow:var(${OWN_SHADOW},0 0 #0000),0 0 0 0 transparent,0 0 0 0 transparent}`,
  `12%,${HOLD}%{box-shadow:var(${OWN_SHADOW},0 0 #0000),0 0 0 3px ${RING},0 0 22px 6px ${HALO}}`,
  `100%{box-shadow:var(${OWN_SHADOW},0 0 #0000),0 0 0 3px transparent,0 0 22px 6px transparent}}`,
  `[${ARRIVED_ATTR}="still"]{outline:2px solid var(--ring, currentColor)!important;outline-offset:3px}`,
  `@media (prefers-reduced-motion: reduce){[${ARRIVED_ATTR}="glow"]{animation:none;outline:2px solid var(--ring, currentColor)!important;outline-offset:3px}}`,
].join("");

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = ARRIVAL_CSS;
  doc.head.appendChild(style);
}

/** The Living Map keeps its own route in the hash (ScrollToTop's hashIsAnAddress). */
const hashIsAnAddress = (path: string) => path.replace(/\/+$/, "") === "/map";

/** True when the element is drawn: a hidden chapter or an unchosen tab is not where anyone landed. */
function drawn(el: HTMLElement): boolean {
  return !el.closest("[hidden]") && el.getClientRects().length > 0;
}

/** The section a hash lands on: by id, or a tabbed page's panel for it. Null while it is not drawn. */
export function arrivalTarget(hash: string, doc: Document = document): HTMLElement | null {
  const byId = hashTarget(hash, doc);
  if (byId) return drawn(byId) ? byId : null;
  let id = hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    return null;
  }
  if (!/^[\w-]+$/.test(id)) return null;
  const panel = Array.from(doc.querySelectorAll<HTMLElement>(`[role="tabpanel"][id$="-panel-${id}"]`)).find(drawn);
  return panel ?? null;
}

/** Glow (or, for less motion, outline) one element, then clear it. Returns the early clear. */
export function highlight(el: HTMLElement, { reduced = prefersReducedMotion() }: { reduced?: boolean } = {}): () => void {
  const doc = el.ownerDocument;
  ensureStyle(doc);
  const view = doc.defaultView;
  const own = view?.getComputedStyle ? view.getComputedStyle(el).boxShadow : "";
  if (own && own !== "none") el.style.setProperty(OWN_SHADOW, own);
  el.setAttribute(ARRIVED_ATTR, reduced ? "still" : "glow");
  let done = false;
  const clear = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    el.removeAttribute(ARRIVED_ATTR);
    el.style.removeProperty(OWN_SHADOW);
  };
  const timer = setTimeout(clear, reduced ? ARRIVAL_MS : ARRIVAL_MS + FADE_MS);
  return clear;
}

let running: (() => void) | null = null;

/**
 * Light the section `hash` names on the page at `path`, once it is drawn. A new arrival ends the one before it, so
 * two quick taps never leave two rings.
 */
export function arrive(hash: string, path: string, doc: Document = document): () => void {
  running?.();
  if (!hash || hash.length < 2 || hashIsAnAddress(path)) return () => {};
  let stopped = false;
  let clearGlow: (() => void) | null = null;
  let waited = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    clearGlow?.();
    if (running === stop) running = null;
  };
  const look = () => {
    if (stopped) return;
    const el = arrivalTarget(hash, doc);
    if (el) {
      timer = setTimeout(() => {
        if (!stopped) clearGlow = highlight(el);
      }, SETTLE_MS);
      return;
    }
    waited += FIND_EVERY_MS;
    if (waited <= FIND_FOR_MS) timer = setTimeout(look, FIND_EVERY_MS);
  };
  running = stop;
  look();
  return stop;
}
