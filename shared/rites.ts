/**
 * RITES: the steps of passage a village names, the ceremony that stamps a
 * spoken one, the mark a member draws, and the buddy who walks beside a
 * newcomer. The rules with no database in them.
 *
 * ── NOTHING HERE NAMES A VILLAGE ────────────────────────────────────────────
 *
 * Every word a member reads on these screens, every rite, photo and colour,
 * arrives as the village's own `village-rites/1` document (the module card,
 * `module_settings.config`). The defaults below are neutral and short, so a
 * village that never writes one reads plain words and no rites at all.
 *
 * ── A RITE IS WITNESSED, NEVER TICKED ───────────────────────────────────────
 *
 * A rite with spoken lines, a mark or more than one witness is stamped only by
 * a ceremony: the candidate speaks each line on their own phone, draws their
 * mark if the rite asks for one, and each witness confirms on THEIR own phone.
 * A rite with none of those is stamped by one witness. Nobody stamps their own.
 *
 * WHO MAY WITNESS. A member who holds the village's admitting rite (they are
 * "sworn"). Until anybody holds it there is nobody sworn to ask, so any
 * admitted member may witness: the first two members swear to each other.
 */

export const RITES_MODULE = "rites";
export const RITES_FORMAT = "village-rites/1";

// ── Limits ────────────────────────────────────────────────────────────────

export const RITES_MAX = 12;
export const LINES_MAX = 12;
export const WITNESSES_MAX = 5;
export const DOORS_MAX = 3;
export const STEPS_MAX = 4;
export const ARTICLES_MAX = 5;
export const COUNTS_MAX = 3;
export const LETTER_LINE_MAX = 200;
export const GREETING_MAX = 400;
export const WHY_MAX = 400;

export const PLACES = ["phone", "site", "gathering"] as const;
export type PlaceKey = (typeof PLACES)[number];

export const COUNT_SOURCES = ["sworn", "circles", "quests"] as const;
export type CountSource = (typeof COUNT_SOURCES)[number];

/** The colours and faces a village may set on its rites screens, each a token the screens' stylesheet reads. */
export const LOOK_COLOURS = [
  "background", "foreground", "card", "cardForeground", "primary", "primaryForeground", "brandSoft",
  "muted", "mutedForeground", "border", "paper", "paper2", "paperForeground", "paperMuted", "success",
  "ceremony", "seal", "stampAlt", "surfaceDeep", "glow", "placePhone", "placeSite", "placeGathering",
] as const;
export type LookColour = (typeof LOOK_COLOURS)[number];
export const LOOK_FONTS = ["fontDisplay", "fontLabel", "fontBody", "fontAccent"] as const;
export type LookFont = (typeof LOOK_FONTS)[number];

/** The CSS custom property each look key sets on the `.rites` scope. */
export const LOOK_VARS: Record<LookColour | LookFont, string> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  brandSoft: "--tone-brand-soft",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  border: "--border",
  paper: "--paper",
  paper2: "--paper-2",
  paperForeground: "--paper-foreground",
  paperMuted: "--paper-muted",
  success: "--success",
  ceremony: "--ceremony",
  seal: "--seal",
  stampAlt: "--stamp-alt",
  surfaceDeep: "--surface-deep",
  glow: "--glow",
  placePhone: "--place-phone",
  placeSite: "--place-site",
  placeGathering: "--place-gathering",
  fontDisplay: "--font-display",
  fontLabel: "--font-label",
  fontBody: "--font-body",
  fontAccent: "--font-accent",
};

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
/** A colour with alpha written as rgba(), the one other form a border needs. */
const RGBA = /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d{1,3})\s*\)$/;
/** A font family name: letters, digits, spaces and a dash. The face itself is uploaded as a brand font. */
const FAMILY = /^[A-Za-z0-9 -]{1,60}$/;
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const SLUG = /^[a-z0-9][a-z0-9._-]{0,63}$/;

// ── The document ──────────────────────────────────────────────────────────

export interface RiteDef {
  id: string;
  /** The rite's name at the top of its ceremony: "The vow". Defaults to the task words. */
  title: string;
  /** The rite as a task, on a waiting stamp: "Plant the seven". */
  todo: string;
  /** The rite done, on an inked stamp and in the pulse: "Planted the seven". */
  done: string;
  witnesses: number;
  /** Spoken lines. Present means the rite is sworn in a ceremony. */
  lines: string[];
  /** The lines used when the ceremony is held at a gathering, if different. */
  gatheringLines: string[];
  /** What the gathered crowd answers after the last line at a gathering, if anything. */
  gatheringAnswer: string;
  /** The candidate draws their mark before the witnesses confirm. */
  mark: boolean;
  /** Holding this rite admits the member. At most one rite admits. */
  admits: boolean;
  /** Other rites stamped at the same moment this one is. */
  together: string[];
  /** A witness on a live video call counts. */
  callCounts: boolean;
  /** The second stamp ink. */
  ink: "seal" | "alt";
  place: PlaceKey | null;
  /**
   * Stamped only by the module named here, when the thing itself happens (the
   * hidden map's opening stamps "Plant the seven"). Nobody stamps it by hand.
   */
  byModule: string;
  /** Said on the public pulse when stamped (default yes). */
  pulse: boolean;
  /** How the pulse says it after a first name, when the done words do not read in the third person ("met their matelot"). */
  said: string;
}

export interface StepDef {
  title: string;
  line: string;
  place: PlaceKey | null;
}

