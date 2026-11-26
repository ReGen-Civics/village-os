/**
 * The crown bar's platform words in the reader's language (statChipWords.ts). Every source comes from
 * shared/mapStatChips.ts and every fixed sentence from `resolveChips` itself, so a source added there, or a
 * sentence changed there, fails here until the client has it.
 */
import path from "node:path";
import { setupI18n, type MessageDescriptor } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_CHIPS, STAT_SOURCES, STAT_SOURCE_KEYS, resolveChips, sayDay, type MapChip } from "@shared/mapStatChips";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../../scripts/lib/poFragments.mjs";
import { CHIP_STATE_WORDS, EXAMPLE_CHIP_WORDS, STAT_SOURCE_WORDS, localizeChips } from "./statChipWords";

// The build precompiles each message (precompileEnglish.ts), so the English is read the way a page reads it.
const EN = setupI18n({ locale: "en", messages: { en: {} } });
const en = (d: MessageDescriptor, values?: Record<string, string>) => EN._({ ...d, values });

const chip = (over: Partial<MapChip>): MapChip => ({
  id: "c",
  label: "Ours",
  icon: "people",
  source: "none",
  unit: "",
  format: "compact",
  link: "",
  manual: null,
  ...over,
});
const DAY = "2026-11-05";

function all(): [string, MessageDescriptor][] {
  return [
    ...Object.entries(STAT_SOURCE_WORDS).flatMap(([k, w]) => Object.entries(w).map(([f, d]) => [`${k} ${f}`, d] as [string, MessageDescriptor])),
    ...Object.entries(EXAMPLE_CHIP_WORDS).map(([k, d]) => [`example ${k}`, d] as [string, MessageDescriptor]),
    ...Object.entries(CHIP_STATE_WORDS).map(([k, d]) => [k, d] as [string, MessageDescriptor]),
  ];
}

describe("every chip word the server sends has the client's words for it", () => {
  it("each source's label, line and sentence, word for word", () => {
    for (const k of STAT_SOURCE_KEYS) {
      const w = STAT_SOURCE_WORDS[k];
      expect([en(w.label), en(w.sub), en(w.how)], k).toEqual([STAT_SOURCES[k].label, STAT_SOURCES[k].sub, STAT_SOURCES[k].how]);
    }
    expect(Object.keys(STAT_SOURCE_WORDS).sort()).toEqual([...STAT_SOURCE_KEYS].sort());
  });

  it("each example's default label", () => {
    for (const d of DEFAULT_MAP_CHIPS) expect(EXAMPLE_CHIP_WORDS[d.id] && en(EXAMPLE_CHIP_WORDS[d.id]), d.id).toBe(d.label);
    expect(Object.keys(EXAMPLE_CHIP_WORDS).sort()).toEqual(DEFAULT_MAP_CHIPS.map((d) => d.id).sort());
  });

  it("each fixed sentence resolveChips writes", () => {
    const [example, undated, dated] = resolveChips(
      [chip({ source: "none" }), chip({ source: "manual", manual: { value: "40", asOf: "" } }), chip({ source: "manual", manual: { value: "40", asOf: DAY } })],
      {},
    );
    expect(en(CHIP_STATE_WORDS.exampleHow)).toBe(example.how);
    expect([en(CHIP_STATE_WORDS.manualSub), en(CHIP_STATE_WORDS.manualHow)]).toEqual([undated.sub, undated.how]);
    const day = sayDay(DAY);
    expect([en(CHIP_STATE_WORDS.manualSubOn, { day }), en(CHIP_STATE_WORDS.manualHowOn, { day })]).toEqual([dated.sub, dated.how]);
  });

  it("Spanish carries every one of them", async () => {
    const dir = path.resolve(__dirname, "../../locales");
    const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
    expect(all().filter(([, d]) => !es[d.id]?.translation).map(([k]) => k), "add them to a fragment in client/src/locales/es.d/").toEqual([]);
  });
});

describe("localizeChips", () => {
  const resolved = resolveChips(
    [
      chip({ id: "people", label: "People", source: "none" }),
      chip({ id: "m", label: STAT_SOURCES.members.label, source: "members", unit: " people" }),
      chip({ id: "own", label: "Our neighbours", source: "members" }),
      chip({ id: "hand", label: "Rain", source: "manual", unit: "mm", manual: { value: "900", asOf: DAY } }),
    ],
    { members: { ok: true, n: 12, sub: "", countedAt: "2026-11-26T00:00:00Z" } },
  );
  const es = setupI18n({
    locale: "es",
    messages: {
      es: {
        [EXAMPLE_CHIP_WORDS.people.id]: "Personas",
        [STAT_SOURCE_WORDS.members.label.id]: "Miembros",
        [STAT_SOURCE_WORDS.members.sub.id]: "miembros",
        [CHIP_STATE_WORDS.manualSubOn.id]: "al {day}",
      },
    },
  });

  it("leaves English exactly as the server sent it", () => {
    expect(localizeChips(resolved, EN)).toEqual(resolved);
  });

  it("translates the platform's words and keeps a founder's label, unit and every number", () => {
    const [ex, members, ours, hand] = localizeChips(resolved, es);
    expect(ex.label).toBe("Personas");
    expect([members.label, members.sub, members.value]).toEqual(["Miembros", "miembros", resolved[1].value]);
    expect([ours.label, ours.sub]).toEqual(["Our neighbours", "miembros"]);
    expect(hand.label).toBe("Rain");
    expect(hand.value).toBe("900mm");
    expect(hand.sub.startsWith("al ")).toBe(true);
    expect(hand.sub).toContain("2026");
  });
});
