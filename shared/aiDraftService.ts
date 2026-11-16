/**
 * WHO READS THE WORDS AN AI DRAFT SENDS, named once for every notice that
 * says so (coordinator, 15 Nov 2026; said the way VOICE_WORDS.heardHint
 * names the browser's speech service).
 *
 * The village and platform keys are Anthropic keys (server/lib/assistant.ts
 * `resolveKey`), so a machine translation draft (server/routes/contentTranslations.ts)
 * and an applicant's voice drafts (shared/voiceDrafts.ts) both go to
 * Anthropic's Claude. Both notices read this, so neither can name a
 * different service from the other.
 *
 * Pure, so the page and the server import it alike.
 */
export const AI_DRAFT_SERVICE = "Anthropic's Claude";