export interface DoorDef {
  id: string;
  title: string;
  line: string;
  place: PlaceKey | null;
  /** The door is not open yet: it takes a name and an email and nothing else. */
  interestOnly: boolean;
  /** Where the door leads when it is open (a page here, or an https address). */
  href: string;
  /** Shown on the public welcome too (default yes); every door is a choice when joining. */
  onWelcome: boolean;
  /** The door as a choice on the joining form, when it reads differently there. */
  choiceTitle: string;
  choiceLine: string;
  /** The first quest and the meeting for somebody who came in by this door, when they differ from the village's. */
  questTitle: string;
  questHref: string;
  questPlace: PlaceKey | null;
  meetLabel: string;
}

export interface ArticleDef {
  n: number;
  title: string;
  line: string;
}

export interface CountDef {
  source: CountSource;
  label: string;
}

/** Text fields and their limits. Every one is the village's to write; the default is neutral. */
export const WORD_LIMITS = {
  buddy: 24,
  memberWord: 24,
  newcomerWord: 24,
  buddyTitle: 30,
  buddyLine: 160,
  placePhone: 16,
  placeSite: 16,
  placeGathering: 16,
  ceremonyHelp: 100,
  ceremonyWhere: 60,
  spoken: 20,
  witnessesTitle: 30,
  ceremonyFoot: 140,
  witnessBuddy: 30,
  witnessOther: 30,
  swornBar: 30,
  markTitle: 40,
  markLine: 160,
  swornKicker: 40,
  swornTitle: 60,
  swornLine: 220,
  ringTitle: 40,
  nextKicker: 40,
  nextTitle: 80,
  nextLabel: 30,
  nextHref: 200,
  arrivedKicker: 40,
  arrivedTitle: 60,
  stampsFoot: 160,
  firstQuestTitle: 60,
  firstQuestHref: 200,
  sayHello: 24,
  meetLabel: 24,
  aboardTitle: 60,
  aboardWhy: 60,
  aboardWhyHelp: 160,
  aboardDoorQuestion: 60,
  aboardButton: 40,
  aboardFoot: 160,
  aboardRoad: 80,
  cameWith: 60,
  markHint: 40,
  firstQuestPlace: 16,
  ringCount: 30,
  invitedBy: 60,
  cardTitle: 30,
  recordTitle: 30,
  crewTitle: 30,
  crewFoot: 160,
  resting: 24,
  away: 16,
  fleetTitle: 30,
  fleetSeasonKicker: 30,
  circlesTitle: 30,
  circleLive: 16,
  crewCount: 30,
  gatheringsTitle: 30,
  ballotsKicker: 40,
  witnessPageTitle: 40,
} as const;
export type WordKey = keyof typeof WORD_LIMITS;
export type Words = Record<WordKey, string>;

export const DEFAULT_WORDS: Words = {
  buddy: "Buddy",
  memberWord: "",
  newcomerWord: "",
  buddyTitle: "Your buddy",
  buddyLine: "A member who walks beside you through your first moon and your rites.",
  placePhone: "Phone",
  placeSite: "On site",
  placeGathering: "Gathering",
  ceremonyHelp: "Speak each line out loud. Tap when it's spoken.",
  ceremonyWhere: "Where are you taking it?",
  spoken: "Spoken",
  witnessesTitle: "Your witnesses",
  ceremonyFoot: "",
  witnessBuddy: "your {buddy}",
  witnessOther: "{member}",
  swornBar: "",
  markTitle: "Make your mark",
  markLine: "Draw your mark with a finger. It becomes your sign on your card.",
  swornKicker: "The rite is complete",
  swornTitle: "You're a {member}!",
  swornLine: "Your mark is in the ring with every member who stood here before you. No name comes first.",
  ringTitle: "The ring",
  nextKicker: "",
  nextTitle: "",
  nextLabel: "",
  nextHref: "",
  arrivedKicker: "Welcome",
  arrivedTitle: "You're in, {name}!",
  stampsFoot: "Each rite is stamped here when a member witnesses it.",
  firstQuestTitle: "",
  firstQuestHref: "",
  sayHello: "Say hello",
  meetLabel: "Meet in person",
  aboardTitle: "You're one step from joining.",
  aboardWhy: "Why are you joining?",
  aboardWhyHelp: "A few true lines. Your buddy reads them first.",
  aboardDoorQuestion: "How are you joining?",
  aboardButton: "Join as a {newcomer}",
  aboardFoot: "",
  aboardRoad: "",
  cameWith: "Came in with {inviter}",
  markHint: "your mark comes later",
  firstQuestPlace: "",
  ringCount: "by {n}",
  invitedBy: "Invited by {inviter}",
  cardTitle: "Your card",
  recordTitle: "Your record",
  crewTitle: "The members",
  crewFoot: "A member's Voice rests while they're away and wakes when they're back.",
  resting: "Voice resting",
  away: "away",
  fleetTitle: "The village",
  fleetSeasonKicker: "This season",
  circlesTitle: "Circles",
  circleLive: "",
  crewCount: "{n} members",
  gatheringsTitle: "Gatherings ahead",
  ballotsKicker: "Open votes",
  witnessPageTitle: "Rites to witness",
};

export const WELCOME_LIMITS = {
  photo: 300,
  photoAlt: 140,
  kicker: 40,
  title: 60,
  lede: 220,
  cta: 30,
  pulseTitle: 40,
  stepsTitle: 40,
  stepsNote: 30,
  waiting: 80,
  ceremonyPhoto: 300,
  doorsTitle: 40,
  doorsFoot: 220,
  roadTitle: 40,
  lockTitle: 60,
  lockLine: 140,
} as const;
export type WelcomeKey = keyof typeof WELCOME_LIMITS;

