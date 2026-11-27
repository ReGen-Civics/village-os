/**
 * THE COMMUNITY FACE'S ALLOWLIST (lane 6): every item a member is sent carries exactly `COMMUNITY_ITEM_FIELDS`, and no
 * applicant, amount, held reason or other person's words ever reaches it, whatever the source rows carry.
 */
import { describe, expect, it } from "vitest";
import { COMMUNITY_ITEM_FIELDS, communityChanges, communityHands, communityVotes, communityWaiting, type CommunityItem } from "./communityReview";

/** What a source row might carry that a member must never be sent. Every value is distinctive, so a leak is findable. */
const SECRET = {
  applicant: "Ana Applicant",
  applicantEmail: "ana@example.test",
  userName: "Ben Raiser",
  author: "Cy Author",
  note: "Ben's private note about why",
  text: "The words somebody wrote in their tension",
  why: "The filer's own reasons",
  evidence: "A quoted line from a meeting",
  heldCode: "recently_discarded",
  heldReason: "held because of a reason",
  amount: 4321,
  amountMinor: 987654,
  invoice: { total: 5555 },
  myVote: null,
  tally: { yes: 7, no: 3 },
  email: "someone@example.test",
};
const SECRET_VALUES = ["Ana Applicant", "ana@example.test", "Ben Raiser", "Cy Author", "private note", "words somebody wrote", "own reasons", "quoted line", "recently_discarded", "held because", "4321", "987654", "5555", "someone@example.test"];

function expectClean(items: CommunityItem[]) {
  for (const it of items) expect(Object.keys(it).sort(), JSON.stringify(it)).toEqual([...COMMUNITY_ITEM_FIELDS].sort());
  const text = JSON.stringify(items);
  for (const v of SECRET_VALUES) expect(text, v).not.toContain(v);
  for (const it of items) expect(it.href).toMatch(/^\/(?!\/)/);
}

describe("the community face's projection: an allowlist, never the deciders' payload filtered", () => {
  it("a vote is its title, its stage and when it closes, and a vote on a role application is left out whole", () => {
    const items = communityVotes([
      { ...SECRET, id: "b1", subjectType: "power_return", title: "Give the dial power back to the village", status: "running", myWeight: 1, closesAt: "2026-11-30T12:00:00.000Z" },
      { ...SECRET, id: "b2", subjectType: "role_application", title: "Seat Ana Applicant as Water Steward", status: "running", myWeight: 1 },
      { ...SECRET, id: "b3", subjectType: "mechanics", title: "Already voted", status: "running", myWeight: 1, myVote: "yes" },
      { ...SECRET, id: "b4", subjectType: "mechanics", title: "Not mine", status: "running", myWeight: null },
    ]);
    expect(items).toEqual([{ id: "b1", kind: "vote", title: "Give the dial power back to the village", state: "running", closesAt: "2026-11-30T12:00:00.000Z", href: "/decisions/b1" }]);
    expectClean(items);
  });

  it("change requests: others' in review or a vote, and the member's own, by title and stage, never by author", () => {
    const { open, yours } = communityChanges({
      open: [{ ...SECRET, id: "c1", title: "Shorter quiet hours", state: "voting", author: "Cy Author", changes: 3 }],
      mine: [{ ...SECRET, id: "c2", title: "My own request", state: "in_review", yours: true }],
    });
    expect(open.map((c) => [c.id, c.title, c.state, c.href])).toEqual([["c1", "Shorter quiet hours", "voting", "/governance/decisions/changes/c1"]]);
    expect(yours.map((c) => [c.id, c.title, c.state])).toEqual([["c2", "My own request", "in_review"]]);
    expectClean([...open, ...yours]);
  });

  it("a raised hand is the power it asks for: never who raised it or what they wrote; the member's own is theirs", () => {
    const { open, yours } = communityHands(
      {
        hands: [
          { ...SECRET, id: "h1", powerLabel: "Turn the village's dials", userId: "u-ben", userName: "Ben Raiser", note: "Ben's private note about why", status: "open", youMayPut: true },
          { ...SECRET, id: "h2", powerLabel: "Not mine to put", userId: "u-ben", status: "open", youMayPut: false },
          { ...SECRET, id: "h3", powerLabel: "Hold the keys", userId: "u-me", status: "open", youMayPut: true },
        ],
      },
      "u-me",
    );
    expect(open.map((h) => [h.id, h.title])).toEqual([["h1", "Turn the village's dials"]]);
    expect(yours.map((h) => [h.id, h.title, h.state])).toEqual([["h3", "Hold the keys", "open"]]);
    expectClean([...open, ...yours]);
  });

  it("what waits on your role is named by the role, never by the words somebody wrote", () => {
    const items = communityWaiting({
      raisedWithYou: [{ ...SECRET, id: "t1", role: "Builder", circle: "Garden", text: "The words somebody wrote in their tension", status: "open", overdue: true }],
      toAccept: [{ ...SECRET, entryId: 7, role: "Builder", text: "The words somebody wrote in their tension", doneOn: "2026-11-21" }],
      applications: [{ ...SECRET, id: "ap1", applicant: "Ana Applicant", href: "/role-applications/ap1" }],
      toConsent: [{ ...SECRET, proposalId: "rp1", applicant: "Ana Applicant" }],
    });
    expect(items.map((i) => [i.kind, i.id, i.title])).toEqual([["tension", "t1", "Builder"], ["task", "7", "Builder"]]);
    expectClean(items);
  });

  it("drops a stage it does not know as a word, an id it cannot trust, and a body of the wrong shape", () => {
    expect(communityChanges({ open: [{ id: "c1", title: "T", state: "<b>voting</b>" }] }).open[0]!.state).toBeNull();
    expect(communityVotes([{ id: "../../x", status: "running", myWeight: 1 }])).toEqual([]);
    for (const bad of [null, 0, "x", [], {}, { hands: "no" }]) {
      expect(communityVotes(bad)).toEqual([]);
      expect(communityWaiting(bad)).toEqual([]);
      expect(communityHands(bad, "me")).toEqual({ open: [], yours: [] });
      expect(communityChanges(bad)).toEqual({ open: [], yours: [] });
    }
  });
});
