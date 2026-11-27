/**
 * The server says the digest's folded line by the shared English and the bell's context (`manyLineIn`,
 * server/lib/catalogSpeech.ts), so every kind's batched line here must carry exactly that id: the shared English, and
 * the context "the bell: several notices of one kind batched into a line, kind <type>". A kind whose context drifts
 * would leave its digest line in English while the bell says it in Spanish.
 */
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_KIND_WORDS } from "@shared/notificationKindWords";
import { KIND_WORDS_MSG } from "./noticeKindWordsI18n";

describe("every kind's batched line is the id the server reads", () => {
  it("by the shared English and the bell's context", () => {
    for (const [type, words] of Object.entries(NOTIFICATION_KIND_WORDS)) {
      expect(KIND_WORDS_MSG[type]?.many.id, type).toBe(generateMessageId(words.many, `the bell: several notices of one kind batched into a line, kind ${type}`));
    }
  });
});
