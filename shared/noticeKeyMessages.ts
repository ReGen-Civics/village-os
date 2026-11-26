/**
 * EVERY NOTICE KEY'S WORDS AS MESSAGES, for the server to say in the reader's language in the notice emails (the
 * coordinator, 26 Nov 2026: mail PR 3, option (a), one translation for the bell and the email).
 *
 * The same messages as client/src/lib/noticeWords.ts, which the extractor reads and whose Spanish lives in the
 * catalog. These are plain objects because the server build runs no macro; noticeWords.test.ts holds the two copies
 * to the same id each. `sayNotice` says a stored notice from them, the way the bell does (localizeNotice), and a part
 * the village wrote itself, a key it does not know, or a message the language lacks stays as stored.
 */
import { NOTICE_KEYS, type NoticeKey, type NoticeParams, type NoticeValueKind, type StoredNoticeWords } from "./noticeKeys";
import { civilDayWords } from "./seasonPlans";

export interface NoticeMessage {
  message: string;
  context: string;
}

export interface NoticeKeyMessages {
  title: NoticeMessage;
  body?: NoticeMessage;
  /** The words a value stands in for when the producer had none (a season with no name). */
  fallback?: Readonly<Record<string, NoticeMessage>>;
}

const SEASON_ASK: NoticeMessage = {
  message:
    "Before it turns, run the end-of-season governance: record what this season did, and seat people for the next season. Roles end with the season by default, so the roles filled now are the roles the next season starts with.",
  context: "notice season ending, the ask",
};

const SEASON_TURNS: NoticeMessage = {
  message: "{season} turns in {daysLeft, plural, one {# day} other {# days}}, on {endsOn}",
  context: "notice season ending, title",
};

const THIS_SEASON: NoticeMessage = { message: "This season", context: "notice season ending, a season with no name" };

export const NOTICE_KEY_MESSAGES: Readonly<Record<NoticeKey, NoticeKeyMessages>> = {
  "season_plan.open": {
    title: { message: "Plan your season: {season}", context: "notice season plan open, title" },
    body: { message: "Choose your roles and what you will do. Open until {closesOn}.", context: "notice season plan open, body" },
    fallback: { season: { message: "the next season", context: "notice season plan open, a season with no name" } },
  },
  "season_plan.reminder": {
    title: { message: "Your season is not filed yet", context: "notice season plan reminder, title" },
    body: { message: "{daysLeft, plural, one {# day left.} other {# days left.}}", context: "notice season plan reminder, body" },
  },
  "season_ending.member": { title: SEASON_TURNS, body: SEASON_ASK, fallback: { season: THIS_SEASON } },
  "season_ending.admin": {
    title: SEASON_TURNS,
    body: {
      message:
        "Before it turns, run the end-of-season governance: record what this season did, and seat people for the next season. Roles end with the season by default, so the roles filled now are the roles the next season starts with. The season review and the season roll are under Season Shapes in the admin panel.",
      context: "notice season ending, the ask to an admin",
    },
    fallback: { season: THIS_SEASON },
  },
};

/** One message in a language, with its values. Throws when the language has none. */
export type NoticeSay = (m: NoticeMessage, values?: Record<string, unknown>) => string;

/** A stored notice's title and body in a language, each the stored English where it cannot be said. */
export function sayNotice(
  stored: { title: string; body?: string | null; words?: StoredNoticeWords | null },
  say: NoticeSay,
  locale: string,
): { title: string; body: string | null } {
  const plain = { title: stored.title, body: stored.body ?? null };
  const w = stored.words;
  if (!w || !locale || locale === "en" || !Object.prototype.hasOwnProperty.call(NOTICE_KEY_MESSAGES, w.key)) return plain;
  const m = NOTICE_KEY_MESSAGES[w.key];
  const own = new Set(w.own ?? []);
  const attempt = (f: () => string, fallback: string | null) => {
    try {
      return f();
    } catch {
      return fallback;
    }
  };
  const values = (params: NoticeParams): Record<string, string | number> => {
    const out: Record<string, string | number> = {};
    for (const [name, kind] of Object.entries(NOTICE_KEYS[w.key].values) as [string, NoticeValueKind][]) {
      const v = params[name];
      if (kind === "day") out[name] = civilDayWords(String(v), locale);
      else if (kind === "text" && !String(v ?? "").trim() && m.fallback?.[name]) out[name] = say(m.fallback[name]);
      else out[name] = kind === "text" ? String(v ?? "").trim() : v;
    }
    return out;
  };
  let v: Record<string, string | number>;
  try {
    v = values(w.params);
  } catch {
    return plain;
  }
  return {
    title: own.has("title") ? plain.title : (attempt(() => say(m.title, v), plain.title) as string),
    body: own.has("body") || !m.body ? plain.body : attempt(() => say(m.body!, v), plain.body),
  };
}
