/**
 * Choose the kindest voice the device has for the page's language.
 *
 * The browser's default voice is often an old robotic one (Windows "David" or
 * "Zira"), so the companion picks for itself. Language match comes first: only
 * a voice that speaks the page's language is ever considered, because a Spanish
 * line read by an English voice is worse than any robotic Spanish voice. Within
 * the language, the name decides, and the region (es-CR, es-MX, es-US, es-419
 * for Spanish) breaks ties inside one tier, so a natural Mexican voice beats a
 * robotic Costa Rican one. The tiers:
 *
 *   1. names with "Natural" or "Neural" (Edge's online voices)
 *   2. "Premium" or "Enhanced" (Apple's downloaded voices)
 *   3. "Google" voices (Chrome)
 *   4. any other ordinary voice, local before remote
 *   5. known robotic defaults (David, Zira, eSpeak), only if nothing else speaks the language
 *
 * Novelty voices (Apple's Albert, Bad News, Bells, Zarvox and the rest) are
 * never chosen. Pure: no DOM, so it is unit tested directly.
 */

/** The fields of SpeechSynthesisVoice this reads, so a test can pass plain objects. */
export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

/** Spanish regions closest to how the village speaks, best first. */
const SPANISH_REGIONS = ["es-cr", "es-mx", "es-us", "es-419"];

/** Apple's novelty and effect voices. Matched on the first word of the name. */
const NOVELTY: readonly string[] = [
  "albert",
  "bad news",
  "bahh",
  "bells",
  "boing",
  "bubbles",
  "cellos",
  "deranged",
  "good news",
  "hysterical",
  "jester",
  "junior",
  "organ",
  "pipe organ",
  "ralph",
  "superstar",
  "trinoids",
  "whisper",
  "wobble",
  "zarvox",
  "fred",
  "kathy",
];

const ROBOTIC = /\b(david|zira|mark|espeak|e-speak)\b/i;

function isNovelty(name: string): boolean {
  const n = name.toLowerCase().trim();
  for (const word of NOVELTY) {
    if (n === word || n.startsWith(`${word} `) || n.startsWith(`${word}(`))
      return true;
  }
  return false;
}

const norm = (lang: string) => lang.replace(/_/g, "-").toLowerCase();

/**
 * How well a voice's language fits the page: lower is better, null means the
 * voice does not speak the language at all.
 */
function langRank(voiceLang: string, pageLang: string): number | null {
  const v = norm(voiceLang);
  const p = norm(pageLang);
  const base = p.split("-")[0];
  if (!base || v.split("-")[0] !== base) return null;
  if (v === p) return 0;
  if (base === "es") {
    const i = SPANISH_REGIONS.indexOf(v);
    if (i >= 0) return 1 + i;
    return 1 + SPANISH_REGIONS.length;
  }
  if (base === "en" && p === "en") {
    // A bare "en" page: prefer US, then UK, then any other English.
    if (v === "en-us") return 1;
    if (v === "en-gb") return 2;
    return 3;
  }
  return 10;
}

/** Name quality within a language: lower is better. */
function nameRank(voice: VoiceLike): number {
  const n = voice.name;
  if (/\b(natural|neural)\b/i.test(n)) return 0;
  if (ROBOTIC.test(n)) return 50;
  if (/\b(premium|enhanced)\b/i.test(n)) return 10;
  if (/\bgoogle\b/i.test(n)) return 20;
  return voice.localService === false ? 31 : 30;
}

/**
 * The best voice for `pageLang` ("en", "es", "es-CR"...), or null when no
 * voice speaks it. An empty `pageLang` is treated as English.
 */
export function pickBrowserVoice<V extends VoiceLike>(
  voices: readonly V[] | null | undefined,
  pageLang: string | null | undefined
): V | null {
  if (!voices || voices.length === 0) return null;
  const lang = (pageLang ?? "").trim() || "en";
  let best: V | null = null;
  let bestScore = Infinity;
  voices.forEach((v, i) => {
    if (!v || typeof v.name !== "string" || typeof v.lang !== "string") return;
    if (isNovelty(v.name)) return;
    const l = langRank(v.lang, lang);
    if (l === null) return;
    // Name tier, then region, then the list's own order as the last tie-break.
    const score = nameRank(v) * 10_000 + l * 100 + Math.min(i, 99);
    if (score < bestScore) {
      bestScore = score;
      best = v;
    }
  });
  return best;
}