export const LETTER_LIMITS = {
  kicker: 40,
  photo: 300,
  photoAlt: 140,
  title: 70,
  about: 320,
  seal: 30,
  sealLine: 140,
  signature: 40,
} as const;
export type LetterKey = keyof typeof LETTER_LIMITS;

export const DOOR_PAGE_LIMITS = {
  title: 60,
  line: 220,
  button: 30,
  given: 30,
  sent: 160,
  packetFront: 30,
  packetSub: 80,
  packetVariety: 60,
  packetBackTitle: 40,
  packetBackLine: 160,
  scanLine: 80,
  packetKicker: 60,
} as const;
export type DoorPageKey = keyof typeof DOOR_PAGE_LIMITS;

export const ARTICLES_LIMITS = { kicker: 40, title: 60, lede: 220, linkLabel: 40, href: 200 } as const;
export type ArticlesKey = keyof typeof ARTICLES_LIMITS;

export const FLEET_LIMITS = {
  joinTitle: 40,
  joinLine: 200,
  joinLabel: 30,
  joinHref: 200,
  pathTitle: 40,
  pathLine: 120,
  pathHref: 200,
  applyKicker: 40,
  applyLine: 220,
  applyLabel: 30,
  applyHref: 200,
} as const;
export type FleetKey = keyof typeof FLEET_LIMITS;
export const FLEET_PHOTOS_MAX = 12;

/** The icons the screens' bottom bar draws. Shapes only; the labels are the village's. */
export const NAV_ICONS = ["home", "vehicle", "quests", "map", "fleet", "card"] as const;
export type NavIcon = (typeof NAV_ICONS)[number];
export const NAV_MAX = 5;

export interface NavItem {
  icon: NavIcon;
  label: string;
  href: string;
}

export interface RitesConfig {
  format: typeof RITES_FORMAT;
  rites: RiteDef[];
  words: Words;
  welcome: Record<WelcomeKey, string> & { steps: StepDef[]; doors: DoorDef[]; road: StepDef[] };
  /** `linkFor`: who the "read them all" link shows to, everyone or signed-in members (until the page is public). */
  articles: Record<ArticlesKey, string> & { items: ArticleDef[]; linkFor: "everyone" | "members" };
  letter: Record<LetterKey, string>;
  door: Record<DoorPageKey, string>;
  fleet: Record<FleetKey, string> & { photos: Record<string, string> };
  counts: CountDef[];
  tokens: { record: string; voice: string };
  /** The village's own mark for the top of each screen: an uploaded image or an https address. */
  sigil: string;
  nav: NavItem[];
  /** The order a newcomer walks the rites, when it differs from the card's. */
  walk: string[];
  look: Partial<Record<LookColour | LookFont, string>>;
}

const blank = <K extends string>(limits: Record<K, number>): Record<K, string> =>
  Object.fromEntries(Object.keys(limits).map((k) => [k, ""])) as Record<K, string>;

export const DEFAULT_WELCOME: RitesConfig["welcome"] = {
  ...blank(WELCOME_LIMITS),
  title: "Welcome to {village}",
  cta: "Join",
  waiting: "{inviter} is waiting for you.",
  pulseTitle: "Right now",
  stepsTitle: "Your first hour",
  doorsTitle: "Ways in",
  roadTitle: "The long road",
  steps: [],
  doors: [],
  road: [],
};

export const DEFAULT_LETTER: RitesConfig["letter"] = {
  ...blank(LETTER_LIMITS),
  kicker: "An invitation",
  title: "{inviter} has saved you a place.",
  seal: "Open your invitation",
  sealLine: "{inviter} vouches for you. This invitation is yours alone.",
  signature: "{inviter}, {member}",
};

export const DEFAULT_DOOR: RitesConfig["door"] = {
  ...blank(DOOR_PAGE_LIMITS),
  title: "A member gave you this.",
  line: "Ask to join and they'll answer you.",
  button: "Ask to join",
  given: "Given by",
  sent: "Sent. {inviter} answers you by email.",
  scanLine: "Scan to ask to join",
};

export const DEFAULT_ARTICLES: RitesConfig["articles"] = { ...blank(ARTICLES_LIMITS), items: [], linkFor: "everyone" };

export const DEFAULT_CONFIG: RitesConfig = {
  format: RITES_FORMAT,
  rites: [],
  words: DEFAULT_WORDS,
  welcome: DEFAULT_WELCOME,
  articles: DEFAULT_ARTICLES,
  letter: DEFAULT_LETTER,
  door: DEFAULT_DOOR,
  fleet: { ...blank(FLEET_LIMITS), photos: {} },
  counts: [
    { source: "sworn", label: "members" },
    { source: "circles", label: "circles" },
    { source: "quests", label: "quests done" },
  ],
  tokens: { record: "", voice: "" },
  sigil: "",
  nav: [],
  walk: [],
  look: {},
};

