/**
 * Pay to be determined in the reader's language (client/src/lib/payTbdWords.ts): the English is the terms' own
 * words, and es.po carries the Spanish under the same id.
 */
import fs from "node:fs";
import path from "node:path";
import { setupI18n } from "@lingui/core";
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { describe, expect, it } from "vitest";
import { PAY_TBD_WORDS } from "@shared/seatSettings";
import { PAY_TBD, payHeadlineIn, payTbdLine } from "./payTbdWords";

const CONTEXT = "pay on offer: paid, the amount still to be set";

describe("payTbdWords", () => {
  it("says the terms' own English", () => {
    const en = setupI18n({ locale: "en", messages: { en: {} } });
    expect(payTbdLine(en)).toBe(PAY_TBD_WORDS);
    expect(payHeadlineIn(PAY_TBD_WORDS, PAY_TBD_WORDS, en)).toBe("Pay to be determined");
    // Any other headline passes through as written.
    expect(payHeadlineIn("Between $1 and $2", PAY_TBD_WORDS, en)).toBe("Between $1 and $2");
  });

  it("says Pago por definir in Spanish, from es.po", () => {
    const po = fs.readFileSync(path.resolve(__dirname, "../locales/es.po"), "utf8");
    expect(po).toContain(`msgctxt "${CONTEXT}"\nmsgid "Pay to be determined"\nmsgstr "Pago por definir"`);
    const id = generateMessageId("Pay to be determined", CONTEXT);
    expect((PAY_TBD as { id?: string }).id ?? id).toBe(id);
    const es = setupI18n({ locale: "es", messages: { es: { [id]: "Pago por definir" } } });
    expect(payTbdLine(es)).toBe("Pago por definir");
    expect(payHeadlineIn(PAY_TBD_WORDS, PAY_TBD_WORDS, es)).toBe("Pago por definir");
  });
});
