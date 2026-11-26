import { setupI18n } from "@lingui/core";
import { describe, expect, it } from "vitest";
import { SUBJECT_NOUN, TYPE_GROUPS, WIZARD_STEPS, WIZARD_TYPE_CONFIGS } from "./wizardConfig";
import { WIZARD_WORDS, wizardWord } from "./wizardWords";

/** The keys of the config whose string value is copy a reader sees. */
const COPY = new Set(["label", "tip", "placeholder", "help", "intro", "doorLabel", "doorIntro", "title", "description", "consequence", "publishLabel", "group"]);

/** Every word the wizard's config would draw: each type's own words, every step and field, every choice. */
function wizardCopy(): string[] {
  const out = new Set<string>();
  const walk = (node: unknown, key = ""): void => {
    if (typeof node === "string") {
      if (COPY.has(key)) out.add(node);
      return;
    }
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach((x) => walk(x, ""));
    for (const [k, v] of Object.entries(node)) walk(v, k);
  };
  walk(WIZARD_TYPE_CONFIGS);
  WIZARD_STEPS.forEach((s) => out.add(s.label));
  TYPE_GROUPS.forEach((g) => out.add(g));
  Object.values(SUBJECT_NOUN).forEach((v) => out.add(v));
  out.add("Decision");
  return [...out];
}

describe("the proposal wizard's words in the reader's language (lane ES-A)", () => {
  it("every word the config draws has a translatable entry", () => {
    const copy = wizardCopy();
    expect(copy.length).toBeGreaterThan(150);
    expect(copy.filter((w) => !WIZARD_WORDS[w]), "add these to client/src/components/governance/wizardWords.ts").toEqual([]);
  });

  it("each entry's English is its own key, so an untranslated word reads as written", () => {
    const en = setupI18n({ locale: "en", messages: { en: {} } });
    for (const key of Object.keys(WIZARD_WORDS)) expect(wizardWord(key, en), key).toBe(key);
    expect(wizardWord("Change a rule", en)).toBe("Change a rule");
    expect(wizardWord("A word the village wrote", en)).toBe("A word the village wrote");
    expect(wizardWord(undefined, en)).toBeUndefined();
  });

  it("a catalog that has the word draws it in that language", () => {
    const d = WIZARD_WORDS["Change a rule"];
    const es = setupI18n({ locale: "es", messages: { es: { [d.id]: "Cambiar una regla" } } });
    expect(wizardWord("Change a rule", es)).toBe("Cambiar una regla");
  });
});
