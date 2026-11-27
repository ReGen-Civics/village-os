/**
 * TODAY'S CARD, FOR YOURSELF (profile overhaul, Direction D; the lead, 24 Nov 2026: "at the top it can have
 * the 'pull a card' feature that we made for sessions but for themselves if they have their human design and
 * gene keys on").
 *
 * PULL A CARD, A DAILY DRAW (the lead, 27 Nov 2026: a fifth quick card "for those with human design/gene keys
 * on to 'pull a card' that pulls a card for that day and reads them a breakdown of their daily chart with their
 * design and everything they have going on that we can see in the app").
 *
 * THE DECK IS THE MEMBER'S OWN CHART. Their eleven spheres (Life's Work to Pearl, shared/geneKeys.ts) are the
 * cards in their hand, and each day one is drawn:
 *
 *   - ONE CARD A DAY, THE SAME ALL DAY. The draw is seeded by the member and the date (`seedOf`), and the sky it
 *     is weighed against is the sky at NOON UTC of that date (`noonUtc`), the same on every device and in every
 *     time zone, so a second pull, a reload or another phone draws the same card. The server keeps the last few
 *     days' cards by date (`MY_CARD_PREFS_KEY`, `MY_CARD_KEEP_DAYS`), so the words stay the same too.
 *   - THE SKY LEANS THE DRAW. A sphere whose gate today's Sun or Earth stands in is six times as likely, one the
 *     Moon passes or whose channel today's sky completes three times (`drawCard`). Nothing is a rank: the chip
 *     on the card says only how today's sky touches it.
 *
 * WHAT THE CARD READS. The day's sky as the session card reads it (shared/sessionCard.ts `readRoom`, for one
 * person), the drawn sphere, and what the member has going on that the app can see, as COUNTS only
 * (`TodayFacts`): quests in hand, session tasks, decisions and asks waiting, sessions and gatherings today, the
 * village's moon and season. The browser reads those from the doors it already reads; titles never leave it.
 *
 * WHO WRITES IT. The plain reading below always, in the platform's own words. The village guide weaves the
 * same facts into its own words only when the member has said yes to both: the guide may use their lines
 * (the Gene Keys `maia` choice) and the provider line that names who runs the model (server/lib/companionConsent.ts
 * `cardDisclosure`). Without both, the card and the plain facts show with a one-tap ask.
 *
 * A lens, never a forecast. No Gene Keys text of Richard Rudd's is reproduced: gates and lines are numbers, and
 * every sentence here is the platform's.
 */
import {
  AUTHORITY_WORDS, BODIES, CHANNELS, LINE_WORDS, SPHERES, SPHERE_WORDS, STRATEGY_WORDS, sphereOf, withArticle,
  type Chart, type HdType, type Authority, type Sphere,
} from "./geneKeys";
import type { CardSky } from "./sessionCard";

export const MY_CARD_API = "/api/me/today-card";
/** The one tap: the guide may read the member's lines, and the provider line, together. */
export const MY_CARD_CONSENT_API = "/api/me/today-card/consent";
/** The card's own page, where the speed card and the profile's card open. */
export const TODAY_CARD_PATH = "/profile/today-card";

/** Pulls one member may make in an hour. */
export const MY_CARD_PER_HOUR = 30;
/**
 * Where the day's cards are kept, in `users.prefs` (the way `companionConsent` lives there), by date: a pull for
 * tomorrow's date (a member just past midnight) never overwrites today's. Never sent anywhere but the member's
 * own card reads: `publicUser` passes on named prefs keys only (server/lib/publicPrefs.ts).
 */
export const MY_CARD_PREFS_KEY = "todayCard";
/** How many dates of cards are kept; the oldest falls off. */
export const MY_CARD_KEEP_DAYS = 3;

// ── THE DATE ────────────────────────────────────────────────────────────────

/**
 * The member's own date, `YYYY-MM-DD`, or null. It must name a real day within a day and a half of the
 * server's clock either side, which every time zone on Earth fits.
 */
export function parseCardDate(raw: unknown, now: number): string | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const noon = Date.parse(`${raw}T12:00:00Z`);
  if (!Number.isFinite(noon) || new Date(noon).toISOString().slice(0, 10) !== raw) return null;
  // The sky is read at this noon and the sky check allows a day and a half (SKY_SLACK_MS), so the date may too.
  return Math.abs(noon - now) <= 36 * 60 * 60 * 1000 ? raw : null;
}

