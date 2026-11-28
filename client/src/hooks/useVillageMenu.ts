import { useEffect, useMemo, useState } from "react";
import { useGameConfig } from "@/lib/gameApi";
import { menuDocOf, type MenuDoc } from "@shared/menuDoc";
import { ACCOUNT_MENU, NAV, type NavEntry, type NavLink } from "@/config/nav";
import type { MenuPlace } from "@shared/menuPlace";

/**
 * The village's own menu and phone tabs (gap G5, shared/menuDoc.ts), served
 * in /api/game/config beside the site words, cleaned again here. Empty while
 * the config loads and for a village that set nothing, which is the
 * platform's menu exactly.
 */
export function useVillageMenu(): MenuDoc {
  const cfg = useGameConfig() as { menu?: unknown } | null;
  return useMemo(() => menuDocOf(cfg?.menu), [cfg?.menu]);
}

type Placer = typeof import("@/config/navPlaces").placedMenu;
let placer: Placer | null = null;
const PLATFORM = { nav: NAV as readonly NavEntry[], account: ACCOUNT_MENU as readonly NavLink[] };

/**
 * The menu with the village's own places for its module entries (config/navPlaces.ts; the lead, 27 Nov 2026). A
 * village that placed nothing gets the platform's lists at once and never loads the placing code, which keeps the
 * first page inside its budget (scripts/route-first-view.json). One that did loads it once, after the first paint:
 * until then its menu is the platform's, which is where every closed dropdown already stands.
 */
export function usePlacedMenu(places: Readonly<Record<string, MenuPlace>> | undefined): { nav: readonly NavEntry[]; account: readonly NavLink[] } {
  const wants = !!places && Object.keys(places).length > 0;
  const [, loaded] = useState(0);
  useEffect(() => {
    if (!wants || placer) return;
    let live = true;
    void import("@/config/navPlaces").then((m) => {
      placer = m.placedMenu;
      if (live) loaded((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, [wants]);
  return wants && placer ? placer(places) : PLATFORM;
}
