/**
 * THE TOP PAGES' ICONS (the lead, 25 Nov 2026: "just do the top pages, get some
 * icons for them now, and also consider putting these icons in the menu").
 *
 * Keyed by the page's address, exactly as the menu and the bar name it, so the
 * responsive bar and every menu read the same one (routeIcons.ts). Each is a
 * glyph the lead has already approved, reused where it means the same thing:
 * the bar's own five, and the family's (components/sacred/living.tsx). The four
 * paths carry their glyphs on their menu entries (config/nav.ts) and need no
 * row here. Loaded after the first paint (routeIcons.ts).
 */
import { Heart } from "lucide-react";
import { Lotus } from "@/components/sacred/glyphs";
import { Cell, CellRing, CouncilCircle, Seed, SeedPin, Songbird, Splash, Sprout, SteppingStones } from "@/components/sacred/living";
import type { RouteIcon } from "./routeIcons";

export const ROUTE_ICON_SET: Readonly<Record<string, RouteIcon>> = {
  "/": Lotus,
  "/quests": SteppingStones,
  "/roles": Cell,
  "/circles": CellRing,
  "/map/circles": CellRing,
  // The bar's own glyph for the gratitude wall until the lead picks a living one.
  "/gratitude": Heart,
  "/profile": Sprout,
  "/path": Seed,
  // How the village decides: the council circle, as the welcome page's "How we decide" door draws it.
  "/governance": CouncilCircle,
  "/decisions": CouncilCircle,
  "/messages": Songbird,
  "/feed": Splash,
  "/map": SeedPin,
};