/** Noon UTC of a `YYYY-MM-DD` date: the instant every device reads the card's sky at. */
export function noonUtc(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

/** A minute's grace either side of noon UTC, for a clock that rounds. Any other instant is another sky. */
export const NOON_SLACK_MS = 60 * 1000;

export function skyFitsDate(sky: CardSky, date: string): boolean {
  return Math.abs(Date.parse(sky.at) - noonUtc(date).getTime()) <= NOON_SLACK_MS;
}

// ── THE DRAW ────────────────────────────────────────────────────────────────

/** FNV-1a over the member and the date: the same pair always seeds the same draw. */
export function seedOf(userId: string, date: string): number {
  let h = 0x811c9dc5;
  const s = `${userId}|${date}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** A number in [0, 1) from a seed (mulberry32, one step). */
function unit(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** How today's sky touches the drawn card's gate. Null: it does not, a steady card. */
export type CardTouch = "sun" | "earth" | "moon" | "channel" | null;

/** How much more likely a touched sphere is to be drawn. */
export const TOUCH_WEIGHT: Record<Exclude<CardTouch, null> | "none", number> = { sun: 6, earth: 6, moon: 3, channel: 3, none: 1 };

/** The platform's own words for what each sphere is about, said to the member. */
export const FOCUS_WORDS: Record<Sphere, string> = {
  lifesWork: "the work you are here to do",
  evolution: "what you are here to learn",
  radiance: "what keeps you well",
  purpose: "what fulfils you deeply",
  attraction: "who and what you draw close",
  iq: "how your mind works best",
  eq: "how you meet other people's feelings",
  sq: "how your heart opens",
  core: "where your deepest healing lies",
  culture: "how you serve the whole",
  pearl: "where your prosperity comes from",
};

export interface DrawnCard {
  sphere: Sphere;
  /** "Radiance" */
  name: string;
  gate: number;
  line: number;
  /** The word genekeys.com shows for this line in this sphere. */
  word: string;
  /** "what keeps you well" */
  focus: string;
  touch: CardTouch;
  /** For a channel touch: the sky's gate that completes it, and the channel. */
  skyGate: number | null;
  channel: string | null;
}

function touchOf(gate: number, sky: CardSky, mine: ReadonlySet<number>): { touch: CardTouch; skyGate: number | null; channel: string | null } {
  if (sky.gates.Sun.gate === gate) return { touch: "sun", skyGate: null, channel: null };
  if (sky.gates.Earth.gate === gate) return { touch: "earth", skyGate: null, channel: null };
  if (sky.gates.Moon.gate === gate) return { touch: "moon", skyGate: null, channel: null };
  const skyGates = new Set(BODIES.map((b) => sky.gates[b].gate));
  for (const [a, b] of CHANNELS) {
    const other = a === gate ? b : b === gate ? a : null;
    // The sky completes a channel the member carries only half of.
    if (other != null && !mine.has(other) && skyGates.has(other)) return { touch: "channel", skyGate: other, channel: `${Math.min(a, b)}-${Math.max(a, b)}` };
  }
  return { touch: null, skyGate: null, channel: null };
}

/** Today's card: one of the member's eleven spheres, weighed by how today's sky touches each, drawn by the seed. */
export function drawCard(chart: Chart, sky: CardSky, seed: number): DrawnCard {
  const mine = new Set<number>();
  for (const side of ["personality", "design"] as const) for (const b of BODIES) mine.add(chart[side][b].gate);
  const hand = SPHERES.map((sphere) => {
    const act = sphereOf(chart, sphere);
    const t = touchOf(act.gate, sky, mine);
    return { sphere, act, ...t, weight: TOUCH_WEIGHT[t.touch ?? "none"] };
  });
  const total = hand.reduce((n, c) => n + c.weight, 0);
  let at = unit(seed) * total;
  let pick = hand[hand.length - 1];
  for (const c of hand) {
    if (at < c.weight) {
      pick = c;
      break;
    }
    at -= c.weight;
  }
  return {
    sphere: pick.sphere,
    name: SPHERE_WORDS[pick.sphere].name,
    gate: pick.act.gate,
    line: pick.act.line,
    word: LINE_WORDS[pick.sphere][pick.act.line - 1] ?? "",
    focus: FOCUS_WORDS[pick.sphere],
    touch: pick.touch,
    skyGate: pick.skyGate,
    channel: pick.channel,
  };
}

// ── WHAT IS GOING ON TODAY ──────────────────────────────────────────────────

/**
 * What the member has going on that the app can see, as counts. Read by the browser from doors it already
 * reads for this member, and checked here: anything unreadable is a zero or a null, never refused, because
 * a card without the day's facts is still a card.
 */
export interface TodayFacts {
  /** Quests claimed or submitted, not yet consented. */
  quests: number;
  /** Session tasks waiting. */
  tasks: number;
  /** Decisions waiting on the member: consents, adoptions, tensions raised with their role. */
  decisions: number;
  /** Asks other members put to them. */
  asks: number;
  /** Meetings of their circles today. */
  sessions: number;
  /** Gatherings on the village calendar today. */
  gatherings: number;
  /** The village's moon: its number, and the day of it. */
  moon: { n: number | null; day: number | null; of: number | null } | null;
  /** The season: its name (the village's own word), and the day of it. */
  season: { name: string; day: number | null; of: number | null } | null;
}

export const NO_FACTS: TodayFacts = { quests: 0, tasks: 0, decisions: 0, asks: 0, sessions: 0, gatherings: 0, moon: null, season: null };

const count = (v: unknown): number => (Number.isInteger(v) && (v as number) >= 0 ? Math.min(v as number, 99) : 0);
const small = (v: unknown, max: number): number | null => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? (v as number) : null);

export function parseTodayFacts(raw: unknown): TodayFacts {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const m = (r.moon && typeof r.moon === "object" ? r.moon : null) as Record<string, unknown> | null;
  const s = (r.season && typeof r.season === "object" ? r.season : null) as Record<string, unknown> | null;
  const name = s && typeof s.name === "string" ? s.name.replace(/\s+/g, " ").trim().slice(0, 60) : "";
  return {
    quests: count(r.quests),
    tasks: count(r.tasks),
    decisions: count(r.decisions),
    asks: count(r.asks),
    sessions: count(r.sessions),
    gatherings: count(r.gatherings),
    moon: m ? { n: small(m.n, 9999), day: small(m.day, 31), of: small(m.of, 31) } : null,
    season: s && name ? { name, day: small(s.day, 400), of: small(s.of, 400) } : null,
  };
}

// ── THE WORDS ───────────────────────────────────────────────────────────────

/** The gift side of a line's word: "Rejection / Gentleness" reads "Gentleness"; a single word stands as it is. */
export function giftOf(word: string): string {
  const parts = word.split("/").map((w) => w.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

/** Today's focus, written for the day: how today's sky touches the card, and its line's word. */
export function focusFor(c: DrawnCard): string {
  const lead =
    c.touch === "sun" ? `The Sun on your ${c.name}`
    : c.touch === "earth" ? `The Earth under your ${c.name}`
    : c.touch === "moon" ? `The Moon through your ${c.name}`
    : c.touch === "channel" ? `A whole current through your ${c.name}`
    : `Your ${c.name}, held steady`;
  const gift = giftOf(c.word);
  return gift ? `${lead}: ${gift}` : lead;
}

/** What today's sky does with the drawn card, then what its line says. */
export function cardLine(c: DrawnCard, sky: CardSky): string {
  const where = `gate ${c.gate}, your ${c.name}`;
  let first: string;
  if (c.touch === "sun") first = `Today's Sun stands in ${where}: that part of you is easy to see today.`;
  else if (c.touch === "earth") first = `Today's Earth stands in ${where}, and grounds the whole day.`;
  else if (c.touch === "moon") first = `The Moon passes through ${where} for a few hours today: notice how it feels.`;
  else if (c.touch === "channel") first = `Today's sky brings gate ${c.skyGate} to ${where}, and together they make channel ${c.channel}: a current you carry half of runs whole today.`;
  else first = `Today's Sun is in gate ${sky.gates.Sun.gate} and leaves ${where} alone: a steady card, yours to bring whatever the weather.`;
  return c.word ? `${first} Line ${c.line} here is ${c.word}.` : first;
}

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const n = (v: number): string => NUMBER_WORDS[v] ?? String(v);
const plural = (v: number, one: string, many: string): string => (v === 1 ? `one ${one}` : `${n(v)} ${many}`);
const upperFirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

function andList(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** What waits on the member today, read against how they decide and how they move. */
export function todayLine(f: TodayFacts, type: HdType, authority: Authority, authoritySaid = false): string {
  const bits: string[] = [];
  if (f.decisions) bits.push(f.decisions === 1 ? "a decision waits on you" : "decisions wait on you");
  if (f.quests) bits.push(`${plural(f.quests, "quest", "quests")} in hand`);
  if (f.tasks) bits.push(`${plural(f.tasks, "task", "tasks")} from your sessions`);
  if (f.asks) bits.push(f.asks === 1 ? "an ask from someone" : "asks from other members");
  if (f.sessions) bits.push(f.sessions === 1 ? "a session today" : `${n(f.sessions)} sessions today`);
  if (f.gatherings) bits.push(f.gatherings === 1 ? "a gathering in the village today" : `${n(f.gatherings)} gatherings in the village today`);
  if (!bits.length) return `Nothing waits on you in the village today. As ${withArticle(type)}: ${lowerFirst(STRATEGY_WORDS[type].line)}`;
  const head = `${upperFirst(andList(bits.slice(0, 3)))}.`;
  if (f.decisions) {
    // Said once: when the chart's own line already gave the authority, this one only points back to it.
    return authoritySaid ? `${head} Give the decision the time your authority asks.` : `${head} For the decision, your authority: ${lowerFirst(AUTHORITY_WORDS[authority].line)}`;
  }
  return `${head} As ${withArticle(type)}: ${lowerFirst(STRATEGY_WORDS[type].line)}`;
}

/** The village's moon and season in a line, or "" when neither is known. */
export function timeLine(f: TodayFacts): string {
  const parts: string[] = [];
  if (f.moon?.n != null) parts.push(f.moon.day != null && f.moon.of != null ? `Moon ${f.moon.n}, day ${f.moon.day} of ${f.moon.of}` : `Moon ${f.moon.n}`);
  if (f.season) parts.push(f.season.day != null && f.season.of != null ? `${f.season.name}, day ${f.season.day} of ${f.season.of}` : f.season.name);
  return parts.length ? `${parts.join(". ")}.` : "";
}

/** Who wrote the reading: the platform's plain words, or the village guide weaving the same facts. */
export type CardSource = "plain" | "guide";

/** The reading's three rows, each two sentences at most (the lead: bullets, not paragraphs). */
export const READING_ROWS = ["sky", "design", "waits"] as const;
export type ReadingRow = (typeof READING_ROWS)[number];

export interface CardReading {
  /** "Today's focus", in a short line. */
  focus: string;
  /** The sky and your card. */
  sky: string;
  /** Your design today. */
  design: string;
  /** What waits on you. */
  waits: string;
  source: CardSource;
}

/** The first two sentences of a line. */
export function twoSentences(text: string): string {
  const parts = text.trim().split(/(?<=[.!?])\s+(?=[A-Z])/);
  return parts.slice(0, 2).join(" ");
}

/** The plain reading, from the facts alone: what the sky does with the card, the whole chart today, the day's work. */
export function plainCardReading(c: DrawnCard, sky: CardSky, personLine: string, f: TodayFacts, type: HdType, authority: Authority): CardReading {
  const design = twoSentences(personLine);
  return {
    focus: focusFor(c),
    sky: twoSentences(cardLine(c, sky)),
    design,
    waits: twoSentences(todayLine(f, type, authority, design.includes(AUTHORITY_WORDS[authority].line))),
    source: "plain",
  };
}

/** The limits on a woven reading: anything longer is served plain. */
export const WOVEN_LIMITS = { focus: 120, row: 220 } as const;

// ── THE ANSWER ──────────────────────────────────────────────────────────────

export interface MyCard {
  /** The member's own date this card belongs to. */
  date: string;
  sky: CardSky;
  card: DrawnCard;
  /** How the day leans, in a line. */
  lean: string;
  /** What today's sky switches on in the member's whole chart, then how they decide. */
  line: string;
  /** The sky in a line for each system, for the fold under the card. */
  skyLines: { "human-design": string; western: string };
  design: { type: HdType; authority: string; profile: string; strategy: string };
  facts: TodayFacts;
  reading: CardReading;
}

/**
 * Where the member stands with the guide writing their card.
 *   given   the guide may read their lines and the provider line is agreed: the card is woven.
 *   ask     one tap away: the sentence names the provider and whoever holds the key.
 *   none    no key on this village at all: the plain card is the whole card, and nothing is asked.
 */
export type CardConsent =
  | { state: "given" }
  | { state: "ask"; provider: string; operator: string; source: string; sentence: string }
  | { state: "none" };

export interface MyCardAnswer {
  /** Today's card, when it has been drawn; null before the first pull of the day. */
  card: MyCard | null;
  consent: CardConsent;
}

export const MY_CARD_REFUSALS = {
  badSky: "The sky did not read. Try again.",
  badDate: "This device's date does not match the day. Check its clock and try again.",
  noLines: "Find your lines first, and the card reads them.",
  noKey: "The guide is not connected on this village, so the card reads in plain words.",
  stale: "The guide's connection changed. Read the new line and try again.",
} as const;
