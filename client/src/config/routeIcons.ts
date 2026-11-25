/**
 * AN ICON FOR EVERY PAGE, by address, for the bottom bar's places that change
 * (the responsive bar, shared/navPopularity.ts) and for the menus (the header's
 * dropdowns, the phone drawer and the More sheet, components/nav/MenuIcon.tsx).
 * The motion lane draws them (components/sacred/living.tsx); the set itself is
 * routeIconSet.ts. A page with no entry keeps the glyph its slot or menu entry
 * already carries.
 *
 * THE SET LOADS AFTER THE FIRST PAINT. Every page's glyph on the first page
 * would put the whole family there for a menu nobody has opened yet, so this
 * file stays a few lines and the set arrives when the browser is idle. Until
 * then `routeIcon` answers with the fallback, and a component that wants the
 * set's icons calls `useRouteIcons()` so it draws again once they land. The
 * bar's own five slots already carry their glyphs and never wait for it.
 */
import { useEffect, useSyncExternalStore, type ComponentType } from "react";

export type RouteIcon = ComponentType<{ className?: string }>;

const icons: Partial<Record<string, RouteIcon>> = {};

/** The icons by address, filled once the set has loaded. */
export const ROUTE_ICONS: Readonly<Partial<Record<string, RouteIcon>>> = icons;

/** The page's own icon, or the one it already had. */
export function routeIcon(path: string | undefined, fallback: RouteIcon): RouteIcon {
  return (path && ROUTE_ICONS[path]) || fallback;
}

let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Load the set (once). A failed load is forgotten, so the next caller tries again. */
export function loadRouteIcons(): Promise<void> {
  loading ??= import("./routeIconSet").then(
    (m) => {
      Object.assign(icons, m.ROUTE_ICON_SET);
      loaded = true;
      listeners.forEach((l) => l());
    },
    () => {
      loading = null;
    },
  );
  return loading;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Whether the set has landed; asks for it when the browser is next idle, and draws again when it does. */
export function useRouteIcons(): boolean {
  const ready = useSyncExternalStore(subscribe, () => loaded, () => false);
  useEffect(() => {
    if (loaded) return;
    const w: Window = window;
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(() => void loadRouteIcons(), { timeout: 2000 });
      return () => w.cancelIdleCallback(id);
    }
    const id = setTimeout(() => void loadRouteIcons(), 200);
    return () => clearTimeout(id);
  }, []);
  return ready;
}

/** For tests: forget the loaded set. */
export function resetRouteIconsForTests(): void {
  for (const k of Object.keys(icons)) delete icons[k];
  loaded = false;
  loading = null;
}
