/**
 * FIND ANYTHING's page table: every page a person might look for, and what each one needs before a reader is
 * offered it. Only the server reads this file (server/routes/search.ts); the browser is handed its own list, so
 * the table and the tab names it imports never ride in a client chunk. The rules are in shared/findAnything.ts.
 *
 * A page's name is its browser tab's name (shared/pageTitles.ts, `pageTitleFor`), so search, the tab and a screen
 * reader all say the same thing. The audiences mirror the menu (client/src/config/nav.ts): "never" for newcomers
 * there is "member" here.
 *
 * Pure: no I/O, no clock.
 */
import type { Capability } from "./capabilities";
import { pageTitleFor } from "./pageTitles";
import type { FindEntry } from "./findAnything";

/** Who a page is for. "visitor" is only somebody signed out (signing in); "member" is somebody the village admitted. */
export type FindAudience = "everyone" | "visitor" | "signedIn" | "member" | "admin";

export interface FindPage {
  path: string;
  audience: FindAudience;
  /** The module it needs on for this reader (shared/modules.ts). */
  module?: string;
  /** Shown only while this module is off (the plain Circles page where the map runs none). */
  unlessModule?: string;
  /** One of the story pages (shared/brochure.ts): shown only while this village serves it. */
  brochure?: string;
  /** Any one of these powers opens it (the treasury desk). */
  anyOf?: readonly Capability[];
  /** The name, where the tab's name is the whole page's and this is a chapter of it. */
  title?: string;
  help: string;
  synonyms: readonly string[];
}

/*
 * Every page a person might look for, grouped the way the menu groups them. A page that is not here is still
 * reached by the menu; one added here is found the same day.
 */
