/**
 * The circle card in the reader's language (circleWords.ts). Every entry is held to shared/circleCardWords.ts, each
 * sentence with sample arguments, so a word added there fails here until it is here; and the card the server
 * builds is said again from what it recorded (shared/saidWords.ts).
 */
import path from "node:path";
import { setupI18n } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { describe, expect, it } from "vitest";
import { buildCircleCard, writtenOnly, type CircleCardIn } from "@shared/circleCard";
import { EMPTY_CHARTER } from "@shared/circleCharter";
import { CIRCLE_CARD_WORDS, CIRCLE_HEADINGS, CIRCLE_SECTION_KEYS } from "@shared/circleCardWords";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../../scripts/lib/poFragments.mjs";
import { CIRCLE_HEADING_WORDS, CIRCLE_WORD_DESCRIPTORS, circleWordsIn, localizeCircleCard } from "./circleWords";

// The build precompiles each message (precompileEnglish.ts), so the English is read the way a page reads it.
const EN = setupI18n({ locale: "en", messages: { en: {} } });

/** Sample arguments for every sentence in the table. A new one fails the first test until it has some here. */
const SAMPLES: Record<string, unknown[][]> = {
  accountabilitiesShort: [[1], [2]],
  rolePartly: [[1, 3]],
  seeCardOf: [["Gardener", 1, 1], ["Gardener", 2, 3]],
  heldByNames: [[[]], [["Ana"]], [["Ana", "Cai"]], [["Ana", "Bea", "Cai"]]],
  valueLine: [["Care", "we check in each week"]],
  adoptedByVote: [["1 October 2026"]],
  adoptedDirectly: [["1 October 2026"]],
  adoptionCount: [[1, "1 October 2026"], [3, "4 September 2026"]],
  proposedOn: [["22 October 2026"]],
  voting: [["30 November 2026"]],
  nOf: [[2, 5]],
  lastMet: [["20 November 2026"]],
  rhythm: [["every Tuesday"]],
  nextMeeting: [["Tuesday at 10"]],
  waiting: [[0], [1], [4]],
  openTensions: [[0], [1], [4]],
  reviewDue: [["21 December 2026"]],
  lastChanged: [["1 October 2026"]],
};

describe("every circle card word has the client's words for it", () => {
  it("each entry in shared/circleCardWords.ts, in English, word for word", () => {
    const en = circleWordsIn(EN) as Record<string, unknown>;
    for (const [key, english] of Object.entries(CIRCLE_CARD_WORDS)) {
      const mine = en[key];
      if (typeof english === "function") {
        expect(SAMPLES[key], `give "${key}" sample arguments in circleWords.test.ts`).toBeTruthy();
        for (const args of SAMPLES[key]) expect((mine as (...a: unknown[]) => unknown)(...args), `${key}(${JSON.stringify(args)})`).toBe((english as (...a: unknown[]) => unknown)(...args));
      } else {
        expect(mine, key).toEqual(english);
      }
    }
    expect(Object.keys(en).sort()).toEqual(Object.keys(CIRCLE_CARD_WORDS).sort());
  });

  it("each heading, by its section key", () => {
    for (const k of CIRCLE_SECTION_KEYS) expect(EN._(CIRCLE_HEADING_WORDS[k]), k).toBe(CIRCLE_HEADINGS[k]);
  });

  it("Spanish carries every one of them", async () => {
    const dir = path.resolve(__dirname, "../../locales");
    const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
    const missing = CIRCLE_WORD_DESCRIPTORS.filter((d) => !es[d.id]?.translation).map((d) => EN._(d));
    expect(missing, "add them to a fragment in client/src/locales/es.d/").toEqual([]);
  });
});

const input = (over: Partial<CircleCardIn> = {}): CircleCardIn => ({
  circle: { id: "c-garden", name: "Garden circle", purpose: "Grow food together.", status: "forming", parent: { id: "c-root", name: "Coordinating circle" } },
  charter: { ...EMPTY_CHARTER, existsWhile: "the village eats from its own land", accountabilities: ["One"] },
  roles: [{ id: "r-1", name: "Gardener", state: "partial", holderCount: 1, capacity: 3, holderNames: ["Ana"], holderHandles: ["ana"] } as any],
  adoptions: [{ draftId: "d-1", publishedAt: "2026-10-01T10:00:00Z", byVote: true, created: false }],
  reviewOn: "2026-12-21",
  timeZone: "UTC",
  frameworkTerms: true,
  ...over,
});

describe("localizeCircleCard", () => {
  // A catalog where every message reads as its key in capitals, so a translated sentence is plain to see.
  const es = setupI18n({ locale: "es", messages: { es: {} } });
  // Each message is the English one, compiled as the build compiles it, with "ES " in front.
  es.load("es", Object.fromEntries(CIRCLE_WORD_DESCRIPTORS.map((d) => [d.id, Array.isArray(d.message) ? ["ES ", ...d.message] : `ES ${d.message}`])) as any);

  it("leaves an English reader's card exactly as the server built it", () => {
    const card = buildCircleCard(input());
    expect(localizeCircleCard(card, EN)).toBe(card);
  });

  it("says every baked sentence again from its key and arguments, and keeps the circle's own words", () => {
    const card = localizeCircleCard(buildCircleCard(input()), es);
    expect(card.header.eyebrow).toBe("ES Circle");
    expect(card.header.status).toBe("ES Forming");
    expect(card.header.name).toBe("Garden circle");
    const roles = card.sections.find((s) => s.key === "roles")!;
    expect(roles.heading).toBe("ES Roles in this circle");
    const row = (roles.slot as any).value[0];
    expect(row.stateWords).toBe("ES 1 of 3 filled");
    expect(row.name).toBe("Gardener");
    const note = (card.sections.find((s) => s.key === "accountabilities") as any).note;
    expect(note).toBe("ES 1 line written. A circle answers for 3 to 6 things.");
    // A day the server formatted is written again in the reader's language.
    const review = (card.sections.find((s) => s.key === "review")!.slot as any).value.lines[0] as string;
    expect(review.startsWith("ES Due for review on ")).toBe(true);
    expect(review).toContain("diciembre");
  });

  it("an older server's card, with no record, is drawn as sent", () => {
    const card = { ...buildCircleCard(input()), said: undefined };
    const out = localizeCircleCard(card, es);
    expect(out.header.eyebrow).toBe("Circle");
    expect(out.sections[0].heading).toBe("ES Why this circle exists");
  });

  it("a visitor's card keeps no record of what it no longer shows", () => {
    const full = buildCircleCard(input({ charter: { ...EMPTY_CHARTER } }));
    expect(Object.keys(full.said!.words)).toContain(CIRCLE_CARD_WORDS.notWritten);
    const quiet = writtenOnly(full);
    expect(Object.keys(quiet.said!.words)).not.toContain(CIRCLE_CARD_WORDS.notWritten);
  });
});
