import { setupI18n } from "@lingui/core";
import { describe, expect, it } from "vitest";
import { ROLE_SHEET_WORDS } from "@shared/roleSheetWords";
import { seatSheet, type SeatInput } from "@shared/roleSheet";
import { expectMirrorMatches } from "@/i18n/wordTableTesting";
import { ROLE_SHEET_MIRROR, roleSheetWords } from "./roleSheetMirror";

const SAMPLES = {
  "lines.listOf": [["aim, domain", "why"]],
  "lines.stillToWrite": [["what it works toward"]],
  "lines.alsoStillToWrite": [["when the term ends"]],
  "lines.notCarried": [["when the term ends"]],
  "lines.readyCount": [
    [1, 3],
    [2, 3],
  ],
  "lines.personTermEnds": [["21 Mar"]],
  "lines.applyAria": [["Water steward"]],
  "lines.contact": [["Ana"]],
  "lines.stockArtFor": [["Weaver"]],
  "lines.daysLeftInTerm": [[1], [12]],
  "lines.daysLeftInSeason": [[1], [0], [40]],
  "lines.termEnds": [["21 Mar 2027"]],
  "lines.namedSeasonEnds": [["Rains", "21 Mar 2027"]],
  "lines.seasonEnds": [["21 Mar 2027"]],
  "lines.places": [[1], [3]],
  "lines.openPlaces": [[1], [0], [2]],
  "lines.endsOn": [["21 Mar 2027"]],
  "lines.reachedOn": [["21 Mar 2027"]],
  "lines.circlesOwnWay": [["Land"]],
  "lines.villagesWayNotCircles": [["Land"]],
  "lines.flipSubWork": [[3, 7]],
  "lines.flipSub": [[0, 7]],
  "lines.powers": [[1], [4]],
  "lines.withPowers": [["role"]],
  seatPreviewSub: [[1], [3]],
  suitsLabel: [["Weaver"]],
  speaksForLabel: [["Land"]],
  speaksForGloss: [["Land"]],
  moreOpenLine: [[1], [4]],
  notReadLine: [[[]], [["a", "b"]]],
  rungLine: [["Member"]],
  keptByLine: [["Ana"]],
} as const;

describe("the role card's words in the reader's language (lane ES-A)", () => {
  it("draws exactly the shared English, and every entry goes through the catalog", () => {
    expectMirrorMatches(ROLE_SHEET_WORDS, ROLE_SHEET_MIRROR, SAMPLES);
  });

  it("the view model takes the translated copy, and with none it reads the shared English", () => {
    const input: SeatInput = {
      mode: "seat",
      id: "s1",
      name: "Water steward",
      isExample: false,
      circle: null,
      seats: 2,
      holderCount: 0,
      holders: [],
      state: "open",
      aim: null,
      domain: null,
      accountabilities: [],
      whyItMatters: null,
      namesServed: true,
      signedIn: true,
      offers: { raiseHand: true, contact: false },
    } as unknown as SeatInput;
    const ctx = { now: new Date("2026-11-26T12:00:00Z"), season: null, classNames: null };
    const english = seatSheet(input, ctx);
    expect(english.badge?.label).toBe("Open");
    expect(seatSheet(input, { ...ctx, words: roleSheetWords(setupI18n({ locale: "en", messages: { en: {} } })) })).toEqual(english);

    const ids = Object.fromEntries([ROLE_SHEET_MIRROR.lines.state.open, ROLE_SHEET_MIRROR.words.openPlace].map((d) => [d.id, d === ROLE_SHEET_MIRROR.lines.state.open ? "Abierto" : "Lugar abierto"]));
    const es = seatSheet(input, { ...ctx, words: roleSheetWords(setupI18n({ locale: "es", messages: { es: ids } })) });
    expect(es.badge?.label).toBe("Abierto");
    expect(es.spots[0].title).toBe("Lugar abierto");
  });
});
