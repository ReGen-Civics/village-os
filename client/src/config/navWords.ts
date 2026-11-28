/**
 * THE MENU'S OWN WORDS, in the reader's language (the lead, 26 Nov 2026: "menu isn't switching to spanish!").
 *
 * client/src/config/nav.ts names every entry in plain English, because a label there is also a key: the
 * village's own menu (shared/menuDoc.ts) renames a group by its English name, and the bar keys its
 * dropdowns by it. So the words are translated HERE, at the moment they are drawn, and only when the village
 * has not given that entry a name of its own (a village's own name is its content, in its own language).
 *
 * Every label and subtitle in NAV and ACCOUNT_MENU has an entry; client/src/config/navWords.test.ts fails on
 * one without, so a new menu entry cannot ship in English only.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, setupI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

export const NAV_WORDS: Readonly<Record<string, MessageDescriptor>> = {
  "Living Map": msg({ message: "Living Map", context: "site menu" }),
  "Module Library": msg({ message: "Module Library", context: "site menu" }),
  "Community": msg({ message: "Community", context: "site menu" }),
  "Feed": msg({ message: "Feed", context: "site menu" }),
  "Forum": msg({ message: "Forum", context: "site menu" }),
  "Messages": msg({ message: "Messages", context: "site menu" }),
  "Rites": msg({ message: "Rites", context: "site menu" }),
  "Introductions": msg({ message: "Introductions", context: "site menu" }),
  "Events": msg({ message: "Events", context: "site menu" }),
  "Live Sessions": msg({ message: "Live Sessions", context: "site menu" }),
  "Seasonal Festivals": msg({ message: "Seasonal Festivals", context: "site menu" }),
  "Share Feedback": msg({ message: "Share Feedback", context: "site menu" }),
  "Village": msg({ message: "Village", context: "site menu" }),
  "Quests": msg({ message: "Quests", context: "site menu" }),
  "Circles & Roles": msg({ message: "Circles & Roles", context: "site menu" }),
  "Circles": msg({ message: "Circles", context: "site menu" }),
  "Roles": msg({ message: "Roles", context: "site menu" }),
  "Places": msg({ message: "Places", context: "site menu" }),
  "Photographs": msg({ message: "Photographs", context: "site menu" }),
  "Hidden map": msg({ message: "Hidden map", context: "site menu" }),
  "Stay": msg({ message: "Stay", context: "site menu" }),
  "Housing": msg({ message: "Housing", context: "site menu" }),
  "Library": msg({ message: "Library", context: "site menu" }),
  "Tools": msg({ message: "Tools", context: "site menu" }),
  "Wallet": msg({ message: "Wallet", context: "site menu" }),
  // The member's own row for sending and receiving credits (27 Nov 2026).
  "Pay": msg({ message: "Pay", context: "site menu" }),
  "Health": msg({ message: "Health", context: "site menu" }),
  "Governance": msg({ message: "Governance", context: "site menu" }),
  "Decisions": msg({ message: "Decisions", context: "site menu" }),
  "Funding Rounds": msg({ message: "Funding Rounds", context: "site menu" }),
  "Season Plans": msg({ message: "Season Plans", context: "site menu" }),
  "Join the Season": msg({ message: "Join the Season", context: "site menu" }),
  "Aligned": msg({ message: "Aligned", context: "site menu" }),
  "Make a Proposal": msg({ message: "Make a Proposal", context: "site menu" }),
  "Change Requests": msg({ message: "Change Requests", context: "site menu" }),
  "Your work": msg({ message: "Your work", context: "site menu" }),
  "What We Look After": msg({ message: "What We Look After", context: "site menu" }),
  // The emoji came off (the lead, 27 Nov 2026: "Drop them").
  "Launch Plan": msg({ message: "Launch Plan", context: "site menu" }),
  "Command Centre": msg({ message: "Command Centre", context: "site menu" }),
  "Join": msg({ message: "Join", context: "site menu" }),
  "Investor": msg({ message: "Investor", context: "site menu" }),
  "Capital Contributor": msg({ message: "Capital Contributor", context: "site menu" }),
  "Village Steward": msg({ message: "Village Steward", context: "site menu" }),
  "Co-Creator": msg({ message: "Co-Creator", context: "site menu" }),
  "Resident": msg({ message: "Resident", context: "site menu" }),
  "Prosperity Creator": msg({ message: "Prosperity Creator", context: "site menu" }),
  "Business Builder": msg({ message: "Business Builder", context: "site menu" }),
  "Business Opportunities": msg({ message: "Business Opportunities", context: "site menu" }),
  "Plan a Visit": msg({ message: "Plan a Visit", context: "site menu" }),
  "Sign the Love Letter": msg({ message: "Sign the Love Letter", context: "site menu" }),
  "Work With Us": msg({ message: "Work With Us", context: "site menu" }),
  "Contribute": msg({ message: "Contribute", context: "site menu" }),
  "Crowd pooling": msg({ message: "Crowd pooling", context: "site menu" }),
  "Guides": msg({ message: "Guides", context: "site menu" }),
  "Co-Creators Guide": msg({ message: "Co-Creators Guide", context: "site menu" }),
  "Game Mechanics": msg({ message: "Game Mechanics", context: "site menu" }),
  "Village Email": msg({ message: "Village Email", context: "site menu" }),
  "Good Neighbor": msg({ message: "Good Neighbor", context: "site menu" }),
  "Training": msg({ message: "Training", context: "site menu" }),
  "Resident Rights": msg({ message: "Resident Rights", context: "site menu" }),
  "Steward Rights": msg({ message: "Steward Rights", context: "site menu" }),
  "Leaving Well": msg({ message: "Leaving Well", context: "site menu" }),
  "Rights and agreements": msg({ message: "Rights and agreements", context: "site menu" }),
  "Good Neighbor Criteria": msg({ message: "Good Neighbor Criteria", context: "site menu" }),
  "About": msg({ message: "About", context: "site menu" }),
  "How We Create": msg({ message: "How We Create", context: "site menu" }),
  "How we work together": msg({ message: "How we work together", context: "site menu" }),
  "Master Plan": msg({ message: "Master Plan", context: "site menu" }),
  "Our Team": msg({ message: "Our Team", context: "site menu" }),
  "Village Network": msg({ message: "Village Network", context: "site menu" }),
  "My Profile": msg({ message: "My Profile", context: "site menu" }),
  "Journal": msg({ message: "Journal", context: "site menu" }),
  "Protocols": msg({ message: "Protocols", context: "site menu" }),
  "My tasks": msg({ message: "My tasks", context: "site menu" }),
  "Badges": msg({ message: "Badges", context: "site menu" }),
  "Cash Budget": msg({ message: "Cash Budget", context: "site menu" }),
  "Village Settings": msg({ message: "Village Settings", context: "site menu" }),
  "Treasury": msg({ message: "Treasury", context: "site menu" }),
  // The menu by membership (27 Nov 2026): two new entries, and the folders inside the groups (config/navNest.ts).
  "Open Roles": msg({ message: "Open Roles", context: "site menu" }),
  "What's happening now": msg({ message: "What's happening now", context: "site menu: Govern's own page, its Now view" }),
  // The season, one page since the season fold (#1862).
  "Season": msg({ message: "Season", context: "site menu" }),
  // What each group holds, the eyebrow over its dropdown (NavGroup.holds, the menu's QA, round 2).
  "The place": msg({ message: "The place", context: "site menu: what a group holds, over its dropdown" }),
  "The people and the story": msg({ message: "The people and the story", context: "site menu: what a group holds, over its dropdown" }),
  "Ways in": msg({ message: "Ways in", context: "site menu: what a group holds, over its dropdown" }),
  "How we're run": msg({ message: "How we're run", context: "site menu: what a group holds, over its dropdown" }),
  "Waiting on you": msg({ message: "Waiting on you", context: "site menu: what waits on the member to decide" }),
  "Choose your path": msg({ message: "Choose your path", context: "site menu: a folder" }),
  "Build with us": msg({ message: "Build with us", context: "site menu: a folder" }),
  "Fund the village": msg({ message: "Fund the village", context: "site menu: a folder" }),
  "Become a partner": msg({ message: "Become a partner", context: "site menu" }),
  "Propose a quest": msg({ message: "Propose a quest", context: "site menu" }),
  "Review": msg({ message: "Review", context: "site menu: the admin's review page" }),
  "Places and homes": msg({ message: "Places and homes", context: "site menu: a folder" }),
  "Gatherings": msg({ message: "Gatherings", context: "site menu: a folder" }),
  "Welcoming": msg({ message: "Welcoming", context: "site menu: a folder" }),
  "This season": msg({ message: "This season", context: "site menu: a folder" }),
  "Our story": msg({ message: "Our story", context: "site menu: a folder" }),
  "How we work": msg({ message: "How we work", context: "site menu: a folder" }),
  "Your things": msg({ message: "Your things", context: "site menu: a folder" }),
  "Running the village": msg({ message: "Running the village", context: "site menu: a folder" }),
  // Round 2 (the lead, 27 Nov 2026): Govern, and the folders and names it brought.
  "Govern": msg({ message: "Govern", context: "site menu: the group for how the village is run" }),
  "Maps": msg({ message: "Maps", context: "site menu: a folder" }),
  "Decide": msg({ message: "Decide", context: "site menu: a folder" }),
  "Conversations": msg({ message: "Conversations", context: "site menu: a folder" }),
  "Village Health": msg({ message: "Village Health", context: "site menu" }),
  "Village Tools": msg({ message: "Village Tools", context: "site menu" }),
  "How roles are going": msg({ message: "How roles are going", context: "site menu" }),
  "Treasury desk": msg({ message: "Treasury desk", context: "site menu: the treasurer's mint and pay queues" }),
};

/** Reads a word's own English when no language has been started (a test, or a read before the app starts one). */
const ENGLISH = setupI18n({ locale: "en", messages: { en: {} } });

