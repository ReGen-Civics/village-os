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
  const was = { W, sayDay, noteDay, sayList };
  W = rec.W;
  noteDay = rec.day;
  sayDay = (iso, withYear = true, timeZone) => rec.day(formatDay(iso, withYear, timeZone), iso, timeZone, withYear);
  sayList = (items, bare) => {
    const out = joinList(items);
    if ((items.length > 1 || bare) && out && !(out in rec.said.words)) rec.said.words[out] = { k: LIST_KEY, a: [(bare ?? items).slice()] };
    return out;
  };
  try {
    return { out: build(), said: rec.said };
  } finally {
    ({ W, sayDay, noteDay, sayList } = was);
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
