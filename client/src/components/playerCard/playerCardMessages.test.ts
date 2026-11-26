/**
 * The player card in the reader's language. The server says it (server/lib/platformSpeech.ts) from the plain
 * messages in shared/playerCardMessages.ts; the extractor reads the same messages here (playerCardMessages.ts).
 * These tests hold the two copies to one id each, the table they make to the English CARD_WORDS word for word
 * (each sentence with sample arguments, so a word added there fails here until it is here), every message to
 * having Spanish, and the card said again from what the builder recorded (shared/playerCardSpeak.ts).
 */
import path from "node:path";
import { setupI18n, type MessageDescriptor } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { describe, expect, it } from "vitest";
import { buildPlayerCard, CARD_WORDS, type PlayerCardInput, type PlayerRoleIn } from "@shared/playerCard";
import { CARD_MESSAGES, type CardMessageKey } from "@shared/playerCardMessages";
import { cardWordsWith, fixedCardWords, sayCardIn, type CardSay } from "@shared/playerCardSpeak";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../../scripts/lib/poFragments.mjs";
import { cardWordsFor, CLIENT_CARD_MESSAGES } from "./cardWords";
import { PLAYER_CARD_DESCRIPTORS, PLAYER_CARD_MESSAGES } from "./playerCardMessages";

// The build precompiles each message (precompileEnglish.ts), so the English is read the way a page reads it.
const EN = setupI18n({ locale: "en", messages: { en: {} } });
const MSG = PLAYER_CARD_MESSAGES as Record<CardMessageKey, MessageDescriptor>;
const sayWith =
  (i18n: typeof EN): CardSay =>
  (key, values) =>
    i18n._(values ? { ...MSG[key], values } : MSG[key]);

/** Sample arguments for every sentence in the table. A new one fails the first test until it has some here. */
const SAMPLES: Record<string, unknown[][]> = {
  rolesLine: [[1, "Gardener"], [2, "Gardener and Cook"]],
  dayOfSeason: [[3, 92]],
  appliesFor: [["Gardener"]],
  moonName: [["October"], ["May"]],
  moonPill: [["October Moon", 22, 92]],
  moonLine: [["October Moon", "10 Oct", "8 Nov"]],
  heroSpan: [["1 October", "31 December 2026"]],
  tagline: [
    ["One", 1, null, null, false],
    ["Three", 3, "the Land circle", "Full-time", false],
    ["two", 2, "the Land circle and the Water circle", null, true],
    ["13", 13, null, "About 20 hours a week", false],
  ],
  aboutHours: [[20], [1]],
  portraitAlt: [["Lena Ortiz"]],
  acrossMany: [[2], [5]],
  myNRoles: [[1], [3]],
  eachInFull: [[1], [2]],
  seasonalGoals: [[0], [1], [3]],
  goalDoneBy: [["31 Dec", "the team can take in 30 people"]],
  doneWhen: [["the beans are in"]],
  signsLede: [["Riverbend"], [null]],
  signFrom: [["Counted from the application page.", "Gardener"]],
  nOf: [[5, 6]],
  loadRoles: [[0], [1], [3]],
  loadTasks: [[1], [4]],
  openSheet: [["Gatherings held on time"]],
  heldUntil: [["31 Dec 2026"]],
  reviewWeekOf: [["16 Nov"]],
  sharedWith: [["Places people in roles", "Operations Steward"]],
  worksWithLine: [["Operations Steward", "the intake agent"]],
  ofTarget: [[9]],
  tensionsAnswered: [[1], [3]],
  tensionsOpen: [[1], [2]],
  tensionsOpenPrivate: [[1, 1], [3, 3], [3, 1], [4, 2]],
  tensionsAnsweredThisMoon: [[2]],
  reviewOn: [["Gardener"]],
  renewalOn: [["Gardener"]],
  termEnds: [["Gardener"]],
  invoice: [["Gardener"]],
  moonDates: [["10 Oct", "8 Nov"]],
  gathering: [["Full team meeting", 1, "10:00", false, "Gardener"], ["Circle", 6, "09:30", true, "Cook"], ["Circle", 9, "09:30", false, "Cook"]],
  acceptedOn: [["3 Nov"]],
  filedOn: [["5 Oct 2026"]],
  termsOnce: [["three"]],
  endsOn: [["31 Dec 2026"]],
  lengthMoons: [[1], [3]],
  reviewDate: [["16 Nov 2026"]],
  renewalDate: [["1 Dec 2026"]],
  notice: [[1], [14]],
  tasksPerMoon: [[3, 6], [3, 3], [null, 1], [2, null]],
  bonusEquity: [["Riverbend", "Seed Shares"]],
  bonusCap: [["set each moon"]],
  bonusRatedBy: [["the circle"]],
  bonusCadence: [["each moon"]],
};

