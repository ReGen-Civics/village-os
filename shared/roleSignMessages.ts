/**
 * THE SIGNS ON THE PLAYER CARD AND THEIR SHEETS, AS MESSAGES (the coordinator, 26 Nov 2026: the player card
 * follow-ups, server-side).
 *
 * A sign's label and "Counted from ..." line (shared/roleSigns.ts), the words a sign reads when it is not counted,
 * and every line of its sheet (SHEET_WORDS, shared/roleSignRows.ts). The server says them by the same hashed id the
 * client macro gives each message, from the one catalog every page reads (client/src/locales/es.d/esb-card-signs.po).
 *
 * A sign is counted once for the whole village and shared by every card, so it is not read through the card's
 * recorder. The server knows every English line here, so it notes each one the card shows (`noteSignWords`) before
 * saying the card again, and says each sheet itself (`saySheetsIn`): a fixed line by its English, a line made from a
 * role's title or a count by the record its row carries. Plain objects, because the server build runs no macro; the
 * extraction source is client/src/components/playerCard/roleSignMessages.ts, and its test holds the two to one id each.
 */
import { NOT_COUNTED_YET, SIGNS, SIGN_KEYS, TREND_FROM_NEXT_MOON, type SignKey } from "./roleSigns";
import { MISSING_PARTS, SHEET_WORDS, type MissingPart, type SheetSaid } from "./roleSignRows";
import type { Said } from "./saidWords";

export interface SignMessage {
  message: string;
  context: string;
}

const m = (message: string, context: string): SignMessage => ({ message, context });

/** Each sign's label and its "Counted from" line, by sign. */
export const SIGN_DEF_MESSAGES: Readonly<Record<SignKey, { label: SignMessage; countedFrom: SignMessage }>> = Object.fromEntries(
  SIGN_KEYS.map((k) => [
    k,
    { label: m(SIGNS[k].label, `role sign ${k}, label`), countedFrom: m(SIGNS[k].countedFrom, `role sign ${k}, counted from`) },
  ]),
) as Record<SignKey, { label: SignMessage; countedFrom: SignMessage }>;

/** The sign words that are not a sign's own, and every line of a sheet. */
export const SIGN_MESSAGES = {
  notCounted: m(NOT_COUNTED_YET, "role sign, not counted yet"),
  trendLater: m(TREND_FROM_NEXT_MOON, "role sign, trend from next moon"),
  answered: m(SHEET_WORDS.answered, "role sign sheet, answered in time"),
  answeredLate: m(SHEET_WORDS.answeredLate, "role sign sheet, answered late"),
  waiting: m(SHEET_WORDS.waiting, "role sign sheet, waiting"),
  notAnswered: m(SHEET_WORDS.notAnswered, "role sign sheet, not answered"),
  filed: m(SHEET_WORDS.filed, "role sign sheet, season plan filed"),
  notFiled: m(SHEET_WORDS.notFiled, "role sign sheet, no season plan filed"),
  activeInTime: m(SHEET_WORDS.activeInTime, "role sign sheet, active in time"),
  stillNew: m(SHEET_WORDS.stillNew, "role sign sheet, still new"),
  notActive: m(SHEET_WORDS.notActive, "role sign sheet, not active"),
  questFinished: m(SHEET_WORDS.questFinished, "role sign sheet, quest finished"),
  fullCard: m("{role}: full card and a term", "role sign sheet, full card and a term"),
  missing: m("{role}: missing {what}", "role sign sheet, missing parts"),
  draftDecided: m(SHEET_WORDS.draftDecided, "role sign sheet, draft decided in time"),
  draftLate: m(SHEET_WORDS.draftLate, "role sign sheet, draft decided late"),
  draftWaiting: m(SHEET_WORDS.draftWaiting, "role sign sheet, draft waiting"),
  draftOpen: m(SHEET_WORDS.draftOpen, "role sign sheet, draft not decided"),
  met: m("The circle met, {n} people", "role sign sheet, the circle met"),
  decision: m(SHEET_WORDS.decision, "role sign sheet, a decision recorded"),
  noRows: m(SHEET_WORDS.noRows, "role sign sheet, nothing to show"),
  heading: m(SHEET_WORDS.heading, "role sign sheet, heading"),
  firstNamesNote: m(SHEET_WORDS.firstNamesNote, "role sign sheet, first names note"),
  orderNote: m(SHEET_WORDS.orderNote, "role sign sheet, order note"),
  partAim: m(MISSING_PARTS.aim, "role sign sheet, missing part aim"),
  partDomain: m(MISSING_PARTS.domain, "role sign sheet, missing part domain"),
  partAnswers: m(MISSING_PARTS.answers, "role sign sheet, missing part what it answers for"),
  partTerm: m(MISSING_PARTS.term, "role sign sheet, missing part a term"),
} as const satisfies Record<string, SignMessage>;

export type SignMessageKey = keyof typeof SIGN_MESSAGES;

