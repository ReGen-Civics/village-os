import { describe, expect, it } from "vitest";
import { billedOfLine, cashOfLine, earnedBesideLine, partOfLabel, partsOfShape, PAYER_IS_BILLED, rewardShareLine, shareLine } from "./rewardShare";

const TOKENS = { equity: "earned-equity", credits: "credits" };
const OPTS = { equityMeaningWritten: true, tokens: TOKENS };
const shape = (...s: Array<[string, number]>) => s.map(([label, pct]) => ({ label, pct }));

describe("a role's price is its total reward, shared out (Rye, 15 Nov 2026, P1-6)", () => {
  it("6,500 at a 60/40 split is 3,900 cash and 2,600 Earned Equity", () => {
    const r = shareLine(650_000, { card: shape(["Cash", 60], ["Equity", 40]), village: [] }, OPTS);
    expect(r).toMatchObject({ from: "card", totalMinor: 650_000, cashMinor: 390_000, equityUnits: 2600, creditsUnits: 0, equityHeld: false });
    expect(cashOfLine({ amountMinor: 650_000, reward: r })).toBe(390_000);
  });
  it("a 100%-cash village owes the whole line in cash, and so does a role with no split anywhere", () => {
    expect(shareLine(650_000, { card: [], village: shape(["Cash", 100]) }, OPTS)).toMatchObject({ from: "village", cashMinor: 650_000, equityUnits: 0, creditsUnits: 0 });
    expect(shareLine(650_000, { card: [], village: [] }, OPTS)).toMatchObject({ from: "none", cashMinor: 650_000, equityUnits: 0, creditsUnits: 0 });
  });
  it("the contract's split wins over the card's, and the card's over the village's (call 1)", () => {
    expect(shareLine(100_000, { contract: shape(["Cash", 70], ["Credits", 30]), card: shape(["Cash", 100]), village: shape(["Cash", 100]) }, OPTS)).toMatchObject({ from: "contract", cashMinor: 70_000, creditsUnits: 300 });
    // A contract split that does not read falls to the card's.
    expect(shareLine(100_000, { contract: shape(["Bonus", 100]), card: shape(["Cash", 50], ["Equity", 50]), village: [] }, OPTS)).toMatchObject({ from: "card", equityUnits: 500 });
  });
  it("no split anywhere says so first: never the model's 0%-cash default", () => {
    const r = shareLine(650_000, { card: [], village: [] }, OPTS)!;
    expect(rewardShareLine(r, "USD")).toBe("No split set: paid all in cash. Total reward US$6,500.");
  });
  it("the payer is billed the cash share, with what the village issues beside it (call 2)", () => {
    expect(PAYER_IS_BILLED).toBe("cash");
    const r = shareLine(650_000, { card: shape(["Cash", 60], ["Equity", 40]), village: [] }, OPTS);
    expect(billedOfLine({ amountMinor: 650_000, reward: r })).toBe(390_000);
    expect(earnedBesideLine(r, "USD")).toBe("Also earned, nothing to pay: 2,600 Earned Equity, 0 Credits. Total reward US$6,500.");
    // All in cash: nothing beside it.
    expect(earnedBesideLine(shareLine(650_000, { card: [], village: [] }, OPTS), "USD")).toBeNull();
  });
  it("the card's split wins over the village's", () => {
    expect(shareLine(100_000, { card: shape(["Cash", 40], ["Equity", 55], ["Credits", 5]), village: shape(["Cash", 100]) }, OPTS)).toMatchObject({ from: "card", cashMinor: 40_000, equityUnits: 550, creditsUnits: 50 });
  });
  it("a split adding to less than 100 gives the rest as Credits, and says so", () => {
    const r = shareLine(100_000, { card: shape(["Cash", 40], ["Equity", 55]), village: [] }, OPTS)!;
    expect(r).toMatchObject({ cashMinor: 40_000, equityUnits: 550, creditsUnits: 50, restToCreditsPct: 5 });
    expect(rewardShareLine(r, "USD")).toContain("the other 5% is Credits");
  });
  it("rounding goes to cash, so the parts always add up to the line", () => {
    const r = shareLine(123_457, { card: shape(["Cash", 33], ["Equity", 33], ["Credits", 34]), village: [] }, OPTS)!;
    expect(r.cashMinor + (r.equityUnits + r.creditsUnits) * 100).toBe(123_457);
    expect(Number.isInteger(r.equityUnits) && Number.isInteger(r.creditsUnits)).toBe(true);
  });
  it("a split that does not read is passed over, never guessed at", () => {
    expect(partOfLabel("Earned Equity")).toBe("equity");
    expect(partOfLabel("Village Credits")).toBe("credits");
    expect(partOfLabel("Bonus")).toBeNull();
    expect(partsOfShape(shape(["Cash", 50], ["Bonus", 50]))).toBeNull();
    expect(partsOfShape(shape(["Cash", 50], ["cash", 50]))).toBeNull();
    expect(partsOfShape(shape(["Cash", 80], ["Equity", 40]))).toBeNull();
    // An unreadable card falls to the village's split.
    expect(shareLine(100_000, { card: shape(["Bonus", 100]), village: shape(["Cash", 50], ["Equity", 50]) }, OPTS)).toMatchObject({ from: "village", cashMinor: 50_000, equityUnits: 500 });
  });
  it("Earned Equity is held, never turned into cash, while the village has not written what it means", () => {
    const r = shareLine(650_000, { card: shape(["Cash", 60], ["Equity", 40]), village: [] }, { ...OPTS, equityMeaningWritten: false })!;
    expect(r).toMatchObject({ cashMinor: 390_000, equityUnits: 2600, equityHeld: true });
    expect(rewardShareLine(r, "USD")).toContain("Earned Equity is owed until the village writes what it means");
  });
  it("names every part beside the total, a 0% one too", () => {
    const r = shareLine(650_000, { card: shape(["Cash", 60], ["Equity", 40]), village: [] }, OPTS)!;
    expect(rewardShareLine(r, "USD")).toBe("Total reward US$6,500: US$3,900 cash (60%), 2,600 Earned Equity (40%), 0 Credits (0%), by the role card's split.");
  });
  it("a line from before the split, or whose amount moved since, owes its amount as it stands", () => {
    expect(cashOfLine({ amountMinor: 650_000 })).toBe(650_000);
    const r = shareLine(650_000, { card: shape(["Cash", 60], ["Equity", 40]), village: [] }, OPTS);
    expect(cashOfLine({ amountMinor: 500_000, reward: r })).toBe(500_000);
    expect(shareLine(null, { card: [], village: [] }, OPTS)).toBeNull();
    expect(shareLine(0, { card: [], village: [] }, OPTS)).toBeNull();
  });
});

