/**
 * THE ADMIN SEARCH INDEX: every Admin page, control and steward page, as data,
 * with the words a person would look for it by (Admin evolution, PR 1).
 *
 * The lead looked for "Send me a test" and could not find it: it was item 13
 * of the mail checklist, folded shut behind Change once a test had been
 * delivered, on a page with four names. This file is the first half of the
 * answer. Every entry has a stable id, and the id is also an ADDRESS:
 *
 *   a page      /admin?tab=<tab>
 *   a control   /admin?tab=<tab>&setting=<id>     (the page focuses it)
 *   a dial      /admin?tab=variables&variable=<key>
 *   a page outside Admin   its own path
 *
 * So the search bar, the village's guide, a launch checklist row and a lane
 * pasting a link into a pull request all land on the same control.
 *
 * ── WHAT THIS FILE NEVER DOES ─────────────────────────────────────────────
 *
 * It never acts. An entry is words and an address, nothing else: no handler,
 * no route to call, no value. Searching only ever takes a person somewhere,
 * and pressing the button there is a separate, visible act. The test proves
 * every entry survives a JSON round trip unchanged, which a function would not.
 *
 * It never decides who may see an entry. An entry NAMES the capability or the
 * module it needs; `GET /api/admin/search-index` (server/routes/adminSearch.ts)
 * asks the one gate (`mayStillSee`, which reads shared/capabilities.ts) and the
 * module lifecycles, and returns only what this person can use.
 *
 * ── ADDING AN ENTRY ───────────────────────────────────────────────────────
 *
 * A control belongs here once its page lands on it: the page reads `setting`
 * off the address and focuses the element (`useLandingFocus` in
 * client/src/components/admin/settingFocus.ts). An entry whose page does not
 * land yet would promise a button and deliver a page, which is the failure
 * this file exists to end. The client test checks every control's tab exists.
 */
import type { Capability } from "./capabilities";

export type AdminSearchKind = "page" | "control" | "dial" | "outside";

export interface AdminSearchEntry {
  /** Stable, and part of the address. Never renamed: a rename breaks every link to it. */
  id: string;
  kind: AdminSearchKind;
  /** The name a person sees, the same name the page uses. */
  title: string;
  /** One line: what it is, in the person's words. */
  help: string;
  /** Other words people use for it. Old names of the same thing go here too. */
  synonyms: readonly string[];
  /** The Admin tab it lives on (page, control, dial). */
  tab?: string;
  /** The path of a page outside /admin. */
  path?: string;
  /** The capability its route asks the gate for. Absent: any admin. */
  capability?: Capability;
  /** The module it needs on. Absent: always there. */
  module?: string;
}

// ── Pages: synonyms for the Admin tabs ─────────────────────────────────────
//
// The tabs themselves (key, name, one line) live in the client
// (client/src/components/admin/adminAreas.ts), because the menu draws them.
// What they are LOOKED FOR by lives here, so the server, the guide and the
// search bar share one list. A tab with no row here is still found by its name.

export const TAB_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  "comms-settings": ["mail settings", "email settings", "comms settings", "email", "mail", "inbox", "sender", "send test", "test email", "resend", "domain", "postal address", "pause email"],
  "email-settings": ["mail settings", "email settings"],
  "comms-letters": ["letter", "newsletter", "announcement", "broadcast", "write to everyone", "send a letter"],
  "comms-journeys": ["journey", "automation", "drip", "sequence", "reminders", "welcome emails"],
  "comms-words": ["email words", "template", "subject line", "mail words"],
  "comms-people": ["mailing list", "unsubscribe", "stop email", "contacts", "consent"],
  "comms-sent": ["sent mail", "bounced", "bounce", "delivery", "email log", "did it send"],
  "comms-overview": ["mail overview", "email overview", "queue", "run now"],
  submissions: ["forms", "requests", "applications", "visit request", "wish to join", "form submissions"],
  "quest-claims": ["witness", "claims", "finished quests"],
  "forum-moderation": ["forum reports", "moderation", "flagged posts", "reported post"],
  "message-reports": ["reported message", "flagged message"],
  failures: ["what is failing", "errors", "failed", "broken", "retry"],
  players: ["members", "people", "players", "access", "make admin", "member list"],
  "org-chart": ["roles", "circles", "seats", "appoint", "role pay", "holders"],
  "game-roles": ["power groups", "permissions", "powers"],
  handover: ["the handover", "grant power", "give power", "steward"],
  setup: ["make this yours", "project settings", "setup wizard", "village name", "logo", "colours", "colors", "pictures", "identity"],
  integrations: ["keys", "api key", "stripe", "anthropic", "connect", "services", "secrets"],
  variables: ["game mechanics", "dials", "settings", "rules", "numbers"],
  modules: ["module library", "turn on", "turn off", "features", "parts"],
  "events-admin": ["calendar", "events", "gatherings"],
  pages: ["page words", "website", "public pages", "copy"],
  tokens: ["tokens", "currency", "coins", "recognition"],
  "cash-payouts": ["payouts", "pay out", "cash owed", "bank transfer"],
  cycles: ["cycle close", "close the cycle", "settle", "moon close"],
  settings: ["dues", "fees", "land figures", "money settings"],
  "exits-admin": ["departures", "leaving", "exit policy", "closing policy"],
  season: ["season", "timezone", "moon"],
  drafts: ["drafts to send", "guide drafts"],
  brain: ["village brain", "what the guide knows", "memory"],
};