describe("the player card's messages", () => {
  it("the server's copy and the extractor's are the same messages, by id", () => {
    expect(Object.keys(PLAYER_CARD_MESSAGES).sort()).toEqual(Object.keys(CARD_MESSAGES).sort());
    for (const [key, d] of Object.entries(CARD_MESSAGES)) {
      expect(MSG[key as CardMessageKey].id, key).toBe(generateMessageId(d.message, d.context));
    }
  });

  it("the sentences a component says itself are the server's messages too", () => {
    for (const [key, d] of Object.entries(CLIENT_CARD_MESSAGES)) {
      const server = CARD_MESSAGES[key as CardMessageKey];
      expect(server, key).toBeTruthy();
      expect(d.id, key).toBe(generateMessageId(server.message, server.context));
    }
  });

  it("make every entry in shared/playerCardWords.ts, in English, word for word", () => {
    const en = cardWordsWith(sayWith(EN), "en") as Record<string, unknown>;
    for (const [key, english] of Object.entries(CARD_WORDS)) {
      const mine = en[key];
      if (typeof english === "function") {
        expect(SAMPLES[key], `give "${key}" sample arguments in playerCardMessages.test.ts`).toBeTruthy();
        for (const args of SAMPLES[key]) expect((mine as (...a: unknown[]) => unknown)(...args), `${key}(${JSON.stringify(args)})`).toBe((english as (...a: unknown[]) => unknown)(...args));
      } else {
        expect(mine, key).toEqual(english);
      }
    }
    expect(Object.keys(en).sort()).toEqual(Object.keys(CARD_WORDS).sort());
  });

  it("Spanish carries every one of them", async () => {
    const dir = path.resolve(__dirname, "../../locales");
    const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
    const missing = PLAYER_CARD_DESCRIPTORS.filter((d) => !es[d.id!]?.translation).map((d) => EN._(d));
    expect(missing, "add them to a fragment in client/src/locales/es.d/").toEqual([]);
  });
});

const TZ = "America/Costa_Rica";

function role(n: number, over: Partial<PlayerRoleIn> = {}): PlayerRoleIn {
  return {
    id: `r${n}`,
    name: n === 1 ? "Garden Steward" : "Kitchen Keeper",
    aim: "Food grows here all year.",
    whyItMatters: null,
    domain: "The beds and the seed store.",
    accountabilities: ["The beds, planted each moon."],
    criticality: "high",
    circle: { id: "c1", name: "Land circle" },
    termEndsAt: "2026-12-31T06:00:00Z",
    archetypes: null,
    archetypesSuggested: false,
    bringMe: null,
    notMine: null,
    runbook: undefined,
    worksWith: [],
    powers: [],
    tensions: [{ id: "t1", status: "open", raisedBy: "u-owner", text: "The hose leaks." }],
    settings: {
      v: 1,
      term: { endsOn: "2026-12-31", reviewOn: "2026-11-16", noticeDays: 14 },
      rhythm: { gatherings: [{ label: "Bed walk", weekday: 1, time: "10:00", every: "week" }] },
    },
    ...over,
  };
}

const input = (over: Partial<PlayerCardInput> = {}): PlayerCardInput => ({
  now: new Date("2026-10-22T18:00:00Z"),
  timeZone: TZ,
  owner: { userId: "u-owner", displayName: "Lena Ortiz", avatar: null },
  viewerUserId: "u-owner",
  villageName: "Riverbend",
  season: { id: "s2", name: "Season of Foundations", startsOn: "2026-10-01", endsOn: "2026-12-31" },
  nextSeasonId: "s3",
  archetypeNames: {},
  roles: [role(1), role(2)],
  plan: { aim: "Every bed planted.", goals: [] },
  seasonalGoals: null,
  tasks: [{ id: "t1", title: "Plant the beans", roleId: "r1", status: "open", doneWhen: "the beans are in" }],
  signRows: {},
  howIHold: null,
  applications: [],
  roleNames: {},
  bonusTokenName: null,
  loadRead: 3,
  ...over,
});

