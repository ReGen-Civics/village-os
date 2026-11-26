/**
 * The notice emails in the reader's language (mail PR 3). A stored notice is said from its key through the compiled
 * catalog, the same Spanish the bell shows (shared/noticeKeyMessages.ts, server/lib/platformSpeech.ts), and the email's
 * frame comes from shared/noticeMailWords.ts. English is exactly what these emails said before; a notice with no
 * key, a part the village wrote, and a message the catalog lacks all read as stored.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MAIL_LANGUAGES } from "../shared/mailLanguage";
import { NOTICE_KEY_MESSAGES, sayNotice } from "../shared/noticeKeyMessages";
import { NOTICE_MAIL_WORDS, noticeMailWords } from "../shared/noticeMailWords";
import type { StoredNoticeWords } from "../shared/noticeKeys";
import { READ_IN_THE_BELL } from "./lib/notify";
import { forgetSpeakers, messageId, noticeSayFor } from "./lib/platformSpeech";

beforeEach(() => forgetSpeakers());

const reminder = (own: StoredNoticeWords["own"] = []) => ({
  title: "Your season is not filed yet",
  body: "3 days left.",
  words: { key: "season_plan.reminder", params: { daysLeft: 3 }, own } as StoredNoticeWords,
});

describe("the frame in English is exactly what the emails said", () => {
  it("the immediate email and the digest", () => {
    const W = noticeMailWords("en");
    expect(W.seeIt).toBe("See it on your profile");
    expect(W.choose).toBe("Choose which emails you get on your profile page.");
    expect(W.readInBell).toBe(READ_IN_THE_BELL);
    expect(W.digest.heading).toBe("While you were away");
    expect(W.digest.subjectMany(4)).toBe("4 things happened while you were away");
    expect(W.digest.more(2)).toBe("…and 2 more.");
    expect(W.digest.seeEverything).toBe("See everything");
  });

  it("every language says every line, and none is the English left in place", () => {
    const flat = (o: object, prefix = ""): Array<[string, unknown]> =>
      Object.entries(o).flatMap(([k, val]) => (val && typeof val === "object" ? flat(val, `${prefix}${k}.`) : [[`${prefix}${k}`, val] as [string, unknown]]));
    const say = (x: unknown) => (typeof x === "function" ? String((x as (n: number) => unknown)(3)) : x);
    const en = new Map(flat(NOTICE_MAIL_WORDS.en));
    for (const lang of MAIL_LANGUAGES) {
      const mine = new Map(flat(NOTICE_MAIL_WORDS[lang]));
      expect([...mine.keys()].sort(), lang).toEqual([...en.keys()].sort());
      if (lang !== "en") for (const [k, val] of mine) expect(say(val), `${lang} ${k}`).not.toBe(say(en.get(k)));
    }
  });
});

describe("a notice said from the compiled catalog", () => {
  it("in Spanish, the bell's own words", () => {
    const say = noticeSayFor("es");
    expect(say, "build first: the Spanish catalog is dist/i18n/es.json").not.toBeNull();
    expect(sayNotice(reminder(), say!, "es")).toEqual({ title: "Su temporada todavía no está registrada", body: "Quedan 3 días." });
  });

  it("a title the village wrote itself stays theirs", () => {
    const n = { ...reminder(["title"]), title: "File your plan, friend" };
    expect(sayNotice(n, noticeSayFor("es")!, "es")).toEqual({ title: "File your plan, friend", body: "Quedan 3 días." });
  });

  it("English, a notice with no key, and a catalog with nothing read as stored", () => {
    const say = noticeSayFor("es")!;
    expect(sayNotice(reminder(), say, "en")).toEqual({ title: "Your season is not filed yet", body: "3 days left." });
    expect(sayNotice({ title: "Hi", body: null }, say, "es")).toEqual({ title: "Hi", body: null });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "notice-mail-"));
    try {
      // A catalog that has the body and not the title: the title stays as stored, and only it.
      const body = NOTICE_KEY_MESSAGES["season_plan.reminder"].body!;
      fs.writeFileSync(path.join(dir, "es.json"), JSON.stringify({ messages: { [messageId(body.message, body.context)]: "ES body" } }));
      forgetSpeakers();
      expect(sayNotice(reminder(), noticeSayFor("es", [dir])!, "es")).toEqual({ title: "Your season is not filed yet", body: "ES body" });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a language with no catalog has no speaker", () => {
    expect(noticeSayFor("es", [path.join(os.tmpdir(), "no-such-catalog-dir")])).toBeNull();
  });
});