type Doc = Record<string, unknown>;
const isObj = (v: unknown): v is Doc => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const has = (o: Doc, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** A link a village may write: a page on this site, or an https address. */
export function safeHref(v: string): boolean {
  if (!v) return true;
  if (v.startsWith("/") && !v.startsWith("//")) return !/[\s<>"']/.test(v);
  return /^https:\/\/[^\s<>"']+$/.test(v);
}

/** A photo a village may name: an uploaded file on this site, or an https address. */
export const safePhoto = safeHref;

function readTexts<K extends string>(src: unknown, limits: Record<K, number>, defaults: Record<K, string>, where: string, problems: string[]): Record<K, string> {
  const out = { ...defaults };
  if (src === undefined) return out;
  if (!isObj(src)) {
    problems.push(`${where} must be an object.`);
    return out;
  }
  for (const key of Object.keys(src)) {
    if (!has(limits, key)) continue;
    const k = key as K;
    const v = src[k];
    if (typeof v !== "string") {
      problems.push(`${where}.${k} must be text.`);
      continue;
    }
    const t = v.trim();
    if (t.length > limits[k]) problems.push(`${where}.${k} is ${t.length} characters. Keep it to ${limits[k]}.`);
    else if (/^(?:href|photo)$|Href$|Photo$/.test(k) && !safeHref(t)) problems.push(`${where}.${k} must be a page here (starting with /) or an https address.`);
    else out[k] = t;
  }
  return out;
}

function readPlace(v: unknown, where: string, problems: string[]): PlaceKey | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "string" && (PLACES as readonly string[]).includes(v)) return v as PlaceKey;
  problems.push(`${where} must be one of ${PLACES.join(", ")}.`);
  return null;
}

function readLines(v: unknown, where: string, problems: string[]): string[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) {
    problems.push(`${where} must be a list of lines.`);
    return [];
  }
  if (v.length > LINES_MAX) problems.push(`${where} has ${v.length} lines. Keep it to ${LINES_MAX}.`);
  const out: string[] = [];
  v.slice(0, LINES_MAX).forEach((line, i) => {
    const t = str(line);
    if (!t) problems.push(`${where}[${i + 1}] is empty.`);
    else if (t.length > 160) problems.push(`${where}[${i + 1}] is ${t.length} characters. Keep each line to 160.`);
    else out.push(t);
  });
  return out;
}

function readSteps(v: unknown, where: string, problems: string[]): StepDef[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) {
    problems.push(`${where} must be a list.`);
    return [];
  }
  if (v.length > STEPS_MAX) problems.push(`${where} has ${v.length} entries. Keep it to ${STEPS_MAX}.`);
  return v.slice(0, STEPS_MAX).map((s, i) => {
    const at = `${where}[${i + 1}]`;
    if (!isObj(s)) {
      problems.push(`${at} must be an object.`);
      return { title: "", line: "", place: null };
    }
    const t = readTexts(s, { title: 40, line: 160 }, { title: "", line: "" }, at, problems);
    if (!t.title) problems.push(`${at}.title is empty.`);
    return { title: t.title, line: t.line, place: readPlace(s.place, `${at}.place`, problems) };
  });
}

function readRite(r: unknown, i: number, problems: string[]): RiteDef | null {
  const at = `rites[${i + 1}]`;
  if (!isObj(r)) {
    problems.push(`${at} must be an object.`);
    return null;
  }
  const id = str(r.id);
  if (!ID.test(id)) problems.push(`${at}.id "${id}" must be lowercase letters, numbers and dashes, up to 40.`);
  const t = readTexts(r, { title: 30, todo: 30, done: 30, gatheringAnswer: 60, said: 40 }, { title: "", todo: "", done: "", gatheringAnswer: "", said: "" }, at, problems);
  if (!t.todo) problems.push(`${at}.todo (the rite as a task) is empty.`);
  if (!t.done) problems.push(`${at}.done (the rite done) is empty.`);
  const witnesses = r.witnesses === undefined ? 1 : Number(r.witnesses);
  if (!Number.isInteger(witnesses) || witnesses < 1 || witnesses > WITNESSES_MAX) problems.push(`${at}.witnesses must be a whole number from 1 to ${WITNESSES_MAX}.`);
  const bool = (k: string) => {
    if (r[k] === undefined) return false;
    if (typeof r[k] !== "boolean") problems.push(`${at}.${k} must be true or false.`);
    return r[k] === true;
  };
  const together = r.together === undefined ? [] : Array.isArray(r.together) ? r.together.map(str) : null;
  if (together === null) problems.push(`${at}.together must be a list of rite ids.`);
  const ink = r.ink === undefined ? "seal" : r.ink;
  const byModule = r.byModule === undefined ? "" : /^[a-z][a-z0-9-]{0,39}$/.test(String(r.byModule)) ? String(r.byModule) : null;
  if (byModule === null) problems.push(`${at}.byModule must be a module id.`);
  if (ink !== "seal" && ink !== "alt") problems.push(`${at}.ink must be "seal" or "alt".`);
  return {
    id,
    title: t.title || t.todo,
    todo: t.todo,
    done: t.done,
    witnesses: Number.isInteger(witnesses) ? Math.min(Math.max(witnesses, 1), WITNESSES_MAX) : 1,
    lines: readLines(r.lines, `${at}.lines`, problems),
    gatheringLines: readLines(r.gatheringLines, `${at}.gatheringLines`, problems),
    gatheringAnswer: t.gatheringAnswer,
    mark: bool("mark"),
    admits: bool("admits"),
    together: together ?? [],
    callCounts: r.callCounts === undefined ? true : bool("callCounts"),
    ink: ink === "alt" ? "alt" : "seal",
    place: readPlace(r.place, `${at}.place`, problems),
    byModule: byModule ?? "",
    pulse: r.pulse === undefined ? true : bool("pulse"),
    said: t.said,
  };
}

