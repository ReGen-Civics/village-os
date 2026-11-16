/**
 * HOW THE VILLAGE'S GUIDE SPEAKS (gap G13).
 *
 * The guide's prompts fixed its persona: "a warm, grounded guide for <name>, a
 * regenerative village community". A village whose guide speaks in another
 * register (plainer, saltier, more formal) had no way to say so. The village
 * setting `guide.voice` is a short paragraph in the village's own words, and
 * every prompt the VILLAGE guide answers through reads it here.
 *
 * Three things hold whatever the paragraph says:
 *   - it changes tone and wording only. The prompt places it as data about
 *     tone, before the platform's own rules, and those rules still close the
 *     prompt, so a sentence in it cannot lift a rule;
 *   - it is clipped to GUIDE_VOICE_MAX and stripped of control characters;
 *   - blank is today's words exactly, so a village that sets nothing reads the
 *     same prompt as before.
 *
 * A second guide a member chose (Sera, through the Saberra bridge) speaks in
 * her own voice and never reads this.
 */

/** The longest voice a prompt carries, in characters. */
export const GUIDE_VOICE_MAX = 1000;

/** The stored setting, made safe to place in a prompt: one paragraph, no control characters, clipped. */
export function guideVoiceOf(raw: unknown): string {
  if (typeof raw !== "string") return "";
  // Bounded before any pattern runs, and lines joined by splitting rather than
  // by a pattern around the newline, so no input can make the cleaning slow.
  return raw
    .slice(0, GUIDE_VOICE_MAX * 4)
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, GUIDE_VOICE_MAX)
    .trim();
}
