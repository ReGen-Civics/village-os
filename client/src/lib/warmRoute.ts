/**
 * WARM THE PAGE ON HOVER (27 Nov 2026, the lead's "do first" list). When a mouse pointer rests on a menu link for
 * about 150 ms, the page's chunk starts loading, so the click feels instant.
 *
 * It asks the route preload table the build already ships (lib/routePreload.ts writes route-preload.js, which leaves
 * its lookup on `window.__routePreload`): the same hints, for the same routes, that the first visit to that page
 * would add. A file already hinted is not hinted again. Where the table is absent (the dev server, a test), nothing
 * happens. A touch never warms anything: a finger has no hover, and a tap is already the click.
 */
import type { PointerEvent } from "react";

export const WARM_AFTER_MS = 150;

declare global {
  interface Window {
    __routePreload?: (path: string) => void;
  }
}

/** Hint the page at `href`. Safe to call for any address. */
export function warmRoute(href: string): void {
  const path = href.split(/[?#]/)[0] || "/";
  try {
    window.__routePreload?.(path);
  } catch {
    /* a hint that fails costs nothing */
  }
}

/** Pointer handlers for one menu link: a mouse resting 150 ms warms its page; leaving first, or a touch, does nothing. */
export function warmOnHover(href: string): { onPointerEnter: (e: PointerEvent) => void; onPointerLeave: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    onPointerEnter: (e) => {
      if (e.pointerType !== "mouse") return;
      timer = setTimeout(() => warmRoute(href), WARM_AFTER_MS);
    },
    onPointerLeave: () => {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
