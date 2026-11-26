/**
 * THE MODULE LIBRARY'S WORDS, in the reader's language (the lead, 26 Nov 2026: the whole site in Spanish).
 *
 * The server sends every module's name, description and card copy in English (shared/modules.ts,
 * shared/moduleCatalog.ts), and it does not translate. So the words are translated HERE, keyed by the
 * module's id and the shelf's id, and `localizeCatalog` swaps them in as the catalog arrives
 * (`useCatalog`, catalog.ts). An id this file does not know keeps the server's English.
 *
 * Each message's English is the server's English, word for word, so a language with no entry yet reads
 * exactly as before. client/src/components/modules/moduleWords.test.ts derives the ids and the English from
 * the shared definitions and fails on a module, a shelf or a sentence this file lacks or has stale.
 *
 * Only the library's two pages import this, so its words ride their lazy chunks.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import type { CatalogPayload } from "./catalog";

export interface ModuleWordSet {
  name: MessageDescriptor;
  description: MessageDescriptor;
  promise: MessageDescriptor;
  benefits: readonly MessageDescriptor[];
  forWhom: MessageDescriptor;
  setupSummary: MessageDescriptor;
  dataSummary: MessageDescriptor;
}

export const MODULE_SHELF_WORDS: Readonly<Record<string, { label: MessageDescriptor; gloss: MessageDescriptor }>> = {
  "coordinate": {
    label: msg({ message: "Coordinate", context: "module shelf coordinate, label" }),
    gloss: msg({ message: "Plan the work and the days: quests, the calendar, calls, tools.", context: "module shelf coordinate, gloss" }),
  },
  "recognise": {
    label: msg({ message: "Recognise", context: "module shelf recognise, label" }),
    gloss: msg({ message: "See people: gratitude, the path from guest to co-creator, badges.", context: "module shelf recognise, gloss" }), // village-ok: the server's own words from shared/, mirrored here to translate them
  },
  "host-and-earn": {
    label: msg({ message: "Host and earn", context: "module shelf host-and-earn, label" }),
    gloss: msg({ message: "Value moving with care: stays, the shelves, the exchange, payments.", context: "module shelf host-and-earn, gloss" }),
  },
  "know-and-decide": {
    label: msg({ message: "Know and decide", context: "module shelf know-and-decide, label" }),
    gloss: msg({ message: "How the village understands itself: conversations, decisions, power, health.", context: "module shelf know-and-decide, gloss" }),
  },
  "connect": {
    label: msg({ message: "Connect", context: "module shelf connect, label" }),
    gloss: msg({ message: "People finding people: profiles, messages, the feed, other villages.", context: "module shelf connect, gloss" }),
  },
};

export const MODULE_WORDS: Readonly<Record<string, ModuleWordSet>> = {
  "quests": {
    name: msg({ message: "Quests", context: "module quests, name" }),
    description: msg({ message: "The contribution board: post work, claim it, submit it, consent to release recognition.", context: "module quests, description" }),
    promise: msg({ message: "Work you can pick up and finish: the board where contribution starts.", context: "module quests, promise" }),
    benefits: [
      msg({ message: "Post work as quests anyone can claim", context: "module quests, benefit 1" }),
      msg({ message: "Submission and consent keep the release of recognition honest", context: "module quests, benefit 2" }),
      msg({ message: "Crews form around the bigger quests", context: "module quests, benefit 3" }),
      msg({ message: "Finished work feeds progression, so contribution moves people forward", context: "module quests, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages that run on visible, shared work.", context: "module quests, for whom" }),
    setupSummary: msg({ message: "Nothing to set up. Core, on from the first day.", context: "module quests, setup" }),
    dataSummary: msg({ message: "Quests, claims and submissions, tied to the named members who made them.", context: "module quests, data" }),
  },
  "gratitude": {
    name: msg({ message: "Gratitude", context: "module gratitude, name" }), // village-ok: the server's own words from shared/, mirrored here to translate them
    description: msg({ message: "Recognition sends, lunar cycles, and the value pool distributed at each close.", context: "module gratitude, description" }), // village-ok: the server's own words from shared/, mirrored here to translate them
    promise: msg({ message: "Appreciation that carries value, cycle by lunar cycle.", context: "module gratitude, promise" }), // village-ok: the server's own words from shared/, mirrored here to translate them
    benefits: [
      msg({ message: "Send gratitude with a message, from your own cycle budget", context: "module gratitude, benefit 1" }), // village-ok: the server's own words from shared/, mirrored here to translate them
      msg({ message: "Lunar cycles close and share out the value pool", context: "module gratitude, benefit 2" }), // village-ok: the server's own words from shared/, mirrored here to translate them
      msg({ message: "A public wall shows appreciation moving through the village", context: "module gratitude, benefit 3" }), // village-ok: the server's own words from shared/, mirrored here to translate them
      msg({ message: "Every send lands in the recipient's own ledger", context: "module gratitude, benefit 4" }), // village-ok: the server's own words from shared/, mirrored here to translate them
    ],
    forWhom: msg({ message: "Villages that want recognition to be a habit, and to count.", context: "module gratitude, for whom" }), // village-ok: the server's own words from shared/, mirrored here to translate them
    setupSummary: msg({ message: "Nothing to set up. Core, on from the first day.", context: "module gratitude, setup" }), // village-ok: the server's own words from shared/, mirrored here to translate them
    dataSummary: msg({ message: "Who appreciated whom, when, and the balances that followed.", context: "module gratitude, data" }), // village-ok: the server's own words from shared/, mirrored here to translate them
  },
  "progression": {
    name: msg({ message: "Stages & Roles", context: "module progression, name" }),
    description: msg({ message: "The path from guest to co-creator: stages, capabilities, and appointed roles.", context: "module progression, description" }),
    promise: msg({ message: "The path from guest to co-creator, walked in the open.", context: "module progression, promise" }),
    benefits: [
      msg({ message: "Stages mark how deep someone is in", context: "module progression, benefit 1" }),
      msg({ message: "Capabilities unlock as people grow", context: "module progression, benefit 2" }),
      msg({ message: "Appointed roles carry real permissions", context: "module progression, benefit 3" }),
      msg({ message: "Proposals open, get decided, and stay on the record", context: "module progression, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages where trust grows in steps and everyone can see the stairs.", context: "module progression, for whom" }),
    setupSummary: msg({ message: "Nothing to set up. Core, on from the first day.", context: "module progression, setup" }),
    dataSummary: msg({ message: "Each member's stage, roles and capability grants.", context: "module progression, data" }),
  },
  "profiles": {
    name: msg({ message: "Profiles", context: "module profiles, name" }),
    description: msg({ message: "Member identity: handles, journeys, balances, and each member's own ledger.", context: "module profiles, description" }),
    promise: msg({ message: "Who is here: handles, journeys, and each member's own ledger.", context: "module profiles, promise" }),
    benefits: [
      msg({ message: "A profile for every member, with a handle of their own", context: "module profiles, benefit 1" }),
      msg({ message: "Journeys record how someone arrived and where they are headed", context: "module profiles, benefit 2" }),
      msg({ message: "Balances and a personal ledger in one place", context: "module profiles, benefit 3" }),
      msg({ message: "Members choose what their profile shows", context: "module profiles, benefit 4" }),
    ],
    forWhom: msg({ message: "Every village. People have to be findable to be met.", context: "module profiles, for whom" }),
    setupSummary: msg({ message: "Nothing to set up. Core, on from the first day.", context: "module profiles, setup" }),
    dataSummary: msg({ message: "Names, handles, journeys and balances: the most personal data the platform holds.", context: "module profiles, data" }),
  },
  "map": {
    name: msg({ message: "How Power Is Held", context: "module map, name" }),
    description: msg({ message: "The living org chart: circles, the roles that orbit them, who holds each role, which roles are open calls, plus a concierge that routes 'I want to help with X' to the right person.", context: "module map, description" }),
    promise: msg({ message: "Circles, roles and the people holding them. Includes the Living Map of the land.", context: "module map, promise" }),
    benefits: [
      msg({ message: "Nested circles show how the village organises itself", context: "module map, benefit 1" }),
      msg({ message: "Every role names its holder, or stands as an open call", context: "module map, benefit 2" }),
      msg({ message: "A concierge routes offers of help to the right person", context: "module map, benefit 3" }),
      msg({ message: "The Living Map draws the land the village stands on", context: "module map, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages ready to show where power sits and where help is needed.", context: "module map, for whom" }),
    setupSummary: msg({ message: "Draw your circles and name the first roles. Examples stand in while you do.", context: "module map, setup" }),
    dataSummary: msg({ message: "Circles, roles, holders and contact requests, tied to named members.", context: "module map, data" }),
  },
  "resources": {
    name: msg({ message: "How Resources Flow", context: "module resources, name" }),
    description: msg({ message: "A declared map of how money and resources are governed: who may spend what, with whose approval, paid from where, and where the money comes from; it describes the flow and moves nothing.", context: "module resources, description" }),
    promise: msg({ message: "Who may spend what, with whose yes, and where the money comes from, drawn on the map.", context: "module resources, promise" }),
    benefits: [
      msg({ message: "Spending rules per circle or role: what moves alone, what needs a yes", context: "module resources, benefit 1" }),
      msg({ message: "Funding sources and season budgets, declared in the village's own currency", context: "module resources, benefit 2" }),
      msg({ message: "Request approval opens a forum decision pre-filled from the rule", context: "module resources, benefit 3" }),
      msg({ message: "Declared beside measured: the ledger's own counts and totals, never a member's balance", context: "module resources, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages that want the money questions answered before anyone has to ask.", context: "module resources, for whom" }),
    setupSummary: msg({ message: "Declare one rule, one source and one budget; the map draws the rest.", context: "module resources, setup" }),
    dataSummary: msg({ message: "Rules, sources and budgets the village declares. Counts and totals from the ledger, no names.", context: "module resources, data" }),
  },
  "forum": {
    name: msg({ message: "Forum & Decisions", context: "module forum, name" }),
    description: msg({ message: "Village conversations: threads by circle-of-life category, @mentions, thread follows, community moderation, and the decision primitive, where proposals are opened and outcomes recorded.", context: "module forum, description" }),
    promise: msg({ message: "Conversations that can end in a decision.", context: "module forum, promise" }),
    benefits: [
      msg({ message: "Threads by circle-of-life category", context: "module forum, benefit 1" }),
      msg({ message: "Mentions and follows keep the right people in the room", context: "module forum, benefit 2" }),
      msg({ message: "Proposals open, get decided, and stay on the record", context: "module forum, benefit 3" }),
      msg({ message: "Community moderation with a clear report path", context: "module forum, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages that want decisions made in the open, where anyone can read how they went.", context: "module forum, for whom" }),
    setupSummary: msg({ message: "Nothing to set up. Four starter categories are seeded and yours to rename.", context: "module forum, setup" }),
    dataSummary: msg({ message: "Threads, replies and recorded decisions, under each author's name.", context: "module forum, data" }),
  },
  "feed": {
    name: msg({ message: "Village Feed", context: "module feed, name" }),
    description: msg({ message: "The everyday stream: microposts, events and announcements from one forum category, woven with the village's own milestones, where a tap of appreciation is a real gift from your cycle budget.", context: "module feed, description" }),
    promise: msg({ message: "The everyday stream: small posts, milestones, and hearts that are real gifts.", context: "module feed, promise" }),
    benefits: [
      msg({ message: "Microposts, events and announcements from one forum category", context: "module feed, benefit 1" }),
      msg({ message: "The village's own milestones weave into the stream", context: "module feed, benefit 2" }),
      msg({ message: "A heart is a real gratitude send from your cycle budget", context: "module feed, benefit 3" }), // village-ok: the server's own words from shared/, mirrored here to translate them
      msg({ message: "Light enough to read well on a phone over a slow link", context: "module feed, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages that want a daily pulse without another app.", context: "module feed, for whom" }),
    setupSummary: msg({ message: "Nothing to set up. It reads one forum category from the day it is on.", context: "module feed, setup" }),
    dataSummary: msg({ message: "Posts and hearts, under each author's name.", context: "module feed, data" }),
  },
  "messaging": {
    name: msg({ message: "Messages", context: "module messaging, name" }),
    description: msg({ message: "Private conversations between members: one to one, or a named group carrying its own membership and read state. A direct message is the two-party case of the same thread, so every conversation in the village has one home, one report path, and one place to moderate.", context: "module messaging, description" }),
    promise: msg({ message: "Private conversations, one to one or in a named group.", context: "module messaging, promise" }),
    benefits: [
      msg({ message: "Direct messages and group threads are one thing with one home", context: "module messaging, benefit 1" }),
      msg({ message: "Read state follows you between devices", context: "module messaging, benefit 2" }),
      msg({ message: "One report path and one place to moderate", context: "module messaging, benefit 3" }),
      msg({ message: "Conversations keep their history when the module rests", context: "module messaging, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages whose coordination outgrew a group chat somewhere else.", context: "module messaging, for whom" }),
    setupSummary: msg({ message: "Nothing to set up. On means people can write to each other.", context: "module messaging, setup" }),
    dataSummary: msg({ message: "Private messages between named members: the village's most private table.", context: "module messaging, data" }),
  },
  "stays": {
    name: msg({ message: "Stays", context: "module stays, name" }),
    description: msg({ message: "Accommodation on stay credits: rooms post credit (and optional USD) prices per audience, credits are bought or earned through work-exchange quests, and one credit hosts one night. Funds-bearing: read the legal card before enabling.", context: "module stays, description" }),
    promise: msg({ message: "Rooms on stay credits, where one credit hosts one night.", context: "module stays, promise" }),
    benefits: [
      msg({ message: "Rooms carry credit and optional USD prices, per audience", context: "module stays, benefit 1" }),
      msg({ message: "Credits are bought, or earned through work-exchange quests", context: "module stays, benefit 2" }),
      msg({ message: "Autopay posts each night and warns before a balance runs low", context: "module stays, benefit 3" }),
      msg({ message: "Every movement lands on the one ledger", context: "module stays, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages hosting guests, arriving residents, or work-exchangers.", context: "module stays, for whom" }),
    setupSummary: msg({ message: "Post at least one room and a price before going live. The legal card comes first.", context: "module stays, setup" }),
    dataSummary: msg({ message: "Bookings, balances and payment records, tied to named guests and members.", context: "module stays, data" }),
  },
  "automation": {
    name: msg({ message: "Call Automation", context: "module automation, name" }),
    description: msg({ message: "The weekly call becomes assigned work, not content distribution: recordings in, transcripts kept, an AI synthesis whose every task suggestion carries a verbatim quote and timestamp (or is dropped), published to the forum by a human, with suggestions routed to the roles they name. Nothing publishes or applies itself.", context: "module automation, description" }),
    promise: msg({ message: "The weekly call becomes assigned work.", context: "module automation, promise" }),
    benefits: [
      msg({ message: "Recordings in, transcripts kept", context: "module automation, benefit 1" }),
      msg({ message: "Every suggested task carries a verbatim quote and timestamp, or is dropped", context: "module automation, benefit 2" }),
      msg({ message: "A human publishes the synthesis to the forum; nothing publishes itself", context: "module automation, benefit 3" }),
      msg({ message: "Suggestions route to the roles they name", context: "module automation, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages whose calls are rich and whose follow-through is thin.", context: "module automation, for whom" }),
    setupSummary: msg({ message: "Point it at your call recordings. It works from the first one you feed it.", context: "module automation, setup" }),
    dataSummary: msg({ message: "Recordings, transcripts and the tasks drawn from them. Voices are personal data.", context: "module automation, data" }),
  },
  "health": {
    name: msg({ message: "Village Health", context: "module health, name" }),
    description: msg({ message: "The village's vital signs: per-lunation snapshots frozen at each cycle close, the land's own regeneration ledger (trees, water, hectares: absolute counts, never leaderboards), and season goals. Snapshot COLLECTION runs from the day this ships; turn the dashboard on once a few lunations of history exist.", context: "module health, description" }), // village-ok: the server's own words from shared/, mirrored here to translate them
    promise: msg({ message: "The village's vital signs, frozen at each cycle close.", context: "module health, promise" }),
    benefits: [
      msg({ message: "Per-lunation snapshots of participation, recognition and contribution", context: "module health, benefit 1" }),
      msg({ message: "The land's own ledger: trees, water, hectares, as absolute counts", context: "module health, benefit 2" }), // village-ok: the server's own words from shared/, mirrored here to translate them
      msg({ message: "Season goals sit over the numbers as the steering layer", context: "module health, benefit 3" }),
      msg({ message: "No leaderboards, by design", context: "module health, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages that steer by evidence and want the land counted too.", context: "module health, for whom" }),
    setupSummary: msg({ message: "Snapshots collect on their own. Record the land's first measurements when ready.", context: "module health, setup" }),
    dataSummary: msg({ message: "Village-level numbers and land measurements. No personal records.", context: "module health, data" }),
  },
  "library": {
    name: msg({ message: "Material Library", context: "module library, name" }),
    description: msg({ message: "The village's shared tools and goods: donate an item and earn library credits (appraised, capped, dual-signed above a threshold), then borrow against an escrowed deposit. Credits are backed by the shelves; they never swap, and selling them for fiat is a separate caution-card opt-in (L9).", context: "module library, description" }),
    promise: msg({ message: "The village's shared tools and goods, backed by the shelves.", context: "module library, promise" }),
    benefits: [
      msg({ message: "Donate an item and earn library credits, appraised and capped", context: "module library, benefit 1" }),
      msg({ message: "Borrow against an escrowed deposit", context: "module library, benefit 2" }),
      msg({ message: "Every item carries its own history", context: "module library, benefit 3" }),
      msg({ message: "Selling credits for fiat stays off unless a village opts in past the caution card", context: "module library, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages with one good drill and eleven people who need it.", context: "module library, for whom" }),
    setupSummary: msg({ message: "Put the first items on the shelves and set your categories before going live.", context: "module library, setup" }),
    dataSummary: msg({ message: "Items, loans and credit balances, tied to named members.", context: "module library, data" }),
  },
  "badges": {
    name: msg({ message: "Badges & Skills", context: "module badges, name" }),
    description: msg({ message: "Recognition of who people are and what they can do: self-declared skills, badges earned from settled contribution, granted honors, and warning badges that suspend specific capabilities until resolved. Earned badges never ride applause metrics into permissions.", context: "module badges, description" }),
    promise: msg({ message: "Who people are and what they can do, said out loud.", context: "module badges, promise" }),
    benefits: [
      msg({ message: "Self-declared skills anyone can browse", context: "module badges, benefit 1" }),
      msg({ message: "Badges earn from settled contribution, never from applause", context: "module badges, benefit 2" }),
      msg({ message: "Honors are granted and say who granted them", context: "module badges, benefit 3" }),
      msg({ message: "Warning badges suspend specific capabilities until resolved", context: "module badges, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages that want skills findable and recognition earned.", context: "module badges, for whom" }),
    setupSummary: msg({ message: "Works from the start. Add your own badges when the defaults run thin.", context: "module badges, setup" }),
    dataSummary: msg({ message: "Skills, awards and any standing warnings, per named member.", context: "module badges, data" }),
  },
  "exchange": {
    name: msg({ message: "Exchange", context: "module exchange, name" }),
    description: msg({ message: "Buy the village's own platform tokens for fiat, out of a stocked treasury, buy-only in v1. Recognition and Hypha-governed tokens can never be listed; a token another module sells can't be listed twice. Funds-bearing: read the legal card before enabling.", context: "module exchange, description" }),
    promise: msg({ message: "The village's own tokens, bought from a stocked treasury.", context: "module exchange, promise" }),
    benefits: [
      msg({ message: "Buy-only in v1: fiat in, credits out, from treasury stock", context: "module exchange, benefit 1" }),
      msg({ message: "Posted prices with a change cap, never a market", context: "module exchange, benefit 2" }),
      msg({ message: "Recognition and Hypha-governed tokens can never be listed", context: "module exchange, benefit 3" }),
      msg({ message: "Internal trading stays off until the caution card is read and accepted", context: "module exchange, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages whose internal economy needs a front door.", context: "module exchange, for whom" }),
    setupSummary: msg({ message: "Stock the treasury and post prices before going live. The legal card comes first.", context: "module exchange, setup" }),
    dataSummary: msg({ message: "Orders and balances, tied to named members and their payment records.", context: "module exchange, data" }),
  },
  "redemption": {
    name: msg({ message: "Redemption", context: "module redemption, name" }),
    description: msg({ message: "A member asks for tokens they hold to become something real off the platform: cash, a service, a share. Asking holds the tokens, a steward confirms once the village has paid, and only then are the tokens destroyed; a refusal, a withdrawal or an expiry gives them back in full. Funds-bearing: read the legal card before enabling.", context: "module redemption, description" }),
    promise: msg({ message: "A member turns tokens they hold into something real, and the village says when it happened.", context: "module redemption, promise" }),
    benefits: [
      msg({ message: "Asking holds the tokens, so nothing is spent twice while the village pays", context: "module redemption, benefit 1" }),
      msg({ message: "Tokens are destroyed only after a steward confirms the member was paid", context: "module redemption, benefit 2" }),
      msg({ message: "A refusal, a withdrawal or an expiry gives every token back", context: "module redemption, benefit 3" }),
      msg({ message: "The confirming key can be handed to a named role", context: "module redemption, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages that will pay members back, in cash, services or shares, for tokens they earned.", context: "module redemption, for whom" }),
    setupSummary: msg({ message: "Write how a member actually gets paid, pick the currency, follow the exchange's price or set your own, and set the limits before going live. The legal card comes first.", context: "module redemption, setup" }),
    dataSummary: msg({ message: "Each member's requests, what they asked for, and who decided, tied to named members.", context: "module redemption, data" }),
  },
  "commerce": {
    name: msg({ message: "Payments & Donations", context: "module commerce, name" }),
    description: msg({ message: "Every payment your project issues or receives, as products you define: application fees, donations, deposits and down payments, waitlist seats, recurring memberships, and token packs granted from treasury stock. Rides the same verified Stripe spine as stays and the exchange; Zeffy and manual payment paths for fee-free giving. Money flows IN only, always.", context: "module commerce, description" }),
    promise: msg({ message: "Every payment your project receives, as products you define.", context: "module commerce, promise" }),
    benefits: [
      msg({ message: "Application fees, donations, deposits, memberships and token packs", context: "module commerce, benefit 1" }),
      msg({ message: "Rides the same verified Stripe spine as stays and the exchange", context: "module commerce, benefit 2" }),
      msg({ message: "Zeffy and manual paths for fee-free giving", context: "module commerce, benefit 3" }),
      msg({ message: "Money flows in only, always", context: "module commerce, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages taking applications, gifts or memberships without a second system.", context: "module commerce, for whom" }),
    setupSummary: msg({ message: "Create your first product before going live. The legal card comes first.", context: "module commerce, setup" }),
    dataSummary: msg({ message: "Orders and payer details, held with the care payment records need.", context: "module commerce, data" }),
  },
  "network": {
    name: msg({ message: "Village Network", context: "module network, name" }),
    description: msg({ message: "Federation with other villages running this platform: publish your needs and offers to the network, and read what peer villages share. Foundations for co-hiring, shared events and resource pooling. You choose exactly which villages to listen to; publishing an item is an explicit act, and nothing about individual members is ever shared.", context: "module network, description" }),
    promise: msg({ message: "Villages sharing needs and offers, on purpose.", context: "module network, promise" }),
    benefits: [
      msg({ message: "Publish a need or an offer to the villages you choose", context: "module network, benefit 1" }),
      msg({ message: "Read what peer villages share, and nothing else", context: "module network, benefit 2" }),
      msg({ message: "Nothing about individual members ever travels", context: "module network, benefit 3" }),
      msg({ message: "Foundations for co-hiring, shared events and resource pooling", context: "module network, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages that know their neighbours and want pipes between them.", context: "module network, for whom" }),
    setupSummary: msg({ message: "Nothing to set up. Choose your peers and publish when ready.", context: "module network, setup" }),
    dataSummary: msg({ message: "What this village chose to publish. Never member data.", context: "module network, data" }),
  },
  "crowdpool": {
    name: msg({ message: "Crowdpool", context: "module crowdpool, name" }),
    description: msg({ message: "The village's hub crowdpool, told in the living map's own language: a gold funding ring, a star lantern counting toward build day, a needs shelf with claim links to the hub, partner funders, and a ledger of arrivals. The game server reads the hub's public data and shows aggregates; every pledge happens on the hub itself.", context: "module crowdpool, description" }),
    promise: msg({ message: "Watch the pool your village is gathering become walls.", context: "module crowdpool, promise" }),
    benefits: [
      msg({ message: "The hub campaign as a living page: gold ring, star lantern, needs shelf", context: "module crowdpool, benefit 1" }),
      msg({ message: "A ledger of arrivals in the map's own voice, aggregates only", context: "module crowdpool, benefit 2" }),
      msg({ message: "Every claim links to the hub page where the pledge itself happens", context: "module crowdpool, benefit 3" }),
      msg({ message: "Partner funder cards carry the hub's own cached numbers", context: "module crowdpool, benefit 4" }),
      msg({ message: "Hub outages degrade to the last snapshot with its age named", context: "module crowdpool, benefit 5" }),
    ],
    forWhom: msg({ message: "Villages raising something real through the hub's crowdpool.", context: "module crowdpool, for whom" }),
    setupSummary: msg({ message: "Link at least one hub campaign by id or slug in the module config.", context: "module crowdpool, setup" }),
    dataSummary: msg({ message: "A cached copy of hub-public campaign data. Never member data.", context: "module crowdpool, data" }),
  },
  "tools": {
    name: msg({ message: "Tools Hub", context: "module tools, name" }),
    description: msg({ message: "An audience-aware registry of the village's tools: one place to find the chat, the documents, the governance space, with a pinned card that deep-links to your Hypha DHO.", context: "module tools, description" }),
    promise: msg({ message: "One place to find every tool the village uses.", context: "module tools, promise" }),
    benefits: [
      msg({ message: "An audience-aware registry: guests, members and roles each see their own view", context: "module tools, benefit 1" }),
      msg({ message: "A pinned card deep-links your Hypha DHO", context: "module tools, benefit 2" }),
      msg({ message: "Link checking says when a tool went dark", context: "module tools, benefit 3" }),
      msg({ message: "Click counts show what is actually used", context: "module tools, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages whose tools live in eleven tabs somebody has to remember.", context: "module tools, for whom" }),
    setupSummary: msg({ message: "Add your first tools, or start from the examples.", context: "module tools, setup" }),
    dataSummary: msg({ message: "Tool links and click counts. Little here is personal.", context: "module tools, data" }),
  },
  "events": {
    name: msg({ message: "Village Calendar", context: "module events, name" }),
    description: msg({ message: "The village's calendar: gatherings with a time, a place, a capacity and an RSVP. Other surfaces read it, so the map can light the building something is happening in.", context: "module events, description" }),
    promise: msg({ message: "The village's one calendar: twelve months and thirteen moons, with equal weight.", context: "module events, promise" }),
    benefits: [
      msg({ message: "Gatherings with a time, a place, a capacity and an RSVP", context: "module events, benefit 1" }),
      msg({ message: "Village time: the lunar clock and the year wheel beside the civic date", context: "module events, benefit 2" }),
      msg({ message: "Subscribe from any calendar app with one address", context: "module events, benefit 3" }),
      msg({ message: "Other surfaces read it, so the map lights the building something is in", context: "module events, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages that live by more than one clock.", context: "module events, for whom" }),
    setupSummary: msg({ message: "Say which hemisphere the village is in, so the seasons turn the right way round, then post the first gathering when it is time.", context: "module events, setup" }),
    dataSummary: msg({ message: "Events and RSVPs, tied to named members.", context: "module events, data" }),
  },
  "introductions": {
    name: msg({ message: "Introductions", context: "module introductions, name" }),
    description: msg({ message: "Members say in plain words what they seek, confirm offers the village already knows about them, and receive a few good introductions a week. A match is a proposal with its reasoning attached; both people say yes separately before one conversation opens.", context: "module introductions, description" }),
    promise: msg({ message: "A few good introductions a week, and both people say yes first.", context: "module introductions, promise" }),
    benefits: [
      msg({ message: "Say what you seek in your own words, with a privacy tier you choose", context: "module introductions, benefit 1" }),
      msg({ message: "Offers are suggested from what the village already knows, and only you confirm them", context: "module introductions, benefit 2" }),
      msg({ message: "Every match shows its reasons, and you can correct any sentence about you", context: "module introductions, benefit 3" }),
      msg({ message: "A mutual yes opens one Messages thread; nothing is accepted for anyone", context: "module introductions, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages where the right two people have not met yet.", context: "module introductions, for whom" }),
    setupSummary: msg({ message: "Nothing to set up. It works from the first intent someone posts.", context: "module introductions, setup" }),
    dataSummary: msg({ message: "What members seek and offer, in their own words, plus who was introduced to whom.", context: "module introductions, data" }),
  },
  "journal": {
    name: msg({ message: "Journal", context: "module journal, name" }),
    description: msg({ message: "A journal for each member: morning and evening practices, a weekly pulse, a debrief after calls and an open page, with a guide that asks one question at a time and reflects back what it heard. Inside the village an entry is its author's alone; it is shared with organisational memory under code-names unless the member keeps it private. The village reads the pulse as numbers, and members who say yes can receive unsigned feedback in a weekly batch.", context: "module journal, description" }),
    promise: msg({ message: "A practice for each member, and what a village learns from it.", context: "module journal, promise" }),
    benefits: [
      msg({ message: "Morning and evening practices, light or deep, plus a debrief after calls and an open page", context: "module journal, benefit 1" }),
      msg({ message: "A weekly pulse: five numbers, the tensions in each role, the work between roles, and missed opportunities", context: "module journal, benefit 2" }),
      msg({ message: "A guide that asks one question at a time and checks it heard you right", context: "module journal, benefit 3" }),
      msg({ message: "Entries shared with organisational memory under code-names, unless a member keeps one private", context: "module journal, benefit 4" }),
      msg({ message: "Feedback that arrives unsigned, in a weekly batch, only to people who asked for it", context: "module journal, benefit 5" }),
    ],
    forWhom: msg({ message: "Teams that want to notice how people are really doing before it becomes a crisis.", context: "module journal, for whom" }),
    setupSummary: msg({ message: "Nothing to set up. The pulse shows from the first answer, and the village can raise that floor.", context: "module journal, setup" }),
    dataSummary: msg({ message: "Each member's own entries, readable by nobody else in the village, admins included, and shared with organisational memory under code-names unless marked private; pulse numbers; and feedback between members who opted in.", context: "module journal, data" }),
  },
  "gene-keys": {
    name: msg({ message: "Gene Keys", context: "module gene-keys, name" }),
    description: msg({ message: "Each member can find their Gene Keys lines and Human Design type from their birth details, read on their own device so the details never leave it. The lines show as a seal on their portrait unless they hide them, a circle sees which of the six lines it holds, and the village guide can shape suggestions to how a member works best when they say yes.", context: "module gene-keys, description" }),
    promise: msg({ message: "Each member's lines and how they work best, so roles and teams fit the people in them.", context: "module gene-keys, promise" }),
    benefits: [
      msg({ message: "Gene Keys lines and Human Design type, read from a member's birth details on their own device", context: "module gene-keys, benefit 1" }),
      msg({ message: "A seal on the portrait, two words and two numbers, which a member can hide at any time", context: "module gene-keys, benefit 2" }),
      msg({ message: "A circle sees which of the six lines it holds, and a gap becomes an invitation to hold one", context: "module gene-keys, benefit 3" }),
      msg({ message: "Role suggestions say why they fit, and the village guide shapes its offers to each member's type when they say yes", context: "module gene-keys, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages forming teams and roles that want to understand the people who fill them.", context: "module gene-keys, for whom" }),
    setupSummary: msg({ message: "Nothing to set up. Members find their lines from their character page.", context: "module gene-keys, setup" }),
    dataSummary: msg({ message: "Each member's saved result: their lines, keys and type. Birth details are never sent to the village or kept.", context: "module gene-keys, data" }),
  },
  "rites": {
    name: msg({ message: "Rites", context: "module rites, name" }),
    description: msg({ message: "The steps of passage a village names, stamped on each member's card when another member witnesses them. A spoken rite is held as a ceremony: the newcomer speaks each line from their phone, draws their own mark, and witnesses confirm on theirs, in person or on a live call. One rite can admit a member. Each newcomer is paired with a member who walks beside them, an invitation can carry its maker's own line, each member can print a lasting code that asks to join through them, and a public welcome shows the village's own words and counts with no place attached.", context: "module rites, description" }),
    promise: msg({ message: "A newcomer goes from an invitation to a member through rites the village names, each witnessed by somebody already in.", context: "module rites, promise" }),
    benefits: [
      msg({ message: "The village names its rites, and each member's card shows them waiting, then stamped when witnessed", context: "module rites, benefit 1" }),
      msg({ message: "A spoken rite is a ceremony: one line at a time on the newcomer's phone, witnesses confirming on theirs, in person or on a call", context: "module rites, benefit 2" }),
      msg({ message: "A drawn mark joins a ring of every member's mark, where no name comes first", context: "module rites, benefit 3" }),
      msg({ message: "Every newcomer walks with a member beside them, the one who invited them first", context: "module rites, benefit 4" }),
      msg({ message: "Invitations carry their maker's own line, and a printed code asks to join through the member who handed it over", context: "module rites, benefit 5" }),
    ],
    forWhom: msg({ message: "Villages where joining is a passage people do together, and somebody already in vouches for each newcomer.", context: "module rites, for whom" }),
    setupSummary: msg({ message: "Paste the village's rites document in the module card: the rites, their lines, the words and the look.", context: "module rites, setup" }),
    dataSummary: msg({ message: "Which rites each member holds and who witnessed them, each member's drawn mark, who walks beside whom, a newcomer's own line, and names left at a door that is not open yet.", context: "module rites, data" }),
  },
  "protocols": {
    name: msg({ message: "Protocols", context: "module protocols, name" }),
    description: msg({ message: "Named checklists the village walks together: opening up, closing down, anything done the same careful way each time. Any member starts a run and ticks the steps, a step can be kept for one role, and a run with a required step still open cannot be marked complete. Every run records who ticked what and when. It works on a phone with no signal and offers to add itself to the home screen.", context: "module protocols, description" }),
    promise: msg({ message: "The village's careful routines as checklists anyone can walk, even with no signal.", context: "module protocols, promise" }),
    benefits: [
      msg({ message: "Named checklists, each step required or optional, and a step can be kept for one role", context: "module protocols, benefit 1" }),
      msg({ message: "Any member starts a run and ticks the steps; a run with a required step open cannot be completed", context: "module protocols, benefit 2" }),
      msg({ message: "Every run records who ticked what and when, and several people can tick the same run", context: "module protocols, benefit 3" }),
      msg({ message: "Works on a phone with no signal, and sends what was ticked when the signal returns", context: "module protocols, benefit 4" }),
      msg({ message: "Offers to add itself to a phone's home screen", context: "module protocols, benefit 5" }),
    ],
    forWhom: msg({ message: "Villages with routines that must be done the same careful way every time.", context: "module protocols, for whom" }),
    setupSummary: msg({ message: "Write the checklists on this card, or import a file of them, then switch the module on for members.", context: "module protocols, setup" }),
    dataSummary: msg({ message: "The checklists, and for each run who ticked each step and when.", context: "module protocols, data" }),
  },
  "funding-rounds": {
    name: msg({ message: "Funding rounds", context: "module funding-rounds, name" }),
    description: msg({ message: "The village chooses together which quests the season funds, within a pot. Members share rough ideas, shape them into quests, tick the ones they would fund, and the count shows both what Voice chose and what one member, one vote chose. Funded quests hold their share of the pot and are paid when the work is done.", context: "module funding-rounds, description" }),
    promise: msg({ message: "Choose together which quests the season funds, within a pot.", context: "module funding-rounds, promise" }),
    benefits: [
      msg({ message: "Members share rough ideas, by name or without one, and each idea opens its own forum thread", context: "module funding-rounds, benefit 1" }),
      msg({ message: "Ideas are shaped into quests with a price, then members tick every one they would fund", context: "module funding-rounds, benefit 2" }),
      msg({ message: "The count shows what Voice chose beside what one member, one vote chose, and says where they differ", context: "module funding-rounds, benefit 3" }),
      msg({ message: "Funded quests hold their share of the pot and are paid when the work is done, so the pot is never spent twice", context: "module funding-rounds, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages with a budget to share that want the people doing the work to choose where it goes.", context: "module funding-rounds, for whom" }),
    setupSummary: msg({ message: "Seat someone who holds the pots, by default the Treasury role, then open a pot and a round.", context: "module funding-rounds, setup" }),
    dataSummary: msg({ message: "Each idea and who shared it, kept private when they share it without a name; members' ticks; and a record of each act for later rewards.", context: "module funding-rounds, data" }),
  },
  "places": {
    name: msg({ message: "Living places", context: "module places, name" }),
    description: msg({ message: "Every place on the land as a living invitation: what it is, which stage it has reached from idea to built, which permits it waits on, the roles that care for it, and how to step forward as its steward.", context: "module places, description" }),
    promise: msg({ message: "Every place on the land as a living invitation, from the first idea to a building that needs care.", context: "module places, promise" }),
    benefits: [
      msg({ message: "One list of every place, by zone, with the stage it has reached and how ready it is", context: "module places, benefit 1" }),
      msg({ message: "Each place shows the roles that care for it, its open quests and what it waits on", context: "module places, benefit 2" }),
      msg({ message: "A place reaches building only with its permits complete and a steward in place, or by the village's highest vote", context: "module places, benefit 3" }),
      msg({ message: "Anyone can step forward to steward a place, with what they would build, with whom and by when", context: "module places, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages building on their land that want every place to say what it needs and who it is waiting for.", context: "module places, for whom" }),
    setupSummary: msg({ message: "Seat someone who keeps the registry, then load the village's places from its seed.", context: "module places, setup" }),
    dataSummary: msg({ message: "Each place's name, zone, stage, permits and words. Who holds its roles is read from the org chart, never copied.", context: "module places, data" }),
  },
  "hidden-map": {
    name: msg({ message: "Hidden map", context: "module hidden-map, name" }),
    description: msg({ message: "A members-only map of the places your members log, with photos, growth over time and return visits. Each member sees only their own pins until enough of them are vouched for by others, and then the whole map opens.", context: "module hidden-map, description" }),
    promise: msg({ message: "A members-only map of the places your members log, which opens to each member once others have vouched for their own.", context: "module hidden-map, promise" }),
    benefits: [
      msg({ message: "Log a place from a phone, with its location read from the photo and then removed from it", context: "module hidden-map, benefit 1" }),
      msg({ message: "Each member sees only their own pins until enough of them are vouched for, then the whole map opens", context: "module hidden-map, benefit 2" }),
      msg({ message: "Return visits add photos, so a planting is seen growing from seed to tree", context: "module hidden-map, benefit 3" }),
      msg({ message: "No names beside pins, two people for any copy of the map, and a record of who looked", context: "module hidden-map, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages whose members tend places spread far apart and want a record of them that stays inside the membership.", context: "module hidden-map, for whom" }),
    setupSummary: msg({ message: "Seat someone who keeps the map, so the first members can be vouched for, and choose what it is drawn on.", context: "module hidden-map, setup" }),
    dataSummary: msg({ message: "Each pin's place, kind, words and photos, tied to the member who logged it and never shown with their name. Photos are stripped of every hidden detail. A record of who read the map, with no places in it.", context: "module hidden-map, data" }),
  },
  "season-places": {
    name: msg({ message: "Season places", context: "module season-places, name" }),
    description: msg({ message: "Every season starts fresh: members apply, and each circle's picker chooses that season's team from everyone who applied. Circles propose to take part, a season can hold a set number of places with a waitlist in order, and each gathering can take circles up to a cap its host sets.", context: "module season-places, description" }),
    promise: msg({ message: "Circles take part season by season, with places that fill in order and a waitlist that tells people when a place opens.", context: "module season-places, promise" }),
    benefits: [
      msg({ message: "Each circle proposes to take part in a season, and the power that places people in roles, or the village, says yes", context: "module season-places, benefit 1" }),
      msg({ message: "After a set number of seasons a circle takes part without asking", context: "module season-places, benefit 2" }),
      msg({ message: "A season can hold a set number of places, and a full season keeps a waitlist in order", context: "module season-places, benefit 3" }),
      msg({ message: "Each gathering can take circles up to a cap its own host sets", context: "module season-places, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages whose circles come and go with the seasons, such as a travelling gathering or a rotating team.", context: "module season-places, for whom" }),
    setupSummary: msg({ message: "Date the village's seasons, then set the places in a season and the seasons a circle serves before it needs no proposal.", context: "module season-places, setup" }),
    dataSummary: msg({ message: "Which circle took part in which season, the words its people wrote with the proposal, and the order of the waitlist.", context: "module season-places, data" }),
  },
  "session-card": {
    name: msg({ message: "Session Card", context: "module session-card, name" }),
    description: msg({ message: "An optional card anyone in a live session can pull at the start, as often as they like. It reads today's sky in both Human Design and Western astrology, weaves in the Gene Keys of the people present who said yes, names each person, and offers the room a few ways to hold the session. Each person's own line stays private until they share it, and the cards are deleted when the session closes.", context: "module session-card, description" }),
    promise: msg({ message: "A card to pull as a session opens, so the room starts present with each other and the day.", context: "module session-card, promise" }),
    benefits: [
      msg({ message: "Anyone in the room can pull a card, and pull again whenever they like", context: "module session-card, benefit 1" }),
      msg({ message: "Today's sky in Human Design and in Western astrology, each line labelled with its system", context: "module session-card, benefit 2" }),
      msg({ message: "A collective reading that names everyone present, and a line for each person who said yes", context: "module session-card, benefit 3" }),
      msg({ message: "Ways to hold the session today: a longer arrival round, sleeping on a big proposal, a tension given its own session", context: "module session-card, benefit 4" }),
    ],
    forWhom: msg({ message: "Circles that like to open a working call by tuning in to each other first.", context: "module session-card, for whom" }),
    setupSummary: msg({ message: "Nothing to set up. Turn on Live Sessions and Gene Keys first; the card appears at drop in.", context: "module session-card, setup" }),
    dataSummary: msg({ message: "While a session is open: its cards and the line for each person read, private until they share it. A card is deleted within an hour of its session closing or being discarded, at once when someone it read withdraws, and on erasure. With an assistant key, facts without names go to the assistant provider (Anthropic by default).", context: "module session-card, data" }),
  },
  "moon-review": {
    name: msg({ message: "End-of-Moon Review", context: "module moon-review, name" }),
    description: msg({ message: "Once a moon, each member who holds a role gathers what they delivered, checks it against their role cards and the season goals, does a role audit and sends a recap. When their role's adopted terms carry money they also send a draft invoice. One person approves the work and a different person approves the invoice, neither of them the member. Pay is recorded here and paid outside the platform.", context: "module moon-review, description" }),
    promise: msg({ message: "Once a moon, each member says what they delivered for their roles, and the village approves it and records the pay.", context: "module moon-review, promise" }),
    benefits: [
      msg({ message: "Tasks from the profile and the rooms come in on their own, and Sera drafts the rest", context: "module moon-review, benefit 1" }),
      msg({ message: "Each item is read against the role card and the season goals, so unseen work shows up", context: "module moon-review, benefit 2" }),
      msg({ message: "A role audit sends each role that should grow, shrink or exist to its circle", context: "module moon-review, benefit 3" }),
      msg({ message: "Two different people approve, neither of them the member, and amounts stay with the member and Finance", context: "module moon-review, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages that pay their core team for deliverables and want one honest record of the moon's work.", context: "module moon-review, for whom" }),
    setupSummary: msg({ message: "Seat someone in a power group that approves the work, choose who holds the cash power, and fill in the payers document before the first invoice.", context: "module moon-review, setup" }),
    dataSummary: msg({ message: "Each member's recap and items; their pay route, legal name and address; their invoices and every approval. Amounts, routes and invoices are read by the member and the cash power holders only. Erasure clears the words and keeps amounts, dates, numbers and events.", context: "module moon-review, data" }),
  },
  "sessions": {
    name: msg({ message: "Live Sessions", context: "module sessions, name" }),
    description: msg({ message: "A circle holds a working call together in real time: drop in with a shared breath, say how each person is arriving, build the agenda and consent to it, give every item its own page and clock, and leave with every action held by a person or a role. The record stays with the people who were there and the village's admins, and arrival words are erased when the session closes.", context: "module sessions, description" }),
    promise: msg({ message: "A circle's working call, held together live, from the first breath to the last action claimed.", context: "module sessions, promise" }),
    benefits: [
      msg({ message: "Six stages the facilitator moves the room through: drop in, arrival, agenda, items, actions and close", context: "module sessions, benefit 1" }),
      msg({ message: "An agenda built together, every item with an aim and its own clock, consented to before the work starts", context: "module sessions, benefit 2" }),
      msg({ message: "Proposals decided in a consent round the whole room can see", context: "module sessions, benefit 3" }),
      msg({ message: "Every action leaves with a person or a role on it, and what nobody can hold waits in the backlog for next time", context: "module sessions, benefit 4" }),
      msg({ message: "Feedback on the facilitation reaches the facilitator unsigned, and ideas for the tool land in your feedback inbox", context: "module sessions, benefit 5" }),
    ],
    forWhom: msg({ message: "Circles that meet often and want each call to end with clear decisions and actions somebody holds.", context: "module sessions, for whom" }),
    setupSummary: msg({ message: "Nothing to set up. Write your village's place line and choose a usual length when you want your own words and rhythm.", context: "module sessions, setup" }),
    dataSummary: msg({ message: "Who took part, the agenda, notes, decisions and who holds each action. Arrival words and numbers are erased at close, and the record is read by the people who were there and your admins.", context: "module sessions, data" }),
  },
  "governance": {
    name: msg({ message: "Governance", context: "module governance, name" }),
    description: msg({ message: "The village decides on-site: staged proposals go to weighted ballots with frozen electorates, votes stay changeable until a human closes with a stated outcome, and passed mechanics changes apply through the one amendment ledger. Off keeps the shipped Hypha loop exactly as it is.", context: "module governance, description" }),
    promise: msg({ message: "The village decides on-site: weighted ballots, frozen the day they open.", context: "module governance, promise" }),
    benefits: [
      msg({ message: "Staged proposals go to a real vote once support gathers", context: "module governance, benefit 1" }),
      msg({ message: "Thresholds, electorate and weights freeze when a ballot opens", context: "module governance, benefit 2" }),
      msg({ message: "Votes stay changeable until a human closes with a stated outcome", context: "module governance, benefit 3" }),
      msg({ message: "Passed mechanics changes apply through the one amendment ledger", context: "module governance, benefit 4" }),
      msg({ message: "Voting weight and every change to it sit on a member-readable record", context: "module governance, benefit 5" }),
    ],
    forWhom: msg({ message: "Villages ready to conduct their own decisions where the sensing already happens.", context: "module governance, for whom" }),
    setupSummary: msg({ message: "Nothing to set up. Pick a weight mode and the dials when you want more than the defaults.", context: "module governance, setup" }),
    dataSummary: msg({ message: "Ballots, who voted what and with what weight, objections and their rulings.", context: "module governance, data" }),
  },
  "canvas": {
    name: msg({ message: "Governance Canvas", context: "module canvas, name" }),
    description: msg({ message: "The village reads how it governs itself, block by block, on the twelve blocks of the Governance Canvas: a reading per block, the season map, five frames to walk each block in, a Decision Matrix, one public line per block, a printable workbook and a companion that answers from the village's own record. While it is on, every block must be on record before the village is asked to start its Game.", context: "module canvas, description" }),
    promise: msg({ message: "How the village governs itself, read block by block on the Governance Canvas.", context: "module canvas, promise" }),
    benefits: [
      msg({ message: "A reading for each of the twelve blocks: a level and one sentence, with who recorded it and when", context: "module canvas, benefit 1" }),
      msg({ message: "Five frames for each block: sense it, see what the village already runs, learn, say the village's answer, adopt a change", context: "module canvas, benefit 2" }),
      msg({ message: "Anybody in the village suggests a change, and whoever holds the power adopts it", context: "module canvas, benefit 3" }),
      msg({ message: "A Decision Matrix of who approves, who is asked and who is told, and one public line per block", context: "module canvas, benefit 4" }),
      msg({ message: "A printable workbook of the canvas, and a guide that answers from the village's own record first", context: "module canvas, benefit 5" }),
    ],
    forWhom: msg({ message: "Villages that want to see where their governance stands before they ask members to start.", context: "module canvas, for whom" }),
    setupSummary: msg({ message: "Nothing to set up. Record the first reading when you are ready; while it is on, every block needs one before the Game starts.", context: "module canvas, setup" }),
    dataSummary: msg({ message: "Each block's readings with who recorded them, suggestions with their author, the Decision Matrix rows the village wrote, and the public lines.", context: "module canvas, data" }),
  },
  "conflict-evolution": {
    name: msg({ message: "Conflict Evolution", context: "module conflict-evolution, name" }),
    description: msg({ message: "A conflict agreement the village writes and changes by vote: where a conflict goes, who takes it and who covers, how soon a member hears back, a contact outside the village, and a private ask to the ombuds. While it is on, the village names a working conflict door before it is asked to start its Game.", context: "module conflict-evolution, description" }),
    promise: msg({ message: "Somewhere for a conflict to go, written by the village and changed by its vote.", context: "module conflict-evolution, promise" }),
    benefits: [
      msg({ message: "A conflict agreement: the steps, who takes a conflict and who covers when they cannot", context: "module conflict-evolution, benefit 1" }),
      msg({ message: "A reply time in hours the village chose, and a contact outside the village", context: "module conflict-evolution, benefit 2" }),
      msg({ message: "A private ask to the outside contact that carries no words and sends nothing", context: "module conflict-evolution, benefit 3" }),
      msg({ message: "The founders write it before the Game starts, and after that a change is a vote", context: "module conflict-evolution, benefit 4" }),
    ],
    forWhom: msg({ message: "Villages that want a conflict door every member can find before they need it.", context: "module conflict-evolution, for whom" }),
    setupSummary: msg({ message: "Nothing to set up first. The agreement starts from your exit policy's restorative steps; while it is on, the launch checklist asks for a working door.", context: "module conflict-evolution, setup" }),
    dataSummary: msg({ message: "The agreement, which names the people in its care and cover roles and an outside contact, and a record of who asked the outside contact to talk, and when.", context: "module conflict-evolution, data" }),
  },
  "hypha": {
    name: msg({ message: "Hypha Bridge", context: "module hypha, name" }),
    description: msg({ message: "Your DAO on Hypha, read from Base and shown here: the contracts this village actually holds, total supply and treasury balance as the chain reports them, and governance outcomes that find their way back to the proposal they came from. Read only, always. Needs a Base endpoint somebody pays for, and it says which of the two listener paths this village is on.", context: "module hypha, description" }),
    promise: msg({ message: "Your DAO's real numbers from Base, on your own pages.", context: "module hypha, promise" }),
    benefits: [
      msg({ message: "Find your token contracts from your founder account, then confirm each one yourself", context: "module hypha, benefit 1" }),
      msg({ message: "The name on screen is the one the contract answers to, read from the chain and dated", context: "module hypha, benefit 2" }),
      msg({ message: "Total supply and treasury balance as facts about the village, not one member's holding", context: "module hypha, benefit 3" }),
      msg({ message: "A failed chain read shows the last true figure with when it was true, and never a zero", context: "module hypha, benefit 4" }),
      msg({ message: "Outcomes that match no proposal are listed for a steward instead of dropped", context: "module hypha, benefit 5" }),
    ],
    forWhom: msg({ message: "Villages whose equity and governance already live on a Hypha DAO on Base.", context: "module hypha, for whom" }),
    setupSummary: msg({ message: "Set your DHO address and founder Base account, look your tokens up, and confirm each contract. Reading the chain needs a Base endpoint somebody pays for.", context: "module hypha, setup" }),
    dataSummary: msg({ message: "Contract addresses, what those contracts call themselves, village-level supply and treasury figures, and a log of outcomes that arrived.", context: "module hypha, data" }),
  },
  "comms": {
    name: msg({ message: "Village Comms", context: "module comms, name" }),
    description: msg({ message: "The village's email in one place: reminders for the gatherings people said yes to, a few emails that walk somebody along the path they chose, guest RSVPs, a live vote on a session time, and letters to the people who agreed to get them. Every email is recorded before it goes, and anybody can stop any kind of email with one click.", context: "module comms, description" }),
    promise: msg({ message: "The village's email in one place: every email recorded, and every person able to say stop.", context: "module comms, promise" }),
    benefits: [
      msg({ message: "Reminders and changes for the gatherings people said yes to", context: "module comms, benefit 1" }),
      msg({ message: "A few emails that walk somebody along the path they chose", context: "module comms, benefit 2" }),
      msg({ message: "Guests with no account can say they are coming, and confirm by email", context: "module comms, benefit 3" }),
      msg({ message: "A live vote on a session time, where the time that is winning is the time", context: "module comms, benefit 4" }),
      msg({ message: "Letters to the people who agreed to get them, with a record of each one", context: "module comms, benefit 5" }),
    ],
    forWhom: msg({ message: "Villages that want to stay in touch with everybody they meet, by email, from inside the village's own platform.", context: "module comms, for whom" }),
    setupSummary: msg({ message: "Add your email provider key, your sending domain, a sender, delivery reports and a postal address in Comms Settings, then send yourself a test.", context: "module comms, setup" }),
    dataSummary: msg({ message: "Email addresses, what each person agreed to receive, and a record of every email sent to them.", context: "module comms, data" }),
  },
  "saberra": {
    name: msg({ message: "Organisational Memory", context: "module saberra, name" }),
    description: msg({ message: "An outside service reads your meetings and records, and suggests changes to your circles and roles. Every suggestion is reviewed before anything changes.", context: "module saberra, description" }),
    promise: msg({ message: "An outside reading of how your village is organised, offered back as suggestions you decide on.", context: "module saberra, promise" }),
    benefits: [
      msg({ message: "A service that keeps your organisational record proposes circles and roles", context: "module saberra, benefit 1" }),
      msg({ message: "Every suggestion goes to your review queue, so nothing changes until somebody agrees", context: "module saberra, benefit 2" }),
      msg({ message: "Roles carry what the service knows about them, so a member can see what a role involves before putting their hand up", context: "module saberra, benefit 3" }),
      msg({ message: "Circles and roles it holds are stored beside yours, in its own words", context: "module saberra, benefit 4" }),
      msg({ message: "Tensions and risks it is tracking reach your stewards", context: "module saberra, benefit 5" }),
    ],
    forWhom: msg({ message: "Villages that already keep their organisational memory with an outside service.", context: "module saberra, for whom" }),
    setupSummary: msg({ message: "You hold your own connection: a subdomain at the service and your own token.", context: "module saberra, setup" }),
    dataSummary: msg({ message: "Circles, roles and their state, under the service's own field names. No member is named.", context: "module saberra, data" }),
  },
};

/** One definition's words in the reader's language, or the server's own when this file has none. */
const said = (d: MessageDescriptor | undefined, server: string, i18n: I18n): string => (d ? i18n._(d) : server);

/** The catalog as the server sent it, with the platform's words in the reader's language. */
export function localizeCatalog(data: CatalogPayload, i18n: I18n = appI18n): CatalogPayload {
  return {
    ...data,
    groups: data.groups.map((g) => {
      const w = MODULE_SHELF_WORDS[g.id];
      return w ? { ...g, label: said(w.label, g.label, i18n), gloss: said(w.gloss, g.gloss, i18n) } : g;
    }),
    modules: data.modules.map((m) => {
      const w = MODULE_WORDS[m.id];
      if (!w) return m;
      const card = m.card && {
        ...m.card,
        promise: said(w.promise, m.card.promise, i18n),
        benefits: m.card.benefits.map((b, i) => said(w.benefits[i], b, i18n)),
        forWhom: said(w.forWhom, m.card.forWhom, i18n),
        setupSummary: said(w.setupSummary, m.card.setupSummary, i18n),
        dataSummary: said(w.dataSummary, m.card.dataSummary, i18n),
      };
      return { ...m, name: said(w.name, m.name, i18n), description: said(w.description, m.description, i18n), card };
    }),
  };
}
