/**
 * EVERY LIMIT ON THE APPLICATION, IN ONE PLACE (the ops request of 19 Nov 2026: "room for 8 minutes of talking,
 * shown and never cut"). The form, the server's parsers, the upload routes, the transcription door and the
 * database columns all read these numbers; the older names (OPEN_WHY_MAX, GOAL_LIMITS, VOICE_NOTE_MAX_SECONDS and
 * the rest) are kept as aliases of them so nothing that imports the old name drifts from this file.
 *
 * HOW THEY WERE SIZED (ops, 19 Nov 2026):
 *   - "Why you, and why now" holds 8,000 characters.
 *   - Every other limit an applicant or a member meets is three times what it was.
 *   - A box that takes voice (it has the mic, or a clip beside it) holds at least VOICE_BOX_FLOOR, about seven
 *     minutes of talking, where tripling would give less.
 *   - One take records for 15 minutes (three times five), which every transcription provider still takes (below).
 *
 * WHAT DID NOT MOVE, AND WHY:
 *   - Rate and abuse caps (tries an hour per connection, per address, the village's hourly ceiling, transcriptions
 *     a day). They count people and paid calls, not the size of an answer.
 *   - How MANY files, takes and clips one post carries. Their sizes tripled, and every byte of a post is held in
 *     memory while it is judged, so tripling the count as well would multiply what one post holds by nine.
 *     OPEN_UPLOAD_BYTES_IN_FLIGHT bounds what the server holds at once instead.
 *   - A name and an email address: identity, not an answer (an address is held to 254 by the mail standard, and the
 *     name column is varchar(120)).
 *   - Ids, keys, dates and time zones.
 *
 * Pure: no clock, no pool, no browser. It imports nothing, so every shared module may import it.
 */

/** About how many characters a minute of talking writes (seven minutes is about 1,000 to 1,150 words). */
export const SPEECH_CHARS_PER_MINUTE = 1050;
/** The least a box that takes voice holds: about seven minutes of talking. */
export const VOICE_BOX_FLOOR = 7500;
/** Three times the old limit, and never less than the floor for a box that takes voice. */
const voiceBox = (old: number): number => Math.max(old * 3, VOICE_BOX_FLOOR);

/* ── Recording ─────────────────────────────────────────────────────────── */

/** One take: 15 minutes (was 5). */
export const TAKE_MAX_SECONDS = 15 * 60;
/** Takes one application carries (unchanged: a count of uploads, see above). */
export const TAKES_MAX = 3;
/** A clip beside one answer: the village's default length and the platform's ceiling (were 60 and 180). */
export const CLIP_SECONDS_DEFAULT = 180;
export const CLIP_SECONDS_CEILING = 540;
/** Clips one application may carry: the village's default and the platform's ceiling (unchanged: counts of uploads). */
export const CLIPS_DEFAULT = 12;
export const CLIPS_CEILING = 24;

/*
 * HOW BIG A RECORDING CAN BE. The page asks for 64 kbit/s (useVoiceRecorder.ts VOICE_BITS_PER_SECOND), but a
 * browser that refuses the option records at its own rate, and the largest a phone produces is 128 kbit/s: AAC in
 * an MP4 on an iPhone, Opus in WebM on Android Chrome. VBR peaks and the container add up to a quarter more, so a
 * recording is sized at 160 kbit/s, 20,000 bytes a second:
 *
 *   a 15-minute take:   900 s x 20,000 B/s = 18,000,000 bytes (17.2 MiB)
 *   a 9-minute clip:    540 s x 20,000 B/s = 10,800,000 bytes (10.3 MiB)
 *
 * Tripling the old caps gives 30 MiB a take and 12 MiB a clip. A take also goes, whole, to the transcription
 * service, and Groq and OpenAI each take at most 25 MB (25,000,000 bytes) in one request, so a take is held to
 * 24,000,000 bytes: room for 15 minutes at up to 213 kbit/s, with a megabyte for the provider's own envelope.
 */
export const RECORDING_BYTES_PER_SECOND = 20_000;
/** The most one request to a transcription provider carries (Groq's and OpenAI's documented 25 MB). */
export const PROVIDER_UPLOAD_MAX_BYTES = 25_000_000;
export const TAKE_MAX_BYTES = 24_000_000;
export const CLIP_MAX_BYTES = 12 * 1024 * 1024;

/* ── Files ─────────────────────────────────────────────────────────────── */

/** Files one application carries (unchanged: a count of uploads), and how big each may be (was 10 MiB). */
export const FILES_MAX = 3;
export const FILE_MAX_BYTES = 30 * 1024 * 1024;

/* ── The whole post ────────────────────────────────────────────────────── */