/** Every sign message, for the test and the extraction copy. */
export const ALL_SIGN_MESSAGES: readonly SignMessage[] = [
  ...Object.values(SIGN_DEF_MESSAGES).flatMap((d) => [d.label, d.countedFrom]),
  ...Object.values(SIGN_MESSAGES),
];

/** One message in the reader's language. Throws when the language has none. */
export type SignSay = (m: SignMessage, values?: Record<string, unknown>) => string;

const PART_KEY: Record<MissingPart, SignMessageKey> = { aim: "partAim", domain: "partDomain", answers: "partAnswers", term: "partTerm" };

/** The key a sign's words are noted under on the card's record, said by `signWordsWith`. */
export const SIGN_PREFIX = "sign";

/**
 * Notes on the card's record every sign line the server knows, under `sign.*`, so the card can say them again
 * (shared/playerCardSpeak.ts `sayCardIn`, with `signWordsWith` as its `sign` table). A line the card does not show
 * is never read: noting it costs nothing.
 */
export function noteSignWords(said: Said): Said {
  const words = { ...said.words };
  const note = (english: string, k: string) => {
    if (!(english in words)) words[english] = { k: `${SIGN_PREFIX}.${k}` };
  };
  for (const k of SIGN_KEYS) {
    note(SIGNS[k].label, `label.${k}`);
    note(SIGNS[k].countedFrom, `countedFrom.${k}`);
  }
  note(NOT_COUNTED_YET, "notCounted");
  note(TREND_FROM_NEXT_MOON, "trendLater");
  return { ...said, words };
}

/** The `sign` table `sayCardIn` reads the noted lines from. Each entry is read only when used. */
export function signWordsWith(say: SignSay): object {
  const byKey = (pick: "label" | "countedFrom") => {
    const o: Record<string, string> = {};
    for (const k of SIGN_KEYS) Object.defineProperty(o, k, { enumerable: true, get: () => say(SIGN_DEF_MESSAGES[k][pick]) });
    return o;
  };
  return {
    label: byKey("label"),
    countedFrom: byKey("countedFrom"),
    get notCounted() {
      return say(SIGN_MESSAGES.notCounted);
    },
    get trendLater() {
      return say(SIGN_MESSAGES.trendLater);
    },
  };
}

/** A sheet as the payload carries it (shared/playerCardPayload.ts SignSheetOut), with each row's record. */
export interface SheetIn {
  title: string;
  countedFrom: string;
  rows: { at: string | null; words: string; who: string | null; said?: SheetSaid }[];
  note: string;
}

/** The English of every fixed sheet line and sign line, to its message. */
function fixedLines(): Map<string, SignMessage> {
  const out = new Map<string, SignMessage>();
  for (const k of SIGN_KEYS) {
    out.set(SIGNS[k].label, SIGN_DEF_MESSAGES[k].label);
    out.set(SIGNS[k].countedFrom, SIGN_DEF_MESSAGES[k].countedFrom);
  }
  for (const [k, msg] of Object.entries(SIGN_MESSAGES)) {
    const english = (SHEET_WORDS as Record<string, unknown>)[k];
    if (typeof english === "string") out.set(english, msg);
  }
  return out;
}

/**
 * Every sheet in the reader's language, with no record left on its rows. A line the language lacks, or a line with
 * no message (a row a later release writes), stays as built.
 */
export function saySheetsIn<S extends SheetIn>(sheets: Record<string, S>, say: SignSay): Record<string, S> {
  const fixed = fixedLines();
  const line = (english: string) => {
    const msg = fixed.get(english);
    if (!msg) return english;
    try {
      return say(msg);
    } catch {
      return english;
    }
  };
  const row = (r: SheetIn["rows"][number]): string => {
    const s = r.said;
    try {
      if (s?.k === "fullCard") return say(SIGN_MESSAGES.fullCard, { role: s.a[0] });
      if (s?.k === "missing") return say(SIGN_MESSAGES.missing, { role: s.a[0], what: s.a[1].map((p) => say(SIGN_MESSAGES[PART_KEY[p]])).join(", ") });
      if (s?.k === "met") return say(SIGN_MESSAGES.met, { n: s.a[0] });
    } catch {
      return r.words;
    }
    return line(r.words);
  };
  return Object.fromEntries(
    Object.entries(sheets).map(([key, sh]) => [
      key,
      { ...sh, title: line(sh.title), countedFrom: line(sh.countedFrom), note: line(sh.note), rows: sh.rows.map(({ said: _said, ...r }) => ({ ...r, words: row({ ...r, said: _said }) })) },
    ]),
  );
}

/** Every sheet as built, with no record left on its rows: what an English reader is sent. */
export function plainSheets<S extends SheetIn>(sheets: Record<string, S>): Record<string, S> {
  return Object.fromEntries(Object.entries(sheets).map(([key, sh]) => [key, { ...sh, rows: sh.rows.map(({ said: _said, ...r }) => r) }]));
}
