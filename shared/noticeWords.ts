/**
 * NOTICES IN THE VILLAGE'S WORDS (gap G6).
 *
 * About a hundred notice kinds have titles the server writes, and a blurb that
 * explains each kind in a member's notice settings. A village may now set, per
 * kind, its own title and its own blurb, in the content section `app-notices`
 * (Admin, Make it yours, Notices):
 *
 *   { "ballot_opened": { "title": "Council called: {default}", "blurb": "..." } }
 *
 * `{default}` is the platform's own title for that notice, with whatever it
 * names (a person, a quest), so a village can keep the particulars and put its
 * own words around them. The village's nouns (`{circle}`, `{ballot}` and the
 * rest, gap G4) and its name (`{village}`) fill in too. Lengths are capped, and
 * a kind the village left alone reads exactly as before.
 */

import { kindWordsOf } from "./notificationKindWords";

export const NOTICE_SECTION = "app-notices";
export const NOTICE_TITLE_MAX = 120;
export const NOTICE_BLURB_MAX = 300;

export type NoticeWords = Record<string, { title?: string; blurb?: string }>;

const KIND = /^[a-z0-9_.-]{1,64}$/;
const clean = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

/** The stored section, cleaned: known-shaped kinds only, capped words only. */
export function noticeWordsOf(raw: unknown): NoticeWords {
  const out: NoticeWords = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [kind, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!KIND.test(kind) || !v || typeof v !== "object") continue;
    const title = clean((v as Record<string, unknown>).title, NOTICE_TITLE_MAX);
    const blurb = clean((v as Record<string, unknown>).blurb, NOTICE_BLURB_MAX);
    if (title || blurb) out[kind] = { ...(title ? { title } : {}), ...(blurb ? { blurb } : {}) };
  }
  return out;
}

/** Why the content route must refuse this section, or null. */
export function noticeWordsProblem(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "Send your notice words as { kind: { title, blurb } }.";
  for (const [kind, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!KIND.test(kind)) return `"${kind}" is not a notice kind.`;
    if (!v || typeof v !== "object") return `Send the words for ${kind} as { title, blurb }.`;
    const { title, blurb } = v as Record<string, unknown>;
    if (title !== undefined && (typeof title !== "string" || title.trim().length > NOTICE_TITLE_MAX)) return `A notice title is ${NOTICE_TITLE_MAX} characters at most (${kind}).`;
    if (blurb !== undefined && (typeof blurb !== "string" || blurb.trim().length > NOTICE_BLURB_MAX)) return `A notice description is ${NOTICE_BLURB_MAX} characters at most (${kind}).`;
  }
  return null;
}

/** Fill `{default}` and the village's words into one template. A word with no value stays as typed. */
export function fillNoticeWords(template: string, platform: string, vars: Readonly<Record<string, string>>): string {
  return template.replace(/\{([a-z][a-z-]*)\}/g, (whole, name: string) =>
    name === "default" ? platform : Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : whole,
  );
}

/** A notice's title in the village's words, or the platform's when the village set none. Never longer than the column. */
export function noticeTitle(words: NoticeWords, kind: string, platform: string, vars: Readonly<Record<string, string>>): string {
  const own = words[kind]?.title;
  return (own ? fillNoticeWords(own, platform, vars) : platform).slice(0, 255);
}

/**
 * Every kind the village wrote a description for, filled, keyed by kind: what
 * /api/game/config serves the bell, so the bell needs none of this file.
 * `{default}` is the platform's own blurb for that kind.
 */
export function noticeBlurbsFor(words: NoticeWords, vars: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [kind, w] of Object.entries(words)) {
    if (w.blurb) out[kind] = fillNoticeWords(w.blurb, kindWordsOf(kind).blurb, vars);
  }
  return out;
}

/** A notice kind's explanation in the village's words, or the platform's. */
export function noticeBlurb(words: NoticeWords, kind: string, platform: string, vars: Readonly<Record<string, string>>): string {
  const own = words[kind]?.blurb;
  return own ? fillNoticeWords(own, platform, vars) : platform;
}
