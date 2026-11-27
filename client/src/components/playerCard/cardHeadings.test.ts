/**
 * The role words' headings outside the player card (cardHeadings.ts) are the player card's own messages: the same
 * English as CARD_WORDS and the same id as playerCardMessages.ts, so they read the Spanish the catalog already holds.
 * The proposal editor's field labels (roleWords.ts EDIT_FIELDS) read them in the language active now.
 */
import { i18n, setupI18n } from "@lingui/core";
import { afterEach, describe, expect, it } from "vitest";
import { CARD_WORDS } from "@shared/playerCardWords";
import { EDIT_FIELDS } from "../roleProposal/roleWords";
import { CARD_HEADING_MESSAGES, cardHeadingsIn, type CardHeadingKey } from "./cardHeadings";
import { PLAYER_CARD_MESSAGES } from "./playerCardMessages";

const EN = setupI18n({ locale: "en", messages: { en: {} } });

afterEach(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("the role words' headings", () => {
  it("are the card's English and the card's own messages, by id", () => {
    const en = cardHeadingsIn(EN);
    for (const key of Object.keys(CARD_HEADING_MESSAGES) as CardHeadingKey[]) {
      expect(en[key], key).toBe(CARD_WORDS[key]);
      expect(CARD_HEADING_MESSAGES[key].id, key).toBe((PLAYER_CARD_MESSAGES as Record<string, { id?: string }>)[key].id);
    }
  });

  it("the editor's field labels follow the language active now", () => {
    expect(EDIT_FIELDS[0].label).toBe(CARD_WORDS.purpose);
    i18n.load("es", Object.fromEntries(Object.entries(CARD_HEADING_MESSAGES).map(([k, d]) => [d.id, `ES ${k}`])));
    i18n.activate("es");
    expect(EDIT_FIELDS.map((f) => f.label).every((l) => l.startsWith("ES "))).toBe(true);
  });
});
