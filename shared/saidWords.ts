/**
 * WHAT A SERVER-BUILT MODEL SAID, AS KEYS AND ARGUMENTS, so the client can say it again in the reader's language
 * (the lead, 26 Nov 2026: the whole site in Spanish; the mechanism agreed with the coordinator the same day).
 *
 * A model the server builds (the circle card, the player card) bakes English sentences into its fields, from a
 * words table such as CIRCLE_CARD_WORDS. The server translates nothing, and the English stays exactly where it
 * is. While it builds, it reads the table through `sayRecorder`, which notes beside every sentence it hands out the
 * table key and the arguments that made it, and beside every day it formats the instant and zone it came from. The
 * model ships that record as `said`. The client, which holds the same table in the reader's language, finds a
 * field's English in `said` and says it again with the same key and arguments; an English reader, an older
 * server, or a sentence it cannot find reads the field as sent.
 *
 * `pruneSaid` keeps only what the finished model still shows, so a part the server took away for this reader (a
 * visitor's card) leaves nothing behind in the record.
 */

export type SaidArg = string | number | readonly string[];

/** One sentence: the table key it came from (a dotted path for a nested one) and its arguments, if it took any. */
export interface SaidWord {
  k: string;
  a?: SaidArg[];
}

/** One day as the server formatted it: the instant or civil date, the zone, and whether the year was shown. */
export interface SaidDay {
  iso: string;
  tz: string | null;
  year: boolean;
}

export interface Said {
  /** By the English the model carries. */
  words: Record<string, SaidWord>;
  /** By the English day the model carries. */
  days: Record<string, SaidDay>;
}

/**
 * A words table read through a recorder. `W` behaves exactly like the table: a constant reads as itself and a
 * function returns what it returns. Each string handed out is noted in `said.words`.
 */
export function sayRecorder<T extends object>(table: T): { W: T; said: Said; day: (formatted: string | null, iso: string | null | undefined, tz: string | null | undefined, year: boolean) => string | null } {
  const said: Said = { words: {}, days: {} };
  const note = (english: unknown, k: string, a?: SaidArg[]) => {
    if (typeof english === "string" && english && !(english in said.words)) said.words[english] = a && a.length ? { k, a } : { k };
  };
  const wrap = (obj: object, prefix: string): any =>
    new Proxy(obj, {
      get(target, prop, receiver) {
        const v = Reflect.get(target, prop, receiver);
        if (typeof prop !== "string") return v;
        const k = prefix ? `${prefix}.${prop}` : prop;
        if (typeof v === "string") {
          note(v, k);
          return v;
        }
        if (typeof v === "function") {
          return (...args: SaidArg[]) => {
            const out = (v as (...x: SaidArg[]) => unknown)(...args);
            note(out, k, args);
            return out;
          };
        }
        if (v && typeof v === "object" && !Array.isArray(v)) return wrap(v, k);
        return v;
      },
    });
  const day = (formatted: string | null, iso: string | null | undefined, tz: string | null | undefined, year: boolean) => {
    if (formatted && iso && !(formatted in said.days)) said.days[formatted] = { iso: String(iso), tz: tz ?? null, year };
    return formatted;
  };
  return { W: wrap(table, "") as T, said, day };
}

/** Every string a model carries, at any depth, leaving out its own record. */
function stringsIn(model: unknown, out: Set<string>, seen = new Set<unknown>()): Set<string> {
  if (typeof model === "string") out.add(model);
  else if (model && typeof model === "object" && !seen.has(model)) {
    seen.add(model);
    for (const [key, v] of Object.entries(model)) if (key !== "said") stringsIn(v, out, seen);
  }
  return out;
}

/** The record cut to what the model still shows. A day is kept when a kept sentence names it. */
export function pruneSaid(said: Said | undefined, model: unknown): Said | undefined {
  if (!said) return said;
  const shown = stringsIn(model, new Set());
  const words: Record<string, SaidWord> = {};
  for (const [english, w] of Object.entries(said.words)) if (shown.has(english)) words[english] = w;
  const kept = Object.values(words).flatMap((w) => (w.a ?? []).filter((x): x is string => typeof x === "string"));
  const days: Record<string, SaidDay> = {};
  for (const [english, d] of Object.entries(said.days)) if (kept.includes(english) || shown.has(english)) days[english] = d;
  return { words, days };
}
