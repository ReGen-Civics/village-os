/**
 * A SPLIT SAID BY HAND THAT THE CARD DOES NOT PAY (the coordinator, 23 Nov 2026).
 *
 * The split a role card shows comes from data: the card's own `payShape`, else the village's `org.pay_shape`
 * (`cardPay`). A card's words (its aim, its accountabilities, its pay note, its split note, any section line) can
 * still name a split by hand, "60/40", "60% cash", "40% tokens", and once the shape changes those words say a split
 * nobody pays. This reads the splits a text names and compares them with the shape in force.
 *
 * What it reads, sentence by sentence:
 *   - a percent with a share after it: "60% cash", "40% in tokens", "5% credits", "55% paid in Harbour tokens";
 *   - a share with a percent after it: "cash 60%", "Equity: 40%";
 *   - a slash split adding to 100, in a sentence that speaks of pay ("a 60/40 split", "paid 50/50/0"), read in the
 *     card's own order: cash, then tokens, then credits. "24/7" adds to 31 and is never a split.
 * Only shares the text names are compared: "60% cash" alone agrees with any shape whose cash share is 60.
 *
 * WHAT IT DOES NOT SEE: a split written in words ("half in cash"), a percent whose share is two sentences away, and
 * a shape whose labels read as no share (`partsOfShape` null), which it leaves alone rather than guess.
 *
 * Pure: no pool, no clock.
 */
import { partsOfShape, type PayShare } from "./rewardShare";

export type SplitPart = "cash" | "equity" | "credits";

export interface StatedSplit {
  /** The words as written, for the sentence that refuses them. */
  said: string;
  parts: Partial<Record<SplitPart, number>>;
}

export interface SplitDrift {
  /** Where the words are: a word field's key, or `sections.<key>`. */
  field: string;
  said: string;
}

const PAY_WORD = /\b(cash|tokens?|equity|credits?|split|pay|paid|compensation|rewards?|contribution)\b/i;

/** Which share a few words name, or null. Credits before tokens, so "Village Credits tokens" reads as credits. */
function partOf(words: string): SplitPart | null {
  const w = words.toLowerCase();
  if (/\bcash\b/.test(w)) return "cash";
  if (/\bcredits?\b|\busage\b/.test(w)) return "credits";
  if (/\btokens?\b|\bequity\b|\bcontribution\b/.test(w)) return "equity";
  return null;
}

/** The splits one text names, in the order it names them. */
export function statedSplits(text: string): StatedSplit[] {
  const out: StatedSplit[] = [];
  for (const sentence of String(text ?? "").split(/(?<=[.!?;])\s+|\n+/)) {
    // A slash split: two or three whole percents adding to 100, in a sentence about pay.
    for (const m of Array.from(sentence.matchAll(/(?<![\d/])(\d{1,3})\s*\/\s*(\d{1,3})(?:\s*\/\s*(\d{1,3}))?(?![\d/])/g))) {
      const nums = [m[1], m[2], m[3]].filter((x): x is string => x !== undefined).map(Number);
      if (nums.reduce((n, x) => n + x, 0) !== 100 || !PAY_WORD.test(sentence)) continue;
      const parts: StatedSplit["parts"] = { cash: nums[0], equity: nums[1] };
      if (nums.length === 3) parts.credits = nums[2];
      out.push({ said: m[0].trim(), parts });
    }
    // A percent, then the share it names (a filler word or two between).
    // The share is the first word, or the second when the first is a token's own name ("Harbour tokens"), so
    // "60% commitment and cash" names no share.
    for (const m of Array.from(sentence.matchAll(/(\d{1,3})\s*%\s*(?:(?:paid\s+)?(?:in|as|of)\s+)?([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F'-]*)(?:\s+([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F'-]*))?/g))) {
      const second = m[3] && /^(tokens?|credits?)$/i.test(m[3]) ? m[3] : "";
      const part = partOf(m[2]) ?? (second ? partOf(second) : null);
      if (part) out.push({ said: `${m[1]}% ${partOf(m[2]) ? m[2] : `${m[2]} ${second}`}`, parts: { [part]: Number(m[1]) } });
    }
    // A share, then its percent: "cash 60%", "Equity: 40%". Never a share that a percent just named ("60% cash 40% tokens").
    for (const m of Array.from(sentence.matchAll(/(?<!%[\sA-Za-z\u00C0-\u024F]{0,24})\b(cash|equity|credits?|tokens?)\s*[:=]?\s*(\d{1,3})\s*%/gi))) {
      const part = partOf(m[1]);
      if (part) out.push({ said: m[0].trim(), parts: { [part]: Number(m[2]) } });
    }
  }
  return out;
}

/**
 * The first split the texts name that the shape in force does not pay, or null. Null too when the shape is empty or
 * its labels read as no share: there is nothing certain to compare with.
 */
export function splitDrift(texts: ReadonlyArray<{ field: string; text: string }>, shape: readonly PayShare[]): SplitDrift | null {
  const parts = partsOfShape(shape);
  if (!parts) return null;
  for (const { field, text } of texts) {
    for (const s of statedSplits(text)) {
      const off = (Object.entries(s.parts) as Array<[SplitPart, number]>).some(([k, v]) => parts[k] !== v);
      if (off) return { field, said: s.said };
    }
  }
  return null;
}

/** "60% Cash, 40% Equity, 0% Credits": the shape as stored, every share said. */
export function storedSplitWords(shape: readonly PayShare[]): string {
  return shape.map((s) => `${s.pct}% ${s.label}`).join(", ");
}

/** The refusal: the words, where they are, and the split the card pays. */
export function splitDriftProblem(d: SplitDrift, shape: readonly PayShare[], fieldLabel: string): string {
  return `${fieldLabel} says "${d.said}", but this card's split is ${storedSplitWords(shape)}. Change the words to match, or change the split under How compensation works.`;
}

/** Every line of a word field's value, a string or a list of them. */
export function textOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string").join("\n");
  return "";
}
