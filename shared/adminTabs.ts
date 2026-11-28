/**
 * EVERY ADMIN TAB, as data the server and the browser both read.
 *
 * The table lived in client/src/components/admin/adminAreas.ts, where only the
 * menu could read it. It moved here unchanged so the registry of acts
 * (shared/adminActs.ts) can give every tab a page entry by derivation: a tab
 * added to this list is found by search the same day, with no second list to
 * keep in step. The client file re-exports it, so every caller reads the same
 * rows as before.
 *
 * `area` is the six plain areas the menu draws today. `place` is where the tab
 * lives on the garden's grounds (the Fire, the Hall, the Gate and the rest).
 * Both are words about where a thing is shown. Neither decides who may open it.
 *
 * ADDING A TAB: one row here, with its area and its place, and one row in the
 * menu (client/src/components/admin/adminNavGroups.ts). A tab that needs a
 * module on names it in TAB_MODULE (shared/adminTabModules.ts).
 *
 * Pure: no I/O, no clock.
 */

export type AreaId = "today" | "inbox" | "people" | "village" | "events" | "connections";

/** The twelve places of the garden. The first ten are grounds a person walks to; Scarlet and the frame hold the rest. */
export const ADMIN_PLACES = ["fire", "hall", "gate", "library", "greenhouse", "store", "tower", "spring", "stage", "ceiba", "scarlet", "frame"] as const;
export type AdminPlace = (typeof ADMIN_PLACES)[number];

export interface AdminTabEntry {
  key: string;
  area: AreaId;
  name: string;
  help: string;
  /** Where this tab lives on the garden's grounds. */
  place: AdminPlace;
  /** An old address that opens another tab's page. Search lists the page once, under the tab named here. */
  sameAs?: string;
}

const entry = (key: string, area: AreaId, place: AdminPlace, name: string, help: string, sameAs?: string): AdminTabEntry => ({ key, area, name, help, place, ...(sameAs ? { sameAs } : {}) });

