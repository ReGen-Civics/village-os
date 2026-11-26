/**
 * A NOTICE'S WORDS AS A KEY AND ITS VALUES, so the bell can draw it in the reader's language (the lead, 26 Nov 2026:
 * the whole site in Spanish; the design approved by the coordinator the same day).
 *
 * A notice is stored with its English `title` and `body`, exactly as it always was, and the email, the digest and an
 * older client keep reading those. A producer that has moved to a key ALSO passes `words`: a key named here and the
 * raw values its words need. The server translates nothing. It stores them in `notifications.words` (migration 0435)
 * and hands them back, and the bell draws the key's words in the reader's language
 * (client/src/lib/noticeWords.ts), falling back to the stored English for any notice without them.
 *
 * VALUES ARE RAW: a count is a number, a day is "YYYY-MM-DD", a name is the name as written. The client formats
 * them for the reader. Each key lists its values and what kind each is.
 *
 * THE STORED TITLE IS PART OF THE RECORD. `words` carries the title it was stored with, and it is read back only
 * while the row still has that title. The erasure rewrites a notice that named a departed member to a constant
 * title (server/repos/noticesNaming.ts), and so does any older release that does not know this column, so a
 * rewritten notice never shows a translation of what it used to say, whichever release rewrote it.
 *
 * `own` lists the parts the village wrote itself (its own notice titles, shared/noticeWords.ts). Those are the
 * village's words and are drawn as stored.
 *
 * Adding a key: add it here, pass `words` from its producer beside the English it already writes, and give the
 * key its words in client/src/lib/noticeWords.ts. The test there fails until the client has it and its English
 * matches what the producer writes.
 */

export type NoticeValueKind = "text" | "count" | "day";

export interface NoticeKeyDef {
  /** The notice kind (notifications.type) a notice under this key is stored as. */
  type: string;
  /** Each value the words name, and what kind it is. */
  values: Readonly<Record<string, NoticeValueKind>>;
}

export const NOTICE_KEYS = {
  /** "Plan your season: {season}" / "Choose your roles … Open until {closesOn}." (shared/seasonPlans.ts planOpenCopy) */
  "season_plan.open": { type: "season_plan_open", values: { season: "text", closesOn: "day" } },
  /** "Your season is not filed yet" / "{daysLeft} days left." (planReminderCopy) */
  "season_plan.reminder": { type: "season_plan_reminder", values: { daysLeft: "count" } },
  /** "{season} turns in {daysLeft} days, on {endsOn}" and the ask, to a member (server/lib/seasonReminders.ts) */
  "season_ending.member": { type: "season_ending", values: { season: "text", daysLeft: "count", endsOn: "day" } },
  /** The same, to an admin, whose ask names where the season review lives. */
  "season_ending.admin": { type: "season_ending", values: { season: "text", daysLeft: "count", endsOn: "day" } },
} as const satisfies Record<string, NoticeKeyDef>;

export type NoticeKey = keyof typeof NOTICE_KEYS;
export type NoticeParams = Readonly<Record<string, string | number>>;

/** What a producer passes beside its English. */
export interface NoticeWordsRef {
  key: NoticeKey;
  params: NoticeParams;
}

/** The parts of a notice a village can write itself. */
export type NoticePart = "title" | "body";

/** What `notifications.words` holds, and what the bell is handed. */
export interface StoredNoticeWords {
  key: NoticeKey;
  params: NoticeParams;
  own: NoticePart[];
}

/** A stored `words` value never grows past this; a longer one is not stored, and the English stands. */
export const NOTICE_WORDS_MAX = 2000;

export function isNoticeKey(k: unknown): k is NoticeKey {
  return typeof k === "string" && Object.prototype.hasOwnProperty.call(NOTICE_KEYS, k);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The values a key names, each of the kind it names, and nothing else. Null when any is missing or wrong. */
export function cleanParams(key: NoticeKey, params: unknown): NoticeParams | null {
  if (!params || typeof params !== "object" || Array.isArray(params)) return null;
  const out: Record<string, string | number> = {};
  for (const [name, kind] of Object.entries(NOTICE_KEYS[key].values) as [string, NoticeValueKind][]) {
    const v = (params as Record<string, unknown>)[name];
    if (kind === "count") {
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      out[name] = v;
    } else if (kind === "day") {
      if (typeof v !== "string" || !DAY.test(v)) return null;
      out[name] = v;
    } else {
      if (typeof v !== "string") return null;
      out[name] = v.slice(0, 200);
    }
  }
  return out;
}

/**
 * The JSON `insertNotification` stores, or null when there is nothing sound to store: an unknown key, a value
 * missing or of the wrong kind, a notice of another type, or a result too long. Null always means the English
 * stands alone, which is what a notice without words has always been.
 */
export function noticeWordsJson(type: string, ref: NoticeWordsRef | null | undefined, storedTitle: string, own: readonly NoticePart[]): string | null {
  if (!ref || !isNoticeKey(ref.key) || NOTICE_KEYS[ref.key].type !== type) return null;
  const params = cleanParams(ref.key, ref.params);
  if (!params) return null;
  const json = JSON.stringify({ key: ref.key, params, own: Array.from(new Set(own)), title: storedTitle });
  return json.length <= NOTICE_WORDS_MAX ? json : null;
}

/**
 * The words a stored row carries, as the bell is handed them, or null. Never throws: a malformed value, an
 * unknown key, or a row whose title has changed since (the erasure, or anything else that rewrote it) all read
 * as no words, and the stored English stands.
 */
export function readNoticeWords(raw: unknown, title: string, type: string): StoredNoticeWords | null {
  if (typeof raw !== "string" || !raw || raw.length > NOTICE_WORDS_MAX) return null;
  let w: any;
  try {
    w = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!w || typeof w !== "object" || w.title !== title || !isNoticeKey(w.key) || NOTICE_KEYS[w.key as NoticeKey].type !== type) return null;
  const params = cleanParams(w.key, w.params);
  if (!params) return null;
  const own = Array.isArray(w.own) ? (w.own.filter((p: unknown) => p === "title" || p === "body") as NoticePart[]) : [];
  return { key: w.key, params, own };
}
