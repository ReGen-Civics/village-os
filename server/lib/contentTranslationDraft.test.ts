/** The machine draft's ask and the reading of its answer (server/lib/contentTranslationDraft.ts). */
import { describe, expect, it } from "vitest";
import { readTranslationReply, translationMessage, translationSystemPrompt } from "./contentTranslationDraft";

describe("the machine's translation ask", () => {
  it("names the language, the village voice and the braces rule", () => {
    const p = translationSystemPrompt("es", "Riverside");
    expect(p).toMatch(/Español|Spanish/);
    expect(p).toMatch(/\{village\}/);
    expect(p).toMatch(/tú/);
  });

  it("sends each field's English under its id", () => {
    expect(JSON.parse(translationMessage([{ field: "aim", english: "Hold it." }]))).toEqual({ translate: { aim: "Hold it." } });
  });

  it("reads only the fields asked for, and only words", () => {
    const text = 'Here you go: {"translations": {"aim": "Sostenerlo.", "name": 7, "extra": "x", "blank": " "}}';
    expect(readTranslationReply(text, [{ field: "aim" }, { field: "name" }, { field: "blank" }])).toEqual({ aim: "Sostenerlo." });
    expect(readTranslationReply("no json", [{ field: "aim" }])).toEqual({});
  });
});
