/**
 * Header navigation config: the group tree and the account menu.
 *
 * One source for BOTH the desktop bar and the mobile drawer. Those were two
 * hand-written copies of the same seventeen links, and they had already drifted:
 * the drawer was missing the Launch Plan entry and rendered its preview badges
 * with different markup. A fork changes its menu by editing THIS file only.
 *
 * Shape rules that the Layout depends on:
 *  - A group renders nothing at all when every child is filtered out, so a fork
 *    with its optional modules off never gets an empty dropdown.
 *  - `module` hides a link unless that module is on for the viewer. Ids match
 *    shared/modules.ts, which is why they do not always match the label or the
 *    route (stays -> /stay, health -> /village-health, exchange -> /wallet).
 *  - `roles` hides a link unless the signed-in member holds one of them.
 *  - `sub` puts a link in a folder inside its group (config/navNest.ts).
 */
import {
  type LucideIcon,
} from "lucide-react";
import { SeedHand, SeedPodHome, SunLeaf, TreeCrown } from "@/components/sacred/livingCore";
import { TASK_BOARD_PATH, TASK_MENU } from "@shared/taskMenu";
// The menu's words in the reader's language live beside it (navWords.ts); Layout reaches them through here.
export { navMenuId, navWord, ownWord, platformWords } from "./navWords";

export type NavLink = {
  href: string;
  label: string;
  /** Second line in the dropdown. Only the join paths use one. */
  subtitle?: string;
  icon?: LucideIcon;
  /** Module id from shared/modules.ts. Absent means always visible. */
  module?: string;
  /** Signed-in roles allowed to see this. Absent means everyone. */
  roles?: readonly string[];
  /**
   * One of the brochure pages (shared/brochure.ts). Shown only while this
   * village serves them, which a new village does not.
   */
  brochure?: true;
  /**
   * Amber treatment, for the two entries that lead into the village's own
   * working surfaces. It reads as "this is the machine room", not as "this is
   * the team's": the Launch Plan is open to every signed-in member and the
   * Command Centre is not, and they wear the same amber.
   */
  accent?: boolean;
  /**
   * This entry is named after a token, so what a member reads is whatever the
   * village calls that token (Admin → Tokens). Layout swaps `label` for the
   * live name; the `label` written here is the platform's own default word,
   * kept so this file still reads as a menu rather than a set of blanks.
   *
   * The HREF never moves. A village renaming its recognition token to Seeds
   * gets a menu entry that reads Seeds and still points at /gratitude, which
   * is where every link, bookmark and notification already goes.
   */
  token?: "recognition";
  /**
   * Shown only while this module is OFF. For a plain page that a module's
   * richer surface replaces in the menu: the separate Circles page folds into
   * the map's "Circles & Roles" view, and comes back as its own entry on a
   * village that runs no map, so the page never loses its door.
   */
  unlessModule?: string;
  /**
   * Draw a count beside the label: "tasks" is the member's own tasks waiting
   * on them (components/tasks/TaskCountBadge.tsx), "messages" their own unread
   * messages (components/messages/MessageCountBadge.tsx). Each is read for
   * them alone and hidden at zero. Never anyone else's number.
   */
  count?: "tasks" | "messages";
  /**
   * true: shown only to someone signed in. false: shown only to a visitor.
   * Absent: both.
   */
  signedIn?: boolean;
  /**
   * Shown only when the gate opens this door for the signed-in member.
   * "treasury": they hold `token.mint`, `cash.pay` or `moon.approve_alone`
   * (GET /api/treasury/doors, components/treasury/useTreasuryDoors.ts), so a
   * Treasurer who is not an admin finds the mint and the pay queues, and a
   * member who holds none of them never sees a page that would refuse them.
   */
  door?: "treasury";
  /**
   * THE FRONT DOOR (a reviewer's feedback, approved by the lead on 24 Nov 2026).
   * A visitor, or someone signed in whom the village has not admitted yet,
   * meets these areas as a sign-in wall, a page of standing examples or an
   * empty page, so the menu keeps them for members:
   *   "never"   hidden from newcomers: a member's own working surface;
   *   "in-use"  hidden from newcomers until the area is in real use
   *             (client/src/lib/areasInUse.ts says what counts for each).
   * Absent: shown to everyone the other gates let through. A member sees every
   * one of them, and an empty page says "Coming soon" (ComingSoonPanel).
   */
  newcomers?: "never" | "in-use";
  /**
   * A folder inside the group (the lead, 27 Nov 2026: "make use of nesting to not overwhelm so we're never
   * showing more than ~5 options"). Links with the same `sub` draw as one row that opens to show them
   * (config/navNest.ts). A folder left with one visible link draws as that link, so nobody opens a folder to
   * find a single page. The name is a platform word, translated in navWords.ts.
   */
  sub?: string;
};