/*
 * THE PROPOSAL'S OWN WORDS, AS JSON. With every list full and every answer at its cap, one application is about
 * 2.6 million characters: three roles x 24 value items x (7,500 + 7,500 + 900 + 900) = 1,209,600; 90 suggestions
 * x 7,500 = 675,000; term notes, ten for each of three roles, 225,000; the heard words 48,000; 24 clips' words
 * 288,000; references, links, the about lines and the card about 175,000. As UTF-8 inside JSON a character costs
 * at most three bytes (a letter outside the BMP is two UTF-16 units of two bytes each), so about 7.9 MB.
 */
export const PROPOSAL_JSON_MAX_BYTES = 8 * 1024 * 1024;
/**
 * The server's ordinary JSON body limit (express.json, 1 MB in server/index.ts). A proposal longer than this goes
 * as one field of a multipart post, which takes up to PROPOSAL_JSON_MAX_BYTES (VoiceInvite.tsx applicationRequest).
 */
export const JSON_BODY_MAX_BYTES = 1_000_000;
/** The multipart wrapping around the parts: the proposal's JSON field and a megabyte for every part's headers. */
export const UPLOAD_ENVELOPE_BYTES = PROPOSAL_JSON_MAX_BYTES + 1024 * 1024;

/**
 * The most one application post may carry, for a village that takes `clipsMax` clips: every file, take and clip at
 * its own cap, and the envelope. The server refuses a longer Content-Length before reading a byte; the form adds
 * the same sum up before it sends. With the default twelve clips that is 90 MiB + 68.7 MiB + 144 MiB + 9 MiB,
 * about 312 MiB; at the ceiling of 24 clips, about 456 MiB.
 */
export function uploadTotalMax(clipsMax: number): number {
  const clips = Math.max(0, Math.min(CLIPS_CEILING, Math.floor(Number.isFinite(clipsMax) ? clipsMax : 0)));
  return FILES_MAX * FILE_MAX_BYTES + TAKES_MAX * TAKE_MAX_BYTES + clips * CLIP_MAX_BYTES + UPLOAD_ENVELOPE_BYTES;
}

/**
 * What the server holds in memory for application posts at once, in bytes, counted by each post's Content-Length
 * as it starts. Three times the old most (four posts of 45 MiB, 180 MiB). Larger than the largest single post, so
 * any post that fits its own cap can be read when nothing else is.
 */
export const OPEN_UPLOAD_BYTES_IN_FLIGHT = 540 * 1024 * 1024;
/** Application posts read at once, whatever their size (unchanged). */
export const OPEN_UPLOADS_AT_ONCE = 4;

/* ── How long a send may take ──────────────────────────────────────────── */

/** Node's own `server.requestTimeout`, which the rest of the server keeps. */
export const NODE_REQUEST_TIMEOUT_MS = 300_000;
/** A slow mobile uplink: 1 Mbit/s, a weak 3G or a crowded 4G cell. */
export const SLOW_UPLINK_BITS_PER_SECOND = 1_000_000;
/** No byte for this long and the upload is given up, however long its window is. */
export const UPLOAD_IDLE_MS = 120_000;

/**
 * How long an upload of `bytes` is given to arrive: its time on a slow uplink, half as long again, and never less
 * than Node's own five minutes. A 15-minute take at 64 kbit/s (7.2 MB) gets the five minutes; a full application
 * of about 312 MiB gets about 65 minutes. Only the upload routes use it (server/lib/uploadWindow.ts).
 */
export function uploadWindowMs(bytes: number): number {
  const b = Math.max(0, Number.isFinite(bytes) ? bytes : 0);
  const onSlowLine = Math.ceil(((b * 8) / SLOW_UPLINK_BITS_PER_SECOND) * 1000 * 1.5);
  return Math.max(NODE_REQUEST_TIMEOUT_MS, onSlowLine);
}

/** A send with no files or recordings: three times the old 90 seconds. */
export const JSON_SEND_TIMEOUT_MS = 270_000;

/* ── Transcription ─────────────────────────────────────────────────────── */

/**
 * Waiting on a provider (Groq or OpenAI) for one take, and on this server's own Whisper: three times 90 s and
 * 240 s. The server's Whisper wrote a five-minute take in about a minute of two cores (17 Nov 2026), so a
 * 15-minute take needs about three; twelve minutes leaves room on a busy box.
 */
export const TRANSCRIBE_PROVIDER_TIMEOUT_MS = 270_000;
export const TRANSCRIBE_LOCAL_TIMEOUT_MS = 720_000;

/* ── Words ─────────────────────────────────────────────────────────────── */

/**
 * Every written answer's limit, in characters. Old values in the comments; `voiceBox` marks a box that takes
 * voice (the mic, or a clip beside it), held to at least VOICE_BOX_FLOOR.
 */
