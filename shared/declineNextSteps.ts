/**
 * A KIND NO'S NEXT STEPS (the lead, 20 Nov 2026, idea 20): when an application is declined, the
 * decline letter offers three ways to stay close, each a link.
 *
 *   - the waitlist for other roles, the /roles page where a coming-soon card says "Notify me";
 *   - open quests, /quests;
 *   - the Founding Seeder path, the same tile "Other ways to join" shows on /roles
 *     (shared/otherWays.ts: its title and line, and `org.stay_close_link` for where it goes).
 *
 * The letter is still sent by a person through the existing decline path. This only builds the
 * block of lines that path adds. The words are VILLAGE DATA, four settings under "The founding
 * team" in shared/gameVariables.ts, with defaults below. A setting that still holds its default
 * is said in the applicant's own language; a village's own words are said as written.
 *
 * PURE: the server reads the settings and hands them in as `get`.
 */
import type { ApplicantLanguage } from "./applicantWords";
import { OTHER_WAYS_DEFAULTS, OTHER_WAYS_KEYS, SEEDER_FALLBACK_HREF, safeHref } from "./otherWays";

export const DECLINE_STEPS_KEYS = {
  on: "org.decline_next_steps_on",
  intro: "org.decline_next_steps_intro",
  waitlist: "org.decline_next_steps_waitlist",
  quests: "org.decline_next_steps_quests",
} as const;

/** The defaults. shared/declineNextSteps.test.ts holds them equal to the registered settings'. */
export const DECLINE_STEPS_DEFAULTS = {
  intro: "If you would like to stay close, here are three ways in.",
  waitlist: "Other roles are coming soon. Ask to hear when one opens:",
  quests: "Quests anyone can take today:",
} as const;

const ES = {
  intro: "Si quiere seguir cerca, aquí hay tres maneras de entrar.",
  waitlist: "Otros roles se abrirán pronto. Pida que le avisemos cuando se abra uno:",
  quests: "Misiones que cualquiera puede tomar hoy:",
  seederTitle: "Hágase Sembrador Fundador",
  seederLine: "¿Quiere vivir aquí algún día? Empiece por el camino de residente.",
} as const;

type Key = Exclude<(typeof DECLINE_STEPS_KEYS)[keyof typeof DECLINE_STEPS_KEYS], "org.decline_next_steps_on"> | (typeof OTHER_WAYS_KEYS)[keyof typeof OTHER_WAYS_KEYS] | "org.stay_close_link";

const word = (raw: unknown, max = 300): string => (typeof raw === "string" ? raw.trim().slice(0, max) : "");

/** The block's text lines, paragraph breaks included, or none when the village turned the block off. */
export function declineNextStepsLines(get: (key: Key) => string, o: { site: string; on: boolean; lang?: ApplicantLanguage | null }): string[] {
  if (!o.on) return [];
  const es = o.lang === "es";
  const say = (raw: unknown, base: string, spanish: string, max?: number) => {
    const w = word(raw, max);
    return !w || w === base ? (es ? spanish : base) : w;
  };
  const site = String(o.site ?? "").trim().replace(/\/+$/, "");
  const abs = (href: string) => (href.startsWith("/") ? `${site}${href}` : href);
  const seederTitle = say(get(OTHER_WAYS_KEYS.seederTitle), OTHER_WAYS_DEFAULTS.seederTitle, ES.seederTitle, 200);
  const seederLine = say(get(OTHER_WAYS_KEYS.seederLine), OTHER_WAYS_DEFAULTS.seederLine, ES.seederLine);
  const seederHref = safeHref(get("org.stay_close_link"), SEEDER_FALLBACK_HREF);
  return [
    say(get(DECLINE_STEPS_KEYS.intro), DECLINE_STEPS_DEFAULTS.intro, ES.intro),
    "",
    say(get(DECLINE_STEPS_KEYS.waitlist), DECLINE_STEPS_DEFAULTS.waitlist, ES.waitlist),
    abs("/roles"),
    "",
    say(get(DECLINE_STEPS_KEYS.quests), DECLINE_STEPS_DEFAULTS.quests, ES.quests),
    abs("/quests"),
    "",
    `${seederTitle}. ${seederLine}`,
    abs(seederHref),
  ];
}
