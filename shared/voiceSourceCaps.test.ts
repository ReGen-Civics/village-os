import { describe, expect, it } from "vitest";
import {
  HAND_MINT_CASH_SOURCE,
  HAND_MINT_OTHER_SOURCE,
  capsInMinor,
  contributionKindOfSource,
  countedWeight,
  handMintSource,
  parseContributionKind,
  splitHeld,
} from "./voiceSourceCaps";
import { voiceSourceKind } from "./voiceFromMoney";

// Voice at 2 decimals: 1 whole Voice is 100 minor units.
const V = (whole: number) => whole * 100;
const caps = capsInMinor({ cash: 22_000, other: 22_000 }, 2);

function counted(cashMinted: number, otherMinted: number, held: number): number {
  const split = splitHeld(V(held), { admin_mint_cash: V(cashMinted), quest_consent: V(otherMinted) });
  return countedWeight(split, caps).counted;
}

describe("the worked table (spec section 3, caps 22,000 and 22,000)", () => {
  it("A: other only, at the cap, counts in full", () => {
    expect(counted(0, 22_000, 22_000)).toBe(V(22_000));
  });
  it("B: cash only, under the cap, counts in full", () => {
    expect(counted(7_777, 0, 7_777)).toBe(V(7_777));
  });
  it("C: cash over its cap, other under, counts 22,000 + 10,000", () => {
    expect(counted(30_000, 10_000, 40_000)).toBe(V(32_000));
  });
  it("D: both over after decay, counts the 44,000 most anybody can", () => {
    expect(counted(50_000, 50_000, 99_000)).toBe(V(44_000));
  });
});

describe("splitHeld", () => {
  it("splits the balance by each source's share of what was minted, so decay takes from both alike", () => {
    const s = splitHeld(V(99_000), { admin_mint_cash: V(50_000), role_cycle: V(50_000) });
    expect(s).toEqual({ held: V(99_000), cash: V(49_500), other: V(49_500) });
  });

  it("holds everything as other when nothing was ever minted, so a balance with no traceable source stays capped", () => {
    expect(splitHeld(V(500), {})).toEqual({ held: V(500), cash: 0, other: V(500) });
  });

  it("counts a source netted to zero or below as nothing", () => {
    const s = splitHeld(V(100), { admin_mint_cash: -V(10), quest_consent: V(100) });
    expect(s.cash).toBe(0);
    expect(s.other).toBe(V(100));
  });

  it("floors the cash part and gives the remainder to other, so the two always sum to the balance", () => {
    const s = splitHeld(101, { donation_voice: 1, quest_consent: 2 });
    expect(s.cash).toBe(33);
    expect(s.other).toBe(68);
    expect(s.cash + s.other).toBe(101);
  });

  it("never reads a negative balance as weight", () => {
    expect(splitHeld(-5, { quest_consent: 10 })).toEqual({ held: 0, cash: 0, other: 0 });
  });
});

describe("countedWeight", () => {
  it("leaves a source with no cap uncapped", () => {
    const s = splitHeld(V(90_000), { admin_mint_cash: V(60_000), quest_consent: V(30_000) });
    const out = countedWeight(s, { cash: V(22_000), other: null });
    expect(out).toEqual({ counted: V(52_000), cash: V(22_000), other: V(30_000) });
  });

  it("with no caps at all counts the whole balance", () => {
    const s = splitHeld(V(90_000), { admin_mint_cash: V(60_000), quest_consent: V(30_000) });
    expect(countedWeight(s, { cash: null, other: null }).counted).toBe(V(90_000));
  });

  it("fails closed: a cap of 0 counts nothing from that source", () => {
    const s = splitHeld(V(100), { admin_mint_cash: V(40), quest_consent: V(60) });
    expect(countedWeight(s, { cash: 0, other: null }).counted).toBe(V(60));
  });

  it("treats a negative or non-finite cap as 0, never as unlimited", () => {
    const s = splitHeld(V(100), { quest_consent: V(100) });
    expect(countedWeight(s, { cash: null, other: -1 }).counted).toBe(0);
    expect(countedWeight(s, { cash: null, other: Number.NaN }).counted).toBe(0);
  });
});

describe("capsInMinor", () => {
  it("scales whole-token caps to the token's minor units and keeps an off cap off", () => {
    expect(capsInMinor({ cash: 22_000, other: null }, 2)).toEqual({ cash: 2_200_000, other: null });
    expect(capsInMinor({ cash: 7, other: 3 }, 0)).toEqual({ cash: 7, other: 3 });
  });
});

describe("which sources are cash", () => {
  it("is exactly the money list, which now holds the cash hand-mint", () => {
    expect(voiceSourceKind(HAND_MINT_CASH_SOURCE)).toBe("money");
    for (const s of ["donation_voice", "investment_voice", "dues_dividend", HAND_MINT_CASH_SOURCE]) {
      expect(contributionKindOfSource(s)).toBe("cash");
    }
  });

  it("puts every other source in other, an unknown one included", () => {
    for (const s of ["quest_consent", "role_cycle", "proposal_accepted", HAND_MINT_OTHER_SOURCE, "something_new"]) {
      expect(contributionKindOfSource(s)).toBe("other");
    }
  });
});

describe("the hand-mint tag", () => {
  it("reads absent as other, which is what every hand-mint meant before the tag", () => {
    expect(parseContributionKind(undefined)).toBe("other");
    expect(parseContributionKind(null)).toBe("other");
    expect(parseContributionKind("")).toBe("other");
  });

  it("reads cash and other, and refuses anything else", () => {
    expect(parseContributionKind("cash")).toBe("cash");
    expect(parseContributionKind(" Other ")).toBe("other");
    expect(parseContributionKind("money")).toBeNull();
    expect(parseContributionKind(5)).toBeNull();
  });

  it("names the ledger source each tag posts", () => {
    expect(handMintSource("cash")).toBe(HAND_MINT_CASH_SOURCE);
    expect(handMintSource("other")).toBe(HAND_MINT_OTHER_SOURCE);
  });
});
