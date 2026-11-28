/**
 * Words the launch rehearsal (15 Nov 2026) read wrong, each pinned:
 *   F3   a Gratitude send of 2.5 is refused in words, never floored to 2 in silence
 *   F11  "the village holds this power" for one, and the stewards' pulse line names what crossed
 *   F12  a moon proposal adopted onto an existing account starts today, for this moon
 */
import { describe, expect, it } from "vitest";
import { launchProposalDoc } from "./launchProposal";
import { stewardPowersWords } from "./launchSeating";
import { sendGratitude } from "./gratitude";
import { DECIDE_WORDS } from "../../shared/openProposalDecide";

const doc = (handover: Array<{ title: string; consequence: string }>) =>
  launchProposalDoc({ villageName: "Wealden", quorumPct: 100, unityPct: 100, onTheRoll: 3, weightNote: "", openedBy: "Ari", openedOn: "2026-11-15", slate: [], handover });

describe("launch words from the rehearsal", () => {
  it("F11: one power reads as one, and several as several", () => {
    const one = doc([{ title: "Releasing value on finished work", consequence: "release recognition on someone else's finished work" }]);
    expect(one).toContain("When this carries, the village holds this power, and only a village vote hands it back:");
    expect(one).not.toContain("these 1 powers");
    const two = doc([{ title: "A", consequence: "do a" }, { title: "B", consequence: "do b" }]);
    expect(two).toContain("the village holds these 2 powers");
  });

  it("F11: the stewards' line says what the village took at launch", () => {
    expect(stewardPowersWords(0)).toBe("every power this village has to give");
    expect(stewardPowersWords(1)).toBe("every power this village has to give except the one the village now holds itself");
    expect(stewardPowersWords(3)).toBe("every power this village has to give except the 3 the village now holds itself");
  });

  it("F3: a fraction of Gratitude is refused with the whole amounts to send instead", async () => {
    const out = await sendGratitude({} as any, { fromUser: { id: "u-ari", name: "Ari" }, to: "@fay", amount: 2.5, message: "Half a thanks" } as any);
    expect(out).toMatchObject({ ok: false, status: 400 });
    expect((out as any).error).toMatch(/in whole amounts, such as 2 or 3\.$/);
    const tiny = await sendGratitude({} as any, { fromUser: { id: "u-ari", name: "Ari" }, to: "@fay", amount: 0.5, message: "x" } as any);
    expect((tiny as any).error).toMatch(/such as 1\.$/);
  });

  it("F12: a moon proposal's adoption says the roles start today", () => {
    expect(DECIDE_WORDS.adoptedAccountMoon).toContain("their roles start today, for this moon");
    expect(DECIDE_WORDS.adoptedAccount).toContain("the season's first day");
  });
});