/**
 * Read a stored or pasted document. Every problem is named; the caller refuses
 * a save with any. A document that is absent reads as the neutral defaults.
 */
export function parseRitesConfig(raw: unknown): { config: RitesConfig; problems: string[] } {
  const problems: string[] = [];
  if (raw === undefined || raw === null) return { config: DEFAULT_CONFIG, problems };
  if (!isObj(raw)) return { config: DEFAULT_CONFIG, problems: ["The rites document must be an object."] };
  if (raw.format !== undefined && raw.format !== RITES_FORMAT) problems.push(`format must be "${RITES_FORMAT}".`);

  const rites: RiteDef[] = [];
  if (raw.rites !== undefined) {
    if (!Array.isArray(raw.rites)) problems.push("rites must be a list.");
    else {
      if (raw.rites.length > RITES_MAX) problems.push(`There are ${raw.rites.length} rites. Keep it to ${RITES_MAX}.`);
      raw.rites.slice(0, RITES_MAX).forEach((r, i) => {
        const def = readRite(r, i, problems);
        if (def) rites.push(def);
      });
    }
  }
  const ids = new Set<string>();
  for (const r of rites) {
    if (ids.has(r.id)) problems.push(`The rite id "${r.id}" is used twice.`);
    ids.add(r.id);
  }
  for (const r of rites) {
    for (const t of r.together) {
      if (!ids.has(t)) problems.push(`The rite "${r.id}" stamps "${t}" together with it, and there is no rite with that id.`);
      if (t === r.id) problems.push(`The rite "${r.id}" names itself in together.`);
    }
    if (r.gatheringLines.length > 0 && r.lines.length === 0) problems.push(`The rite "${r.id}" has gathering lines and no lines.`);
    if (r.byModule && (r.lines.length > 0 || r.mark || r.admits || r.witnesses > 1)) problems.push(`The rite "${r.id}" is stamped by ${r.byModule}, so it has no lines, mark, witnesses or admission of its own.`);
  }
  if (rites.filter((r) => r.admits).length > 1) problems.push("Only one rite may admit a member.");

  const words = readTexts(raw.words, WORD_LIMITS, DEFAULT_WORDS, "words", problems);

  const w = isObj(raw.welcome) ? raw.welcome : raw.welcome === undefined ? {} : null;
  if (w === null) problems.push("welcome must be an object.");
  const welcomeTexts = readTexts<WelcomeKey>(w ?? {}, WELCOME_LIMITS, DEFAULT_WELCOME, "welcome", problems);
  const doorsRaw = w?.doors;
  const doors: DoorDef[] = [];
  if (doorsRaw !== undefined) {
    if (!Array.isArray(doorsRaw)) problems.push("welcome.doors must be a list.");
    else {
      if (doorsRaw.length > DOORS_MAX) problems.push(`welcome.doors has ${doorsRaw.length} doors. Keep it to ${DOORS_MAX}.`);
      doorsRaw.slice(0, DOORS_MAX).forEach((d, i) => {
        const at = `welcome.doors[${i + 1}]`;
        if (!isObj(d)) return void problems.push(`${at} must be an object.`);
        const id = str(d.id);
        if (!ID.test(id)) problems.push(`${at}.id "${id}" must be lowercase letters, numbers and dashes.`);
        const t = readTexts(d, { title: 40, line: 180, href: 200, choiceTitle: 40, choiceLine: 180, questTitle: 60, questHref: 200, meetLabel: 24 }, { title: "", line: "", href: "", choiceTitle: "", choiceLine: "", questTitle: "", questHref: "", meetLabel: "" }, at, problems);
        if (d.onWelcome !== undefined && typeof d.onWelcome !== "boolean") problems.push(`${at}.onWelcome must be true or false.`);
        if (!t.title) problems.push(`${at}.title is empty.`);
        if (d.interestOnly !== undefined && typeof d.interestOnly !== "boolean") problems.push(`${at}.interestOnly must be true or false.`);
        doors.push({ id, title: t.title, line: t.line, href: t.href, interestOnly: d.interestOnly === true, onWelcome: d.onWelcome !== false, choiceTitle: t.choiceTitle, choiceLine: t.choiceLine, questTitle: t.questTitle, questHref: t.questHref, questPlace: readPlace(d.questPlace, `${at}.questPlace`, problems), meetLabel: t.meetLabel, place: readPlace(d.place, `${at}.place`, problems) });
      });
      const seen = new Set<string>();
      for (const d of doors) {
        if (seen.has(d.id)) problems.push(`The door id "${d.id}" is used twice.`);
        seen.add(d.id);
      }
    }
  }
  const welcome = {
    ...welcomeTexts,
    steps: readSteps(w?.steps, "welcome.steps", problems),
    road: readSteps(w?.road, "welcome.road", problems),
    doors,
  };

  const a = isObj(raw.articles) ? raw.articles : raw.articles === undefined ? {} : null;
  if (a === null) problems.push("articles must be an object.");
  if (a?.linkFor !== undefined && a.linkFor !== "everyone" && a.linkFor !== "members") problems.push('articles.linkFor must be "everyone" or "members".');
  const articleTexts = readTexts<ArticlesKey>(a ?? {}, ARTICLES_LIMITS, DEFAULT_ARTICLES, "articles", problems);
  const items: ArticleDef[] = [];
  if (a?.items !== undefined) {
    if (!Array.isArray(a.items)) problems.push("articles.items must be a list.");
    else {
      if (a.items.length > ARTICLES_MAX) problems.push(`articles.items has ${a.items.length} entries. Keep it to ${ARTICLES_MAX}.`);
      a.items.slice(0, ARTICLES_MAX).forEach((it, i) => {
        const at = `articles.items[${i + 1}]`;
        if (!isObj(it)) return void problems.push(`${at} must be an object.`);
        const n = Number(it.n);
        if (!Number.isInteger(n) || n < 1 || n > 99) problems.push(`${at}.n must be a whole number from 1 to 99.`);
        const t = readTexts(it, { title: 40, line: 200 }, { title: "", line: "" }, at, problems);
        if (!t.title) problems.push(`${at}.title is empty.`);
        items.push({ n: Number.isInteger(n) ? n : i + 1, title: t.title, line: t.line });
      });
    }
  }

  const letter = readTexts(raw.letter, LETTER_LIMITS, DEFAULT_LETTER, "letter", problems);
  const door = readTexts(raw.door, DOOR_PAGE_LIMITS, DEFAULT_DOOR, "door", problems);

  let counts = DEFAULT_CONFIG.counts;
  if (raw.counts !== undefined) {
    if (!Array.isArray(raw.counts)) problems.push("counts must be a list.");
    else {
      if (raw.counts.length > COUNTS_MAX) problems.push(`counts has ${raw.counts.length} entries. Keep it to ${COUNTS_MAX}.`);
      counts = [];
      raw.counts.slice(0, COUNTS_MAX).forEach((c, i) => {
        const at = `counts[${i + 1}]`;
        if (!isObj(c) || !(COUNT_SOURCES as readonly string[]).includes(String(c.source))) return void problems.push(`${at}.source must be one of ${COUNT_SOURCES.join(", ")}.`);
        const label = str(c.label);
        if (!label || label.length > 24) problems.push(`${at}.label must be 1 to 24 characters.`);
        counts.push({ source: c.source as CountSource, label });
      });
    }
  }

  const tokens = { record: "", voice: "" };
  if (raw.tokens !== undefined) {
    if (!isObj(raw.tokens)) problems.push("tokens must be an object.");
    else
      for (const k of ["record", "voice"] as const) {
        const v = str(raw.tokens[k]);
        if (v && !SLUG.test(v)) problems.push(`tokens.${k} "${v}" is not a token's slug.`);
        else tokens[k] = v;
      }
  }

  const look: RitesConfig["look"] = {};
  if (raw.look !== undefined) {
    if (!isObj(raw.look)) problems.push("look must be an object.");
    else
      for (const [k, v] of Object.entries(raw.look)) {
        const s = str(v);
        if ((LOOK_COLOURS as readonly string[]).includes(k)) {
          if (!HEX.test(s) && !RGBA.test(s)) problems.push(`look.${k} must be a colour like #0b1a1e.`);
          else look[k as LookColour] = s;
        } else if ((LOOK_FONTS as readonly string[]).includes(k)) {
          if (!FAMILY.test(s)) problems.push(`look.${k} must be a font family name (letters, numbers, spaces).`);
          else look[k as LookFont] = s;
        } else problems.push(`look.${k} is not a look this module reads.`);
      }
  }

  const fleetRaw = isObj(raw.fleet) ? raw.fleet : raw.fleet === undefined ? {} : null;
  if (fleetRaw === null) problems.push("fleet must be an object.");
  const fleetTexts = readTexts<FleetKey>(fleetRaw ?? {}, FLEET_LIMITS, DEFAULT_CONFIG.fleet, "fleet", problems);
  const photos: Record<string, string> = {};
  if (fleetRaw?.photos !== undefined) {
    if (!isObj(fleetRaw.photos)) problems.push("fleet.photos must map a circle id to a photo.");
    else {
      const entries = Object.entries(fleetRaw.photos);
      if (entries.length > FLEET_PHOTOS_MAX) problems.push(`fleet.photos has ${entries.length} photos. Keep it to ${FLEET_PHOTOS_MAX}.`);
      for (const [id, url] of entries.slice(0, FLEET_PHOTOS_MAX)) {
        const u = str(url);
        if (!/^[A-Za-z0-9._-]{1,64}$/.test(id)) problems.push(`fleet.photos "${id}" is not a circle id.`);
        else if (!u || u.length > 300 || !safePhoto(u)) problems.push(`fleet.photos.${id} must be an uploaded file (starting with /) or an https address.`);
        else photos[id] = u;
      }
    }
  }

  const walk: string[] = [];
  if (raw.walk !== undefined) {
    if (!Array.isArray(raw.walk)) problems.push("walk must be a list of rite ids.");
    else
      for (const w of raw.walk.map(str)) {
        if (!rites.some((r) => r.id === w)) problems.push(`walk names "${w}", and there is no rite with that id.`);
        else if (!walk.includes(w)) walk.push(w);
      }
  }

  const sigil = str(raw.sigil);
  if (sigil && (sigil.length > 300 || !safePhoto(sigil))) problems.push("sigil must be an uploaded file (starting with /) or an https address.");

  const nav: NavItem[] = [];
  if (raw.nav !== undefined) {
    if (!Array.isArray(raw.nav)) problems.push("nav must be a list.");
    else {
      if (raw.nav.length > NAV_MAX) problems.push(`nav has ${raw.nav.length} entries. Keep it to ${NAV_MAX}.`);
      raw.nav.slice(0, NAV_MAX).forEach((n, i) => {
        const at = `nav[${i + 1}]`;
        if (!isObj(n)) return void problems.push(`${at} must be an object.`);
        const icon = str(n.icon);
        if (!(NAV_ICONS as readonly string[]).includes(icon)) problems.push(`${at}.icon must be one of ${NAV_ICONS.join(", ")}.`);
        const t = readTexts(n, { label: 16, href: 200 }, { label: "", href: "" }, at, problems);
        if (!t.label || !t.href) problems.push(`${at} needs a label and an href.`);
        else if ((NAV_ICONS as readonly string[]).includes(icon)) nav.push({ icon: icon as NavIcon, label: t.label, href: t.href });
      });
    }
  }

  return {
    config: {
      format: RITES_FORMAT,
      rites,
      words,
      welcome,
      articles: { ...articleTexts, items, linkFor: a?.linkFor === "members" ? "members" : "everyone" },
      letter,
      door,
      fleet: { ...fleetTexts, photos },
      counts,
      tokens,
      sigil: sigil && safePhoto(sigil) && sigil.length <= 300 ? sigil : "",
      nav,
      walk,
      look,
    },
    problems,
  };
}

