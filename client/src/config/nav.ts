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
   * The story page an entry stands for when its href is a chapter of another
   * page (fold 3, #1857: the Good Neighbor criteria are a chapter of /rights).
   * Its switch and the village's own name for it stay under this address, so
   * the menu reads both here. `STORY_CHAPTERS` in shared/brochure.ts (#1857)
   * gives the switch the same answer through the anchor.
   */
  story?: string;
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
  count?: "tasks" | "messages" | "waiting";
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
  /** A folder (by its platform name) open when a newcomer opens the group (the menu's QA, 27 Nov 2026). */
  opens?: string;
  /**
   * What the group holds, in a few words, drawn as the eyebrow over its dropdown (the menu's QA, round 2). A platform
   * word, translated in navWords.ts.
   */
  holds?: string;
};

export type NavEntry = NavLink | NavGroup;

export const isGroup = (entry: NavEntry): entry is NavGroup => "items" in entry;

/**
 * THE MENU BY MEMBERSHIP (the lead, 27 Nov 2026: "Let's rethink this menu from the different levels of
 * membership (visitor, member, role holder, admin, investor, etc) and what we prioritize (like having join be
 * first, and module library at the bottom)" and "never showing more than ~5 options while still being able to
 * nest all pages into the menu"). docs/MENU_MAP.md maps every page and says why each sits where it does.
 *
 * ROUND 2 (the lead, 27 Nov 2026, on #1847): the place in Village, the people and the story in Community, how the
 * village is run and how we work in Govern, the ways in in Join, and nothing a stranger does not need shown to a
 * signed-out visitor. "So with the feedback that I gave you here, take that same logic and apply it to the rest."
 *
 * Four groups, and no group shows more than five rows to anyone (Village six: the lead chose "Allow six rows", 27 Nov
 * 2026): a row is a link or a folder (`sub`), and a folder
 * opens to five links at most. navNest.test.ts holds both counts for every audience.
 *
 *   Join        ways in. First for every reader (the lead, 27 Nov 2026: "Join should be first on the list").
 *   Village     the place and its life: the maps, Quests, Places and homes, the Library, Village health, Tools.
 *   Community   the people and the story: Our story, conversations, Gratitude, gatherings, welcoming.
 *   Govern      how the village is run and how we work: deciding, circles and roles, the season (Quests again,
 *               the one page in two groups on purpose), the guides, how we work, and the Module Library last.
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
    label: "Join",
    holds: "Ways in",
    // First for every reader (the lead, 27 Nov 2026, on the phone's More sheet: "Join should be first on the list"), so
    // the desktop bar and the phone show one order. `leads` stays: it says why a newcomer meets Join first.
    leads: "newcomers",
    // A newcomer opens Join to the paths, the first thing a stranger chooses.
    opens: "Choose your path",
    items: [
      // One glyph per path everywhere: the same four the bottom bar draws for a member's path (the lead, 25 Nov 2026).
      { href: "/investor", brochure: true, label: "Investor", subtitle: "Capital Contributor", icon: SeedHand, sub: "Choose your path" },
      { href: "/steward", brochure: true, label: "Village Steward", subtitle: "Co-Creator", icon: TreeCrown, sub: "Choose your path" },
      { href: "/resident", brochure: true, label: "Resident", subtitle: "Co-Creator", icon: SeedPodHome, sub: "Choose your path" },
      { href: "/prosperity", brochure: true, label: "Prosperity Creator", subtitle: "Business Builder", icon: SunLeaf, sub: "Choose your path" },
      // The founding team and the open ventures. Also in Govern's Circles & Roles, on purpose: here it is the way in.
      { href: "/roles", label: "Open Roles" },
      // Come and see (the Love Letter moved to Community, round 2).
      { href: "/visit", brochure: true, label: "Plan a Visit" },
      // The other three of the four ways to build (components/ContributorRoutes.tsx).
      { href: "/partner", label: "Become a partner", sub: "Build with us" },
      { href: "/propose-quest", label: "Propose a quest", sub: "Build with us" },
      { href: "/opportunities", brochure: true, label: "Business Opportunities", sub: "Build with us" },
      { href: "/work-with-us", brochure: true, label: "Work With Us", sub: "Build with us" },
      // The two ways to put money in.
      { href: "/contribute", label: "Contribute", module: "commerce", sub: "Fund the village" },
      /**
       * The crowdpool bridge. It shipped with no entry anywhere, so the only link to /campaigns in the whole
       * client sat on the campaign page, reachable only from /campaigns: a closed loop with no door in.
       */
      { href: "/campaigns", label: "Crowd pooling", module: "crowdpool", newcomers: "in-use", sub: "Fund the village" },
    ],
  },
  {
    label: "Village",
    holds: "The place",
    items: [
      // The map is the village's primary surface: the first row, with the hidden map beside it for a member.
      { href: "/map", label: "Living Map", module: "map", sub: "Maps" },
      // Members only; the module can never stand at public.
      { href: "/hidden-map", label: "Hidden map", module: "hidden-map", newcomers: "never", sub: "Maps" },
      // Quests are something you do in the village, and something the season is made of: in Govern too, on purpose.
      { href: "/quests", label: "Quests" },
      // The lead (round 2): "housing and stay and good neighbor criteria all under that", with the places beside
      // them. Photographs is a section of Places since fold 5 (#1856): /photographs redirects to /places#photos.
      { href: "/housing", brochure: true, label: "Housing", sub: "Places and homes" },
      { href: "/stay", label: "Stay", module: "stays", sub: "Places and homes" },
      // A chapter of Rights and agreements since fold 3 (#1857); its switch and its name stay under /good-neighbor.
      { href: "/rights#good-neighbor", brochure: true, story: "/good-neighbor", label: "Good Neighbor Criteria", sub: "Places and homes" },
      { href: "/places", label: "Places", module: "map", newcomers: "in-use", sub: "Places and homes" },
      // The Library and Village Health are each their own row (the lead, 27 Nov 2026: "LIbrary as it's own village
      // row", and round 2's "so could village health"). Neither is a stranger's: a visitor is not offered them.
      { href: "/library", label: "Library", module: "library", newcomers: "never" },
      { href: "/village-health", label: "Village Health", module: "health", newcomers: "never" },
      // TOOLS (the lead, 27 Nov 2026, on Village Tools: "Its under community but should be under tools"). A folder, so
      // the village's other tools can join it; holding only the tools grid (chat, calendar, Hypha) it shows as that row
      // (navNest.ts). Village is the one group with six rows: the lead chose "Allow six rows" (27 Nov 2026).
      { href: "/tools", label: "Village Tools", module: "tools", newcomers: "never", sub: "Tools" },
    ],
  },
  {
    label: "Community",
    holds: "The people and the story",
    items: [
      // The people and the story (the lead, round 2: "Our story could be under community. Our team could be under
      // community", and the Love Letter "would be under community").
      { href: "/team", brochure: true, label: "Our Team", sub: "Our story" },
      { href: "/master-plan", brochure: true, label: "Master Plan", sub: "Our story" },
      { href: "/love-letter", brochure: true, label: "Sign the Love Letter", sub: "Our story" },
      // The other villages this one is linked with.
      { href: "/network", label: "Village Network", module: "network", newcomers: "in-use", sub: "Our story" },
      { href: "/feed", label: "Feed", module: "feed", newcomers: "in-use", sub: "Conversations" },
      { href: "/forum", label: "Forum", module: "forum", newcomers: "in-use", sub: "Conversations" },
      { href: "/feedback", label: "Share Feedback", sub: "Conversations" },
      // Public since #1528 (the lead, 24 Nov 2026: the wall shows a visitor first names only).
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
     * GOVERN (the lead, round 2: "which we could just call govern"): how the village is run and how we work. The
     * routes stay where they were (/governance and the rest); only the menu's word changed, and a village that
     * renamed the old group keeps its name (shared/menuDoc.ts MOVED_GROUPS). Built on where the Governance lane is
     * going: the hub's views (Now, Decisions, Treasury) lead its first folder. The group is last for every reader,
     * so the Module Library, its last entry, is the bottom of the whole menu.
     */
    label: "Govern",
    holds: "How we're run",
    href: "/governance",
    items: [
      // The Now view (26 Nov 2026): what the village is deciding and what waits on you. Open to a guest too. "What's
      // happening now" in the menu (the menu's QA, 27 Nov 2026: "Now" alone said nothing).
      { href: "/governance", label: "What's happening now", sub: "Decide" },
      { href: "/governance/decisions", label: "Decisions", module: "governance", newcomers: "never", sub: "Decide" },
      /**
       * The Treasury tab (#1843): the cash budget every member reads (budgets spec R23), folded in from /budget,
       * which redirects here. The budget read refuses anyone not admitted, so a newcomer is not offered it.
       */
      { href: "/governance/treasury", label: "Treasury", newcomers: "never", sub: "Decide" },
      // Signed out, the page itself asks the visitor to sign in to write one.
      { href: "/propose", label: "Make a Proposal", module: "governance", newcomers: "never", sub: "Decide" },
      // No Change Requests entry: folds 6 and 7 (#1861) put change requests inside Decisions
      // (/governance/decisions#changes), and the approvals inside Your work (/governance/work#approvals).
      /**
       * Circles & Roles (the lead, round 2: "circles and roles will also open up to have roles and the circle pages
       * to learn more about that"). The org view where the map runs, the plain Circles page where it does not, the
       * roles, who looks after what, and how the roles are going.
       */
      { href: "/map/circles", label: "Circles", module: "map", sub: "Circles & Roles" },
      { href: "/circles", label: "Circles", unlessModule: "map", sub: "Circles & Roles" },
      { href: "/roles", label: "Roles", sub: "Circles & Roles" },
      // 0098. What the village looks after, and who holds each one. Public since #1529.
      { href: "/powers", label: "What We Look After", sub: "Circles & Roles" },
      // A members-only report on how the roles are going. It had no menu door.
      // A section of Circles since 1.3.95 (/role-measures redirects to /circles#role-measures).
      { href: "/circles#role-measures", label: "How roles are going", newcomers: "never", sub: "Circles & Roles" },
      // The season, one page (the season fold, #1862): Season Plans, Join the Season and the aligned terms are its
      // tabs, and their old addresses redirect there. Members read it, so it is listed for the signed-in roles only.
      { href: "/season", label: "Season", roles: ["member", "admin", "founder"], newcomers: "never", sub: "This season" },
      { href: "/funding-rounds", label: "Funding Rounds", module: "funding-rounds", roles: ["member", "admin", "founder"], newcomers: "never", sub: "This season" },
      // The season's work (the lead, round 2: "Quests could be in both village and in governance").
      { href: "/quests", label: "Quests", sub: "This season" },
      // The reference shelf: the guide, the training, Rights and agreements, then the one about leaving. Fold 3 (#1857)
      // made the two rights pages, the Good Neighbor criteria and Leaving Well one page, /rights, with four chapters;
      // Leaving Well keeps a row of its own, a door to its chapter.
      { href: "/co-creators-guide", brochure: true, label: "Co-Creators Guide", sub: "Guides" },
      { href: "/training", label: "Training", sub: "Guides" },
      { href: "/rights", label: "Rights and agreements", sub: "Guides" },
      { href: "/rights#leaving-well", label: "Leaving Well", sub: "Guides" },
      // The village's checklists and their practice runs: the reference shelf's, beside the guides (it left Your things
      // so Pay could join the Wallet there, 27 Nov 2026).
      { href: "/protocols", label: "Protocols", module: "protocols", sub: "Guides" },
      // How we work (the lead, round 2: "the how we work and the game mechanics and all of that would also be under
      // the governance"). Renamed on 2026-09-28 with the page it opens; the route stays put.
      { href: "/governance/how", label: "How we work together", sub: "How we work" },
      // A section of How we work together since fold 4 (#1854, 1.3.96); /game-mechanics redirects there. The lead's rule
      // names it in Govern, so it keeps a row of its own, as Leaving Well does. The rules are a member's.
      { href: "/governance/how#game-mechanics", label: "Game Mechanics", newcomers: "never", sub: "How we work" },
      { href: "/how-we-create", brochure: true, label: "How We Create", sub: "How we work" },
      // Every email the village sends and when, read-only, with a door to propose a change. A member's.
      { href: "/village-email", label: "Village Email", module: "comms", newcomers: "never", sub: "How we work" },
      // Last of all, for every reader (the lead, 27 Nov 2026: "module library at the bottom").
      { href: "/modules", label: "Module Library", sub: "How we work" },
    ],
  },
];