/**
 * A page's first act, which takes the focus when a search lands on the page
 * itself. A dialog focuses its first control for the same reason: the lead
 * typed "mail settings", pressed Enter, and wanted Send me a test in front of
 * them, not the top of a page to read down. Only pages whose first act is
 * safe to have focused (focusing never presses it) are listed.
 */
export const TAB_FIRST_CONTROL: Readonly<Record<string, string>> = {
  "comms-settings": "comms.test-email",
  "email-settings": "comms.test-email",
};

// ── Controls: the buttons and fields a page lands on ───────────────────────

/** The prefix every mail checklist control's id carries (`comms.<SetupKey>`). */
export const COMMS_SETTING_PREFIX = "comms.";

export const CONTROL_ENTRIES: readonly AdminSearchEntry[] = [
  {
    id: "comms.test-email", kind: "control", tab: "comms-settings", capability: "comms.manage",
    title: "Send me a test email",
    help: "Sends you a test from the village's sender. Mail counts as ready once it arrives.",
    synonyms: ["send me a test", "test email", "send test", "test mail", "check email works", "mail settings"],
  },
  {
    id: "comms.pause-all", kind: "control", tab: "comms-settings", capability: "comms.manage",
    title: "Pause all automated email",
    help: "Holds every gathering email, path email and letter at once. Password links and member notices keep going.",
    synonyms: ["pause email", "stop all email", "hold mail", "emergency stop"],
  },
  {
    id: "comms.api-key", kind: "control", tab: "comms-settings", capability: "operator.secrets",
    title: "Sending key (Resend)",
    help: "The key the village sends email with. Without one, no email leaves the village.",
    synonyms: ["resend key", "email key", "api key", "mail key"],
  },
  {
    id: "comms.domain", kind: "control", tab: "comms-settings", capability: "comms.manage",
    title: "Sending domain",
    help: "The domain the village's email comes from, and whether it is verified.",
    synonyms: ["domain", "dns", "verify domain", "email domain"],
  },
  {
    id: "comms.sender", kind: "control", tab: "comms-settings", capability: "comms.manage",
    title: "Sender name and address",
    help: "The name and address the village's email goes out as.",
    synonyms: ["from address", "sender", "from name", "reply from"],
  },
  {
    id: "comms.delivery-reports", kind: "control", tab: "comms-settings", capability: "comms.manage",
    title: "Delivery reports",
    help: "Whether the mail service reports back what arrived and what bounced.",
    synonyms: ["webhook", "bounces", "delivery reports"],
  },
  {
    id: "comms.postal-address", kind: "control", tab: "comms-settings", capability: "comms.manage",
    title: "Postal address for the footer",
    help: "The address every bulk email carries in its footer.",
    synonyms: ["postal address", "footer address", "mailing address"],
  },
  {
    id: "comms.reply-to", kind: "control", tab: "comms-settings", capability: "operator.secrets",
    title: "Reply-to inbox for each path",
    help: "Where replies and form answers for each path land.",
    synonyms: ["reply to", "inbox", "email settings", "where replies go"],
  },
  {
    id: "comms.path-contacts", kind: "control", tab: "comms-settings", capability: "comms.manage",
    title: "Who writes back for each path",
    help: "The member each path's journey asks people to write to.",
    synonyms: ["path contact", "who writes back"],
  },
  {
    id: "comms.consent-words", kind: "control", tab: "comms-settings", capability: "comms.manage",
    title: "Words beside the tick-box on forms",
    help: "The sentence beside the tick-box on every public form that leads to a path.",
    synonyms: ["consent", "tick box", "checkbox words"],
  },
  {
    id: "comms.recap-questions", kind: "control", tab: "comms-settings", capability: "comms.manage",
    title: "The two recap questions",
    help: "The two questions a recap email asks.",
    synonyms: ["recap", "questions"],
  },
  {
    id: "comms.who-runs-comms", kind: "control", tab: "comms-settings", capability: "comms.manage",
    title: "Who runs mail",
    help: "Which power group holds the power to run the village's email.",
    synonyms: ["who runs comms", "mail power", "comms role"],
  },
  {
    id: "comms.investor-words", kind: "control", tab: "comms-settings", capability: "comms.manage",
    title: "Investor emails reviewed",
    help: "Whether someone has read the emails investors receive.",
    synonyms: ["investor emails", "investor words"],
  },
  {
    id: "comms.rehearsal-inbox", kind: "control", tab: "comms-settings", capability: "comms.manage",
    title: "Rehearsal inbox",
    help: "Where every email goes instead while mail is in preview.",
    synonyms: ["rehearsal", "preview mail", "test inbox"],
  },
  {
    id: "season.timezone", kind: "control", tab: "season",
    title: "The village's timezone",
    help: "The timezone the village's days, moons and reminders run on.",
    synonyms: ["timezone", "time zone", "clock"],
  },
  {
    id: "project.fiatCurrency", kind: "control", tab: "setup",
    title: "The village's currency",
    help: "The currency prices and dues are shown in.",
    synonyms: ["currency", "money", "dollars", "colones", "prices"],
  },
  {
    id: "exit.closing", kind: "control", tab: "exits-admin",
    title: "What closing means",
    help: "The village's words for what happens if it closes.",
    synonyms: ["closing policy", "close the village", "dissolution"],
  },
];

