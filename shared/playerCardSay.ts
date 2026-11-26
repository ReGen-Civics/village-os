/**
 * THE PLAYER CARD'S WORDS AS THE BUILDERS READ THEM (the lead, 26 Nov 2026: the whole site in Spanish).
 *
 * `buildPlayerCard` (shared/playerCard.ts) and the pieces it calls (shared/playerCardHero.ts,
 * shared/playerCardCcos.ts) read CARD_WORDS through `W` here, format their days through `sayDay`
 * and join names through `sayList`. Outside a build these are the plain table, `formatDay` and
 * `joinList`. During one, `recordingWords` points them at a recorder (shared/saidWords.ts), so the
 * card carries what each sentence was made from and the client can say it again in the reader's
 * language. The English is exactly what it was.
 *
 * ES modules export live bindings, so a module that imports `W` reads whichever table is current.
 * The build is synchronous, so one module-level slot is safe, and it is put back whatever happens.
 */
import { CARD_WORDS } from "./playerCardWords";
import { formatDay, joinList } from "./roleSheet";
import { pruneSaid, sayRecorder, type Said } from "./saidWords";

/** The key a joined list of names is noted under: not a table entry, said again with the reader's "and". */
export const LIST_KEY = "$list";

/** The key a list joined by a plain separator is noted under; its first argument is the items, its second the separator. */
export const JOIN_KEY = "$join";

/** The table keys the role health and handover words are noted under (shared/playerCardWords.ts, shared/roleHandover.ts). */
export const HEALTH_PREFIX = "health";
export const HANDOVER_PREFIX = "handover";

/**
 * Another words table read through the recorder while the card is built, its keys noted under `prefix` (the role
 * health and handover words, shared/playerCardHealth.ts). Outside a build it is the table itself. The caller hands
 * the table in, so this file imports none of them and the client bundle's chunks stay as they were.
 */
export let sayTable = <T extends object>(table: T, _prefix: string): T => table;

/** Items joined by `sep`, noted while recording so each item can be said again. */
export let sayJoin = (items: string[], sep: string): string => items.join(sep);

export let W: typeof CARD_WORDS = CARD_WORDS;

/** `formatDay`, noted while recording. */
export let sayDay = (iso: string | null | undefined, withYear = true, timeZone?: string | null): string | null => formatDay(iso, withYear, timeZone);

/** A day the caller formatted itself, noted while recording. */
export let noteDay = (formatted: string | null, _iso: string | null | undefined, _tz: string | null | undefined, _year: boolean): string | null => formatted;

/**
 * `joinList`, noted while recording. `bare` is the list as another language says it, when the English
 * dressed each item ("the Land circle"): the client joins `bare` in the reader's language.
 */
export let sayList = (items: string[], _bare?: string[]): string => joinList(items);

/** Runs `build` with the words recorded, and returns what it built with the record. */
export function recordingWords<T>(build: () => T): { out: T; said: Said } {
  const rec = sayRecorder(CARD_WORDS);
  const tables = new Map<string, { table: object; rec: ReturnType<typeof sayRecorder> }>();
  const was = { W, sayDay, noteDay, sayList, sayTable, sayJoin };
  W = rec.W;
  sayTable = <T extends object>(table: T, prefix: string): T => {
    let t = tables.get(prefix);
    if (!t || t.table !== table) {
      t = { table, rec: sayRecorder(table) };
      tables.set(prefix, t);
    }
    return t.rec.W as T;
  };
  sayJoin = (items, sep) => {
    const out = items.join(sep);
    if (items.length > 1 && !(out in rec.said.words)) rec.said.words[out] = { k: JOIN_KEY, a: [items.slice(), sep] };
    return out;
  };
  noteDay = rec.day;
  sayDay = (iso, withYear = true, timeZone) => rec.day(formatDay(iso, withYear, timeZone), iso, timeZone, withYear);
  sayList = (items, bare) => {
    const out = joinList(items);
    if ((items.length > 1 || bare) && out && !(out in rec.said.words)) rec.said.words[out] = { k: LIST_KEY, a: [(bare ?? items).slice()] };
    return out;
  };
  try {
    const out = build();
    // The health and handover words join the card's record under their own prefix.
    tables.forEach(({ rec: r }, prefix) => {
      for (const english of Object.keys(r.said.words)) {
        const w = r.said.words[english];
        if (!(english in rec.said.words)) rec.said.words[english] = { ...w, k: `${prefix}.${w.k}` };
      }
    });
    return { out, said: rec.said };
  } finally {
    ({ W, sayDay, noteDay, sayList, sayTable, sayJoin } = was);
  }
}

/**
 * The record cut to what the card still shows (`pruneSaid`). A sentence is kept while the card shows it,
 * alone or inside a longer line: "October Moon" inside "October Moon · Day 3 of 92", "2 roles" inside
 * "2 roles · 1 open task this moon". Whatever is kept is already in the words the card shows, so the
 * record reveals nothing the card does not.
 */
export function pruneCardSaid(said: Said | undefined, card: unknown): Said | undefined {
  if (!said) return said;
  const shown: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") shown.push(v);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (k !== "said") walk(x);
  };
  walk(card);
  const inside = [...Object.keys(said.words), ...Object.keys(said.days)].filter((english) => shown.some((s) => s.includes(english)));
  return pruneSaid(said, { card, inside });
}
