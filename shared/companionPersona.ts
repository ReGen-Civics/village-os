/**
 * A COMPANION'S PERSONALITY, THE MEMBER'S LENSES, AND THE WELCOME (Rye, 14 Nov
 * 2026, "Meet your companion": the approved mix is the Hatchery egg for the
 * first five beats and the Shoulder Guide tour on the real profile).
 *
 * Three things live here, named once:
 *
 *   Persona   how ONE companion talks: a starting character, three dials, the
 *             ways the member likes to be helped, and whether it speaks aloud.
 *             Stored on the companion's own row (`companions.persona`).
 *   Lenses    what the member feeds in so their companions understand them: a
 *             Vedic Moon, a personality type, or a note in their own words. One
 *             private row per lens (`member_companion_lenses`). Gene Keys and
 *             Human Design are NOT a lens row: they already have their own
 *             reading and their own "let my guide use my lines" switch
 *             (`member_gene_keys.maia`), and the welcome flips that switch.
 *   Welcome   which beat the member reached, and whether they finished or
 *             skipped (`prefs.companionWelcome`).
 *
 * THE RULE THAT HOLDS ALL OF IT: a lens shapes ONLY how a companion talks to
 * its own member. Nothing here ranks, selects, scores or matches anyone; no
 * other member, role or admin reads a lens; every lens is optional and has a
 * delete. The note a model reads ends with that rule in words (LENS_NEVER).
 *
 * Birth details never reach the server. The Vedic Moon is worked out in the
 * member's browser (shared/vedicMoon.ts), the way the Gene Keys reading is,
 * and only the two numbers it gives are sent.
 */

// ── Persona ─────────────────────────────────────────────────────────────────

export const CHARACTERS = ["sidekick", "elder", "plain", "poet", "coach", "trickster"] as const;
export type Character = (typeof CHARACTERS)[number];

export interface CharacterInfo {
  label: string;
  blurb: string;
  /** The line it says when the member taps it, so they hear the difference. */
  sample: string;
  /** What the model reads. */
  prompt: string;
}

export const CHARACTER_INFO: Record<Character, CharacterInfo> = {
  sidekick: {
    label: "Sidekick",
    blurb: "Bouncy, cheers you on",
    sample: "Ooh, that's a great idea! Want me to turn it into three tiny steps?",
    prompt: "Be a bright, warm sidekick: upbeat, encouraging, quick to celebrate.",
  },
  elder: {
    label: "Wise Elder",
    blurb: "Calm, asks good questions",
    sample: "Before we begin, what would make this moon feel well spent?",
    prompt: "Be a calm, wise elder: unhurried, kind, and ask one good question before advising.",
  },
  plain: {
    label: "Plain Talker",
    blurb: "Short, no fluff",
    sample: "Two tasks due Friday. Start with the invoice.",
    prompt: "Talk plainly: short sentences, no flourishes, the next thing first.",
  },
  poet: {
    label: "Poet",
    blurb: "Images and metaphors",
    sample: "Your week is a garden bed. Let's plant the first seed today.",
    prompt: "Talk like a gentle poet: one fresh image or metaphor when it helps, never at the cost of clarity.",
  },
  coach: {
    label: "Coach",
    blurb: "Direct, keeps you moving",
    sample: "You said Friday. It's Wednesday. What's one thing you finish today?",
    prompt: "Be a direct, friendly coach: name the commitment, ask for one concrete next step.",
  },
  trickster: {
    label: "Trickster",
    blurb: "Cheeky, full of surprises",
    sample: "I hid your next task behind the moon. Just kidding. It's right here.",
    prompt: "Be a cheeky, playful trickster: light jokes and surprises, always kind, and always clear about the real answer.",
  },
};

export const HELP_WAYS = ["steps", "ask-first", "cheer", "mondays", "no-nag", "plainly"] as const;
export type HelpWay = (typeof HELP_WAYS)[number];

export const HELP_INFO: Record<HelpWay, { label: string; prompt: string }> = {
  steps: { label: "Show me steps", prompt: "Break things into small numbered steps." },
  "ask-first": { label: "Ask me first", prompt: "Ask what they want before suggesting anything." },
  cheer: { label: "Cheer my wins", prompt: "Notice and celebrate what they finished." },
  mondays: { label: "Nudge me Mondays", prompt: "On Mondays, help them plan the week." },
  "no-nag": { label: "Never nag", prompt: "Never repeat a reminder they did not ask for." },
  plainly: { label: "Talk to me plainly", prompt: "Avoid jargon and figures of speech." },
};

