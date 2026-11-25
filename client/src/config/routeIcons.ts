/**
 * AN ICON FOR EVERY PAGE, by address, for the bottom bar's places that change
 * (the responsive bar, shared/navPopularity.ts). The motion lane draws them
 * (components/sacred/living.tsx) and fills this map; a page with no entry
 * keeps the glyph its slot or menu entry already carries.
 */
import type { ComponentType } from "react";

export type RouteIcon = ComponentType<{ className?: string }>;

export const ROUTE_ICONS: Readonly<Partial<Record<string, RouteIcon>>> = {};

/** The page's own icon, or the one it already had. */
export function routeIcon(path: string | undefined, fallback: RouteIcon): RouteIcon {
  return (path && ROUTE_ICONS[path]) || fallback;
}
