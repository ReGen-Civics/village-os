/**
 * The dials in the reader's language (gameMechanicsDialWords.ts). Every dial, choice, category and unit comes from
 * shared/gameVariables.ts, so one added there, or a word changed there, fails here until the client has it.
 */
import path from "node:path";
import { setupI18n, type MessageDescriptor } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { describe, expect, it } from "vitest";
import { VARIABLES } from "@shared/gameVariables";
import { GAME_CONFIG } from "@shared/gameConfig";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../scripts/lib/poFragments.mjs";
import { DIAL_CATEGORY_WORDS, DIAL_STAGE_WORDS, DIAL_UNIT_WORDS, DIAL_WORDS, dialLabel, localizeDials } from "./gameMechanicsDialWords";

// The build precompiles each message (precompileEnglish.ts), so the English is read the way a page reads it.
const EN = setupI18n({ locale: "en", messages: { en: {} } });

/** A unit that is a symbol or an abbreviation reads the same in every language. */
const SAME_IN_EVERY_LANGUAGE = new Set(["%", "MB", "h UTC", "bps", "USD"]);
const STAGE_IDS = new Set<string>(GAME_CONFIG.stages.map((s) => s.id));

/** A stage choice reads from the one stage table; the language picker's choices are each language's own name. */
const isStage = (key: string, value: string) => key.startsWith("progression.unlock.") && STAGE_IDS.has(value);
const keepsOwnWords = (key: string, value: string) => isStage(key, value) || key === "village.default_locale";

type Pair = { where: string; d: MessageDescriptor | undefined; server: string };

function pairs(): Pair[] {
  const out: Pair[] = [];
  for (const v of VARIABLES) {
    const w = DIAL_WORDS[v.key];
    out.push({ where: `${v.key} label`, d: w?.label, server: v.label }, { where: `${v.key} description`, d: w?.description, server: v.description });
    for (const c of v.choices ?? []) {
      if (isStage(v.key, c.value)) {
        out.push({ where: `${v.key}=${c.value} stage`, d: DIAL_STAGE_WORDS[c.value], server: c.label });
        continue;
      }
      if (keepsOwnWords(v.key, c.value)) continue;
      const cw = w?.choices?.[c.value];
      out.push({ where: `${v.key}=${c.value} label`, d: cw?.label, server: c.label });
      if (c.hint) out.push({ where: `${v.key}=${c.value} hint`, d: cw?.hint, server: c.hint });
    }
  }
  for (const cat of new Set(VARIABLES.map((v) => v.category))) out.push({ where: `category ${cat}`, d: DIAL_CATEGORY_WORDS[cat], server: cat });
  for (const u of new Set(VARIABLES.map((v) => v.unit).filter((u): u is string => !!u))) {
    if (!SAME_IN_EVERY_LANGUAGE.has(u)) out.push({ where: `unit ${u}`, d: DIAL_UNIT_WORDS[u], server: u });
  }
  return out;
}

describe("every dial the server sends has the client's words for it", () => {
  it("each dial, choice, category and unit in shared/gameVariables.ts is here, with its English word for word", () => {
    const wrong = pairs()
      .filter((p) => !p.d || EN._(p.d) !== p.server)
      .map((p) => `${p.where}: ${p.d ? "English differs from shared/" : "missing"}`);
    expect(wrong, "correct client/src/pages/gameMechanicsDialWords.ts from shared/gameVariables.ts").toEqual([]);
  });

  it("holds nothing the server no longer sends", () => {
    const keys = new Set(VARIABLES.map((v) => v.key));
    expect(Object.keys(DIAL_WORDS).filter((k) => !keys.has(k))).toEqual([]);
    for (const [key, w] of Object.entries(DIAL_WORDS)) {
      const values = new Set((VARIABLES.find((v) => v.key === key)?.choices ?? []).map((c) => c.value));
      expect(Object.keys(w.choices ?? {}).filter((c) => !values.has(c) || keepsOwnWords(key, c)), key).toEqual([]);
    }
    const cats = new Set(VARIABLES.map((v) => v.category));
    expect(Object.keys(DIAL_CATEGORY_WORDS).filter((c) => !cats.has(c))).toEqual([]);
    expect(Object.keys(DIAL_STAGE_WORDS).filter((s) => !STAGE_IDS.has(s))).toEqual([]);
    const units = new Set(VARIABLES.map((v) => v.unit));
    expect(Object.keys(DIAL_UNIT_WORDS).filter((u) => !units.has(u))).toEqual([]);
  });

  it("Spanish carries every one of them", async () => {
    const dir = path.resolve(__dirname, "../locales");
    const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
    expect(pairs().filter((p) => !es[p.d!.id]?.translation).map((p) => p.where), "add them to a fragment in client/src/locales/es.d/").toEqual([]);
  });
});

describe("localizeDials", () => {
  const served = VARIABLES.filter((v) => v.choices?.some((c) => c.hint) && v.unit == null)
    .slice(0, 1)
    .concat(VARIABLES.filter((v) => v.unit === "days").slice(0, 1))
    .map((v) => ({ key: v.key, category: v.category, label: v.label, description: v.description, unit: v.unit ?? null, choices: v.choices ?? null, value: "7" }));

  it("in English reads exactly as the server sent it", () => {
    expect(localizeDials(served, EN)).toEqual(served);
  });

  it("draws every word in the reader's language, and leaves values and unknown words alone", () => {
    const [chosen, timed] = served;
    const w = DIAL_WORDS[chosen.key];
    const firstHinted = chosen.choices!.find((c) => c.hint)!;
    const es = setupI18n({
      locale: "es",
      messages: {
        es: {
          [w.label.id]: "ETIQUETA",
          [w.choices![firstHinted.value].hint!.id]: "PISTA",
          [DIAL_CATEGORY_WORDS[timed.category].id]: "CATEGORIA",
          [DIAL_UNIT_WORDS.days.id]: "días",
        },
      },
    });
    const [a, b] = localizeDials([...served, { ...served[1], key: "a.village.dial", category: "Ours", unit: "goats" }], es);
    expect(a.label).toBe("ETIQUETA");
    expect(a.choices!.find((c) => c.value === firstHinted.value)!.hint).toBe("PISTA");
    expect(a.value).toBe("7");
    expect(b.unit).toBe("días");
    expect(b.category).toBe("CATEGORIA");
    const ours = localizeDials([{ ...served[1], key: "a.village.dial", label: "Ours", category: "Ours", unit: "goats" }], es)[0];
    expect([ours.label, ours.category, ours.unit]).toEqual(["Ours", "Ours", "goats"]);
    expect(dialLabel("toString", "x", es)).toBe("x");
  });

  it("names a stage choice from the one stage table", () => {
    const unlock = VARIABLES.find((v) => v.key.startsWith("progression.unlock."))!;
    const stage = unlock.choices!.find((c) => STAGE_IDS.has(c.value))!;
    const es = setupI18n({ locale: "es", messages: { es: { [DIAL_STAGE_WORDS[stage.value].id]: "ETAPA" } } });
    const [d] = localizeDials([{ key: unlock.key, category: unlock.category, label: unlock.label, description: unlock.description, unit: null, choices: unlock.choices ?? null }], es);
    expect(d.choices!.find((c) => c.value === stage.value)!.label).toBe("ETAPA");
  });
});