export type NavGroup = {
  label: string;
  items: readonly NavLink[];
  /**
   * The group's own page, when it has one. The breadcrumb links the group's name there; without one the name is
   * plain words (the coordinator for the lead, 26 Nov 2026: "Keep it honest").
   */
  href?: string;
  /**
   * "newcomers": the group comes first for a visitor or someone the village has not admitted yet, and keeps its
   * place in the order below for a member (the lead, 27 Nov 2026: "having join be first").
   */
  leads?: "newcomers";
};

export type NavEntry = NavLink | NavGroup;

export const isGroup = (entry: NavEntry): entry is NavGroup => "items" in entry;

/**
 * THE MENU BY MEMBERSHIP (the lead, 27 Nov 2026: "Let's rethink this menu from the different levels of
 * membership (visitor, member, role holder, admin, investor, etc) and what we prioritize (like having join be
 * first, and module library at the bottom)" and "never showing more than ~5 options while still being able to
 * nest all pages into the menu"). docs/MENU_MAP.md maps every page and says why each sits where it does.
 *
 * Five groups, and no group shows more than five rows to anyone: a row is a link or a folder (`sub`), and a
 * folder opens to five links at most. navNest.test.ts holds both counts for every audience.
 *
 *   Village     the place and what you do in it, the map first.
 *   Community   who is here, what they say, when they gather.
 *   Governance  how the village decides: its hub's views, the season, and where to put something to it.
 *   Join        ways in. First for a visitor or a newcomer (`leads`), fourth for a member.
 *   About       what the village is, how it works, its guides, and the Module Library last of all.
 *
 * The bar's width rule still holds: what costs bar width is an ENTRY, and five groups fit at `lg`. The Living Map
 * and the Module Library left the bar for their groups so the bar keeps five: the map is Village's first row, the
 * library About's last.
 *
 * A `module` gate is for a page that renders NotFound or a gate with its module off, so an ungated link to it
 * would be a dead end on a fresh fork. Gratitude and Quests need none: both are `core` in shared/modules.ts.
 */