/** A menu word in the reader's language; a word this file does not know is drawn as it is. */
export function navWord(label: string, i18n: I18n = appI18n): string {
  const d = NAV_WORDS[label];
  if (!d) return label;
  return (i18n.locale ? i18n : ENGLISH)._(d);
}

/**
 * The village's name for an entry when it gave one, else the platform's word in the reader's language. The
 * server fills a story page's menu name with the platform's English default (site.menu), so a name that only
 * repeats that default is the platform's word, not the village's, and is translated like any other.
 */
export function ownWord(own: string | undefined, platform: string, i18n: I18n = appI18n): string {
  const mine = own?.trim();
  return mine && mine !== platform ? mine : navWord(platform, i18n);
}

/** A menu entry in the platform's own words, in the reader's language; a village's own label and subtitle are kept as written. */
export function platformWords<L extends { label: string; subtitle?: string }>(link: L, i18n: I18n = appI18n, ownSubtitle?: string, ownLabel?: string): L {
  return { ...link, label: ownWord(ownLabel, link.label, i18n), subtitle: ownSubtitle || (link.subtitle ? navWord(link.subtitle, i18n) : undefined) };
}

/** A dropdown's element id from its drawn name, which is the reader's own word ("Acerca de"): no space, no accent. */
export function navMenuId(label: string): string {
  return `nav-menu-${label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}
