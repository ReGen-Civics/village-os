/**
 * A notice drawn from its stored words (noticeWords.ts). Every key in shared/noticeKeys.ts has words here, and its
 * English, with sample values, is exactly what its producer writes, so the bell in English and the bell in
 * Spanish say the same thing.
 */
import path from "node:path";
import { setupI18n, type MessageDescriptor } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { describe, expect, it } from "vitest";
import { NOTICE_KEYS, cleanParams, type NoticeKey, type NoticeParams } from "@shared/noticeKeys";
import { planOpenCopy, planReminderCopy } from "@shared/seasonPlans";
import { seasonReminderCopy } from "../../../server/lib/seasonReminders";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../scripts/lib/poFragments.mjs";
import { NOTICE_KEY_WORDS, localizeNotice } from "./noticeWords";

// The build precompiles each message (precompileEnglish.ts), so the English is read the way a page reads it.
const EN = setupI18n({ locale: "en", messages: { en: {} } });

/** Each key, with sample values, beside the title and body its producer writes for them. */
const SAMPLES: Array<{ key: NoticeKey; params: NoticeParams; english: { title: string; body: string } }> = [
  { key: "season_plan.open", params: { season: "Harvest", closesOn: "2026-12-01" }, english: planOpenCopy("Harvest", "2026-12-01") },
  { key: "season_plan.open", params: { season: "", closesOn: "2026-12-01" }, english: planOpenCopy("", "2026-12-01") },
  { key: "season_plan.reminder", params: { daysLeft: 1 }, english: planReminderCopy(1) },
  { key: "season_plan.reminder", params: { daysLeft: 5 }, english: planReminderCopy(5) },
  ...(["member", "admin"] as const).flatMap((audience) =>
    [
      { name: "Harvest", days: 1 },
      { name: "", days: 7 },
    ].map(({ name, days }) => ({
      key: `season_ending.${audience}` as NoticeKey,
      params: { season: name, daysLeft: days, endsOn: "2026-12-21" },
      english: seasonReminderCopy({ seasonId: "s", seasonName: name, endsOn: "2026-12-21", daysLeft: days, mark: "week" as any }, audience),
    })),
  ),
];

describe("every notice key has the bell's words for it", () => {
  it("each key in shared/noticeKeys.ts is here, and nothing else", () => {
    expect(Object.keys(NOTICE_KEY_WORDS).sort()).toEqual(Object.keys(NOTICE_KEYS).sort());
    expect([...new Set(SAMPLES.map((s) => s.key))].sort(), "give every key a sample above").toEqual(Object.keys(NOTICE_KEYS).sort());
  });

  it("in English says word for word what the producer writes", () => {
    for (const s of SAMPLES) {
      expect(cleanParams(s.key, s.params), s.key).not.toBeNull();
      const drawn = localizeNotice({ title: "stored", body: "stored", words: { key: s.key, params: s.params, own: [] } }, EN);
      expect({ title: drawn.title, body: drawn.body }, `${s.key} ${JSON.stringify(s.params)}`).toEqual({ title: s.english.title, body: s.english.body });
    }
  });

  it("Spanish carries every one of them", async () => {
    const dir = path.resolve(__dirname, "../locales");
    const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
    const all: [string, MessageDescriptor][] = Object.entries(NOTICE_KEY_WORDS).flatMap(([k, w]) => [
      [`${k} title`, w.title],
      ...(w.body ? [[`${k} body`, w.body] as [string, MessageDescriptor]] : []),
      ...Object.entries(w.fallback ?? {}).map(([v, d]) => [`${k} ${v} fallback`, d] as [string, MessageDescriptor]),
    ]);
    expect(all.filter(([, d]) => !es[d.id]?.translation).map(([k]) => k), "add them to a fragment in client/src/locales/es.d/").toEqual([]);
  });
});

describe("localizeNotice", () => {
  const words = NOTICE_KEY_WORDS["season_plan.reminder"];
  const es = setupI18n({
    locale: "es",
    messages: { es: { [words.title.id]: "Su temporada todavía no está registrada", [words.body!.id]: "{daysLeft, plural, one {Queda # día.} other {Quedan # días.}}" } },
  });
  const stored = { id: "n1", title: "Your season is not filed yet", body: "3 days left.", words: { key: "season_plan.reminder" as const, params: { daysLeft: 3 }, own: [] } };

  it("draws a worded notice in the reader's language", () => {
    expect(localizeNotice(stored, es)).toEqual({ ...stored, title: "Su temporada todavía no está registrada", body: "Quedan 3 días." });
  });

  it("keeps the part a village wrote itself, and a notice with no words or an unknown key, as stored", () => {
    expect(localizeNotice({ ...stored, title: "Our own words", words: { ...stored.words, own: ["title" as const] } }, es).title).toBe("Our own words");
    expect(localizeNotice({ ...stored, words: null }, es)).toEqual({ ...stored, words: null });
    const foreign = { ...stored, words: { key: "toString" as any, params: {}, own: [] } };
    expect(localizeNotice(foreign, es)).toBe(foreign);
  });
});