/** The module registry's validator: one sentence naming the first problems, or null. */
export function ritesConfigProblem(raw: unknown): string | null {
  const { problems } = parseRitesConfig(raw);
  if (problems.length === 0) return null;
  return problems.slice(0, 5).join(" ") + (problems.length > 5 ? ` And ${problems.length - 5} more.` : "");
}

/** The CSS declarations a village's look sets on the scope, ready for a style attribute. */
export function lookStyle(look: RitesConfig["look"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(look)) {
    if (!v) continue;
    const name = LOOK_VARS[k as LookColour | LookFont];
    if (!name) continue;
    out[name] = (LOOK_FONTS as readonly string[]).includes(k) ? `"${v}", ${k === "fontBody" ? "system-ui, sans-serif" : k === "fontAccent" ? "cursive" : "Georgia, serif"}` : v;
  }
  return out;
}

// ── Words with blanks ─────────────────────────────────────────────────────

export interface FillVars {
  name?: string;
  inviter?: string;
  member?: string;
  newcomer?: string;
  village?: string;
  buddy?: string;
}

/** Fill `{name}`-style blanks. A blank with no value reads as nothing, never as its braces. */
export function fill(text: string, vars: FillVars): string {
  return text.replace(/\{(name|inviter|member|newcomer|village|buddy)\}/g, (_m, k: keyof FillVars) => vars[k] ?? "").replace(/\s{2,}/g, " ").trim();
}

