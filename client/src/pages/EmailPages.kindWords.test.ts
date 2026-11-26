import { setupI18n } from "@lingui/core";
import { describe, expect, it } from "vitest";
import { BLOCKED_WORDS, ESSENTIAL_NOTE, KIND_WORDS } from "@shared/comms/preferences";
import { BLOCKED_MSG, ESSENTIAL_NOTE_MSG, KIND_WORDS_MSG } from "./EmailPages";

const en = setupI18n({ locale: "en", messages: { en: {} } });

describe("the email preferences page says what the server says, in the reader's language", () => {
  it("every switch carries the shared English", () => {
    expect(Object.keys(KIND_WORDS_MSG).sort()).toEqual(Object.keys(KIND_WORDS).sort());
    for (const [kind, words] of Object.entries(KIND_WORDS)) {
      const m = KIND_WORDS_MSG[kind as keyof typeof KIND_WORDS_MSG];
      expect({ label: en._(m.label), description: en._(m.description) }, kind).toEqual(words);
    }
  });

  it("every reason an address receives nothing, and the standing note, carry the shared English", () => {
    expect(Object.keys(BLOCKED_MSG).sort()).toEqual(Object.keys(BLOCKED_WORDS).sort());
    for (const [reason, sentence] of Object.entries(BLOCKED_WORDS)) expect(en._(BLOCKED_MSG[reason as keyof typeof BLOCKED_MSG]), reason).toBe(sentence);
    expect(en._(ESSENTIAL_NOTE_MSG)).toBe(ESSENTIAL_NOTE);
  });
});
