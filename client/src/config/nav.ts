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
 */
import {
  type LucideIcon,
} from "lucide-react";
import { SeedHand, SeedPodHome, SunLeaf, TreeCrown } from "@/components/sacred/livingCore";
import { TASK_BOARD_PATH, TASK_MENU } from "@shared/taskMenu";

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
   * richer surface replaces in the menu: the separate Circles and Roles pages
   * fold into the map's "Circles & Roles" view, and come back as their own
   * entries on a village that runs no map, so neither page loses its door.
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
   * Absent: both. For an entry that earns the bar for a member and sits in a
   * group for a visitor (design pass D-27: the bar carried nine stops for a
   * visitor), so the page keeps its door either way.
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
};

export type NavGroup = {
  label: string;
  items: readonly NavLink[];
};

export type NavEntry = NavLink | NavGroup;

export const isGroup = (entry: NavEntry): entry is NavGroup => "items" in entry;

/**
 * The bar, left to right. Seven entries plus the account menu (Rye,
 * 2026-10-09: the menu restructure).
 *
 * The width rule that produced this shape still governs it: at seventeen
 * TOP-LEVEL links the bar measured ~1250px and could only render from `xl`,
 * which left every viewport between 768px and ~1310px with no desktop
 * navigation at all. What costs bar width is an entry, not an item, because the
 * items live in a dropdown. So a page the menu never linked costs nothing to
 * add as an item, and the bar stays short.
 *
 * Each group answers one question, and runs 5-12 items so it stays readable:
 *   Community  who is here and what are they saying
 *   Village    the place, and what you can do in it (Quests live here now)
 *   Decide     how the village decides, and where to put something to it
 *   Join       ways in, and ways to put something in
 *   Guides     how to take part well
 *   About      what the village is
 *
 * A `module` gate is for a page that renders NotFound or a gate with its module
 * off, so an ungated link to it would be a dead end on a fresh fork.
 * Gratitude and Quests need none: both are `core` in shared/modules.ts.
 */
