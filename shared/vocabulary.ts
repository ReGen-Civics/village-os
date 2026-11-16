/**
 * A VILLAGE'S OWN NOUNS (gap G4).
 *
 * `memberName` reached page words only, and the words for the village's other
 * things (its circles, its gatherings, its badges, a member's profile and
 * record, a ballot, the constitution, the member vouch) were literals. This is
 * the village's vocabulary: a fixed list of noun slots, each with a singular
 * and a plural, the article worked out as `villageWord` already does. It lives
 * in the content section `app-vocabulary` (Admin, Make it yours, Identity,
 * "Your words for things"), and /api/game/config serves it resolved.
 *
 * Every slot defaults to the platform's word, so a village that types nothing
 * reads what it reads today. A word left blank takes the default; a plural left
 * blank is worked out from the singular.
 *
 * WHERE THE WORDS REACH: every editable page field (`{circle}`, `{circles}`,
 * `{gathering}` and the rest, through shared/pageContent/vars.ts), notice
 * titles that name one (gap G6), and any component through `useNoun`. Moving
 * the platform's own typed copy onto these words is ongoing work, string by
 * string; this is the store they all read.
 */
import { articleFor, pluralFor } from "./villageWord";

export const VOCAB_SECTION = "app-vocabulary";
export const NOUN_MAX = 32;

/** The slots, each with the platform's word and what it names, for the Admin box. */
export const NOUN_SLOTS = {
  village: { one: "village", many: "villages", what: "The place itself, the whole community" },
  circle: { one: "circle", many: "circles", what: "A team that looks after one part of the work" },
  crew: { one: "circle member", many: "circle members", what: "The people in one circle" },
  gathering: { one: "gathering", many: "gatherings", what: "An event the village holds" },
  badge: { one: "badge", many: "badges", what: "A mark of something a member did" },
  skill: { one: "skill", many: "skills", what: "Something a member can do" },
  profile: { one: "profile", many: "profiles", what: "A member's own page" },
  record: { one: "record", many: "records", what: "A member's ledger of what they hold" },
  ballot: { one: "ballot", many: "ballots", what: "A vote the village holds" },
  constitution: { one: "constitution", many: "constitutions", what: "The village's founding rules" },
  vouch: { one: "vouch", many: "vouches", what: "One member speaking for a newcomer" },
} as const;

export type NounSlot = keyof typeof NOUN_SLOTS;
export const NOUN_SLOT_IDS = Object.keys(NOUN_SLOTS) as NounSlot[];

export interface Noun {
  one: string;
  many: string;
  /** "a" or "an" for `one`. */
  a: string;
}

export type Vocabulary = Record<NounSlot, Noun>;

const clean = (v: unknown): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, NOUN_MAX) : "";

/** The stored section, resolved: every slot present, defaults for blanks, plurals worked out. */
export function vocabularyOf(raw: unknown): Vocabulary {
  const d = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = {} as Vocabulary;
  for (const slot of NOUN_SLOT_IDS) {
    const stored = d[slot] && typeof d[slot] === "object" ? (d[slot] as Record<string, unknown>) : {};
    const typedOne = clean(stored.one);
    const one = typedOne || NOUN_SLOTS[slot].one;
    const many = clean(stored.many) || (typedOne ? pluralFor(typedOne) : NOUN_SLOTS[slot].many);
    out[slot] = { one, many, a: articleFor(one) };
  }
  return out;
}

/** True when the village kept every platform word. */
export function vocabularyIsDefault(v: Vocabulary): boolean {
  return NOUN_SLOT_IDS.every((s) => v[s].one === NOUN_SLOTS[s].one && v[s].many === NOUN_SLOTS[s].many);
}

/** Why the content route must refuse this section, or null. */
export function vocabularyProblem(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "Send your words as { circle: { one, many }, ... }.";
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!(k in NOUN_SLOTS)) return `"${k}" is not one of the words a village can set.`;
    if (!v || typeof v !== "object") return `Send the word for ${k} as { one, many }.`;
    for (const part of ["one", "many"] as const) {
      const w = (v as Record<string, unknown>)[part];
      if (w !== undefined && (typeof w !== "string" || w.trim().length > NOUN_MAX)) return `The word for ${k} must be ${NOUN_MAX} characters at most.`;
    }
  }
  return null;
}

/**
 * The `{words}` a page field may use for each noun: `{circle}`, `{circles}`,
 * `{a-circle}`. The village noun is `{village-noun}`, because `{village}` has
 * always been the village's NAME.
 */
export function nounVars(v: Vocabulary): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slot of NOUN_SLOT_IDS) {
    const key = slot === "village" ? "village-noun" : slot;
    out[key] = v[slot].one;
    out[`${key}s`] = v[slot].many;
    out[`a-${key}`] = `${v[slot].a} ${v[slot].one}`;
  }
  return out;
}
