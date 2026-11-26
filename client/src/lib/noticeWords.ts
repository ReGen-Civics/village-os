/**
 * A NOTICE'S WORDS IN THE READER'S LANGUAGE, from the key and values it was stored with (shared/noticeKeys.ts;
 * the lead, 26 Nov 2026: the whole site in Spanish).
 *
 * Every key in NOTICE_KEYS has its title and body here, written as the producer writes its English, word for word,
 * with the values as ICU arguments. The store loads this file only when a reader not reading English has a notice
 * that carries words (notificationStore.ts), so it stays off every page's first view. A notice without words, a
 * key this file does not know, and any part the village wrote itself are drawn as stored.
 *
 * noticeWords.test.ts holds every key to the English its producer writes, with sample values, and fails on a key
 * with no words here or no Spanish.
 */
// A value import of the runtime: precompileEnglish compiles the messages of a file that imports it and skips one
// that only uses `msg` (client/src/components/roleCard/payBandWords.ts says the same).
import { i18n as appI18n, type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { NOTICE_KEYS, type NoticeKey, type NoticeParams, type NoticeValueKind, type StoredNoticeWords } from "@shared/noticeKeys";
import { civilDayWords } from "@shared/seasonPlans";

interface NoticeKeyWords {
  title: MessageDescriptor;
  body?: MessageDescriptor;
  /** The words a value stands in for when the producer had none (a season with no name). */
  fallback?: Readonly<Record<string, MessageDescriptor>>;
}

const SEASON_ASK = msg({
  message:
    "Before it turns, run the end-of-season governance: record what this season did, and seat people for the next season. Roles end with the season by default, so the roles filled now are the roles the next season starts with.",
  context: "notice season ending, the ask",
});

export const NOTICE_KEY_WORDS: Readonly<Record<NoticeKey, NoticeKeyWords>> = {
  "season_plan.open": {
    title: msg({ message: "Plan your season: {season}", context: "notice season plan open, title" }),
    body: msg({ message: "Choose your roles and what you will do. Open until {closesOn}.", context: "notice season plan open, body" }),
    fallback: { season: msg({ message: "the next season", context: "notice season plan open, a season with no name" }) },
  },
  "season_plan.reminder": {
    title: msg({ message: "Your season is not filed yet", context: "notice season plan reminder, title" }),
    body: msg({ message: "{daysLeft, plural, one {# day left.} other {# days left.}}", context: "notice season plan reminder, body" }),
  },
  "season_ending.member": {
    title: msg({
      message: "{season} turns in {daysLeft, plural, one {# day} other {# days}}, on {endsOn}",
      context: "notice season ending, title",
    }),
    body: SEASON_ASK,
    fallback: { season: msg({ message: "This season", context: "notice season ending, a season with no name" }) },
  },
  "season_ending.admin": {
    title: msg({
      message: "{season} turns in {daysLeft, plural, one {# day} other {# days}}, on {endsOn}",
      context: "notice season ending, title",
    }),
    body: msg({
      message:
        "Before it turns, run the end-of-season governance: record what this season did, and seat people for the next season. Roles end with the season by default, so the roles filled now are the roles the next season starts with. The season review and the season roll are under Season Shapes in the admin panel.",
      context: "notice season ending, the ask to an admin",
    }),
    fallback: { season: msg({ message: "This season", context: "notice season ending, a season with no name" }) },
  },
};

/** The values as the reader reads them: a day in their language, an empty name as the words that stand for it. */
function valuesFor(key: NoticeKey, params: NoticeParams, i18n: I18n): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  const words = NOTICE_KEY_WORDS[key];
  for (const [name, kind] of Object.entries(NOTICE_KEYS[key].values) as [string, NoticeValueKind][]) {
    const v = params[name];
    if (kind === "day") out[name] = civilDayWords(String(v), i18n.locale);
    else if (kind === "text" && !String(v ?? "").trim() && words.fallback?.[name]) out[name] = i18n._(words.fallback[name]);
    else out[name] = kind === "text" ? String(v ?? "").trim() : v;
  }
  return out;
}

export interface WordedNotice {
  title: string;
  body?: string | null;
  words?: StoredNoticeWords | null;
}

/** One notice in the reader's language, or as stored when it carries no words this file knows. */
export function localizeNotice<N extends WordedNotice>(n: N, i18n: I18n = appI18n): N {
  const w = n.words;
  if (!w || !Object.prototype.hasOwnProperty.call(NOTICE_KEY_WORDS, w.key)) return n;
  const words = NOTICE_KEY_WORDS[w.key];
  const values = valuesFor(w.key, w.params, i18n);
  const own = new Set(w.own ?? []);
  return {
    ...n,
    title: own.has("title") ? n.title : i18n._({ ...words.title, values }),
    body: own.has("body") || !words.body ? n.body : i18n._({ ...words.body, values }),
  };
}

export function localizeNotices<N extends WordedNotice>(items: readonly N[], i18n: I18n = appI18n): N[] {
  return items.map((n) => localizeNotice(n, i18n));
}
