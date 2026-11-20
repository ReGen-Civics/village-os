/**
 * TOOLTIPS FOR THE VILLAGE'S OWN WORDS ON A ROLE CARD (the lead, 20 Nov 2026; the roles lane's idea 6).
 *
 * The moon word and the contribution token already carry a tip (client/src/components/MoonWord.tsx,
 * ContributionWord.tsx). A role card also says words a newcomer may not know: the anchor circle's name,
 * consent, steward, Founding Seeder, Digital Companion. Each carries a tip too.
 *
 * WHERE THE WORDS COME FROM, first match wins:
 *   1. the village's own line for that word in `org.role_card_word_tips` ("word: tip", one per line);
 *   2. for the anchor circle, the circle's own purpose, from the village's data;
 *   3. the platform's default, translated (client/src/components/roleCard/CardTips.tsx).
 * A village can also add a word of its own there, and it is tipped like the rest.
 *
 * Only the FIRST mention of a word in a passage (a line, a tile, a heading) carries the tip, as the credits
 * token does, so a line that says "consent" three times is not underlined three times.
 *
 * Pure: no pool, no clock, no Node builtins.
 */

export const WORD_TIPS_VARIABLE = "org.role_card_word_tips";

export interface WordTipLine {
  word: string;
  tip: string;
}

export const WORD_TIP_LIMITS = { lines: 20, wordChars: 40, tipChars: 280 } as const;

/** The village's lines, "word: tip", read: bullets dropped, blanks and lines without both halves skipped. */
export function readWordTipLines(v: unknown): WordTipLine[] {
  if (typeof v !== "string") return [];
  const out: WordTipLine[] = [];
  for (const raw of v.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*•])\s+/, "").trim();
    const at = line.indexOf(":");
    if (at < 1) continue;
    const word = line.slice(0, at).replace(/\s+/g, " ").trim();
    const tip = line.slice(at + 1).replace(/\s+/g, " ").trim();
    if (!word || !tip || word.length > WORD_TIP_LIMITS.wordChars) continue;
    if (out.some((t) => t.word.toLowerCase() === word.toLowerCase())) continue;
    out.push({ word, tip: tip.slice(0, WORD_TIP_LIMITS.tipChars) });
    if (out.length >= WORD_TIP_LIMITS.lines) break;
  }
  return out;
}

/**
 * The tips a card uses: the village's lines over the defaults, word by word (case does not matter), and the
 * village's extra words after them. A default whose tip is empty is dropped.
 */
export function mergeWordTips(defaults: readonly WordTipLine[], own: readonly WordTipLine[] | undefined): WordTipLine[] {
  const mine = new Map((own ?? []).map((t) => [t.word.toLowerCase(), t]));
  const out = defaults.filter((d) => d.word && d.tip && !mine.has(d.word.toLowerCase()));
  return [...(own ?? []), ...out];
}

const escaped = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A passage cut where each tipped word first appears, whole words only, longest word first so "Founding
 * Seeder" wins over "Seeder". Plural "s" is allowed ("stewards"). `seen` carries the words already tipped
 * in this passage across calls, so a card can tip a word once over several lines.
 */
export function tipParts(text: string, tips: readonly WordTipLine[], seen: Set<string> = new Set()): Array<string | { word: string; tip: string }> {
  const words = tips.filter((t) => t.word && !seen.has(t.word.toLowerCase())).sort((a, b) => b.word.length - a.word.length);
  if (!text || !words.length) return [text];
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${words.map((w) => escaped(w.word)).join("|")})(s?)(?![\\p{L}\\p{N}])`, "giu");
  const out: Array<string | { word: string; tip: string }> = [];
  let at = 0;
  for (const m of Array.from(text.matchAll(re))) {
    const hit = words.find((w) => w.word.toLowerCase() === m[1].toLowerCase());
    if (!hit || seen.has(hit.word.toLowerCase())) continue;
    seen.add(hit.word.toLowerCase());
    const i = m.index ?? 0;
    if (i > at) out.push(text.slice(at, i));
    out.push({ word: m[0], tip: hit.tip });
    at = i + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out.length ? out : [text];
}
