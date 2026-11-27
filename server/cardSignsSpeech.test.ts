/**
 * The signs on the player card and their sheets, said by the server from the real compiled catalog
 * (shared/roleSignMessages.ts): a sign's label and "Counted from" line noted on the card's record and said again,
 * a sheet's fixed lines by their English, its rows made from a title or a count by their record, and nothing of the
 * record left in what is sent.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { PlayerCard } from "../shared/playerCard";
import { cardWordsWith, sayCardIn } from "../shared/playerCardSpeak";
import { MISSING_PARTS, SHEET_WORDS } from "../shared/roleSignRows";
import { NOT_COUNTED_YET, SIGNS } from "../shared/roleSigns";
import { noteSignWords, plainSheets, saySheetsIn, signWordsWith, type SheetIn } from "../shared/roleSignMessages";
import { forgetSpeakers, messageSay, speakerFor } from "./lib/catalogSpeech";

beforeEach(() => forgetSpeakers());

const say = () => {
  const i18n = speakerFor("es");
  expect(i18n, "build first: the Spanish catalog is dist/i18n/es.json").not.toBeNull();
  return messageSay(i18n!);
};

const sheet: SheetIn = {
  title: SIGNS["roles-with-card-and-term"].label,
  countedFrom: SIGNS["roles-with-card-and-term"].countedFrom,
  rows: [
    { at: null, words: SHEET_WORDS.fullCard("Gardener"), who: null, said: { k: "fullCard", a: ["Gardener"] } },
    { at: null, words: SHEET_WORDS.missing("Cook", `${MISSING_PARTS.aim}, ${MISSING_PARTS.term}`), who: null, said: { k: "missing", a: ["Cook", ["aim", "term"]] } },
    { at: "2026-10-01T10:00:00Z", words: SHEET_WORDS.met(1), who: null, said: { k: "met", a: [1] } },
    { at: null, words: SHEET_WORDS.decision, who: null },
  ],
  note: SHEET_WORDS.firstNamesNote,
};

describe("the sign sheets from the Spanish catalog", () => {
  it("say every line, keep each role's title, and leave no record on a row", () => {
    const out = saySheetsIn({ k: sheet }, say()).k;
    expect(out.title).toBe("Roles con tarjeta completa y un plazo");
    expect(out.note).toBe("Solo nombres de pila. En el orden en que ocurrió.");
    expect(out.rows.map((r) => r.words)).toEqual(["Gardener: tarjeta completa y un plazo", "Cook: falta el propósito, un plazo", "El círculo se reunió, 1 persona", "Una decisión registrada"]);
    expect(out.rows.some((r) => "said" in r)).toBe(false);
  });

  it("an English reader's sheets are as built, with no record left", () => {
    const out = plainSheets({ k: sheet }).k;
    expect(out.rows.map((r) => r.words)).toEqual(sheet.rows.map((r) => r.words));
    expect(out.rows.some((r) => "said" in r)).toBe(false);
  });
});

describe("a sign's lines on the card", () => {
  it("are noted on the record and said again", () => {
    const label = SIGNS["circle-met"].label;
    const card = { roles: [], said: { words: {}, days: {} }, working: { label, countedFrom: SIGNS["circle-met"].countedFrom, words: NOT_COUNTED_YET } } as unknown as PlayerCard;
    const noted = { ...card, said: noteSignWords(card.said!) };
    const out = sayCardIn(noted, cardWordsWith(() => "", "es"), "es", { sign: signWordsWith(say()) }) as unknown as { working: Record<string, string> };
    expect(out.working).toEqual({
      label: "Veces que el círculo se reunió",
      countedFrom: "Contado a partir de las sesiones en vivo a las que se unieron dos o más personas.",
      words: "Aún no se ha contado",
    });
  });
});
