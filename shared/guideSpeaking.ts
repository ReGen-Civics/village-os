/**
 * THE SPEAKING DIAL: how much the guide says, one setting per person.
 *
 * The founder, 27 Nov 2026 (Q12): "a speaking dial per person: quiet, at
 * decisions, walk with me". And on 28 Nov, ruling on her voice: "Go with warm
 * and plain with the brief and quiet toggle." Warm and plain is the voice
 * everywhere. Brief and quiet is the `quiet` setting of this dial: the same
 * facts in the fewest words.
 *
 * All three settings are in the type now, so the data never has to change
 * shape. Only `quiet` behaves differently today: `decisions` (the default) and
 * `walk` both speak warm and plain, and no screen offers `walk` as a choice
 * until something follows from it.
 *
 * A closed value. Anything else, from a browser or a request, reads as the
 * default. Pure: no clock, no storage, read by the client and the server.
 */
export const GUIDE_SPEAKING = ["quiet", "decisions", "walk"] as const;
export type GuideSpeaking = (typeof GUIDE_SPEAKING)[number];

/** What a person who never chose gets: she speaks at decisions, warm and plain. */
export const DEFAULT_GUIDE_SPEAKING: GuideSpeaking = "decisions";

/** A stored or sent value read back as a setting. Anything unknown is the default. */
export function readGuideSpeaking(v: unknown): GuideSpeaking {
  return typeof v === "string" && (GUIDE_SPEAKING as readonly string[]).includes(v) ? (v as GuideSpeaking) : DEFAULT_GUIDE_SPEAKING;
}

/** Whether a setting is the brief and quiet one. */
export function speaksBriefly(setting: GuideSpeaking): boolean {
  return setting === "quiet";
}
