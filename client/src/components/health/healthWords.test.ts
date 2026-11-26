/**
 * The health metrics' names in the reader's language (healthWords.ts). The keys, labels and units come from
 * shared/healthMetrics.ts, so a metric added there, or a label changed there, fails here until the client has it.
 */
import path from "node:path";
import { setupI18n, type MessageDescriptor } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { describe, expect, it } from "vitest";
import { HEALTH_METRICS } from "@shared/healthMetrics";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../../scripts/lib/poFragments.mjs";
import { HEALTH_METRIC_WORDS, HEALTH_UNIT_WORDS, localizeHealth, metricLabel, metricUnit } from "./healthWords";

// The build precompiles each message (precompileEnglish.ts), so the English is read the way a page reads it.
const EN = setupI18n({ locale: "en", messages: { en: {} } });

/** A unit that is a symbol or an abbreviation reads the same in every language, so it needs no entry. */
const SAME_IN_EVERY_LANGUAGE = new Set(["%", "kg", "ha"]);

describe("every health metric the server sends has the client's words for it", () => {
  it("each metric's label is here, and its English is the server's word for word", () => {
    const wrong = HEALTH_METRICS.filter((m) => {
      const w = HEALTH_METRIC_WORDS[m.key];
      return !w || EN._(w.label) !== m.label;
    }).map((m) => m.key);
    expect(wrong, "add or correct them in client/src/components/health/healthWords.ts").toEqual([]);
    const keys = new Set(HEALTH_METRICS.map((m) => m.key));
    expect(Object.keys(HEALTH_METRIC_WORDS).filter((k) => !keys.has(k)), "a metric shared/ no longer defines").toEqual([]);
  });

  it("each unit word the metrics use is here", () => {
    const units = [...new Set(HEALTH_METRICS.map((m) => m.unit))].filter((u) => !SAME_IN_EVERY_LANGUAGE.has(u));
    expect(units.filter((u) => !HEALTH_UNIT_WORDS[u] || EN._(HEALTH_UNIT_WORDS[u].unit) !== u)).toEqual([]);
  });

  it("Spanish carries every one of them", async () => {
    const dir = path.resolve(__dirname, "../../locales");
    const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
    const all: [string, MessageDescriptor][] = [
      ...Object.entries(HEALTH_METRIC_WORDS).map(([k, w]) => [k, w.label] as [string, MessageDescriptor]),
      ...Object.entries(HEALTH_UNIT_WORDS).map(([k, w]) => [k, w.unit] as [string, MessageDescriptor]),
    ];
    expect(all.filter(([, d]) => !es[d.id]?.translation).map(([k]) => k), "add them to a fragment in client/src/locales/es.d/").toEqual([]);
  });
});

describe("localizeHealth", () => {
  const es = setupI18n({
    locale: "es",
    messages: { es: { [HEALTH_METRIC_WORDS.trees_planted.label.id]: "Árboles sembrados", [HEALTH_UNIT_WORDS.trees.unit.id]: "árboles" } },
  });
  const payload = {
    regen: {
      metrics: [{ key: "trees_planted", label: "Trees planted", unit: "trees" }],
      totals: { trees_planted: { total: 40, unit: "trees", entries: 2 } },
      latest: [{ id: 1, value: 4, unit: "seedlings we counted", note: "by the river" }],
    },
    doughnut: { foundation: [], regen: [{ key: "trees_planted", label: "Trees planted", unit: "trees", total: 40 }] },
    lunationsCollected: 3,
  };

  it("draws the platform's words in the reader's language and leaves numbers and a village's own words alone", () => {
    const out = localizeHealth(payload, es);
    expect(out.regen.metrics[0]).toEqual({ key: "trees_planted", label: "Árboles sembrados", unit: "árboles" });
    expect(out.regen.totals.trees_planted).toEqual({ total: 40, unit: "árboles", entries: 2 });
    expect(out.regen.latest[0]).toEqual(payload.regen.latest[0]);
    expect(out.doughnut.regen[0].label).toBe("Árboles sembrados");
    expect(out.lunationsCollected).toBe(3);
  });

  it("in English reads exactly as the server sent it, and survives a payload with pieces missing", () => {
    expect(localizeHealth(payload, EN)).toEqual(payload);
    expect(localizeHealth(null, es)).toBeNull();
    expect(localizeHealth({ regen: null }, es)).toEqual({ regen: null });
    expect(metricLabel("a_village_metric", "Ours", es)).toBe("Ours");
    expect(metricUnit("toString", es)).toBe("toString");
  });
});
