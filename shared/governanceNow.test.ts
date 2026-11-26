/**
 * The Governance page's Now (build step 2): an allowlist end to end. The voice carries exactly its fields, each right
 * exactly its fields, and nothing a catalogue row or a weight snapshot carries beyond them reaches a member.
 */
import { describe, expect, it } from "vitest";
import { CLOSING_SOON_MS, governanceNow, NOW_RIGHT_FIELDS, NOW_VOICE_FIELDS, nowVoice } from "./governanceNow";
import { COMMUNITY_ITEM_FIELDS, type CommunityAnswer } from "./communityReview";

const item = (id: string, closesAt: string | null, kind: "vote" | "change" | "tension" = "vote") => ({ id, kind, title: `T ${id}`, state: null, closesAt, href: `/x/${id}` });
const NOW = new Date("2026-11-26T12:00:00.000Z");
const at = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();
const COMMUNITY: CommunityAnswer = {
  open: [item("late", at(100)), item("soon", at(10)), item("none", null, "change")],
  waiting: [item("t1", null, "tension")],
  yours: [item("mine", null, "change")],
  reads: [{ name: "ballots", state: "ok" }],
};
const CATALOGUE = [
  { key: "ballot.vote", label: "Cast a vote", held: true, opens: { via: "stage", stage: "member" }, secret: "x", affinity: { roleIds: ["r1"] } },
  { key: "mechanics.propose", held: true, opens: { via: "stage", stage: "member" } },
  { key: "proposal.open", held: false, opens: { via: "stage", stage: "co-creator" }, holders: ["Ana"] },
  { key: "cash.pay", held: true, opens: { via: "appointment" } },
];

describe("the Governance page's Now: its own allowlisted projection", () => {
  it("names each right from the person's catalogue, with the rung that opens one not yet held, and nothing else", () => {
    const v = nowVoice({ mode: "equal", token: null }, CATALOGUE);
    expect(Object.keys(v).sort()).toEqual([...NOW_VOICE_FIELDS].sort());
    for (const r of v.rights) expect(Object.keys(r).sort()).toEqual([...NOW_RIGHT_FIELDS].sort());
    expect(v).toEqual({
      mode: "equal",
      weighedBy: null,
      rights: [
        { right: "ballot.vote", held: true, opensAt: null },
        { right: "mechanics.propose", held: true, opensAt: null },
        { right: "proposal.open", held: false, opensAt: "co-creator" },
      ],
    });
    expect(JSON.stringify(v)).not.toMatch(/secret|affinity|holders|Ana|cash\.pay|Cast a vote/);
  });

  it("names the weighing token only when the village weighs by one, and never a token name it cannot trust", () => {
    expect(nowVoice({ mode: "token", token: "gratitude" }, []).weighedBy).toBe("gratitude");
    expect(nowVoice({ mode: "custom", token: "gratitude" }, []).weighedBy).toBeNull();
    expect(nowVoice({ mode: "token", token: "<b>x</b>" }, []).weighedBy).toBeNull();
    expect(nowVoice({ mode: "something", token: null }, []).mode).toBe("equal");
  });

  it("a right missing from the catalogue (its module off) reads as not held, with no rung promised", () => {
    expect(nowVoice({ mode: "equal", token: null }, [{ key: "ballot.vote", held: true }]).rights[2]).toEqual({ right: "proposal.open", held: false, opensAt: null });
    expect(nowVoice({ mode: "equal", token: null }, "nonsense").rights.every((r) => !r.held)).toBe(true);
    expect(nowVoice({ mode: "equal", token: null }, [{ key: "proposal.open", held: false, opens: { via: "stage", stage: "<script>" } }]).rights[2]!.opensAt).toBeNull();
  });

  it("orders what waits soonest to close first, picks out what closes within 48 hours, and keeps every item to the allowlist", () => {
    const n = governanceNow(COMMUNITY, nowVoice({ mode: "equal", token: null }, CATALOGUE), NOW);
    expect(n.waiting.map((i) => i.id)).toEqual(["soon", "late", "none", "t1"]);
    expect(n.closingSoon.map((i) => i.id)).toEqual(["soon"]);
    expect(n.yours.map((i) => i.id)).toEqual(["mine"]);
    for (const it of [...n.waiting, ...n.yours]) expect(Object.keys(it).sort()).toEqual([...COMMUNITY_ITEM_FIELDS].sort());
    expect(Object.keys(n).sort()).toEqual(["closingSoon", "reads", "voice", "waiting", "yours"]);
    expect(CLOSING_SOON_MS).toBe(48 * 3_600_000);
  });

  it("something that already closed is not closing soon", () => {
    const c = { ...COMMUNITY, open: [item("gone", at(-1))], waiting: [] };
    expect(governanceNow(c, nowVoice({ mode: "equal", token: null }, []), NOW).closingSoon).toEqual([]);
  });
});
