/**
 * THE LAST CRUMB: a page below its menu entry names itself for the breadcrumb (components/nav/Breadcrumbs.tsx), the
 * role, the circle or the decision a reader is on. A page that names nothing ends the trail at its menu entry, and
 * its own heading says the rest.
 *
 *   useCrumbLeaf(role?.name);
 *
 * Call it with the name once it is known; until then (or with nothing) the trail has no last crumb. Leaving the page
 * takes the name with it. A store, not a context, because a page draws <Layout> INSIDE itself, so nothing Layout
 * provides is above the page.
 */
import { useEffect, useSyncExternalStore } from "react";

let current: string | null = null;
const listeners = new Set<() => void>();

function set(name: string | null): void {
  if (name === current) return;
  current = name;
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The page's own name for the last crumb, read by Layout. */
export function useCrumbLeafValue(): string | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

export function useCrumbLeaf(name: string | null | undefined): void {
  const clean = typeof name === "string" ? name.trim() : "";
  useEffect(() => {
    if (!clean) return;
    set(clean);
    return () => set(null);
  }, [clean]);
}