export interface Dials {
  /** 0 calm, 100 playful. */
  playful: number;
  /** 0 brief, 100 detailed. */
  detail: number;
  /** 0 gentle, 100 direct. */
  direct: number;
}

export const DIAL_INFO: { key: keyof Dials; low: string; high: string }[] = [
  { key: "playful", low: "Calm", high: "Playful" },
  { key: "detail", low: "Brief", high: "Detailed" },
  { key: "direct", low: "Gentle", high: "Direct" },
];

export interface Persona {
  character: Character;
  dials: Dials;
  help: HelpWay[];
  /** Speak the companion's lines aloud, with the kindest voice the device has for the page language (client/src/lib/voice/pickBrowserVoice.ts). */
  speak: boolean;
}

export const DEFAULT_PERSONA: Persona = {
  character: "sidekick",
  dials: { playful: 60, detail: 40, direct: 50 },
  help: ["cheer"],
  speak: true,
};

const dial = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
};

/** Read a stored or sent persona. Anything unreadable is null; unknown parts fall back to the defaults. */
export function parsePersona(v: unknown): Persona | null {
  let o = v;
  if (typeof o === "string") {
    try {
      o = JSON.parse(o);
    } catch {
      return null;
    }
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  if (!(CHARACTERS as readonly string[]).includes(String(r.character))) return null;
  const d = (r.dials && typeof r.dials === "object" ? r.dials : {}) as Record<string, unknown>;
  const help = Array.isArray(r.help)
    ? r.help.map(String).filter((h, i, all): h is HelpWay => (HELP_WAYS as readonly string[]).includes(h) && all.indexOf(h) === i)
    : [];
  return {
    character: r.character as Character,
    dials: {
      playful: dial(d.playful, DEFAULT_PERSONA.dials.playful),
      detail: dial(d.detail, DEFAULT_PERSONA.dials.detail),
      direct: dial(d.direct, DEFAULT_PERSONA.dials.direct),
    },
    help,
    speak: r.speak !== false,
  };
}

const lean = (v: number, low: string, high: string): string | null => (v <= 30 ? low : v >= 70 ? high : null);

/** The persona as short sentences for a model. Built only from the fixed words above, never member text. */
export function personaLines(p: Persona): string[] {
  const out = [CHARACTER_INFO[p.character].prompt];
  const tone = [
    lean(p.dials.playful, "Keep the tone calm.", "Keep the tone playful."),
    lean(p.dials.detail, "Keep replies very short.", "Give a little more detail when it helps."),
    lean(p.dials.direct, "Be gentle.", "Be direct."),
  ].filter((s): s is string => Boolean(s));
  out.push(...tone);
  for (const h of p.help) out.push(HELP_INFO[h].prompt);
  return out;
}

// ── Lenses ──────────────────────────────────────────────────────────────────

export const LENS_IDS = ["vedic", "type", "own"] as const;
export type LensId = (typeof LENS_IDS)[number];

export const RASHI = [
  "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
  "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena",
] as const;

export const NAKSHATRA = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha",
  "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
] as const;

/** The Moon's element by rashi, for the tone line. */
const RASHI_TONE = ["fire", "earth", "air", "water"] as const;
const TONE_LINE: Record<(typeof RASHI_TONE)[number], string> = {
  fire: "warm and spirited",
  earth: "steady and practical",
  air: "light and curious",
  water: "gentle and feeling",
};

export const ENNEAGRAM = [
  "Reformer", "Helper", "Achiever", "Individualist", "Investigator", "Loyalist", "Enthusiast", "Challenger", "Peacemaker",
] as const;

const ENNEAGRAM_TONE = [
  "Be clear and fair; acknowledge when something is done well.",
  "Thank them warmly, and check they are looking after themselves too.",
  "Keep momentum visible; name progress in plain numbers.",
  "Honour what makes their way of doing things their own.",
  "Give them room to think; offer the reasoning, not just the answer.",
  "Be steady and reliable; say what happens next.",
  "Keep it light and full of options.",
  "Be straight with them; no hedging.",
  "Make space for their view and ask what they want first.",
] as const;