export const NAV: readonly NavEntry[] = [
  /*
   * No "Home" entry (Rye, 2026-10-09). The village name or logo at the left of the bar is already the home link,
   * and on a phone the bottom tab bar carries Home.
   */
  {
    label: "Village",
    items: [
      /**
       * The map is the village's primary surface, and it spent a release buried as the first item of a nine-item
       * Village dropdown. It held a bar slot of its own until 27 Nov 2026; it is now this group's first row, so the
       * bar keeps five entries.
       */
      { href: "/map", label: "Living Map", module: "map" },
      { href: "/quests", label: "Quests" },
      // The org view. The plain Circles page folds into it, and returns as its own entry only on a village with no map.
      { href: "/map/circles", label: "Circles & Roles", module: "map" },
      { href: "/circles", label: "Circles", unlessModule: "map" },
      { href: "/places", label: "Places", module: "map", newcomers: "in-use", sub: "Places and homes" },
      { href: "/photographs", label: "Photographs", module: "map", newcomers: "in-use", sub: "Places and homes" },
      // Members only; the module can never stand at public.
      { href: "/hidden-map", label: "Hidden map", module: "hidden-map", newcomers: "never", sub: "Places and homes" },
      { href: "/housing", brochure: true, label: "Housing", sub: "Places and homes" },
      { href: "/stay", label: "Stay", module: "stays", sub: "Places and homes" },
      { href: "/library", label: "Library", module: "library", sub: "Shared things" },
      { href: "/tools", label: "Tools", module: "tools", newcomers: "in-use", sub: "Shared things" },
      // The village exchange. A member's own balances live on the profile; this is the village's page, and its one
      // menu door (it also sat in the account menu until 27 Nov 2026).
      { href: "/wallet", label: "Wallet", module: "exchange", sub: "Shared things" },
      { href: "/village-health", label: "Health", module: "health", sub: "Shared things" },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/feed", label: "Feed", module: "feed", newcomers: "in-use" },
      { href: "/forum", label: "Forum", module: "forum", newcomers: "in-use" },
      // Public since #1528 (the lead, 24 Nov 2026: the wall shows a visitor first names only), so the menu and the
      // footer offer it to a newcomer. Their phone tab bar still gives its slot to the roles (config/mobileNav.ts).
      { href: "/gratitude", label: "Gratitude", token: "recognition" },
      { href: "/events", label: "Events", module: "events", newcomers: "in-use", sub: "Gatherings" },
      // The circle calls a member takes part in.
      { href: "/sessions", label: "Live Sessions", module: "sessions", newcomers: "never", sub: "Gatherings" },
      { href: "/seasonal-festivals", label: "Seasonal Festivals", newcomers: "in-use", sub: "Gatherings" },
      // Rites: begin a rite, witness one, pair a newcomer, invite with a letter (module `rites`).
      { href: "/rites", label: "Rites", module: "rites", newcomers: "never", sub: "Welcoming" },
      { href: "/introductions", label: "Introductions", module: "introductions", newcomers: "never", sub: "Welcoming" },
    ],
  },
  {
    /**
     * "Governance" (the lead, 26 Nov 2026): how the village governs itself. Built on where the Governance lane is
     * going (the lead: "make sure you're building on top of what they're going to do"): /governance is the hub and
     * its views are Now, Decisions, Your work, Treasury and How we decide (components/governance/now/GovernanceTabs.tsx,
     * with the Treasury tab from #1843). The group leads with Now, Decisions and the Treasury, which every member
     * reads; the season's pages share one folder and the other views and doors a second, so it keeps five rows.
     */
    label: "Governance",
    href: "/governance",
    items: [
      // The Now view (26 Nov 2026): what the village is deciding and what waits on you. Open to a guest too.
      { href: "/governance", label: "Now" },
      // The live surface, module-gated, where the engine is switched on.
      { href: "/governance/decisions", label: "Decisions", module: "governance", newcomers: "never" },
      /**
       * The Treasury tab (#1843): the cash budget every member reads (budgets spec R23), folded in from /budget, which
       * redirects here (the lead, 27 Nov 2026: "This can just be built into the governance section under the treasury
       * section"). The budget read refuses anyone not admitted, so a newcomer is not offered it. It left the account
       * menu, where it read as a personal page.
       */
      { href: "/governance/treasury", label: "Treasury", newcomers: "never" },
      // The season's own pages. Members read them (terms.read), so they are listed for the signed-in roles only.
      { href: "/season-plans", label: "Season Plans", module: "governance", roles: ["member", "admin", "founder"], newcomers: "never", sub: "This season" },
      { href: "/season-places", label: "Join the Season", module: "season-places", roles: ["member", "admin", "founder"], newcomers: "never", sub: "This season" },
      { href: "/funding-rounds", label: "Funding Rounds", module: "funding-rounds", roles: ["member", "admin", "founder"], newcomers: "never", sub: "This season" },
      { href: "/aligned", label: "Aligned", module: "governance", roles: ["member", "admin", "founder"], newcomers: "never", sub: "This season" },
      /**
       * 0140. What waits on the reader, what an outside service proposed among it. Capability-gated in the page, so a
       * steward who is not an admin can keep this queue. Signed in only, because a stranger cannot hold the capability.
       */
      { href: "/governance/work", label: "Your work", roles: ["member", "admin", "founder"], newcomers: "never", sub: "More in Governance" },
      // Governance's last view. Renamed on 2026-09-28 with the page it opens; the route stays put. It moved from About
      // on 27 Nov 2026, beside the other views.
      { href: "/governance/how", label: "How we work together", sub: "More in Governance" },
      // Signed out, the page itself asks the visitor to sign in to write one.
      { href: "/propose", label: "Make a Proposal", module: "governance", newcomers: "never", sub: "More in Governance" },
      // Change requests (Rye, 2026-11-06): several connected changes gathered and sent to one vote. Signed in only.
      { href: "/changes", label: "Change Requests", roles: ["member", "admin", "founder"], newcomers: "never", sub: "More in Governance" },
      // 0098. What the village looks after, and who holds each one. Public since #1529, so a newcomer is offered it.
      { href: "/powers", label: "What We Look After", sub: "More in Governance" },
    ],
  },
  {
    label: "Join",
    leads: "newcomers",
    items: [
      // One glyph per path everywhere: the same four the bottom bar draws for a member's path (the lead, 25 Nov 2026).
      { href: "/investor", brochure: true, label: "Investor", subtitle: "Capital Contributor", icon: SeedHand, sub: "Choose your path" },
      { href: "/steward", brochure: true, label: "Village Steward", subtitle: "Co-Creator", icon: TreeCrown, sub: "Choose your path" },
      { href: "/resident", brochure: true, label: "Resident", subtitle: "Co-Creator", icon: SeedPodHome, sub: "Choose your path" },
      { href: "/prosperity", brochure: true, label: "Prosperity Creator", subtitle: "Business Builder", icon: SunLeaf, sub: "Choose your path" },
      // The founding team and the open ventures. A phone has it as a tab; on a wide screen this is its door, and on a
      // village with no map it is its only one (the plain Roles entry used to sit under Village there).
      { href: "/roles", label: "Open Roles" },
      { href: "/visit", brochure: true, label: "Plan a Visit", sub: "Come and see" },
      { href: "/love-letter", brochure: true, label: "Sign the Love Letter", sub: "Come and see" },
      // The other three of the four ways to build (components/ContributorRoutes.tsx) had no menu door until
      // 27 Nov 2026: a partnership, a quest, a venture on the general proposal form.
      { href: "/partner", label: "Become a partner", sub: "Build with us" },
      { href: "/propose-quest", label: "Propose a quest", sub: "Build with us" },
      { href: "/opportunities", brochure: true, label: "Business Opportunities", sub: "Build with us" },
      { href: "/work-with-us", brochure: true, label: "Work With Us", sub: "Build with us" },
      // The two ways to put money in, beside the ways to come in.
      { href: "/contribute", label: "Contribute", module: "commerce", sub: "Fund the village" },
      /**
       * The crowdpool bridge. It shipped with no entry anywhere, so the only link to /campaigns in the whole
       * client sat on the campaign page, reachable only from /campaigns: a closed loop with no door in.
       */
      { href: "/campaigns", label: "Crowd pooling", module: "crowdpool", newcomers: "in-use", sub: "Fund the village" },
    ],
  },
  {
    label: "About",
    items: [
      { href: "/how-we-create", brochure: true, label: "How We Create", sub: "Our story" },
      { href: "/master-plan", brochure: true, label: "Master Plan", sub: "Our story" },
      { href: "/team", brochure: true, label: "Our Team", sub: "Our story" },
      // The other villages this one is linked with: part of what it is.
      { href: "/network", label: "Village Network", module: "network", newcomers: "in-use", sub: "Our story" },
      { href: "/game-mechanics", label: "Game Mechanics", sub: "How we work" },
      // Every email the village sends and when, read-only, with a door to propose a change (comms build spec 5.13).
      // It left Guides (the lead, 27 Nov 2026: "the village emails can be nested somewhere else"): it is how the
      // village works, beside its rules of play.
      { href: "/village-email", label: "Village Email", module: "comms", sub: "How we work" },
      { href: "/good-neighbor", brochure: true, label: "Good Neighbor", sub: "How we work" },
      // The reference shelf: the guide, the training, the two rights pages, then the one about leaving. Your First
      // Walk is gone (the lead, 27 Nov 2026: "Let's get rid of this"); /first-walk redirects home.
      { href: "/co-creators-guide", brochure: true, label: "Co-Creators Guide", sub: "Guides" },
      { href: "/training", label: "Training", sub: "Guides" },
      { href: "/resident-rights", brochure: true, label: "Resident Rights", sub: "Guides" },
      { href: "/steward-rights", brochure: true, label: "Steward Rights", sub: "Guides" },
      { href: "/exit-policy", label: "Leaving Well", sub: "Guides" },
      { href: "/feedback", label: "Share Feedback" },
      // Last of all, for every reader (the lead, 27 Nov 2026: "module library at the bottom").
      { href: "/modules", label: "Module Library" },
    ],
  },
];

