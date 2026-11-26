/**
 * The digest's folded line in the reader's language (`manyLineIn`, server/lib/catalogSpeech.ts): the bell's own
 * batched line, read from the compiled catalog by the shared English and the bell's context. Every kind's server id
 * is the bell's id (client/src/lib/noticeKindManyIds.test.ts holds that); here the real Spanish catalog says one, and
 * a language with no catalog says none, so the digest keeps the English.
 */
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { manyLine } from "../shared/notificationKindWords";
import { forgetSpeakers, manyLineIn } from "./lib/catalogSpeech";

beforeEach(() => forgetSpeakers());

describe("manyLineIn", () => {
  it("says the canvas line in Spanish, from the bell's own words", () => {
    expect(manyLineIn("es", "canvas_revisit", 4), "build first: the Spanish catalog is dist/i18n/es.json").toBe("4 respuestas del lienzo merecen otra mirada.");
  });

  it("has nothing to say without a catalog, and the digest keeps its English", () => {
    expect(manyLineIn("es", "canvas_revisit", 4, [path.join(os.tmpdir(), "no-such-catalog-dir")])).toBeNull();
    expect(manyLine("canvas_revisit", 4)).toBe("4 canvas answers are worth another look.");
  });
});
