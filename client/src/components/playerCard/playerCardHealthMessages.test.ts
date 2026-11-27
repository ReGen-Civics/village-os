/**
 * The role health and handover lines on the player card, in the reader's language. The server says them from the
 * plain copy in shared/playerCardHealthMessages.ts; the extractor reads the same messages here. These tests hold the
 * two copies to one id each, the words they make to the English HEALTH_WORDS and HANDOVER_CHECK_WORDS word for word,
 * every message to having Spanish, and the card's health lines said again from what the builder recorded.
 */
import path from "node:path";
import { setupI18n, type MessageDescriptor } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { describe, expect, it } from "vitest";
import { buildPlayerCard, type PlayerCardInput, type PlayerRoleIn } from "@shared/playerCard";
import { HEALTH_WORDS } from "@shared/playerCardHealth";
import { HANDOVER_CHECK_WORDS } from "@shared/roleHandover";
import { HEALTH_MESSAGES, healthWordsWith, type HealthMessageKey, type HealthSay } from "@shared/playerCardHealthMessages";
import { cardWordsWith, sayCardIn, type CardSay } from "@shared/playerCardSpeak";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../../scripts/lib/poFragments.mjs";
import { CARD_HEALTH_MESSAGES } from "./playerCardHealthMessages";
import { PLAYER_CARD_MESSAGES } from "./playerCardMessages";

const EN = setupI18n({ locale: "en", messages: { en: {} } });
const MSG = CARD_HEALTH_MESSAGES as Record<HealthMessageKey, MessageDescriptor>;
const sayWith =
  (i18n: typeof EN): HealthSay =>
  (key, values) =>
    i18n._(values ? { ...MSG[key], values } : MSG[key]);

const SAMPLES: Record<string, unknown[][]> = {
  withinTerm: [["31 Dec 2026"]],
  termEnded: [["31 Dec 2026"]],
  reviewDue: [["16 Nov 2026"]],
  reviewPassed: [["16 Nov 2026"]],
  someOnTrack: [[1, 3]],
  readyOf: [[2, 4]],
  partsWritten: [[3, 5, "Bring me, Not mine to hold"], [5, 5, ""]],
  decisionsN: [[0], [1], [4]],
};

describe("the player card's health words", () => {
  it("the server's copy and the extractor's are the same messages, by id", () => {
    expect(Object.keys(CARD_HEALTH_MESSAGES).sort()).toEqual(Object.keys(HEALTH_MESSAGES).sort());
    for (const [key, d] of Object.entries(HEALTH_MESSAGES)) expect(MSG[key as HealthMessageKey].id, key).toBe(generateMessageId(d.message, d.context));
  });

  it("make every health and handover line in English, word for word", () => {
    const en = healthWordsWith(sayWith(EN));
    for (const [key, english] of Object.entries(HEALTH_WORDS)) {
      const mine = (en.health as Record<string, unknown>)[key];
      if (typeof english === "function") {
        expect(SAMPLES[key], `give "${key}" sample arguments`).toBeTruthy();
        for (const args of SAMPLES[key]) expect((mine as (...a: unknown[]) => unknown)(...args), key).toBe((english as (...a: unknown[]) => unknown)(...args));
      } else if (typeof english === "object") {
        for (const [k, v] of Object.entries(english)) expect((mine as Record<string, unknown>)[k], `${key}.${k}`).toBe(v);
      } else expect(mine, key).toBe(english);
    }
    for (const [key, w] of Object.entries(HANDOVER_CHECK_WORDS)) expect({ ...(en.handover as Record<string, object>)[key] }, key).toEqual(w);
  });

  it("Spanish carries every one of them", async () => {
    const dir = path.resolve(__dirname, "../../locales");
    const es = await formatter({ lineNumbers: false }).parse(mergedPoText(dir, "es"), { locale: "es", sourceLocale: "en", filename: path.join(dir, "es.po") });
    const missing = Object.values(MSG).filter((d) => !es[d.id!]?.translation).map((d) => EN._(d));
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

describe("the card's health lines, said again", () => {
  // Every message is its English with "ES " in front, compiled as the build compiles it.
  const prefixed = (ds: MessageDescriptor[]) => Object.fromEntries(ds.map((d) => [d.id, Array.isArray(d.message) ? ["ES ", ...d.message] : `ES ${d.message}`]));
  const es = setupI18n({ locale: "es", messages: { es: {} } });
  es.load("es", { ...prefixed(Object.values(MSG)), ...prefixed(Object.values(PLAYER_CARD_MESSAGES) as MessageDescriptor[]) } as any);
  const CM = PLAYER_CARD_MESSAGES as Record<string, MessageDescriptor>;
  const cardSay: CardSay = (key, values) => es._(values ? { ...CM[key], values } : CM[key]);

  it("says the dot, the facts and the handover meter in the reader's language", () => {
    const card = sayCardIn(buildPlayerCard(input()), cardWordsWith(cardSay, "es"), "es", healthWordsWith(sayWith(es)));
    const tile = (card.tiles.items as any).value[0];
    expect(tile.health.dotWords.startsWith("ES ")).toBe(true);
    expect(tile.health.facts.every((f: { words: string }) => f.words.startsWith("ES "))).toBe(true);
    const handover = card.roles[0].handover;
    expect(handover.heading).toBe("ES Ready to hand over");
    expect(handover.summary.startsWith("ES ")).toBe(true);
    expect(handover.checks.every((c) => c.label.startsWith("ES ") && c.words.startsWith("ES "))).toBe(true);
  });

  it("without the health words, the card's own lines are said and the health lines stay as built", () => {
    const built = buildPlayerCard(input());
    const card = sayCardIn(built, cardWordsWith(cardSay, "es"), "es");
    expect(card.roles[0].handover.heading).toBe("Ready to hand over");
    expect(card.roles[0].purpose.heading).toBe("ES Purpose");
  });
});
