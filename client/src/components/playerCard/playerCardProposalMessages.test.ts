/**
 * A role's open proposals on the player card, in the reader's language. The server says "Proposed on ..." from the
 * plain copy in shared/playerCardProposalMessages.ts and sends the lines the components draw beside the card; the
 * extractor reads the same messages here. These tests hold the two copies to one id each, the words they make to
 * the English ROLE_PROPOSAL_WORDS word for word, every message to having Spanish, and the proposal said again.
 */
import path from "node:path";
import { setupI18n, type MessageDescriptor } from "@lingui/core";
import { formatter } from "@lingui/format-po";
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { describe, expect, it } from "vitest";
import { buildPlayerCard, type PlayerCardInput, type PlayerRoleIn } from "@shared/playerCard";
import { ROLE_PROPOSAL_WORDS } from "@shared/playerCardProposals";
import { PROPOSAL_MESSAGES, fixedProposalWords, proposalWordsWith, type ProposalMessageKey, type ProposalSay } from "@shared/playerCardProposalMessages";
import { cardWordsWith, sayCardIn, type CardSay } from "@shared/playerCardSpeak";
// @ts-expect-error - scripts/ is untyped JavaScript, deliberately outside tsconfig
import { mergedPoText } from "../../../../scripts/lib/poFragments.mjs";
import { CARD_PROPOSAL_MESSAGES } from "./playerCardProposalMessages";
import { PLAYER_CARD_MESSAGES } from "./playerCardMessages";

const EN = setupI18n({ locale: "en", messages: { en: {} } });
const MSG = CARD_PROPOSAL_MESSAGES as Record<ProposalMessageKey, MessageDescriptor>;
const sayWith =
  (i18n: typeof EN): ProposalSay =>
  (key, values) =>
    i18n._(values ? { ...MSG[key], values } : MSG[key]);

describe("the player card's role proposal words", () => {
  it("the server's copy and the extractor's are the same messages, by id", () => {
    expect(Object.keys(CARD_PROPOSAL_MESSAGES).sort()).toEqual(Object.keys(PROPOSAL_MESSAGES).sort());
    for (const [key, d] of Object.entries(PROPOSAL_MESSAGES)) expect(MSG[key as ProposalMessageKey].id, key).toBe(generateMessageId(d.message, d.context));
  });

  it("make every line of ROLE_PROPOSAL_WORDS in English, word for word", () => {
    const en = proposalWordsWith(sayWith(EN)) as Record<string, unknown>;
    expect(Object.keys(en).sort()).toEqual(Object.keys(ROLE_PROPOSAL_WORDS).sort());
    for (const [key, english] of Object.entries(ROLE_PROPOSAL_WORDS)) {
      if (typeof english === "function") expect((en[key] as (d: string) => string)("30 Nov 2026"), key).toBe(english("30 Nov 2026"));
      else expect(en[key], key).toBe(english);
    }
  });

  it("sends the components their lines, with the voting line as a template", () => {
    const sent = fixedProposalWords(sayWith(EN));
    expect(sent.heading).toBe(ROLE_PROPOSAL_WORDS.heading);
    expect(sent.votingTemplate).toBe("The village is voting on this until {day}.");
    expect(sent.votingTemplate!.replace("{day}", "30 Nov 2026")).toBe(ROLE_PROPOSAL_WORDS.voting("30 Nov 2026"));
    expect("proposedOn" in sent).toBe(false);
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

describe("a role's proposal, said again", () => {
  const prefixed = (ds: MessageDescriptor[]) => Object.fromEntries(ds.map((d) => [d.id, Array.isArray(d.message) ? ["ES ", ...d.message] : `ES ${d.message}`]));
  const es = setupI18n({ locale: "es", messages: { es: {} } });
  es.load("es", { ...prefixed(Object.values(MSG)), ...prefixed(Object.values(PLAYER_CARD_MESSAGES) as MessageDescriptor[]) } as any);
  const CM = PLAYER_CARD_MESSAGES as Record<string, MessageDescriptor>;
  const cardSay: CardSay = (key, values) => es._(values ? { ...CM[key], values } : CM[key]);
  const proposed = () => input({ roles: [role(1, { proposals: [{ draftId: "d-1", proposedAt: "2026-10-20T15:00:00Z", payload: { aim: "Grow beans." } }] })] });

  it("says Proposed on in the reader's language, the day in it too, and keeps the proposed words", () => {
    const card = sayCardIn(buildPlayerCard(proposed()), cardWordsWith(cardSay, "es"), "es", { proposal: proposalWordsWith(sayWith(es)) });
    const p = card.roles[0].proposals[0];
    expect(p.proposedOn.startsWith("ES Proposed on ")).toBe(true);
    expect(p.proposedOn).toContain("octubre");
    expect(p.fields[0].lines).toEqual(["Grow beans."]);
  });

  it("without the proposal words, Proposed on stays as built", () => {
    const built = buildPlayerCard(proposed());
    const card = sayCardIn(built, cardWordsWith(cardSay, "es"), "es");
    expect(card.roles[0].proposals[0].proposedOn).toBe(built.roles[0].proposals[0].proposedOn);
  });
});
