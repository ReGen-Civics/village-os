/**
 * The player card's words read through the recorder (shared/playerCardSay.ts): the card is the card it
 * was, every sentence it bakes from CARD_WORDS carries its key and arguments in `said`, and the record
 * holds nothing the finished card does not show.
 */
import { describe, expect, it } from "vitest";
import { buildPlayerCard, CARD_WORDS, type PlayerCardInput, type PlayerRoleIn } from "./playerCard";
import { LIST_KEY, pruneCardSaid, recordingWords, sayList, W } from "./playerCardSay";

const TZ = "America/Costa_Rica";

function role(n: number, over: Partial<PlayerRoleIn> = {}): PlayerRoleIn {
  return {
    id: `r${n}`,
    name: `Garden Steward ${n}`,
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
    tensions: [],
    settings: { v: 1, term: { endsOn: "2026-12-31", reviewOn: "2026-11-16", noticeDays: 14 } },
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
  ...over,
});

const withoutSaid = <T extends { said?: unknown }>(card: T) => {
  const { said: _said, ...rest } = card;
  return rest;
};

describe("buildPlayerCard records its words", () => {
  it("builds the same English it built without the recorder", () => {
    const card = buildPlayerCard(input());
    // The plain table, read outside any build: the same sentences, word for word.
    expect(card.header.rolesLine).toBe(CARD_WORDS.rolesLine(2, "Garden Steward 1 and Garden Steward 2"));
    expect(card.across.heading).toBe(CARD_WORDS.acrossMany(2));
    expect(card.roles[0].chips).toContain(CARD_WORDS.heldUntil("31 Dec 2026"));
    // Building twice gives the same card: the recorder leaves nothing behind between builds.
    expect(withoutSaid(buildPlayerCard(input()))).toEqual(withoutSaid(card));
    expect(W).toBe(CARD_WORDS);
    expect(sayList(["a", "b"])).toBe("a and b");
  });

  it("notes each sentence's key and arguments, each day's instant, and each list of names", () => {
    const said = buildPlayerCard(input()).said!;
    expect(said.words[CARD_WORDS.acrossMany(2)]).toEqual({ k: "acrossMany", a: [2] });
    expect(said.words[CARD_WORDS.keyRole]).toEqual({ k: "keyRole" });
    expect(said.words["Garden Steward 1 and Garden Steward 2"]).toEqual({ k: LIST_KEY, a: [["Garden Steward 1", "Garden Steward 2"]] });
    expect(said.words[CARD_WORDS.doneWhen("the beans are in")]).toEqual({ k: "doneWhen", a: ["the beans are in"] });
    expect(said.days["31 Dec 2026"]).toEqual({ iso: "2026-12-31T06:00:00Z", tz: TZ, year: true });
    // A nested table's entry is noted by its dotted path.
    const loaded = buildPlayerCard(input({ loadRead: 3 })).said!;
    expect(loaded.words[CARD_WORDS.loadStep[3]]).toEqual({ k: "loadStep.3" });
    // The circles on the tagline are noted bare, so another language joins them without the English "the".
    const tagline = buildPlayerCard(input()).header.tagline;
    expect(tagline).toContain("in the Land circle");
    expect(said.words["the Land circle"]).toEqual({ k: LIST_KEY, a: [["Land circle"]] });
  });

  it("keeps no record of what the card does not show", () => {
    const card = buildPlayerCard(input());
    const shown = JSON.stringify(withoutSaid(card));
    for (const english of Object.keys(card.said!.words)) expect(shown).toContain(JSON.stringify(english).slice(1, -1));
    // A sentence the build read and the card dropped is pruned away.
    const { out, said } = recordingWords(() => ({ kept: W.today, dropped: W.noTasks && null }));
    expect(Object.keys(said.words)).toContain(CARD_WORDS.noTasks);
    expect(Object.keys(pruneCardSaid(said, out)!.words)).toEqual([CARD_WORDS.today]);
  });

  it("keeps a sentence a kept one was made from", () => {
    const { out, said } = recordingWords(() => {
      const moon = W.moonName("October");
      return { pill: W.moonPill(moon, 3, 29) };
    });
    const kept = pruneCardSaid(said, out)!;
    expect(kept.words["October Moon"]).toEqual({ k: "moonName", a: ["October"] });
    expect(kept.words["October Moon · Day 3 of 29"]).toEqual({ k: "moonPill", a: ["October Moon", 3, 29] });
  });

  it("the words of an application card prune after its open rows are named once", () => {
    const card = buildPlayerCard(input({ mode: "proposal", fillWith: "Operations Steward" }));
    const shown = JSON.stringify(withoutSaid(card));
    for (const english of Object.keys(card.said!.words)) expect(shown).toContain(JSON.stringify(english).slice(1, -1));
  });
});