export const BIG_FIVE = ["Openness", "Conscientiousness", "Extraversion", "Agreeableness", "Steadiness"] as const;

export interface VedicLens {
  /** 0 Mesha to 11 Meena: the sidereal sign of the Moon. */
  rashi: number;
  /** 0 Ashwini to 26 Revati, or null when the birth time is not known well enough to say. */
  nakshatra: number | null;
}
export interface TypeLens {
  /** 1 to 9, or null. */
  enneagram: number | null;
  /** Four letters, or null. */
  four: string | null;
  /** Five numbers 0 to 100 in BIG_FIVE order, or null. */
  bigFive: number[] | null;
}
export interface OwnLens {
  text: string;
}
export type LensData = { vedic: VedicLens; type: TypeLens; own: OwnLens };

export const MAX_OWN_WORDS = 400;
const FOUR_RE = /^[EI][SN][TF][JP]$/;

/** Check a lens sent by the member. Returns the clean value, or an error a member reads. */
export function readLens<L extends LensId>(lens: L, v: unknown): { ok: true; data: LensData[L] } | { ok: false; error: string } {
  const r = (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
  if (lens === "vedic") {
    const rashi = Number(r.rashi);
    if (!Number.isInteger(rashi) || rashi < 0 || rashi > 11) return { ok: false, error: "That Moon sign could not be read. Work it out again." };
    const nk = r.nakshatra === null || r.nakshatra === undefined ? null : Number(r.nakshatra);
    if (nk !== null && (!Number.isInteger(nk) || nk < 0 || nk > 26)) return { ok: false, error: "That nakshatra could not be read. Work it out again." };
    if (nk !== null && Math.floor(nk / 2.25) !== rashi) return { ok: false, error: "That Moon sign and nakshatra do not agree. Work it out again." };
    return { ok: true, data: { rashi, nakshatra: nk } as LensData[L] };
  }
  if (lens === "type") {
    const en = r.enneagram === null || r.enneagram === undefined || r.enneagram === "" ? null : Number(r.enneagram);
    if (en !== null && (!Number.isInteger(en) || en < 1 || en > 9)) return { ok: false, error: "Choose an Enneagram type from 1 to 9." };
    const fourRaw = typeof r.four === "string" ? r.four.trim().toUpperCase() : "";
    const four = fourRaw ? fourRaw : null;
    if (four !== null && !FOUR_RE.test(four)) return { ok: false, error: "A four-letter type looks like INFP or ESTJ." };
    let bigFive: number[] | null = null;
    if (Array.isArray(r.bigFive)) {
      if (r.bigFive.length !== 5) return { ok: false, error: "Slide all five." };
      bigFive = r.bigFive.map((x) => dial(x, 50));
    }
    if (en === null && four === null && bigFive === null) return { ok: false, error: "Choose at least one: an Enneagram type, four letters, or the five sliders." };
    return { ok: true, data: { enneagram: en, four, bigFive } as LensData[L] };
  }
  const text = typeof r.text === "string" ? r.text.replace(/\s+/g, " ").trim() : "";
  if (!text) return { ok: false, error: "Say or type how you like to be helped." };
  if (text.length > MAX_OWN_WORDS) return { ok: false, error: `That holds up to ${MAX_OWN_WORDS} characters.` };
  return { ok: true, data: { text } as LensData[L] };
}

/**
 * What a lens changes, in the words the member reads on the lens card AND the
 * words the model reads. One sentence each, built from fixed words. `own` is
 * the member's own text and is fenced by the caller, never mixed in here.
 */
export function lensNote<L extends LensId>(lens: L, d: LensData[L]): string {
  if (lens === "vedic") {
    const v = d as VedicLens;
    const tone = TONE_LINE[RASHI_TONE[v.rashi % 4]];
    const where = v.nakshatra === null ? RASHI[v.rashi] : `${RASHI[v.rashi]}, in ${NAKSHATRA[v.nakshatra]}`;
    return `Their Vedic Moon is in ${where}. Keep your tone ${tone}.`;
  }
  if (lens === "type") {
    const t = d as TypeLens;
    const parts: string[] = [];
    if (t.enneagram) parts.push(`Enneagram ${t.enneagram} (${ENNEAGRAM[t.enneagram - 1]}): ${ENNEAGRAM_TONE[t.enneagram - 1]}`);
    if (t.four) {
      const f = t.four;
      parts.push(
        `Four-letter type ${f}: ${f[0] === "I" ? "give them time to reply" : "think out loud with them"}, ${f[2] === "F" ? "lead with how things land for people" : "lead with the reasons"}.`,
      );
    }
    if (t.bigFive) {
      const hi = BIG_FIVE.filter((_, i) => (t.bigFive as number[])[i] >= 70);
      const lo = BIG_FIVE.filter((_, i) => (t.bigFive as number[])[i] <= 30);
      if (hi.length || lo.length) parts.push(`Big Five: ${[hi.length ? `high ${hi.join(", ")}` : "", lo.length ? `low ${lo.join(", ")}` : ""].filter(Boolean).join("; ")}.`);
    }
    return parts.join(" ");
  }
  return "They described, in their own words, how they like to be helped (the member.style block).";
}

/** Closes every note a model reads. */
export const LENS_NEVER =
  "These notes shape only how you talk to this member. Never describe, rank or judge them by any of it, never tell them what they can or cannot do because of it, and never mention it to anyone else.";

/** Who may see a lens: its member, nobody else. Said on every lens card. */
export const LENS_PRIVACY =
  "Only you and your companions see this. It never ranks or judges anyone. Delete it any time, and leaving the village erases it.";

export interface LensView<L extends LensId = LensId> {
  lens: L;
  data: LensData[L];
  /** What it changes, as the member reads it. */
  note: string;
  updatedAt: string;
}

// ── The welcome ─────────────────────────────────────────────────────────────

/** The beats, in order. The egg holds 1 to 4; the tour is 5; the moon promise 6; the bond 7. */
export const WELCOME_BEATS = ["arrival", "name", "personality", "lenses", "family", "tour", "moon", "bonded"] as const;
export type WelcomeBeat = (typeof WELCOME_BEATS)[number];
export const WELCOME_STATUSES = ["open", "skipped", "done"] as const;
export type WelcomeStatus = (typeof WELCOME_STATUSES)[number];

export interface WelcomeState {
  beat: number;
  status: WelcomeStatus;
  /** When it last changed. */
  at: string;
}

/** Read `prefs.companionWelcome`. Null: never opened. */
export function readWelcome(prefs: unknown): WelcomeState | null {
  const w = prefs && typeof prefs === "object" ? (prefs as Record<string, unknown>).companionWelcome : null;
  if (!w || typeof w !== "object") return null;
  const r = w as Record<string, unknown>;
  const beat = Number(r.beat);
  if (!Number.isInteger(beat) || beat < 0 || beat >= WELCOME_BEATS.length) return null;
  if (!(WELCOME_STATUSES as readonly string[]).includes(String(r.status))) return null;
  return { beat, status: r.status as WelcomeStatus, at: typeof r.at === "string" ? r.at : "" };
}

/** Check a welcome write. Returns the clean value, or an error. */
export function writeWelcome(v: unknown, at: string): { ok: true; state: WelcomeState } | { ok: false; error: string } {
  const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const beat = Number(r.beat);
  if (!Number.isInteger(beat) || beat < 0 || beat >= WELCOME_BEATS.length) return { ok: false, error: "That step is not one of the welcome's." };
  if (!(WELCOME_STATUSES as readonly string[]).includes(String(r.status))) return { ok: false, error: "The welcome is open, skipped or done." };
  return { ok: true, state: { beat, status: r.status as WelcomeStatus, at } };
}

/**
 * A finished welcome stays finished (H7, Rye 15 Nov 2026). Once it is done,
 * only another "done" may be saved over it: an old tab still open at an earlier
 * beat cannot move it back to open or skipped. The server refuses that write
 * with the finished state, and the old tab reloads to it.
 */
export function welcomeMoveRefused(prev: WelcomeState | null, next: Pick<WelcomeState, "status">): boolean {
  return prev?.status === "done" && next.status !== "done";
}

/** The payload of `GET /api/me/companion-welcome`. */
export interface WelcomePayload {
  state: WelcomeState | null;
  lenses: LensView[];
  /** The Gene Keys reading, when the module is on. `guideUses`: the member's "let my guide use my lines" switch. */
  geneKeys: { has: boolean; profile: string | null; hdType: string | null; guideUses: boolean } | null;
}
