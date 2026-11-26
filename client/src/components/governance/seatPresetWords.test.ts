/**
 * The platform's seat presets in the reader's language (seatPresetWords.ts). Every preset comes from
 * shared/seatPresets.ts, so a preset added there, or a word changed there, fails here until the client has it.
 */
import path from "node:path";
import { setupI18n, type MessageDescriptor } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { describe, expect, it } from "vitest";
import { SEAT_PRESETS, WHOLE_PRESETS } from "@shared/seatPresets";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../../scripts/lib/poFragments.mjs";
import { SEAT_PRESET_WORDS, presetWords } from "./seatPresetWords";

// The build precompiles each message (precompileEnglish.ts), so the English is read the way a page reads it.
const EN = setupI18n({ locale: "en", messages: { en: {} } });
const ALL = [...SEAT_PRESETS, ...WHOLE_PRESETS];

function pairs(): { where: string; d: MessageDescriptor | undefined; server: string }[] {
  return ALL.flatMap((p) => [
    { where: `${p.id} label`, d: SEAT_PRESET_WORDS[p.id]?.label, server: p.label },
    { where: `${p.id} blurb`, d: SEAT_PRESET_WORDS[p.id]?.blurb, server: p.blurb },
  ]);
}

describe("every platform seat preset has the client's words for it", () => {
  it("each preset in shared/seatPresets.ts is here, with its English word for word", () => {
    const wrong = pairs()
      .filter((p) => !p.d || EN._(p.d) !== p.server)
      .map((p) => `${p.where}: ${p.d ? "English differs from shared/" : "missing"}`);
    expect(wrong, "correct client/src/components/governance/seatPresetWords.ts from shared/seatPresets.ts").toEqual([]);
    const ids = new Set(ALL.map((p) => p.id));
    expect(Object.keys(SEAT_PRESET_WORDS).filter((id) => !ids.has(id)), "a preset shared/ no longer has").toEqual([]);
  });

  it("Spanish carries every one of them", async () => {
    const dir = path.resolve(__dirname, "../../locales");
    const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
    expect(pairs().filter((p) => !es[p.d!.id]?.translation).map((p) => p.where), "add them to a fragment in client/src/locales/es.d/").toEqual([]);
  });
});

describe("presetWords", () => {
  const unpaid = SEAT_PRESETS.find((p) => p.id === "platform:unpaid")!;
  const es = setupI18n({ locale: "es", messages: { es: { [SEAT_PRESET_WORDS[unpaid.id].label.id]: "Sin pago" } } });

  it("reads exactly as written in English", () => {
    for (const p of ALL) expect(presetWords(p, EN)).toEqual({ label: p.label, blurb: p.blurb });
  });

  it("draws a platform preset in the reader's language, falling back to English where a word has no translation", () => {
    expect(presetWords(unpaid, es)).toEqual({ label: "Sin pago", blurb: unpaid.blurb });
  });

  it("keeps a village's own preset as the village wrote it", () => {
    const ours = { id: "custom:our-way", label: "Our way", blurb: "How we do it." };
    expect(presetWords(ours, es)).toEqual({ label: "Our way", blurb: "How we do it." });
    expect(presetWords({ id: "toString", label: "x", blurb: "y" }, es)).toEqual({ label: "x", blurb: "y" });
  });
});
