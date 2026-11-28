/**
 * The label over the launch facts, and what a screen may offer from them.
 *
 * Every row below is a village state that exists or can exist, named for the
 * village it describes, so a change to the order of the tests in `launchLabel`
 * shows up as a named village reading wrong.
 */
import { describe, expect, it } from "vitest";
import { LAUNCH_LABELS, launchDoors, launchLabel, launchRecord, type LaunchFacts, type LaunchLabel } from "./launchFacts";

/** A village that was claimed a moment ago and has done nothing else. */
const CLAIMED: LaunchFacts = {
  claimed: true,
  issuing: false,
  issuingSince: null,
  voteCarried: false,
  launchedByBallotId: null,
  checklistFrozen: false,
  launchedAt: null,
  voteOpen: false,
  openBallotId: null,
  lastVote: null,
  founderPowerStands: true,
};

const facts = (over: Partial<LaunchFacts>): LaunchFacts => ({ ...CLAIMED, ...over });

const VILLAGES: Array<{ name: string; facts: LaunchFacts; label: LaunchLabel }> = [
  { name: "nobody has claimed it", facts: facts({ claimed: false }), label: "unclaimed" },
  { name: "claimed and being built", facts: CLAIMED, label: "setup" },
  {
    name: "its first launch vote is open",
    facts: facts({ voteOpen: true, openBallotId: "bal-1" }),
    label: "vote-open",
  },
  {
    name: "its launch vote closed short of everyone answering",
    facts: facts({ lastVote: { id: "bal-1", status: "no_quorum", closedAt: "2026-11-20T00:00:00.000Z" } }),
    label: "vote-did-not-carry",
  },
  {
    name: "its launch vote was called off",
    facts: facts({ lastVote: { id: "bal-1", status: "withdrawn", closedAt: "2026-11-20T00:00:00.000Z" } }),
    label: "vote-did-not-carry",
  },
  {
    name: "a second vote is open after the first did not carry",
    facts: facts({
      voteOpen: true,
      openBallotId: "bal-2",
      lastVote: { id: "bal-1", status: "failed", closedAt: "2026-11-20T00:00:00.000Z" },
    }),
    label: "vote-open",
  },
  {
    // Migration 0112: issuing before the vote existed, no launch state written.
    name: "issuing since before the vote existed, and never voted",
    facts: facts({ issuing: true, issuingSince: "2026-03-01T00:00:00.000Z", founderPowerStands: false }),
    label: "issuing-vote-not-held",
  },
  {
    name: "issuing, with its ratifying vote open",
    facts: facts({ issuing: true, founderPowerStands: false, voteOpen: true, openBallotId: "bal-9" }),
    label: "vote-open",
  },
  {
    name: "issuing, and its ratifying vote did not carry",
    facts: facts({
      issuing: true,
      founderPowerStands: false,
      lastVote: { id: "bal-9", status: "failed", closedAt: "2026-12-28T00:00:00.000Z" },
    }),
    label: "vote-did-not-carry",
  },
  {
    name: "launched by its own vote",
    facts: facts({
      issuing: true,
      issuingSince: "2026-12-30T00:00:00.000Z",
      founderPowerStands: false,
      voteCarried: true,
      launchedByBallotId: "bal-3",
      checklistFrozen: true,
      launchedAt: "2026-12-30T00:00:00.000Z",
      lastVote: { id: "bal-3", status: "passed", closedAt: "2026-12-30T00:00:00.000Z" },
    }),
    label: "running",
  },
  {
    // The old one-press act: a frozen checklist with no ballot behind it.
    name: "marked launched before the vote existed, and issuing",
    facts: facts({ issuing: true, founderPowerStands: false, checklistFrozen: true, launchedAt: "2026-02-01T00:00:00.000Z" }),
    label: "issuing-vote-not-held",
  },
];

describe("launchLabel: one plain name for where the village stands", () => {
  for (const v of VILLAGES) {
    it(`a village where ${v.name} reads "${v.label}"`, () => {
      expect(launchLabel(v.facts)).toBe(v.label);
    });
  }

  it("uses every name in the set, and no name outside it", () => {
    const used = new Set(VILLAGES.map((v) => launchLabel(v.facts)));
    expect([...used].sort()).toEqual([...LAUNCH_LABELS].sort());
  });

  it("is about the village's own vote: a carried vote reads running whatever else is recorded", () => {
    expect(launchLabel(facts({ voteCarried: true, launchedByBallotId: "b", voteOpen: true, issuing: false }))).toBe("running");
  });
});

describe("launchDoors: what a screen may offer", () => {
  it("offers the vote and the row answers to a village still being built", () => {
    expect(launchDoors(CLAIMED)).toEqual({ rowsOpen: true, voteCanBeAsked: true });
  });

  it("does not offer the vote to a village that is already issuing, and still lets it answer its rows", () => {
    // The state the page got wrong: Start the Game showed, and the server answered 409.
    const d = launchDoors(facts({ issuing: true, founderPowerStands: false }));
    expect(d.voteCanBeAsked).toBe(false);
    expect(d.rowsOpen).toBe(true);
  });

  it("closes the row answers and the vote once the checklist froze", () => {
    expect(launchDoors(facts({ checklistFrozen: true, launchedAt: "2026-12-30T00:00:00.000Z" }))).toEqual({
      rowsOpen: false,
      voteCanBeAsked: false,
    });
  });
});

describe("launchRecord: how the checklist became a record", () => {
  it("says voted when the village's own vote carried", () => {
    expect(launchRecord(facts({ voteCarried: true, launchedByBallotId: "bal-3", checklistFrozen: true, launchedAt: "2026-12-30T00:00:00.000Z" }))).toBe("voted");
  });

  it("says marked for a village that is issuing with a frozen checklist and no vote: the page must not say it voted", () => {
    // QA's state S5a. The label reads "issuing-vote-not-held" here, which is true, and the header must agree with it.
    const f = facts({ issuing: true, founderPowerStands: false, checklistFrozen: true, launchedAt: "2026-02-01T00:00:00.000Z" });
    expect(launchRecord(f)).toBe("marked");
    expect(launchLabel(f)).toBe("issuing-vote-not-held");
  });

  it("says marked for a village with a frozen checklist that is not issuing and never voted", () => {
    // QA's state S5b. The label has no name for this village and reads "setup", so a page with a frozen checklist
    // shows this and hides the label.
    const f = facts({ checklistFrozen: true, launchedAt: "2026-02-01T00:00:00.000Z" });
    expect(launchRecord(f)).toBe("marked");
    expect(launchLabel(f)).toBe("setup");
  });

  it("says nothing while the checklist is open, whatever else is true", () => {
    expect(launchRecord(CLAIMED)).toBeNull();
    expect(launchRecord(facts({ issuing: true, founderPowerStands: false }))).toBeNull();
    expect(launchRecord(facts({ voteOpen: true, openBallotId: "bal-1" }))).toBeNull();
  });
});
