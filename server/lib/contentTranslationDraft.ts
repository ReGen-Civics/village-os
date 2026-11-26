/**
 * The machine's draft of the village's own words in another language
 * (server/routes/contentTranslations.ts asks; this only shapes the ask and
 * reads the answer). The drafts it returns are checked like a person's before
 * any is stored, and readers see them marked until a person approves them.
 */
import { autonym } from "../../shared/i18nLocales";
import { parseJsonReply } from "./assistant";

/** The system prompt: the catalog's voice, the words in braces kept, nothing added. */
export function translationSystemPrompt(locale: string, village: string): string {
  return [
    `You translate the words of ${village}, a regenerative village, from English into ${autonym(locale)} (${locale}).`,
    "Write as the village writes: warm, plain and direct. In Spanish, address every reader as usted, members included (the lead, 26 Nov 2026), never tú.",
    "In Spanish the village says aldea for village, ficha de rol for role card, luna for moon, and keeps Steward as it is.",
    "Keep every word in braces, such as {village}, exactly as it is. Keep **bold** markers around the same words. Add no markup, notes or quotation marks.",
    "Translate meaning, not word for word, and keep each translation about as long as its English.",
    'Answer with one JSON object and nothing else: {"translations": {"<id>": "<translation>", ...}}, one entry for every id you were given.',
  ].join("\n");
}

/** The message: each field's English under its id. */
export function translationMessage(items: ReadonlyArray<{ field: string; english: string }>): string {
  return JSON.stringify({ translate: Object.fromEntries(items.map((i) => [i.field, i.english])) });
}

/** The drafts in an answer, by field; only fields that were asked for, only strings. */
export function readTranslationReply(text: string, asked: ReadonlyArray<{ field: string }>): Record<string, string> {
  const got = parseJsonReply<{ translations?: Record<string, unknown> }>(text, {}).translations ?? {};
  const out: Record<string, string> = {};
  for (const { field } of asked) {
    const v = got[field];
    if (typeof v === "string" && v.trim()) out[field] = v;
  }
  return out;
}