export const ADMIN_TABS: AdminTabEntry[] = [
  entry("home", "today", "fire", "Home", "What needs you now, and the six areas."),
  entry("submissions", "inbox", "hall", "All forms", "Requests people sent, such as a visit or a wish to join."),
  entry("portal-visitors", "inbox", "gate", "Portal visitors", "Everyone who entered the portal, and who asked for updates."),
  entry("feedback", "inbox", "hall", "Feedback", "Notes people sent about the village."),
  entry("quest-claims", "inbox", "hall", "Quest claims", "Finished quests waiting for a witness."),
  entry("forum-moderation", "inbox", "hall", "Moderation", "Forum posts a member asked you to look at."),
  entry("message-reports", "inbox", "hall", "Message reports", "Messages a member asked you to look at."),
  entry("drafts", "inbox", "hall", "Her drafts", "Drafts waiting for a person to send or drop."),
  entry("brain", "inbox", "scarlet", "Village brain", "What the assistant has learned for this village."),
  entry("failures", "inbox", "spring", "What is failing", "Work that did not go through, and what to do next."),
  entry("players", "people", "gate", "Players", "Everyone in the village game, and how far they have come."),
  entry("game-roles", "people", "gate", "Power groups", "Groups of permissions you can hand to people."),
  entry("org-chart", "people", "gate", "Org chart", "The circles and the roles on the chart."),
  entry("compare", "people", "hall", "Compare proposals", "Role applications and quest ideas side by side, up to four of one category."),
  entry("role-discover", "people", "gate", "Role discovery", "Which characters a Human Design type or a Gene Keys line points toward."),
  entry("art-library", "people", "gate", "Art library", "The painted animals and plants on every role card, and which role shows each one."),
  entry("handover", "people", "gate", "The handover", "Who receives the village when stewards change."),
  entry("governance-weights", "people", "gate", "Voting weights", "How much each voice counts in a vote."),
  entry("team", "people", "library", "Team page", "The public cards for the people who show the village."),
  entry("setup", "village", "library", "Make this yours", "The village name, colours and pictures."),
  entry("pages", "village", "library", "Pages", "The words on the public pages."),
  entry("paths-stages", "village", "library", "Paths and stages", "The paths a newcomer can take, and the stages they climb."),
  entry("legal", "village", "library", "Legal notices", "The legal words this village publishes."),
  entry("covenant", "village", "library", "Covenant", "The two covenant paragraphs that are this village's own."),
  entry("money", "village", "library", "Money claims", "The money figures this village publishes."),
  entry("confidentiality", "village", "library", "Confidentiality agreement", "The words and the PDF members align with before private records and before a role starts."),
  entry("work-with-us", "village", "library", "Work with us", "The roles the village is asking for help with."),
  entry("faqs", "village", "library", "FAQs", "Answers people can read before they ask."),
  entry("milestones", "village", "stage", "Build progress", "What has been built, and what is still ahead."),
  entry("visit-config", "village", "library", "Visit program", "How a visit works, in this village's words."),
  entry("investor-summary", "village", "library", "Investor summary", "The short page for people looking at the venture."),
  entry("modules", "village", "greenhouse", "Module library", "The extra parts of the village, and which ones are on."),
  entry("needs-admin", "village", "greenhouse", "What this village is for", "The needs the village has taken on."),
  entry("variables", "village", "greenhouse", "Game mechanics", "The dials that change how the village behaves."),
  entry("season", "village", "greenhouse", "Season", "The season that is running, and the next one."),
  entry("seasons-patterns", "village", "greenhouse", "Season shapes", "The pattern of seasons the village repeats."),
  entry("circles-map", "village", "greenhouse", "Circles and map", "The map of circles and the land."),
  entry("land", "village", "greenhouse", "Where the land is", "The place this village sits."),
  entry("housing", "village", "greenhouse", "Housing and reservations", "Homes and the reservations on them."),
  entry("quests-admin", "village", "greenhouse", "Quests", "The quests people can take."),
  entry("tools-admin", "village", "greenhouse", "Tools", "Tools the village lends or lists."),
  entry("library-admin", "village", "greenhouse", "Library", "The material library."),
  entry("badges-admin", "village", "greenhouse", "Badges", "Badges people can earn."),
  entry("stays-admin", "village", "greenhouse", "Stays and payments", "Stays, and the payments that go with them."),
  entry("exchange-admin", "village", "greenhouse", "Exchange", "The exchange, if this village has turned it on."),
  entry("crowdpool-admin", "village", "greenhouse", "Crowdpool", "The pool people can contribute to."),
  entry("calls-admin", "village", "greenhouse", "Calls", "Scheduled calls."),
  entry("intents-admin", "village", "greenhouse", "Introductions", "Introductions between people."),
  entry("health-admin", "village", "greenhouse", "Village health", "A reading of how the village is doing."),
  entry("tokens", "village", "store", "Tokens", "The tokens this village uses."),
  entry("ledger", "village", "store", "Ledger", "Where value moved."),
  entry("cash-payouts", "village", "store", "Cash to pay out", "Cash the village owes, and what has been paid."),
  entry("pricing-desk", "village", "store", "Pricing desk", "Every open quest beside the engine's suggestion, priced by the Treasurer."),
  entry("budgets", "village", "store", "Cash budget", "The cash the village plans to pay this moon, and what is left."),
  entry("cycles", "village", "store", "Cycle close", "Closing a cycle, which is a human act."),
  entry("products", "village", "store", "Payments", "Products and the payments around them."),
  entry("resources-admin", "village", "store", "How resources flow", "How resources move through the village."),
  entry("exits-admin", "village", "store", "Departures", "What happens when someone leaves."),
  entry("settings", "village", "store", "Settings", "Settings that are not on another page."),
  entry("training-modules", "village", "library", "Training modules", "Training a member can open."),
  entry("investor-vault", "village", "library", "Investor vault", "Files kept for investors."),
  entry("uploaded-files", "village", "library", "Uploaded files", "Files people have uploaded."),
  entry("events-admin", "events", "tower", "Calendar", "Events on the village calendar."),
  entry("comms-overview", "events", "tower", "Overview", "A short reading of the village mail."),
  entry("comms-journeys", "events", "tower", "Journeys", "The series of messages a person can receive."),
  entry("comms-words", "events", "tower", "Words", "The words those messages use."),
  entry("comms-people", "events", "tower", "People", "Who is on a journey."),
  entry("comms-letters", "events", "tower", "Letters", "Letters you can send."),
  entry("comms-sent", "events", "tower", "Sent mail", "Mail that has already gone out."),
  entry("comms-settings", "events", "tower", "Mail settings", "How the village sends mail."),
  entry("email-settings", "events", "tower", "Mail settings", "The old address for mail settings. It opens the same page.", "comms-settings"),
  entry("integrations", "connections", "spring", "Integrations", "Outside services, and whether each one is connected."),
];

const BY_KEY = new Map(ADMIN_TABS.map((tab) => [tab.key, tab]));

export function tabEntry(key: string): AdminTabEntry | undefined {
  return BY_KEY.get(key);
}

export function tabsInArea(area: AreaId): AdminTabEntry[] {
  return ADMIN_TABS.filter((tab) => tab.area === area);
}