export const APPLY_TEXT = {
  /** "Why you, and why now" (was 4000 in 1.3.30, 1200 before). */
  why: 8000,
  /** What they bring to one role (was 600). */
  roleNote: 1800,
  /** Their aim in this role (was 300; voice). */
  aim: voiceBox(300),
  /** Human Design or Gene Keys (was 300; voice). */
  selfKnowledge: voiceBox(300),
  /** Where they are based (was 120; voice). */
  based: voiceBox(120),
  /** Languages they work in (was 160; voice). */
  languages: voiceBox(160),
  /** Their story with us (was 400; voice). */
  story: voiceBox(400),
  /** A reference's name (was 80), how they know them (was 160; voice), a way to reach them (was 120). */
  referenceName: 240,
  referenceHow: voiceBox(160),
  referenceContact: 360,
  /** A link's label (was 80) and address (was 500), a file's name (was 120). */
  linkLabel: 240,
  linkUrl: 1500,
  fileName: 360,
  /** A value item: what it brings (was 160; voice), how we will know it is done (was 200; voice), its other lines (was 300). */
  goalTitle: voiceBox(160),
  goalDoneWhen: voiceBox(200),
  goalText: 900,
  /** The role card's lines: an outcome (was 200), a target (was 120), how it serves (was 200), the terms note (was 600). */
  cardMoveText: 600,
  cardTarget: 360,
  cardHow: 600,
  cardTermsNote: 1800,
  /** A note on one of the terms (was 300; voice, a clip beside each). */
  termNote: voiceBox(300),
  /** A decider's wording for a term in a counter-offer (was 600). */
  offerWord: 1800,
  /** Why this price (was 600). */
  priceWhy: 1800,
  /** A suggestion for the role card (was 600; voice). */
  suggestion: voiceBox(600),
  /** A member's own words on a seat application (was 4000 in 1.3.30): never shorter than `why`, which it carries. */
  memberWords: 12000,
  /** A member application's aim and goal lines (were 300), and its terms note (was 600). */
  memberAim: 900,
  memberGoal: 900,
  memberTermsNote: 1800,
  /** References given on the status page: name (was 80), contact (was 120), how (was 300), why an ally (was 400). */
  statusRefName: 240,
  statusRefContact: 360,
  statusRefHow: 900,
  statusRefAlly: 1200,
  /**
   * "What we heard, in your words", across every take: three 15-minute takes of talking (3 x 15 x 1,050 =
   * 47,250), rounded up (was 12,000).
   */
  heard: 48000,
  /** The words a transcription service sends back for one take: a 15-minute take is about 15,750 (was 6000). */
  transcribed: 18000,
  /** An AI transcript kept with a sent recording (was 6000). */
  written: 18000,
  /** The words kept with one clip: at least the longest answer it writes into, and a 9-minute clip's 9,450 (was 4000). */
  clipWords: 12000,
  /** What of the heard words goes to the AI guide for "Draft my answers" (was 8000). */
  draftInput: 24000,
  /**
   * Each answer on the quest proposal (/propose-quest), all of them boxes you can speak into: none had a limit on the
   * page before, and the server's summary of a proposal reads 8,000 of the first (server/lib/publicForms.ts).
   */
  questProse: 8000,
  /** One "get to know us" way, as the village writes it and the applicant's tick keeps it (was 160). */
  knowUsText: 480,
} as const;


/** How many of each list one application holds. Three times the old count. */
export const APPLY_COUNTS = {
  /** The "get to know us" ways a village lists and an applicant ticks (was 8). */
  knowUs: 24,
  /** Value items for one role (was 8). */
  goalsPerRole: 24,
  /**
   * References on the form: 6, doubled from 3 by the lead (19 Nov 2026). The background-check rule asks for none of
   * a count: a check runs when every reference is left blank (shared/proposalAbout.ts `checkNeeded`), so one to six
   * references stands in for it, and the copy says "up to six" and "leave them all blank".
   */
  references: 6,
  /** Links to their work (was 5). */
  links: 15,
  /** Suggestions for the role card, across the roles (was 30). */
  suggestions: 90,
  /** Outcomes a role card names (was 3) and season goals it serves (was 3). */
  cardMoves: 9,
  cardServes: 9,
  /** Revisions of one counter-offer (was 50). */
  offerRevisions: 150,
  /** References given on the status page, or on a member's own application page: 10, doubled from 5 by the lead (19 Nov 2026). */
  statusReferences: 10,
  /** A member application's goals (was 9) and usual times (was 6). */
  memberGoals: 27,
  memberWindows: 18,
} as const;

/* ── The signs on a box ────────────────────────────────────────────────── */

