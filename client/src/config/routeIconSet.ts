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
import { Cell, CellRing, CouncilCircle, EarthshipDome, Gathering, HeartLeaf, LeafCompass, SeedPin, Songbird, Splash, Sprout, SteppingStones, Sunrise } from "@/components/sacred/living";
import type { RouteIcon } from "./routeIcons";

export const ROUTE_ICON_SET: Readonly<Record<string, RouteIcon>> = {
  // Home is the earthship dome, in the bar and every menu (the lead, 25 Nov 2026).
  "/": EarthshipDome,
  // The lead, 25 Nov 2026: the stones are the path now, and quests the leaf compass.
  "/quests": LeafCompass,
  "/roles": Cell,
  "/circles": CellRing,
  "/map/circles": CellRing,
  // The lead's picks, 25 Nov 2026: two leaves as a heart, a fire in a ring of stones, the sun rising.
  "/gratitude": HeartLeaf,
  "/events": Gathering,
  "/seasonal-festivals": Sunrise,
  "/profile": Sprout,
  "/path": SteppingStones,
  // How the village decides: the council circle, as the welcome page's "How we decide" door draws it.
  "/governance/how": CouncilCircle,
  "/governance/decisions": CouncilCircle,
  "/messages": Songbird,
  "/feed": Splash,
  "/map": SeedPin,
};