// ── Pages a steward uses that live outside /admin ──────────────────────────

export const OUTSIDE_ENTRIES: readonly AdminSearchEntry[] = [
  { id: "page.modules", kind: "outside", path: "/modules", title: "Module library", help: "The parts of the village, and which are on.", synonyms: ["modules", "features", "turn on"] },
  { id: "page.review", kind: "outside", path: "/review", title: "Review queue", help: "Changes waiting for a steward to look at them.", synonyms: ["review", "queue", "structure review"] },
  { id: "page.approvals", kind: "outside", path: "/approvals", title: "Approvals", help: "Things waiting for your yes.", synonyms: ["approve", "approval inbox"] },
  { id: "page.proposals", kind: "outside", path: "/admin/proposals", title: "What your agent proposed", help: "Changes an agent proposed, waiting for a person to accept.", synonyms: ["agent proposals", "proposed changes", "accept"] },
  { id: "page.mint", kind: "outside", path: "/admin/mint", title: "Mint desk", help: "Issue tokens, with every guard the mint has.", synonyms: ["mint", "issue tokens"], capability: "token.mint" },
  { id: "page.treasury", kind: "outside", path: "/governance/treasury#desks", title: "Treasury", help: "The treasurer's desks: End of Moon pay, cash to pay out, quest prices and the mint.", synonyms: ["treasurer", "end of moon", "moon review", "invoices", "cash payouts", "bank transfer"] },
  { id: "page.pricing", kind: "outside", path: "/governance/treasury#prices", title: "Pricing desk", help: "Every open quest beside the engine's suggested price.", synonyms: ["pricing", "quest price"] },
  { id: "page.budget", kind: "outside", path: "/governance/treasury#cash-budget", title: "Cash budget", help: "The cash the village plans to pay this moon.", synonyms: ["budget"] },
  { id: "page.powers", kind: "outside", path: "/powers", title: "Powers", help: "Every power, and who holds it.", synonyms: ["powers", "capabilities", "who can"] },
  { id: "page.role-measures", kind: "outside", path: "/role-measures", title: "Role measures", help: "How each role's work is measured.", synonyms: ["measures", "role measures"] },
  { id: "page.decisions", kind: "outside", path: "/decisions", title: "Decisions", help: "Votes and decisions, open and closed.", synonyms: ["votes", "ballots", "decide"] },
  { id: "page.changes", kind: "outside", path: "/changes", title: "Change requests", help: "Requests to change how the village works.", synonyms: ["change request"] },
  { id: "page.launch", kind: "outside", path: "/journey-to-launch", title: "Launch plan", help: "Everything still to do before the village launches.", synonyms: ["launch", "go live", "checklist", "journey to launch"] },
  { id: "page.setup-game", kind: "outside", path: "/setup-game", title: "Setup game", help: "The same setup, as a garden to plant.", synonyms: ["setup game", "garden"] },
  { id: "page.network", kind: "outside", path: "/network", title: "Network", help: "Other villages this one is connected to.", synonyms: ["network", "other villages"] },
];