describe("a share labelled with the village's own token name (the lead, 19 Nov 2026)", () => {
  const NAMES = { equity: ["Earned Equity", "Harbour Tokens", "Harbour"], credits: ["Village Credits"] };
  it("pays the same as the old labels: a relabelled shape never falls through to all cash", () => {
    const old = shareLine(650_000, { card: shape(["Cash", 60], ["Equity", 35], ["Credits", 5]), village: [] }, { ...OPTS, names: NAMES });
    const renamed = shareLine(650_000, { card: shape(["Cash", 60], ["Harbour", 35], ["Village Credits", 5]), village: [] }, { ...OPTS, names: NAMES });
    const full = shareLine(650_000, { card: shape(["Cash", 60], ["Harbour Tokens", 35], ["Credits", 5]), village: [] }, { ...OPTS, names: NAMES });
    const plain = shareLine(650_000, { card: shape(["Cash", 60], ["Contribution tokens", 35], ["Usage", 5]), village: [] }, OPTS);
    for (const r of [old, renamed, full, plain]) expect(r).toMatchObject({ from: "card", cashMinor: 390_000, equityUnits: 2275, creditsUnits: 325 });
    // CONTROL: without the names a label that is only the village's word is read as nothing, and the line is all cash.
    expect(shareLine(650_000, { card: shape(["Cash", 60], ["Harbour", 40]), village: [] }, OPTS)).toMatchObject({ from: "none", cashMinor: 650_000 });
  });
  it("reads a name exactly, never by substring, and keeps reading the old word for stored contracts", () => {
    expect(partOfLabel("Harbour", NAMES)).toBe("equity");
    expect(partOfLabel("Earned equity", NAMES)).toBe("equity");
    expect(partOfLabel("Harbour cash", NAMES)).toBe("cash");
    expect(partsOfShape(shape(["Harbour", 50], ["Equity", 50]), NAMES)).toBeNull();
  });
  it("says a member's names when given them, and the registry's seeded names otherwise (admin pages, the payer's PDF)", () => {
    const r = shareLine(650_000, { card: shape(["Cash", 60], ["Harbour", 40]), village: [] }, { ...OPTS, names: NAMES })!;
    const member = { equity: "Harbour Tokens", credits: "Village Credits" };
    expect(rewardShareLine(r, "USD", member)).toBe("Total reward US$6,500: US$3,900 cash (60%), 2,600 Harbour Tokens (40%), 0 Village Credits (0%), by the role card's split.");
    expect(rewardShareLine(r, "USD", member)).not.toMatch(/equity/i);
    expect(earnedBesideLine(r, "USD", member)).toBe("Also earned, nothing to pay: 2,600 Harbour Tokens, 0 Village Credits. Total reward US$6,500.");
    expect(rewardShareLine(r, "USD")).toContain("2,600 Earned Equity (40%)");
    const held = shareLine(650_000, { card: shape(["Cash", 60], ["Harbour", 40]), village: [] }, { ...OPTS, equityMeaningWritten: false, names: NAMES })!;
    expect(rewardShareLine(held, "USD", member)).toContain("The Harbour Tokens share is owed until the village writes what it means.");
  });
});
