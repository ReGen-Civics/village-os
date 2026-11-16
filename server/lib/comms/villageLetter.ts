/**
 * A LETTER IN THE VILLAGE'S OWN DRESS: the words a route wrote in code (a
 * subject, plain text, maybe one button), set in the shared letter frame
 * (shared/comms/letterFrame.ts) with the village's band, a team's signature
 * and, for a reader the village would love to see again, the come-and-play
 * block (shared/comms/comeAndPlay.ts).
 *
 * WHAT IT READS, once per letter: the village from the brand overlay
 * (`loadEmailVillage`, the same read every comms email makes), each module's
 * live lifecycle (`effectiveLifecycle`), and three settings: the newsletter
 * (`org.newsletter_link`), the way to stay close (`org.stay_close_name` and
 * `org.stay_close_link`) and the team that signs (`org.letter_team`).
 *
 * THE OTHER LANES CALL THIS. A letter built later, such as the 90-day close or
 * an expired invitation's letter, passes its words to `dressLetter` with
 * `comeAndPlay: "public"` and gets the same invitation every applicant letter
 * carries. A member email that wants the block as a footer calls
 * `comeAndPlayFor` with `"members"` and hands the result to `composeEmail`.
 */
import type { Pool } from "mysql2/promise";
import type { ApplicantLanguage } from "../../../shared/applicantWords";
import { comeAndPlayWords, renderComeAndPlay, stayCloseFrom, type PlayAudience, type PlayDoor } from "../../../shared/comms/comeAndPlay";
import { bodyFromText, letterPalette, renderLetterFrame, type LetterBody, type LetterFrame } from "../../../shared/comms/letterFrame";
import type { EmailVillage } from "../../../shared/comms/letterHtml";
import { GAME_CONFIG } from "../../../shared/gameConfig";
import { safeHref } from "../../../shared/otherWays";
import { readConfigDocument } from "../../repos/appConfigDocs";
import { effectiveLifecycle } from "../modules";
import { stringVar } from "../variables";
import { loadEmailVillage } from "./render";

export interface LetterWords {
  subject: string;
  text: string;
  button?: { label: string; url: string } | null;
}

export interface DressOptions {
  lang?: ApplicantLanguage | null;
  /** Who the block is for, or false for a letter with no block. */
  comeAndPlay: PlayAudience | false;
  /** Doors the letter already names in its own words. */
  skip?: readonly PlayDoor[];
  /** The village, when the caller already read it for a batch. */
  village?: EmailVillage;
  /**
   * The village's name as the letter's own words say it (the route's
   * `projectName()`), so the band, the signature and the footer never name a
   * different village from the subject line.
   */
  villageName?: string;
}

const nonBlank = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** The hero picture as an email may load it: https on the village's own host, with the alt text the founder typed. */
async function heroOf(pool: Pool, village: EmailVillage): Promise<{ url: string; alt: string } | null> {
  let brand: Record<string, any> | null = null;
  try {
    brand = await readConfigDocument<Record<string, any>>(pool, "brand");
  } catch {
    brand = null;
  }
  const raw = nonBlank(brand?.images?.hero) || GAME_CONFIG.images.hero;
  if (!raw || !village.url) return null;
  try {
    const site = new URL(village.url);
    const u = new URL(raw, site);
    if (u.protocol !== "https:" || u.host !== site.host) return null;
    const alt = typeof brand?.images?.heroAlt === "string" ? brand.images.heroAlt.trim() : (GAME_CONFIG.images.heroAlt ?? "").trim();
    return { url: u.toString(), alt: alt || village.name };
  } catch {
    return null;
  }
}

/** The come-and-play block for this village and this reader. */
export async function comeAndPlayFor(
  pool: Pool,
  village: EmailVillage,
  o: { audience: PlayAudience; lang?: ApplicantLanguage | null; skip?: readonly PlayDoor[] },
): Promise<LetterBody> {
  return renderComeAndPlay({
    site: village.url,
    audience: o.audience,
    lifecycleOf: (id) => effectiveLifecycle(id),
    newsletter: safeHref(stringVar("org.newsletter_link"), "") || null,
    stayClose: stayCloseFrom(stringVar("org.stay_close_name"), stringVar("org.stay_close_link")),
    skip: o.skip,
    lang: o.lang ?? null,
    palette: letterPalette(village.seed, village.character),
    hero: await heroOf(pool, village),
  });
}

/** The team that signs: the village's own choice, else its name. */
export function letterTeam(village: EmailVillage, lang?: ApplicantLanguage | null): string {
  return stringVar("org.letter_team").trim().slice(0, 80) || comeAndPlayWords(lang).team(village.name);
}

/** The letter, whole: subject, preheader, HTML and its plain-text twin. */
export async function dressLetter(pool: Pool, origin: string, words: LetterWords, o: DressOptions): Promise<LetterFrame> {
  const read = o.village ?? (await loadEmailVillage(pool, origin));
  const village: EmailVillage = o.villageName && o.villageName.trim() ? { ...read, name: o.villageName.trim() } : read;
  const palette = letterPalette(village.seed, village.character);
  const w = comeAndPlayWords(o.lang);
  const extra = o.comeAndPlay ? await comeAndPlayFor(pool, village, { audience: o.comeAndPlay, lang: o.lang, skip: o.skip }) : null;
  return renderLetterFrame({
    village,
    lang: o.lang ?? "en",
    subject: words.subject,
    body: bodyFromText(palette, words.text, words.button ?? null),
    signature: { signOff: w.signOff, team: letterTeam(village, o.lang) },
    extra: extra && extra.html ? extra : null,
    why: w.why(village.name),
    palette,
  });
}
