/**
 * The server's plain copy of every notice key's words (shared/noticeKeyMessages.ts, read by the notice emails) is the
 * same set of messages as the bell's (noticeWords.ts, read by the extractor): the same id for each title, body and
 * fallback, so the email and the bell say one translation.
 */
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { describe, expect, it } from "vitest";
import { NOTICE_KEYS } from "@shared/noticeKeys";
import { NOTICE_KEY_MESSAGES } from "@shared/noticeKeyMessages";
import { NOTICE_KEY_WORDS } from "./noticeWords";

describe("the server's notice messages are the bell's", () => {
  it("every key, every part, by id", () => {
    expect(Object.keys(NOTICE_KEY_MESSAGES).sort()).toEqual(Object.keys(NOTICE_KEYS).sort());
    for (const key of Object.keys(NOTICE_KEYS) as (keyof typeof NOTICE_KEYS)[]) {
      const server = NOTICE_KEY_MESSAGES[key];
      const client = NOTICE_KEY_WORDS[key];
      const id = (m: { message: string; context: string }) => generateMessageId(m.message, m.context);
      expect(client.title.id, `${key} title`).toBe(id(server.title));
      expect(client.body?.id, `${key} body`).toBe(server.body ? id(server.body) : undefined);
      expect(Object.keys(client.fallback ?? {}).sort(), `${key} fallbacks`).toEqual(Object.keys(server.fallback ?? {}).sort());
      for (const [name, m] of Object.entries(server.fallback ?? {})) expect(client.fallback![name].id, `${key} ${name}`).toBe(id(m));
    }
  });
});