describe("sayCardIn", () => {
  // Each message is the English one, compiled as the build compiles it, with "ES " in front.
  const es = setupI18n({ locale: "es", messages: { es: {} } });
  es.load("es", Object.fromEntries(PLAYER_CARD_DESCRIPTORS.map((d) => [d.id, Array.isArray(d.message) ? ["ES ", ...d.message] : `ES ${d.message}`])) as any);
  const words = cardWordsWith(sayWith(es), "es");

  it("leaves an English reader's card exactly as the server built it", () => {
    const card = buildPlayerCard(input());
    expect(sayCardIn(card, cardWordsWith(sayWith(EN), "en"), "en")).toBe(card);
  });

  it("says every baked sentence again from its key and arguments, and keeps the card's own words", () => {
    const card = sayCardIn(buildPlayerCard(input()), words, "es");
    expect(card.said).toBeUndefined();
    // The names are the card's own; the list joins them in the reader's language.
    expect(card.header.name).toBe("Lena Ortiz");
    expect(card.header.rolesLine).toBe("ES 2 roles: Garden Steward y Kitchen Keeper");
    expect(card.across.heading).toBe("ES Across all 2 roles");
    expect(card.across.load.own).toEqual({ kind: "shown", value: { step: 3, words: "ES Balanced" } });
    // A line the builder joined from two sentences is said again piece by piece.
    expect(card.across.load.words).toBe("ES 2 roles · ES 1 open task this moon");
    const r = card.roles[0];
    expect(r.title).toBe("Garden Steward");
    expect(r.purpose.heading).toBe("ES Purpose");
    expect(r.purpose.text).toEqual({ kind: "shown", value: "Food grows here all year." });
    expect(r.chips[0]).toBe("ES Key role");
    // A day the server formatted is written again in the reader's language, inside its sentence.
    expect(r.chips[1].startsWith("ES Held until ")).toBe(true);
    expect(r.chips[1]).toContain("diciembre");
    // A sentence made from another one says both again, and a weekday is said in the reader's language.
    expect(card.header.moon.words).toBe("ES ES octubre Moon · Day 22 of 92");
    expect(card.timeline.rhythm[0]).toBe("ES Bed walk, every week on lunes at 10:00, for Garden Steward");
    // The tagline names the circle bare, with no English "the".
    expect(card.header.tagline).toBe("ES ES ES Two roles in Land circle");
  });

  it("a sentence the language has no words for stays in English, and only that one", () => {
    const say: CardSay = (key, values) => {
      if (key === "keyRole") throw new Error("no words");
      return sayWith(es)(key, values);
    };
    const card = sayCardIn(buildPlayerCard(input()), cardWordsWith(say, "es"), "es");
    expect(card.roles[0].chips[0]).toBe("Key role");
    expect(card.roles[0].purpose.heading).toBe("ES Purpose");
    const fixed = fixedCardWords(cardWordsWith(say, "es"));
    expect(fixed.keyRole).toBeUndefined();
    expect(fixed.purpose).toBe("ES Purpose");
  });

  it("an older card, with no record, is drawn as sent", () => {
    const card = { ...buildPlayerCard(input()), said: undefined };
    expect(sayCardIn(card, words, "es")).toBe(card);
  });

  it("a seasonal goal keeps the owner's own words beside the sentence, for the editor", () => {
    const card = sayCardIn(
      buildPlayerCard(input({ seasonalGoals: [{ title: "Beds", doneWhen: "every bed is planted", doneBy: null }] as any })),
      words,
      "es",
    );
    const items = (card.across.seasonalGoals.items as any).value;
    expect(items[0].doneWhen).toBe("ES Done when every bed is planted");
    expect(items[0].when).toBe("every bed is planted");
  });

  it("a card that shows less keeps no record of what it no longer shows", () => {
    const full = buildPlayerCard(input());
    expect(Object.keys(full.said!.words)).toContain(CARD_WORDS.tensionsOpen(1));
    // The same card with its tensions unread: the open-tension line is gone, and so is its record.
    const quiet = buildPlayerCard(input({ roles: [role(1, { tensions: undefined }), role(2, { tensions: undefined })] }));
    expect(Object.keys(quiet.said!.words)).not.toContain(CARD_WORDS.tensionsOpen(1));
    expect(Object.keys(quiet.said!.words)).not.toContain(CARD_WORDS.tensions);
  });
});

describe("cardWordsFor, the components' table", () => {
  const es = setupI18n({ locale: "es", messages: { es: {} } });
  es.load("es", Object.fromEntries(Object.values(CLIENT_CARD_MESSAGES).map((d) => [d.id, Array.isArray(d.message) ? ["ES ", ...d.message] : `ES ${d.message}`])) as any);

  it("is the English with no lines from the server", () => {
    const w = cardWordsFor(undefined, es);
    expect(w.purpose).toBe(CARD_WORDS.purpose);
    expect(w.myNRoles(2)).toBe(CARD_WORDS.myNRoles(2));
    expect(w.count(2)).toBe("Two");
  });

  it("lays the server's lines over the English and says its own sentences in the reader's language", () => {
    const w = cardWordsFor({ purpose: "Propósito" }, es);
    expect(w.purpose).toBe("Propósito");
    expect(w.keyRole).toBe(CARD_WORDS.keyRole);
    expect(w.myNRoles(2)).toBe("ES My 2 roles");
    expect(w.portraitAlt("Lena")).toBe("ES Lena's character portrait");
  });
});
