/**
 * The signs on the player card and their sheets: the server's plain copy (shared/roleSignMessages.ts) and the
 * extractor's (roleSignMessages.ts) are the same messages, one id each, and every one has Spanish.
 */
import path from "node:path";
import { setupI18n } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { describe, expect, it } from "vitest";
import { ALL_SIGN_MESSAGES } from "@shared/roleSignMessages";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../../scripts/lib/poFragments.mjs";
import { ROLE_SIGN_MESSAGES } from "./roleSignMessages";

const EN = setupI18n({ locale: "en", messages: { en: {} } });

describe("the player card's sign words", () => {
  it("the server's copy and the extractor's are the same messages, by id", () => {
    expect(ROLE_SIGN_MESSAGES.map((d) => d.id)).toEqual(ALL_SIGN_MESSAGES.map((d) => generateMessageId(d.message, d.context)));
  });

  it("Spanish carries every one of them", async () => {
    const dir = path.resolve(__dirname, "../../locales");
    const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
    const missing = ROLE_SIGN_MESSAGES.filter((d) => !es[d.id!]?.translation).map((d) => EN._(d));
    expect(missing, "add them to a fragment in client/src/locales/es.d/").toEqual([]);
  });
});