export const FIND_PAGES: readonly FindPage[] = [
  // Village: the place.
  { path: "/map", audience: "everyone", module: "map", help: "The village's living map: its places and what is happening where.", synonyms: ["map", "land", "where", "site plan"] },
  { path: "/hidden-map", audience: "member", module: "hidden-map", help: "The pins and walks only members see.", synonyms: ["secret map", "pins", "walks"] },
  { path: "/quests", audience: "everyone", help: "Work the village needs done, and what each quest pays.", synonyms: ["tasks", "jobs", "work", "missions", "bounties", "help out"] },
  { path: "/housing", audience: "everyone", brochure: "/housing", help: "Homes in the village and how to live here.", synonyms: ["homes", "house", "live here", "rent", "buy"] },
  { path: "/stay", audience: "everyone", module: "stays", help: "Book a stay in the village.", synonyms: ["book", "lodging", "accommodation", "room", "overnight", "stays"] },
  { path: "/rights#good-neighbor", audience: "everyone", brochure: "/good-neighbor", title: "Good Neighbor Criteria", help: "What the village asks of everyone who lives beside it.", synonyms: ["good neighbour", "neighbor", "criteria"] },
  { path: "/places", audience: "everyone", module: "map", help: "The village's places, with their photos.", synonyms: ["photos", "photographs", "buildings", "spots"] },
  { path: "/library", audience: "member", module: "library", help: "The material library: borrow and lend things.", synonyms: ["borrow", "lend", "tools", "materials"] },
  { path: "/village-health", audience: "member", module: "health", help: "How the village is doing, in numbers.", synonyms: ["health", "metrics", "dashboard", "numbers"] },
  // Community: the people and the story.
  { path: "/team", audience: "everyone", brochure: "/team", help: "The people behind the village.", synonyms: ["our team", "founders", "who"] },
  { path: "/master-plan", audience: "everyone", brochure: "/master-plan", help: "The plan for the land and what will be built.", synonyms: ["plan", "vision", "build"] },
  { path: "/love-letter", audience: "everyone", brochure: "/love-letter", help: "The letter every member signs.", synonyms: ["love letter", "sign", "membership letter", "agreement"] },
  { path: "/network", audience: "everyone", module: "network", help: "Other villages this one is linked with.", synonyms: ["other villages", "network"] },
  { path: "/feed", audience: "everyone", module: "feed", help: "The village's news and posts.", synonyms: ["news", "posts", "updates"] },
  { path: "/forum", audience: "everyone", module: "forum", help: "Conversations and questions.", synonyms: ["discuss", "talk", "threads", "questions", "board", "talk to members"] },
  { path: "/tools", audience: "member", module: "tools", help: "Where the village talks and meets outside this site.", synonyms: ["village tools", "chat", "apps", "group chat"] },
  { path: "/feedback", audience: "everyone", help: "Tell the village what is working and what could be better.", synonyms: ["share feedback", "bug", "report a problem", "suggestion", "idea"] },
  { path: "/gratitude", audience: "everyone", help: "Thank someone, and read who thanked whom.", synonyms: ["thanks", "thank you", "appreciation", "recognition", "pay someone"] },
  { path: "/events", audience: "everyone", module: "events", help: "Gatherings on the village calendar.", synonyms: ["calendar", "gatherings", "meetups", "dates", "events"] },
  { path: "/sessions", audience: "member", module: "sessions", help: "The circle calls you take part in.", synonyms: ["calls", "meetings", "video", "live"] },
  { path: "/seasonal-festivals", audience: "everyone", help: "The festivals the village keeps through the year.", synonyms: ["festival", "celebration", "solstice", "equinox"] },
  { path: "/rites", audience: "member", module: "rites", help: "Begin a rite, witness one, or welcome a newcomer.", synonyms: ["ritual", "ceremony", "welcome"] },
  { path: "/introductions", audience: "member", module: "introductions", help: "Meet the members you have not met yet.", synonyms: ["meet", "introduce", "matches"] },
  // Join: ways in.
  { path: "/investor", audience: "everyone", brochure: "/investor", help: "The path for a capital contributor.", synonyms: ["invest", "investor", "capital", "contributor"] },
  { path: "/steward", audience: "everyone", brochure: "/steward", help: "The path for a village steward.", synonyms: ["steward", "co-creator"] },
  { path: "/resident", audience: "everyone", brochure: "/resident", help: "The path for a resident.", synonyms: ["resident", "live here", "move here"] },
  { path: "/prosperity", audience: "everyone", brochure: "/prosperity", help: "The path for a business builder.", synonyms: ["business", "prosperity creator", "entrepreneur"] },
  { path: "/roles", audience: "everyone", help: "The village's open roles, and how to apply for one.", synonyms: ["open roles", "jobs", "positions", "apply", "volunteer", "seats"] },
  { path: "/visit", audience: "everyone", brochure: "/visit", help: "Come and see the village.", synonyms: ["plan a visit", "tour", "come"] },
  { path: "/partner", audience: "everyone", help: "Build with the village as a partner.", synonyms: ["become a partner", "partnership", "organisation", "organization", "collaborate"] },
  { path: "/propose-quest", audience: "everyone", help: "Bring a quest the village does not have yet.", synonyms: ["propose a quest", "suggest a quest", "new quest", "idea"] },
  { path: "/opportunities", audience: "everyone", brochure: "/opportunities", help: "Businesses the village is looking for.", synonyms: ["business opportunities", "venture"] },
  { path: "/work-with-us", audience: "everyone", brochure: "/work-with-us", help: "Offer the village your work.", synonyms: ["work with us", "offer", "contribute work"] },
  { path: "/contribute", audience: "everyone", module: "commerce", help: "Put money into the village.", synonyms: ["donate", "give", "fund", "money", "support", "donate money"] },
  { path: "/campaigns", audience: "everyone", module: "crowdpool", help: "Pool money with others for something the village needs.", synonyms: ["crowd pooling", "crowdfund", "fundraise", "pool", "donate money"] },
  { path: "/request-membership", audience: "everyone", help: "Ask the village to let you in.", synonyms: ["join", "membership", "become a member", "sign up", "apply to join"] },
  { path: "/login", audience: "visitor", help: "Sign in to your account.", synonyms: ["sign in", "log in", "login", "password", "account"] },
  // Govern: how the village is run.
  { path: "/governance", audience: "everyone", help: "What the village is deciding now, and what waits on you.", synonyms: ["governance", "what's happening now", "now", "happening"] },
  { path: "/governance/decisions", audience: "member", module: "governance", help: "Votes and decisions, open and closed.", synonyms: ["decisions", "votes", "ballots", "decide", "change requests", "vote", "voting"] },
  { path: "/governance/treasury", audience: "member", help: "The cash budget, the pay desks and quest prices.", synonyms: ["treasury", "budget", "money", "spending", "finance", "cash"] },
  { path: "/propose", audience: "member", module: "governance", help: "Start a proposal for the village to decide.", synonyms: ["make a proposal", "proposal", "suggest a change"] },
  { path: "/map/circles", audience: "everyone", module: "map", help: "The village's circles and the roles in each.", synonyms: ["circles", "org chart", "structure", "teams"] },
  { path: "/circles", audience: "everyone", unlessModule: "map", help: "The village's circles and the roles in each.", synonyms: ["circles", "org chart", "structure", "teams"] },
  { path: "/powers", audience: "everyone", help: "What the village looks after, and who holds each power.", synonyms: ["what we look after", "powers", "who decides", "responsibilities"] },
  { path: "/circles#role-measures", audience: "member", title: "How roles are going", help: "Each circle's applications answered and roles kept.", synonyms: ["role measures", "measures"] },
  { path: "/season", audience: "member", help: "The season: its plans, joining it and what we aligned on.", synonyms: ["season plans", "join the season", "aligned", "moon", "plan"] },
  { path: "/funding-rounds", audience: "member", module: "funding-rounds", help: "The season's funding rounds.", synonyms: ["funding", "rounds", "grants"] },
  { path: "/co-creators-guide", audience: "everyone", brochure: "/co-creators-guide", help: "The guide for everyone building the village.", synonyms: ["guide", "handbook", "co-creator"] },
  { path: "/training", audience: "everyone", help: "Training for stewards and residents.", synonyms: ["learn", "course", "lessons", "onboarding"] },
  { path: "/rights", audience: "everyone", help: "Resident rights, steward rights and what the village agrees.", synonyms: ["rights", "agreements", "rules", "resident rights", "steward rights", "village rules"] },
  { path: "/rights#leaving-well", audience: "everyone", title: "Leaving well", help: "What happens when someone leaves the village.", synonyms: ["leave", "leaving", "exit", "depart", "exit policy"] },
  { path: "/governance/how", audience: "everyone", help: "How the village works and decides, together.", synonyms: ["how we work", "process", "co-create", "how we co-create", "voting"] },
  { path: "/governance/how#game-mechanics", audience: "member", title: "Game Mechanics", help: "The rules the village's game runs on.", synonyms: ["game mechanics", "points", "tokens", "rules of the game"] },
  { path: "/how-we-create", audience: "everyone", brochure: "/how-we-create", help: "How the village creates together.", synonyms: ["how we create"] },
  { path: "/village-email", audience: "member", module: "comms", help: "Every email the village sends, and when.", synonyms: ["village email", "emails", "newsletter", "mail"] },
  { path: "/modules", audience: "everyone", help: "The parts of the village, and which are on.", synonyms: ["module library", "modules", "features"] },
  // Yours.
  { path: "/profile", audience: "signedIn", help: "Your own page: your paths, your work and your things.", synonyms: ["my profile", "me", "account", "my page"] },
  { path: "/profile/settings", audience: "signedIn", title: "Settings", help: "Your email, password, language and notices.", synonyms: ["settings", "password", "email", "notifications", "language", "preferences", "change password"] },
  { path: "/messages", audience: "member", module: "messaging", help: "Your messages and the shared work chats.", synonyms: ["inbox", "chat", "direct message", "dm"] },
  { path: "/profile#my-tasks", audience: "signedIn", module: "sessions", title: "My tasks", help: "The tasks waiting on you.", synonyms: ["tasks", "to do", "task board"] },
  { path: "/governance/work", audience: "member", title: "Waiting on you", help: "What waits on you to decide or approve.", synonyms: ["your work", "approvals", "approve", "to do"] },
  { path: "/wallet", audience: "member", module: "exchange", help: "Your balances and what you have received.", synonyms: ["balance", "tokens", "money", "credits"] },
  { path: "/journal", audience: "signedIn", module: "journal", help: "Your own journal.", synonyms: ["diary", "notes", "write"] },
  { path: "/protocols", audience: "signedIn", module: "protocols", help: "Your daily protocols.", synonyms: ["habits", "practice", "routine"] },
  { path: "/badges", audience: "signedIn", module: "badges", help: "Badges and skills you can earn.", synonyms: ["skills", "badge"] },
  { path: "/journey-to-launch", audience: "member", title: "Launch plan", help: "Everything still to do before the village launches.", synonyms: ["launch", "go live", "checklist"] },
  { path: "/governance/treasury#desks", audience: "signedIn", anyOf: ["token.mint", "cash.pay", "moon.approve_alone"], title: "Treasury desk", help: "End of Moon pay, cash to pay out and the mint.", synonyms: ["treasurer", "mint", "pay out", "end of moon"] },
  { path: "/project-history", audience: "admin", brochure: "/project-history", help: "The village's command centre.", synonyms: ["command centre", "command center", "history"] },
  { path: "/admin/review", audience: "admin", title: "Review", help: "Everything waiting for an admin to review.", synonyms: ["review", "queue"] },
  { path: "/admin", audience: "admin", help: "Every setting of the village.", synonyms: ["village settings", "admin", "settings", "configure"] },
];

