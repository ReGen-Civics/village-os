/**
 * THE PLAIN COMMITMENT LABEL (the lead, 24 Nov 2026): one short label from the role's own data, on every /roles
 * row and in both views of the founding lineup. Never hours, never pay.
 */
import { describe, expect, it } from "vitest";
import { setupI18n } from "@lingui/core";
import { commitmentLabel, commitmentLine } from "./rewardWords";

const i18n = setupI18n({ locale: "en", messages: { en: {} } });

describe("commitmentLabel", () => {
  it("says full time, part time or both, with contract for a contractor role", () => {
    expect(commitmentLabel(i18n, { card: { commitmentPct: 100 } })).toBe("Full time");
    expect(commitmentLabel(i18n, { card: { commitmentPct: 50, track: "contractor" } })).toBe("Part time or fractional, contract");
    expect(commitmentLabel(i18n, { card: { commitmentMin: 30, track: "contractor" } })).toBe("Full or part time, contract");
    expect(commitmentLabel(i18n, { timeCommitment: "Part time, by matter." })).toBe("Part time or fractional");
    expect(commitmentLabel(i18n, { card: { track: "contractor" } })).toBe("Contract");
  });

  it("is empty when the role's data says nothing, and never carries a number", () => {
    expect(commitmentLabel(i18n, { timeCommitment: "Commission-based, at the commitment you choose" })).toBe("");
    expect(commitmentLabel(i18n, {})).toBe("");
    for (const seat of [{ card: { commitmentPct: 40 } }, { card: { commitmentMin: 30 } }, { card: { commitmentPct: 100, track: "contractor" } }]) {
      expect(commitmentLabel(i18n, seat)).not.toMatch(/\d/);
    }
  });
});

describe("commitmentLine (the card's Commitment fact)", () => {
  it("says the shared range and a whole share in plain words, keeping the role's own words otherwise", () => {
    expect(commitmentLine(i18n, { card: { commitmentMin: 30 } })).toBe("Full or part time, from 30%");
    expect(commitmentLine(i18n, { card: { commitmentPct: 100 } })).toBe("Full time");
    expect(commitmentLine(i18n, { card: { commitmentPct: 60 } })).toBe("Part time, 60%");
    expect(commitmentLine(i18n, { timeCommitment: "Part time, agreed with the Anchor Circle" })).toBe("Part time, agreed with the Anchor Circle");
  });
});