/**
 * The signed-in avatar menu. Sign out is NOT here: it is rendered separately at
 * the foot of the dropdown, below a divider, because it is the one entry that
 * ends the session on every device and it used to sit twelve pixels from the
 * profile link in the open bar.
 *
 * Five rows at most, like the groups (27 Nov 2026): the three a member opens every day, then two folders.
 */
export const ACCOUNT_MENU: readonly NavLink[] = [
  { href: "/profile", label: "My Profile" },
  // Direct messages and the shared work chats, with the member's own unread count. Its one menu door: it left
  // Community on 27 Nov 2026, so the page sits in one place. The shortcuts button carries the other door.
  { href: "/messages", label: "Messages", module: "messaging", count: "messages", newcomers: "never" },
  // The live-session task board on the profile, with the member's own count of what waits on them beside it.
  { href: TASK_BOARD_PATH, label: TASK_MENU.label, module: "sessions", count: "tasks" },
  // A member's own pages. Hidden while each module is off for this viewer.
  { href: "/journal", label: "Journal", module: "journal", sub: "Your things" },
  { href: "/protocols", label: "Protocols", module: "protocols", sub: "Your things" },
  // Examples only until the village's first real badge (UNFINISHED-AREAS 20), so a newcomer meets it once it is in use.
  { href: "/badges", label: "Badges", module: "badges", newcomers: "in-use", sub: "Your things" },
  // A member's own settings (language, email, privacy). It had no menu door, only the profile's link.
  { href: "/profile/settings", label: "Settings", sub: "Your things" },
  /**
   * Running the village: the village's working surfaces for whoever may open them. The Launch Plan is any signed-in
   * member's (the village test run; a stranger meets a sign-in wall), the Command Centre an admin's or a founder's,
   * the Treasury whoever holds a treasury power. The first two left Governance on 27 Nov 2026 so no group holds more
   * than five rows; they keep the amber that marks the machine room.
   */
  { href: "/journey-to-launch", label: "🌳 Launch Plan", roles: ["member", "admin", "founder"], accent: true, newcomers: "never", sub: "Running the village" },
  // The hand mint and the pay queues for whoever holds those powers, admin or not (Rye, 2026-11-15).
  { href: "/treasury", label: "Treasury", door: "treasury", sub: "Running the village" },
  // Its own gate unlocks for admin and founder and walls everyone else.
  { href: "/project-history", brochure: true, label: "🛠 Command Centre", roles: ["admin", "founder"], accent: true, sub: "Running the village" },
  // The admin's one review page (the Governance lane folds /admin/proposals into it). It had no menu door.
  { href: "/admin/review", label: "Review", roles: ["admin", "founder"], sub: "Running the village" },
  { href: "/admin", label: "Village Settings", roles: ["admin", "founder"], sub: "Running the village" },
];