// ── Addresses ──────────────────────────────────────────────────────────────

/** The one address an entry lands on. */
export function adminSearchHref(e: Pick<AdminSearchEntry, "id" | "kind" | "tab" | "path">): string {
  if (e.kind === "outside") return e.path ?? "/admin";
  const tab = e.tab ?? "home";
  if (e.kind === "dial") return `/admin?tab=variables&variable=${encodeURIComponent(e.id.replace(/^dial\./, ""))}`;
  if (e.kind === "control") return `/admin?tab=${encodeURIComponent(tab)}&setting=${encodeURIComponent(e.id)}`;
  const first = TAB_FIRST_CONTROL[tab];
  if (first) return `/admin?tab=${encodeURIComponent(tab)}&setting=${encodeURIComponent(first)}`;
  return `/admin?tab=${encodeURIComponent(tab)}`;
}

/** A dial as an entry. Labels and descriptions only, never a value: a value can carry a key. */
export function dialEntry(d: { key: string; label: string; description?: string; category?: string }): AdminSearchEntry {
  return {
    id: `dial.${d.key}`,
    kind: "dial",
    tab: "variables",
    title: d.label || d.key,
    help: String(d.description ?? "").slice(0, 240),
    synonyms: [d.key, ...(d.category ? [d.category] : [])],
  };
}

// ── Ranking ────────────────────────────────────────────────────────────────

const STOP = new Set(["the", "a", "an", "to", "of", "my", "me", "i", "how", "do", "where", "is", "for", "in", "on", "and", "can"]);

function norm(s: string): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function words(s: string): string[] {
  return norm(s).split(" ").filter((w) => w.length >= 2 && !STOP.has(w));
}

/**
 * How well an entry answers a query. The whole phrase counts most, in the
 * title first and then in a synonym; single words count after that; an entry
 * that matches every word gets a lift over one that matches some.
 */
/** Lifts a page whose title is exactly the query above every other kind of match. */
export const EXACT_PAGE = 1000;

export function scoreEntry(query: string, e: AdminSearchEntry): number {
  const q = norm(query);
  if (!q) return 0;
  const title = norm(e.title);
  const syns = e.synonyms.map(norm);
  const help = norm(e.help);
  let n = 0;
  if (title === q) n += 100;
  else if (title.startsWith(q)) n += 60;
  else if (title.includes(q)) n += 40;
  if (syns.includes(q)) n += 45;
  else if (syns.some((s) => s.includes(q))) n += 25;
  const ws = words(query);
  let hit = 0;
  for (const w of ws) {
    const inTitle = title.split(" ").some((t) => t.startsWith(w));
    const inSyn = syns.some((s) => s.split(" ").some((t) => t.startsWith(w)));
    const inHelp = help.includes(w);
    if (inTitle) n += 8;
    if (inSyn) n += 5;
    if (inHelp) n += 1;
    if (inTitle || inSyn || inHelp) hit++;
  }
  if (ws.length > 1 && hit === ws.length) n += 10;
  if (n > 0 && e.kind === "page") n += 2;
  // A page's own name, typed whole, is that page: no control or dial can
  // outrank it however many of its synonyms also match. "Introductions" once
  // opened the dial "Introductions one person receives per day" (100 for the
  // page against about 119 for the dial: title prefix, an equal synonym and
  // the word bonuses), so Enter on a tab's own name missed the tab.
  if (e.kind === "page" && title === q) n += EXACT_PAGE;
  return n;
}

/** The best matches, best first. Pure: it reads the entries and returns some of them. */
export function rankAdminSearch(query: string, entries: readonly AdminSearchEntry[], limit = 12): AdminSearchEntry[] {
  return entries
    .map((e, i) => ({ e, i, n: scoreEntry(query, e) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.e);
}

/** The controls that live on a page, for the "jump to" row under a page result. */
export function controlsOn(tab: string, entries: readonly AdminSearchEntry[]): AdminSearchEntry[] {
  return entries.filter((e) => e.kind === "control" && e.tab === tab);
}