export const NAV: readonly NavEntry[] = [
  /*
   * No "Home" entry (Rye, 2026-10-09). The village name or logo at the left of
   * the bar is already the home link, and on a phone the bottom tab bar
   * carries Home. Its width paid for the Module Library below: with both, the
   * bar crowded the village name out of the header at 1024px.
   */
  /**
   * Top level, and worth the bar width.
   *
   * The map is the village's primary surface, and it spent a release buried
   * as the first item of a nine-item Village dropdown where nobody arriving
   * for the first time would find it. What costs bar width is an ENTRY, and
   * this is the one entry that earns it.
   */
  { href: "/map", label: "Living Map", module: "map" },
  /**
   * Top level, and the second entry to earn the bar width (Rye, 2026-10-09).
   * It took the slot of Home, which duplicated the village-name link.
   *
   * The library is the village's "what is possible here" window, and it sat
   * as the last item of Guides, under the rules-of-play pages, where nobody
   * looking for what the village could switch on would think to open. It is
   * ungated for the reason it always was (L1): public and read-only, the
   * platform's own page, so a visitor sees it too.
   */
  // A member's bar only (design pass D-27): a visitor finds it under About. An applicant signed in but not
  // yet admitted is a newcomer (lib/newcomer.ts), and "what the platform can switch on" is not their next step.
  { href: "/modules", label: "Module Library", signedIn: true, newcomers: "never" },
  {
    label: "Community",
    items: [
      { href: "/feed", label: "Feed", module: "feed", newcomers: "in-use" },
      { href: "/forum", label: "Forum", module: "forum", newcomers: "in-use" },
      { href: "/messages", label: "Messages", module: "messaging", newcomers: "never" },
      // Rites: begin a rite, witness one, pair a newcomer, invite with a letter (module `rites`).
      { href: "/rites", label: "Rites", module: "rites", newcomers: "never" },
      { href: "/introductions", label: "Introductions", module: "introductions", newcomers: "never" },
      { href: "/events", label: "Events", module: "events", newcomers: "in-use" },
      // The circle calls a member takes part in. It sat in the account menu,
      // where only a member already looking for it would find it. The
      // shortcuts button carries the other door (config/mobileNav.ts).
      { href: "/sessions", label: "Live Sessions", module: "sessions", newcomers: "never" },
      // Public since #1528 (the lead, 24 Nov 2026: the wall shows a visitor first names only), so the menu
      // and the footer offer it to a newcomer. Their phone tab bar still gives its slot to the roles
      // (NEWCOMER_SWAPPED_TABS, config/mobileNav.ts).
      { href: "/gratitude", label: "Gratitude", token: "recognition" },
      { href: "/seasonal-festivals", label: "Seasonal Festivals", newcomers: "in-use" },
      { href: "/feedback", label: "Share Feedback" },
    ],
  },
  {
    label: "Village",
    items: [
      // Quests left the bar for here (Rye, 2026-10-09): they are something
      // you do in the village. Phones keep them in the bottom tab bar.
      { href: "/quests", label: "Quests" },
      // The org view. The plain Circles and Roles pages fold into it, and
      // return as their own entries only on a village with no map.
      { href: "/map/circles", label: "Circles & Roles", module: "map" },
      { href: "/circles", label: "Circles", unlessModule: "map" },
      { href: "/roles", label: "Roles", unlessModule: "map" },
      { href: "/places", label: "Places", module: "map", newcomers: "in-use" },
      { href: "/photographs", label: "Photographs", module: "map", newcomers: "in-use" },
      // Members only; the module can never stand at public.
      { href: "/hidden-map", label: "Hidden map", module: "hidden-map", newcomers: "never" },
      { href: "/stay", label: "Stay", module: "stays" },
      { href: "/housing", brochure: true, label: "Housing" },
      { href: "/library", label: "Library", module: "library" },
      { href: "/tools", label: "Tools", module: "tools", newcomers: "in-use" },
      { href: "/wallet", label: "Wallet", module: "exchange" },
      { href: "/village-health", label: "Health", module: "health" },
    ],
  },
  {
    /**
     * How the village decides (Rye, 2026-10-09). Make a Proposal had no link
     * anywhere in the menu, and the review queue and the powers page sat in
     * the account menu, where they read as personal settings.
     */
    label: "Decide",
    items: [
      // The live surface, module-gated: /governance (under About) explains
      // how the village decides and is always there; /decisions shows what it
      // is deciding and exists only where the engine is switched on.
      { href: "/decisions", label: "Decisions", module: "governance", newcomers: "never" },
      // Funding rounds (0338): the village chooses which quests the season funds,
      // within a pot. Signed-in roles only: every door asks for a member.
      { href: "/funding-rounds", label: "Funding Rounds", module: "funding-rounds", roles: ["member", "admin", "founder"], newcomers: "never" },
      // Season plans (RC1): everyone's plan for the season, by name. Members
      // read it (terms.read), so it is listed for the signed-in roles only.
      { href: "/season-plans", label: "Season Plans", module: "governance", roles: ["member", "admin", "founder"], newcomers: "never" },
      // Season places (0408): apply for the season, and who takes part. Members read it, so signed-in roles only.
      { href: "/season-places", label: "Join the Season", module: "season-places", roles: ["member", "admin", "founder"], newcomers: "never" },
      // The aligned register (seat settings PR6): every set of terms members
      // have aligned with. Members read it (terms.read), so signed-in roles only.
      { href: "/aligned", label: "Aligned", module: "governance", roles: ["member", "admin", "founder"], newcomers: "never" },
      // Signed out, the page itself asks the visitor to sign in to write one.
      { href: "/propose", label: "Make a Proposal", module: "governance", newcomers: "never" },
      // Change requests (Rye, 2026-11-06): several connected changes to the
      // village's settings gathered, reviewed and sent to one vote. The routes
      // mount outside requireModule(), and the page meets a stranger with a
      // sign-in line, so it is listed for the signed-in roles and no module.
      { href: "/changes", label: "Change Requests", roles: ["member", "admin", "founder"], newcomers: "never" },
      /**
       * 0140. What an outside service has proposed, waiting for somebody to
       * read it. Capability-gated in the page so that a steward who is not an
       * admin can keep this queue: a menu entry only admins could see would put
       * the capability straight back behind the panel it was written to
       * escape. Signed in only, because a stranger cannot hold the capability.
       */
      { href: "/review", label: "Review Queue", roles: ["member", "admin", "founder"], newcomers: "never" },
      // 0098. What the village looks after, and who holds each one: who do I
      // ask. Open to visitors, and the page says what signing in adds.
      // Public since #1529 (the lead, 24 Nov 2026: holders by first name), so a newcomer is offered it too.
      { href: "/powers", label: "What We Look After" },
      /**
       * R12 opened this page to every member. `POST /api/dry-run` answers any
       * signed-in member, so a member could run the village test run and had
       * no way to find it short of being told the URL.
       *
       * SIGNED IN, NOT EVERYONE: `visible()` in Layout.tsx passes a link with
       * no `roles` to a stranger too, and this page meets a stranger with a
       * sign-in wall. `PUT /api/admin/users/:id/role` refuses any value outside
       * `["member", "admin", "founder"]`, so listing all three is the whole
       * signed-in population. A fourth role would have to be added here too.
       *
       * NO `module`. The dry-run route mounts outside `requireModule()`, so a
       * module gate here would hide a working page on every fresh fork.
       */
      {
        href: "/journey-to-launch",
        label: "🌳 Launch Plan",
        roles: ["member", "admin", "founder"],
        accent: true,
        newcomers: "never",
      },
      /**
       * /project-history is the Command Centre, not a public history page. Its
       * own gate auto-unlocks for admin and founder and shows everyone else a
       * sign-in wall, so an ungated entry would put a locked door in the public
       * menu. Same amber as the Launch Plan, because it is the same kind of
       * entry.
       */
      {
        href: "/project-history",
        brochure: true,
        label: "🛠 Command Centre",
        roles: ["admin", "founder"],
        accent: true,
      },
    ],
  },
  {
    label: "Join",
    items: [
      // One glyph per path everywhere: the same four the bottom bar draws for a member's path (the lead, 25 Nov 2026).
      { href: "/investor", brochure: true, label: "Investor", subtitle: "Capital Contributor", icon: SeedHand },
      { href: "/steward", brochure: true, label: "Village Steward", subtitle: "Co-Creator", icon: TreeCrown },
      { href: "/resident", brochure: true, label: "Resident", subtitle: "Co-Creator", icon: SeedPodHome },
      { href: "/prosperity", brochure: true, label: "Prosperity Creator", subtitle: "Business Builder", icon: SunLeaf },
      { href: "/opportunities", brochure: true, label: "Business Opportunities" },
      { href: "/visit", brochure: true, label: "Plan a Visit" },
      { href: "/love-letter", brochure: true, label: "Sign the Love Letter" },
      { href: "/work-with-us", brochure: true, label: "Work With Us" },
      // The two ways to put something in, beside the ways to come in.
      { href: "/contribute", label: "Contribute", module: "commerce" },
      /**
       * The crowdpool bridge. It shipped with no entry anywhere, so the only
       * link to /campaigns in the whole client sat on the campaign page,
       * reachable only from /campaigns: a closed loop with no door in.
       */
      { href: "/campaigns", label: "Crowd pooling", module: "crowdpool", newcomers: "in-use" },
    ],
  },
  {
    /**
     * The reference shelf: what a member reads to take part well. Ordered as a
     * newcomer meets them: the guide, then the walk, then the rules of play,
     * then the two rights pages, then the one about leaving.
     */
    label: "Guides",
    items: [
      { href: "/co-creators-guide", brochure: true, label: "Co-Creators Guide" },
      // Founders and admins only (R47): every stop stands on a practice
      // example and the page ends at the settings, so it is the team tour.
      { href: "/first-walk", label: "Your First Walk", roles: ["admin", "founder"] },
      { href: "/game-mechanics", label: "Game Mechanics" },
      // Every email the village sends and when, read-only, with a door to propose a change (comms build spec 5.13).
      { href: "/village-email", label: "Village Email", module: "comms" },
      { href: "/good-neighbor", brochure: true, label: "Good Neighbor" },
      { href: "/training", label: "Training" },
      { href: "/resident-rights", brochure: true, label: "Resident Rights" },
      { href: "/steward-rights", brochure: true, label: "Steward Rights" },
      { href: "/exit-policy", label: "Leaving Well" },
    ],
  },
  {
    label: "About",
    items: [
      { href: "/how-we-create", brochure: true, label: "How We Create" },
      // Renamed on 2026-09-28 with the page it opens; the route stays put.
      { href: "/governance", label: "How we work together" },
      { href: "/master-plan", brochure: true, label: "Master Plan" },
      { href: "/team", brochure: true, label: "Our Team" },
      // The other villages this one is linked with: part of what it is.
      { href: "/network", label: "Village Network", module: "network", newcomers: "in-use" },
      // A visitor's door to the library, which a member has on the bar (design pass D-27).
      { href: "/modules", label: "Module Library", signedIn: false },
    ],
  },
];

