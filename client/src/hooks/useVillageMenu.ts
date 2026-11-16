import { useMemo } from "react";
import { useGameConfig } from "@/lib/gameApi";
import { menuDocOf, type MenuDoc } from "@shared/menuDoc";

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