/** The calm notice, and the stronger one, as a share of the box. */
export const LIMIT_NOTICE_AT = 0.8;
export const LIMIT_STRONG_AT = 0.95;
/** The gentle warning before a take stops by itself. */
export const TAKE_WARN_SECONDS_LEFT = 30;

export type LimitState = "room" | "near" | "nearer" | "over";

/** Where a box stands against its limit. "over" is past it: kept whole, shown, and the send is held. */
export function limitState(used: number, max: number): LimitState {
  if (!(max > 0)) return "room";
  if (used > max) return "over";
  if (used >= max * LIMIT_STRONG_AT) return "nearer";
  if (used >= max * LIMIT_NOTICE_AT) return "near";
  return "room";
}

/** About how many minutes of talking `chars` characters hold, to the nearest half minute. */
export function minutesOfTalk(chars: number): number {
  return Math.round((Math.max(0, chars) / SPEECH_CHARS_PER_MINUTE) * 2) / 2;
}

/** A number of minutes as people say it, with a half where there is one: "1½", "½", "7". */
export function halfMinutes(minutes: number): string {
  const whole = Math.floor(minutes);
  const half = minutes - whole >= 0.5;
  if (!half) return String(whole);
  return whole === 0 ? "½" : `${whole}½`;
}

/** How many characters to take out of a box before it can be sent; 0 when it fits. */
export function overBy(text: string, max: number): number {
  return max > 0 ? Math.max(0, text.length - max) : 0;
}

/**
 * A SUMMARY MADE FROM THE APPLICANT'S ANSWERS, held to the member application's own words limit. The application
 * keeps every answer whole; a summary written from them for a seat application (the deliverables an adoption
 * writes) is the one place a long application is shortened, and it says so in its last line, so nobody reads a
 * shortened summary as the whole.
 */
export const SUMMARY_MORE = "The rest is in the application, word for word.";
export function summaryWithin(text: string, max: number = APPLY_TEXT.memberWords): string {
  if (text.length <= max) return text;
  const tail = `\n\n${SUMMARY_MORE}`;
  return `${text.slice(0, Math.max(0, max - tail.length - 3)).trimEnd()}...${tail}`;
}

/*
 * THE VILLAGE'S OWN WORDS ON THE APPLICATION (ops check of live 1.3.30, 19 Nov 2026: the form cut them silently at
 * 1200 and 300 characters). The notes an applicant reads on the form are written in Admin, so their limit is held
 * at Admin's save door (shared/gameVariables.ts `validateVariable`, through `villageWordsProblem`), which refuses
 * a longer note with the reason; the form then reads every note whole (shared/foundingApplication.ts).
 *
 *   the note while a way is not ticked, the first cycle:   1,200 to 3,600 characters (longtext settings)
 *   the ways to get to know us:                           8 lines of 160 to 24 lines of 480
 *   the first conversations:                              12 lines of 300 to 36 lines of 900
 *   the at-risk line, the pay note, the "updated" note:   the form cut at 600, 300 and 300; each is a one-line
 *                                                         setting Admin already holds to 255, so the form now
 *                                                         reads them whole and Admin's 255 is the limit (an
 *                                                         admin-only door, left as it is)
 */
export const VILLAGE_WORDS = {
  note: 3600,
  knowUsLines: APPLY_COUNTS.knowUs,
  knowUsText: APPLY_TEXT.knowUsText,
  lines: 36,
  lineEach: 900,
} as const;

/** The settings whose words an applicant reads on the form, by key (shared/foundingApplication.ts names them too). */
const VILLAGE_NOTE_KEYS = ["org.founding_know_us_note", "org.founding_first_cycle"];
const VILLAGE_LINE_KEYS: Record<string, { lines: number; each: number }> = {
  "org.founding_know_us": { lines: VILLAGE_WORDS.knowUsLines, each: VILLAGE_WORDS.knowUsText },
  "org.founding_first_conversations": { lines: VILLAGE_WORDS.lines, each: VILLAGE_WORDS.lineEach },
};

/** Admin's save door for those settings: the reason a value is too long, or null. Never cuts. */
export function villageWordsProblem(key: string, stored: string): string | null {
  if (VILLAGE_NOTE_KEYS.includes(key) && stored.length > VILLAGE_WORDS.note) {
    return `Too long for the application (${VILLAGE_WORDS.note} characters maximum, this is ${stored.length}).`;
  }
  const rule = VILLAGE_LINE_KEYS[key];
  if (rule) {
    const lines = stored.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length > rule.lines) return `Up to ${rule.lines} lines, one per line (this has ${lines.length}).`;
    const long = lines.findIndex((l) => l.length > rule.each);
    if (long >= 0) return `Line ${long + 1} is too long (${rule.each} characters maximum, it has ${lines[long].length}).`;
  }
  return null;
}