/**
 * The signed-in avatar menu. Sign out is NOT here: it is rendered separately at
 * the foot of the dropdown, below a divider, because it is the one entry that
 * ends the session on every device and it used to sit twelve pixels from the
 * profile link in the open bar.
 *
 * Wallet points into the profile page, which is where a member's own balances
 * live. The village exchange keeps its own page under Village.
 */
export const ACCOUNT_MENU: readonly NavLink[] = [
  { href: "/profile", label: "My Profile" },
  // A member's own pages, so it lives beside their profile. The shortcuts
  // button carries the other door (config/mobileNav.ts); both hide while the
  // journal module is off for this viewer.
  { href: "/journal", label: "Journal", module: "journal" },
  // The village's checklists. Hidden while the module is off for this viewer.
  { href: "/protocols", label: "Protocols", module: "protocols" },
  // Direct messages and the shared work chats, with the member's own unread
  // count. The shortcuts button carries the other door (config/mobileNav.ts).
  { href: "/messages", label: "Messages", module: "messaging", count: "messages", newcomers: "never" },
  { href: "/wallet", label: "Wallet", module: "exchange" },
  // The live-session task board on the profile, with the member's own count
  // of what waits on them beside it. The shortcuts button carries the other
  // door (config/mobileNav.ts).
  { href: TASK_BOARD_PATH, label: TASK_MENU.label, module: "sessions", count: "tasks" },
  // Examples only until the village's first real badge (UNFINISHED-AREAS 20), so a newcomer meets it once it is in use.
  { href: "/badges", label: "Badges", module: "badges", newcomers: "in-use" },
  // The cash budget every member reads (budgets spec R23); its holder changes it on the same page. A member's
  // surface: the budget read refuses anyone not admitted, so a newcomer was offered a page that answers 403.
  { href: "/budget", label: "Cash Budget", newcomers: "never" },
  { href: "/admin", label: "Village Settings", roles: ["admin", "founder"] },
  // The hand mint and the pay queues for whoever holds those powers, admin or not (Rye, 2026-11-15).
  { href: "/treasury", label: "Treasury", door: "treasury" },
];