// ── Rites on a card ───────────────────────────────────────────────────────

export type StampState = "on" | "next" | "todo";

export interface StampView {
  id: string;
  label: string;
  state: StampState;
  ink: "seal" | "alt";
}

/** Each rite in the village's order: inked with its done words if held, the first unheld one marked next. */
export function stampsFor(rites: readonly RiteDef[], held: ReadonlySet<string>, walk: readonly string[] = []): StampView[] {
  // The next rite is the first unheld one in the order a newcomer walks them,
  // which a village may give apart from the order its card shows them in.
  const order = [...walk.filter((id) => rites.some((r) => r.id === id)), ...rites.map((r) => r.id).filter((id) => !walk.includes(id))];
  const next = order.find((id) => !held.has(id)) ?? null;
  return rites.map((r) => {
    if (held.has(r.id)) return { id: r.id, label: r.done, state: "on", ink: r.ink };
    const state: StampState = r.id === next ? "next" : "todo";
    return { id: r.id, label: r.todo, state, ink: r.ink };
  });
}

export function admittingRite(rites: readonly RiteDef[]): RiteDef | null {
  return rites.find((r) => r.admits) ?? null;
}

/** A rite stamped by one witness's tap, with no ceremony. Never one a module stamps. */
export function isPlainRite(r: RiteDef): boolean {
  return r.lines.length === 0 && !r.mark && r.witnesses === 1 && !r.byModule;
}

/** A rite another rite stamps together with itself: it is stamped only by that rite's ceremony, never alone. */
export function stampedOnlyWith(r: RiteDef, rites: readonly RiteDef[]): RiteDef | null {
  return rites.find((o) => o.id !== r.id && o.together.includes(r.id)) ?? null;
}

/** The rites one stamp of `r` writes: itself and its together rites, each once. */
export function stampedTogether(r: RiteDef, rites: readonly RiteDef[]): string[] {
  const known = new Set(rites.map((x) => x.id));
  return Array.from(new Set([r.id, ...r.together.filter((t) => known.has(t))]));
}

// ── Who may witness ───────────────────────────────────────────────────────

export type WitnessVia = "present" | "call";

export interface WitnessAsk {
  candidateId: string;
  witnessId: string;
  via: WitnessVia;
  callCounts: boolean;
  /** The witness holds the village's admitting rite. */
  witnessSworn: boolean;
  /** Anybody in the village holds it. */
  anyoneSworn: boolean;
  /** The witness is an admitted member. */
  witnessAdmitted: boolean;
}

export const WITNESS_REFUSALS = {
  self: "Nobody witnesses their own rite.",
  notSworn: "Only a member who has completed the village's admitting rite may witness.",
  notAdmitted: "Only an admitted member may witness.",
  call: "This rite is witnessed in person.",
} as const;

export function refuseWitness(a: WitnessAsk): string | null {
  if (a.candidateId === a.witnessId) return WITNESS_REFUSALS.self;
  if (a.via === "call" && !a.callCounts) return WITNESS_REFUSALS.call;
  if (a.anyoneSworn) return a.witnessSworn ? null : WITNESS_REFUSALS.notSworn;
  return a.witnessAdmitted ? null : WITNESS_REFUSALS.notAdmitted;
}