/** A page as an entry, named the way its tab is. `commitment` is the village's own word for what a member signs. */
export function pageEntry(p: FindPage, words: { commitment?: string } = {}): FindEntry {
  const bare = p.path.split("#")[0] || "/";
  return {
    id: `page:${p.path}`,
    kind: "page",
    title: p.title || pageTitleFor(bare, words) || p.path,
    help: p.help,
    path: p.path,
    synonyms: p.synonyms,
  };
}

/** What one reader is, as the page rules need it. Every field is the server's own answer. */
export interface FindReader {
  signedIn: boolean;
  member: boolean;
  admin: boolean;
}

/**
 * Whether one page passes this reader's door, BEFORE the module, story and power questions the server asks next.
 * An admin is a member; a member is signed in.
 */
export function audienceAdmits(audience: FindAudience, r: FindReader): boolean {
  switch (audience) {
    case "everyone":
      return true;
    case "visitor":
      return !r.signedIn;
    case "signedIn":
      return r.signedIn;
    case "member":
      return r.member || r.admin;
    case "admin":
      return r.admin;
  }
}

/**
 * A module a reader may use at its lifecycle (`requireModule`, server/lib/modules.ts): public for everyone, members
 * for anyone signed in, preview for an admin, off for nobody. A core module always reads public.
 */
export function lifecycleAdmits(lifecycle: string, r: FindReader): boolean {
  if (lifecycle === "public") return true;
  if (lifecycle === "members") return r.signedIn;
  if (lifecycle === "preview") return r.admin;
  return false;
}
