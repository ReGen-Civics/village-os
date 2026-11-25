/**
 * Mobile navigation config: the bottom tab bar slots. (The FAB shortcut rows are gone since phone
 * doors v4: the corner is companions and help, components/mobile/MobileFab.tsx.)
 *
 * Platform code reads this file and nothing else, so a custom game built on this
 * foundation changes its mobile nav by editing THIS file only. Keep route
 * strings, labels, and icons here; keep behaviour in the components.
 *
 * Ported from regen-civics (client/src/components/mobile/) with its adaptive,
 * behaviour-learning ranking removed. That version ranks slots from tRPC profile
 * data plus localStorage visit counts; this one is a static list, which is the
 * right trade until there are enough routes and enough members for ranking to
 * beat a considered order.
 */
import { Tripoint } from "@/components/sacred/glyphs";
import { Cell, EarthshipDome, Seed, SeedHand, SeedPodHome, SteppingStones, SunLeaf, TreeCrown } from "@/components/sacred/livingCore";
import type { LucideIcon } from "lucide-react";

export type TabSlot = {
  /** Route to navigate to, or omit and set `event` to dispatch instead. */
  path?: string;
  /** Window event to dispatch on tap (used by the More slot). */
  event?: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Named after a token: the bar paints the village's word for it and keeps
   *  `path` exactly where it is. See NavLink.token in config/nav.ts. */
  token?: "recognition";
  /** The reader's own slot: the bar draws THEIR path here (PATH_SLOT below). */
  personal?: "path";
};

/**
 * THE PATH SLOT (the lead, 25 Nov 2026: "swap out Circles with whatever path a
 * player has chosen to bring them back to that path's progress screen with a
 * unique Icon for each path").
 *
 * `path` is the slot's fixed identity, the way Admin's menu picker and a
 * village's chosen tabs name it. The bar never links there as it stands: it
 * reads the reader's first claimed path (their primary) and draws that path's
 * glyph and the village's name for it, linking to the path's own card and
 * ladder on the profile. With no path yet it offers the choice instead, with
 * the seed. Circles is in the menu behind More.
 */
export const PATH_SLOT: TabSlot = { path: "/path", label: "Your path", Icon: Seed, personal: "path" };

/** One glyph per path, so the slot shows WHICH path it is without a second icon. A path this map does not know takes the seed. */
export const PATH_GLYPHS: Readonly<Record<string, LucideIcon>> = {
  investor: SeedHand,
  steward: TreeCrown,
  resident: SeedPodHome,
  "prosperity-creator": SunLeaf,
};

/** Where a path's progress is drawn: its card on the profile, with its ladder (components/profile/PathsPanel.tsx). */
export const pathProgressHref = (pathId: string): string => `/profile#path-${pathId}`;

/**
 * Where a path is chosen: the profile's paths for someone signed in, and for a visitor the
 * whole-path page, whose first chapter is the way in. The front page's own four ways exist
 * only while a village shows its brochure pages, so `/#choose-path` landed a visitor at the
 * top of the welcome page with Home lit instead (QA, 25 Nov 2026).
 */
export const CHOOSE_PATH_HREF = { signedIn: "/profile#sheet-paths", visitor: "/path" } as const;

/**
 * Exactly five slots. Four routes plus More, which opens the existing header
 * drawer rather than duplicating it as a second full menu.
 */
// The lead, 25 Nov 2026: exactly Home, Your path, Roles, Quests, More, for everyone, before any visit
// data. The reader's own path sits next to Home; Home is the earthship dome. The gratitude wall is in the
// menu, and a village that wants it on the bar chooses it (villageSlots), where it still wears its token's word.
export const TAB_SLOTS: TabSlot[] = [
  { path: "/", label: "Home", Icon: EarthshipDome },
  PATH_SLOT,
  { path: "/roles", label: "Roles", Icon: Cell },
  { path: "/quests", label: "Quests", Icon: SteppingStones },
  { event: "open-mobile-menu", label: "More", Icon: Tripoint },
];

/**
 * THE FRONT DOOR (24 Nov 2026): the slot a newcomer gets in place of one whose
 * page is a member's working area (config/nav.ts, `newcomers`), so a visitor's
 * bar offers the roles, the way in, where a member's offers Gratitude.
 */
// A role is a cell: a living unit of the village with its own purpose (the lead, 24 Nov 2026: not a shield).
export const NEWCOMER_SLOT: TabSlot = { path: "/roles", label: "Roles", Icon: Cell };

/**
 * Tabs a newcomer's bar gives to the roles even though their page is open to a
 * newcomer (the coordinator for the lead, 24 Nov 2026). The gratitude wall is
 * public, reached from the menu and the footer, and the bar's third slot stays
 * the way in.
 */
export const NEWCOMER_SWAPPED_TABS: readonly string[] = ["/gratitude"];

/**
 * Routes that render no bottom bar and no FAB.
 *
 * A fixed bar owns the bottom 65px of the viewport at EVERY scroll position,
 * including the first paint, and a tap that lands there goes to the bar. On a
 * 390x664 Safari viewport (URL bar showing) the sign-in button sat at y579 to
 * y627 and the bar started at 599: two thirds of the only control on the page
 * navigated to Gratitude instead. Bottom padding cannot fix that — padding at
 * the END of a 2000px document does not move anything at scrollY 0.
 *
 * So these four screens do not render it. Each is a single focused task with
 * one primary control, reached before anyone is signed in, and none of them
 * loses navigation: the header keeps its full menu on mobile. This is also
 * what a native app does with a tab bar during sign-up.
 *
 * Matched as exact paths, query and trailing slash stripped.
 */
export const BARE_ROUTES: string[] = ["/login", "/register", "/set-password", "/forgot-password", "/verify-email"];