// ── The ceremony ──────────────────────────────────────────────────────────

export type CeremonyStatus = "open" | "sworn" | "set-aside";
export type CeremonyStep = "speaking" | "marking" | "witnessing" | "sworn" | "set-aside";

export interface CeremonyFacts {
  status: CeremonyStatus;
  lineCount: number;
  spoken: number;
  markNeeded: boolean;
  markMade: boolean;
  needed: number;
  confirmed: number;
}

export function ceremonyStep(c: CeremonyFacts): CeremonyStep {
  if (c.status === "sworn") return "sworn";
  if (c.status === "set-aside") return "set-aside";
  if (c.spoken < c.lineCount) return "speaking";
  if (c.markNeeded && !c.markMade) return "marking";
  return c.confirmed >= c.needed ? "sworn" : "witnessing";
}

export const CEREMONY_REFUSALS = {
  closed: "This ceremony is no longer open.",
  notCandidate: "Only the person taking the rite marks a line spoken.",
  outOfOrder: "That line has already been spoken, or an earlier one has not.",
  tooEarly: "Witnesses confirm once every line is spoken and the mark is made.",
  notWitness: "Join as a witness first.",
} as const;

/** Whether `line` (0-based) may be marked spoken now. Idempotent for the line just spoken. */
export function refuseSpoken(c: CeremonyFacts, isCandidate: boolean, line: number): string | null {
  if (c.status !== "open") return CEREMONY_REFUSALS.closed;
  if (!isCandidate) return CEREMONY_REFUSALS.notCandidate;
  if (!Number.isInteger(line) || line < 0 || line >= c.lineCount) return CEREMONY_REFUSALS.outOfOrder;
  if (line === c.spoken || line === c.spoken - 1) return null;
  return CEREMONY_REFUSALS.outOfOrder;
}

export function refuseConfirm(c: CeremonyFacts, isWitness: boolean): string | null {
  if (c.status !== "open") return CEREMONY_REFUSALS.closed;
  if (!isWitness) return CEREMONY_REFUSALS.notWitness;
  const step = ceremonyStep(c);
  if (step === "speaking" || step === "marking") return CEREMONY_REFUSALS.tooEarly;
  return null;
}

// ── The mark ──────────────────────────────────────────────────────────────

export const MARK_SIZE = 60;
export const MARK_STROKES_MAX = 12;
export const MARK_POINTS_MAX = 400;

/**
 * Strokes as drawn (lists of [x, y] on a 60 by 60 square) to one SVG path, or
 * a refusal. Coordinates are rounded and clamped; nothing but numbers and the
 * letters M and L ever reaches the path, so it is safe to draw anywhere.
 */
export function markPath(strokes: unknown): { ok: true; path: string } | { ok: false; error: string } {
  if (!Array.isArray(strokes) || strokes.length === 0) return { ok: false, error: "Draw your mark first." };
  if (strokes.length > MARK_STROKES_MAX) return { ok: false, error: `Keep your mark to ${MARK_STROKES_MAX} strokes.` };
  let points = 0;
  const parts: string[] = [];
  for (const s of strokes) {
    if (!Array.isArray(s) || s.length === 0) return { ok: false, error: "A stroke of the mark has no points." };
    const pts: string[] = [];
    for (const p of s) {
      if (!Array.isArray(p) || p.length !== 2) return { ok: false, error: "A point of the mark is not a pair of numbers." };
      const x = Number(p[0]);
      const y = Number(p[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, error: "A point of the mark is not a pair of numbers." };
      const cx = Math.min(MARK_SIZE, Math.max(0, Math.round(x)));
      const cy = Math.min(MARK_SIZE, Math.max(0, Math.round(y)));
      pts.push(`${cx} ${cy}`);
      points += 1;
    }
    if (points > MARK_POINTS_MAX) return { ok: false, error: "Your mark has too many points. Draw it a little simpler." };
    parts.push(pts.length === 1 ? `M${pts[0]}L${pts[0]}` : `M${pts[0]}${pts.slice(1).map((q) => `L${q}`).join("")}`);
  }
  return { ok: true, path: parts.join("") };
}

/** A stored path is drawn only if it is still the shape `markPath` writes. */
export const MARK_PATH_SHAPE = /^(?:M\d{1,2} \d{1,2}(?:L\d{1,2} \d{1,2})+)+$/;

// ── The ring ──────────────────────────────────────────────────────────────

/** A stable 32-bit hash (FNV-1a). */
function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The ring's order: the same for everybody who looks, and set by nothing a
 * person did (not who swore first, not a name). `salt` is the village's own, so
 * two villages' rings do not share an order.
 */
export function ringOrder<T extends { userId: string }>(marks: readonly T[], salt: string): T[] {
  return [...marks].sort((a, b) => fnv(salt + a.userId) - fnv(salt + b.userId) || (a.userId < b.userId ? -1 : 1));
}

// ── The door code ─────────────────────────────────────────────────────────

/** A door code: ten letters and digits from a set with no look-alikes. */
export const DOOR_CODE = /^[a-hjkmnp-z2-9]{10}$/;
export const DOOR_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function makeDoorCode(randomBytes: (n: number) => Uint8Array): string {
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) out += DOOR_ALPHABET[bytes[i] % DOOR_ALPHABET.length];
  return out;
}

export function doorPath(code: string): string {
  return `/door/${code}`;
}