/**
 * The signed-in avatar menu: the member's own things (round 2: Wallet is the member's, "never under shared").
 * Sign out is NOT here: it is rendered separately at the foot of the dropdown, below a divider, because it is the one
 * entry that ends the session on every device and it used to sit twelve pixels from the profile link in the open bar.
 *
 * Five rows at most, like the groups: the profile, messages and tasks (each with its own count, so none hides in a
 * folder), your things, and running the village.
 */
export const ACCOUNT_MENU: readonly NavLink[] = [
  { href: "/profile", label: "My Profile" },
  // Direct messages and the shared work chats, with the member's own unread count. Its one menu door.
  { href: "/messages", label: "Messages", module: "messaging", count: "messages", newcomers: "never" },
  // The live-session task board on the profile, with the member's own count of what waits on them beside it.
  { href: TASK_BOARD_PATH, label: TASK_MENU.label, module: "sessions", count: "tasks" },
  /**
   * The member's own things. Your work (0140: what waits on the reader to decide, capability-gated in the page, so a
   * steward who is not an admin keeps it) left Govern in round 2: it is the member's own work. Wallet is here, its one
   * door (round 2: "wallet shouldn't be under shared things"). Settings has no entry: the profile's own Settings
   * button is its door, and the folder keeps five.
   */
  // With the count of what waits, as the menu's dots carry it (nav/WaitingCount.tsx).
  { href: "/governance/work", label: "Waiting on you", roles: ["member", "admin", "founder"], newcomers: "never", count: "waiting", sub: "Your things" },
  { href: "/wallet", label: "Wallet", module: "exchange", newcomers: "never", sub: "Your things" },
  // PAY (the lead, 27 Nov 2026: "Yes and while we haven't issued credits we can still have it active and showing"). A
  // member's row beside the Wallet, shown before the village issues credits: the page itself says when there are none.
  { href: "/pay", label: "Pay", roles: ["member", "admin", "founder"], newcomers: "never", sub: "Your things" },
  { href: "/journal", label: "Journal", module: "journal", sub: "Your things" },
  // Examples only until the village's first real badge (UNFINISHED-AREAS 20), so a newcomer meets it once it is in use.
  { href: "/badges", label: "Badges", module: "badges", newcomers: "in-use", sub: "Your things" },
  /**
   * Running the village: the village's working surfaces for whoever may open them. The Launch Plan is any signed-in
   * member's (the village test run; a stranger meets a sign-in wall), the Command Centre an admin's or a founder's,
   * the Treasury desk whoever holds a treasury power. They keep the amber that marks the machine room.
   */
  { href: "/journey-to-launch", label: "Launch Plan", roles: ["member", "admin", "founder"], accent: true, newcomers: "never", sub: "Running the village" },
  // The hand mint and the pay queues for whoever holds those powers, admin or not (Rye, 2026-11-15). "Treasury desk"
  // in the menu since round 2, so it does not read as Govern's Treasury tab, the budget every member reads. Since the
  // treasury fold (27 Nov 2026) it opens the desk board at the top of that same Treasury; /treasury redirects there.
  { href: "/governance/treasury#desks", label: "Treasury desk", door: "treasury", sub: "Running the village" },
  // Its own gate unlocks for admin and founder and walls everyone else.
  { href: "/project-history", brochure: true, label: "Command Centre", roles: ["admin", "founder"], accent: true, sub: "Running the village" },
  // The admin's one review page (the Governance lane folds /admin/proposals into it).
  { href: "/admin/review", label: "Review", roles: ["admin", "founder"], sub: "Running the village" },
  { href: "/admin", label: "Village Settings", roles: ["admin", "founder"], sub: "Running the village" },
];
