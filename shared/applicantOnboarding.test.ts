/**
 * The onboarding stage's pure rules: the reference list, who reads a reference,
 * the stage track and the order of the admin list. Each case has a control
 * that fails for the reason claimed.
 */
import { describe, expect, it } from "vitest";
import {
  asksReferences,
  byStageThenDate,
  memberTrackOf,
  mayAssignOwners,
  mayReadReference,
  ONBOARDING_REFERENCES_MAX,
  parseReferenceList,
  parseShortlistAnswer,
  shortlistOf,
  trackOf,
  trackStates,
  type TrackFacts,
} from "./applicantOnboarding";
import { mayReadScorecards } from "./applicationReview";

const ref = (over: Partial<Record<string, string>> = {}) => ({ name: "Ana Ref", contact: "ana@example.test", how: "We built a school garden together.", ally: "She runs a seed library.", ...over });

describe("the reference list", () => {
  it("takes one to five references and drops wholly blank rows", () => {
    const out = parseReferenceList([ref(), { name: "", contact: "", how: "", ally: "" }, ref({ name: "Ben", contact: "+506 8888 1234" })]);
    expect(out.ok && out.value.map((r) => r.name)).toEqual(["Ana Ref", "Ben"]);
  });
  it("leaves the ally line optional and needs a name, a way to reach them and how they know the applicant", () => {
    expect(parseReferenceList([ref({ ally: "" }), ref({ name: "Ben", contact: "ben@example.test" })]).ok).toBe(true);
    // At least two (the lead, 19 Nov 2026): one alone is refused.
    expect(parseReferenceList([ref()])).toEqual({ ok: false, error: "too_few", row: null });
    expect(parseReferenceList([ref({ how: "" })])).toEqual({ ok: false, error: "needs_all", row: 0 });
    expect(parseReferenceList([ref(), ref({ contact: "not a way to reach", name: "C" })])).toEqual({ ok: false, error: "contact", row: 1 });
  });
  it("refuses none, the same reference twice and more than ten", () => {
    expect(parseReferenceList([])).toEqual({ ok: false, error: "none", row: null });
    expect(parseReferenceList([ref(), ref({ name: "Again", contact: "ANA@example.test" })])).toEqual({ ok: false, error: "twice", row: 1 });
    const six = Array.from({ length: ONBOARDING_REFERENCES_MAX + 1 }, (_, i) => ref({ name: `R${i}`, contact: `r${i}@example.test` }));
    expect(parseReferenceList(six)).toMatchObject({ ok: false, error: "too_many" });
    // CONTROL: ten is fine.
    expect(parseReferenceList(six.slice(0, ONBOARDING_REFERENCES_MAX)).ok).toBe(true);
  });
});

describe("the shortlist answer", () => {
  it("is yes or no, read back from the step", () => {
    expect(parseShortlistAnswer("yes")).toBe("yes");
    expect(parseShortlistAnswer("maybe")).toBeNull();
    expect(shortlistOf([{ kind: "confirmed" }, { kind: "shortlist", detail: { answer: "no" } }])).toBe("no");
    expect(shortlistOf([{ kind: "confirmed" }])).toBeNull();
  });
});

describe("who reads a reference", () => {
  const nobody = { isApplicant: false, recused: false, isReviewer: false, isFinalCall: false, isOwner: false };
  it("the reviewers, the final-call role and the reference's owner", () => {
    expect(mayReadReference({ ...nobody, isReviewer: true })).toBe(true);
    expect(mayReadReference({ ...nobody, isFinalCall: true })).toBe(true);
    expect(mayReadReference({ ...nobody, isOwner: true })).toBe(true);
    // CONTROL: another member reads nothing.
    expect(mayReadReference(nobody)).toBe(false);
  });
  it("never the applicant, never somebody who stepped out, whatever else they hold", () => {
    expect(mayReadReference({ ...nobody, isReviewer: true, isApplicant: true })).toBe(false);
    expect(mayReadReference({ ...nobody, isOwner: true, recused: true })).toBe(false);
  });
  it("owners are picked by the reviewers and the final-call role, never by an owner alone", () => {
    expect(mayAssignOwners({ isApplicant: false, recused: false, isReviewer: true, isFinalCall: false })).toBe(true);
    expect(mayAssignOwners({ isApplicant: false, recused: false, isReviewer: false, isFinalCall: true })).toBe(true);
    expect(mayAssignOwners({ isApplicant: false, recused: false, isReviewer: false, isFinalCall: false })).toBe(false);
  });
});

describe("the scorecards are gathered for the final-call role", () => {
  const base = { isApplicant: false, isInterviewer: false, hasSubmitted: false, recused: false, holdsSeatPower: false };
  it("reads them on the same terms as the power to fill roles", () => {
    expect(mayReadScorecards({ ...base, holdsFinalCall: true })).toBe(true);
    // CONTROL: without the role, nothing.
    expect(mayReadScorecards(base)).toBe(false);
  });
  it("keeps the anchoring rule: a final-call holder who interviews and has not written up reads nothing yet", () => {
    expect(mayReadScorecards({ ...base, holdsFinalCall: true, isInterviewer: true })).toBe(false);
    expect(mayReadScorecards({ ...base, holdsFinalCall: true, isInterviewer: true, hasSubmitted: true })).toBe(true);
  });
});

describe("the stage track (six stages, the lead's order, 27 Nov 2026)", () => {
  const facts = (over: Partial<TrackFacts> = {}): TrackFacts => ({
    decided: null,
    reviewStage: "invited",
    firstReplied: true,
    shortlist: null,
    refsAsked: false,
    refsGiven: false,
    references: [],
    interviews: [{ state: "open", final: false, role: "Operations Role" }, { state: "waiting", final: false, role: "Community Role" }],
    ...over,
  });
  const roles = { welcome: "Welcome Role", followup: "People and Operations", finalCall: "Lead Steward" };
  const stateOf = (t: ReturnType<typeof trackOf>) => Object.fromEntries(t.stages.map((s) => [s.key, s.state]));

  it("draws the six stages in the lead's order, in the lead's words", () => {
    const t = trackOf(facts(), roles);
    expect(t.stages.map((s) => s.label)).toEqual(["Received", "Our review", "References and proposal", "Final conversation", "Agreement", "Start"]);
  });

  it("starts at our review while it waits, with the power to place people acting", () => {
    const t = trackOf(facts({ reviewStage: "review", firstReplied: false, interviews: [{ state: "waiting", final: false }] }), roles);
    expect(t.now).toBe("review");
    expect(t.primary).toBe("review");
    expect(t.who).toMatch(/power to place people in roles/);
  });

  it("asks for the shortlist inside our review, then the first conversation with its role, before references", () => {
    expect(trackOf(facts(), roles)).toMatchObject({ now: "review", primary: "shortlist" });
    // Shortlisted: still our review, until the first conversation (the operations role's) is written up.
    const talking = trackOf(facts({ shortlist: "yes" }), roles);
    expect(talking).toMatchObject({ now: "review", primary: "conversation", who: "Operations Role" });
    expect(stateOf(talking)).toMatchObject({ review: "now", references: "later" });
    const passed = trackOf(facts({ shortlist: "yes", interviews: [{ state: "scored", final: false }, { state: "open", final: false }] }), roles);
    expect(passed).toMatchObject({ now: "references", primary: "ask_references" });
    expect(trackOf(facts({ shortlist: "yes", refsAsked: true, interviews: [{ state: "scored", final: false }, { state: "open", final: false }] }), roles)).toMatchObject({ primary: "wait_applicant", who: "The applicant" });
  });

  it("runs the follow-ups beside the community conversation in one stage: neither waits for the other", () => {
    const t = trackOf(facts({ shortlist: "yes", refsAsked: true, refsGiven: true, references: [{ followedUp: false }], interviews: [{ state: "scored", final: false }, { state: "open", final: false }] }), roles);
    expect(t.now).toBe("references");
    expect(t.who).toContain("People and Operations");
    expect(t.who).toContain("conversation roles");
    // CONTROL: with every conversation done and one reference still open, it is still References and proposal.
    expect(trackOf(facts({ shortlist: "yes", refsAsked: true, refsGiven: true, references: [{ followedUp: false }], interviews: [{ state: "scored", final: false }, { state: "scored", final: false }] }), roles).now).toBe("references");
    // And with the references done and the community conversation still open, it waits for that too.
    expect(trackOf(facts({ shortlist: "yes", refsAsked: true, refsGiven: true, references: [{ followedUp: true }], interviews: [{ state: "scored", final: false }, { state: "open", final: false }] }), roles).now).toBe("references");
  });

  it("waits for the team to move it to the final conversation, held by the final-call role, then the agreement", () => {
    const gathered = facts({ shortlist: "yes", refsAsked: true, refsGiven: true, references: [{ followedUp: true }], interviews: [{ state: "scored", final: false }, { state: "scored", final: false }] });
    // Everything in: still References and proposal, with the team's move as the act. Nothing moves by itself (QA round 1).
    expect(trackOf(gathered, roles)).toMatchObject({ now: "references", primary: "add_final", who: "Lead Steward" });
    // A final conversation the role's own list named, still waiting, does not move it either.
    expect(trackOf({ ...gathered, interviews: [...gathered.interviews, { state: "waiting", final: true }] }, roles).now).toBe("references");
    // Opened by the team even with a reference still open: the person moved it, so it is the Final conversation.
    expect(trackStates(facts({ shortlist: "yes", refsAsked: true, refsGiven: true, references: [{ followedUp: false }], interviews: [{ state: "scored", final: false }, { state: "open", final: true }] })).now).toBe("final_interview");
    const withFinal = { ...gathered, interviews: [...gathered.interviews, { state: "open", final: true }] };
    expect(trackOf(withFinal, roles).primary).toBe("final_conversation");
    const held = { ...gathered, interviews: [...gathered.interviews, { state: "scored", final: true }] };
    const t = trackOf(held, roles);
    expect(t).toMatchObject({ now: "agreement", primary: "decide", who: "Lead Steward" });
    expect(t.next).toMatch(/counter/i);
  });

  it("says the power to place people decides when no final-call role is named", () => {
    const held = facts({ shortlist: "yes", refsAsked: true, refsGiven: true, references: [{ followedUp: true }], interviews: [{ state: "scored", final: false }, { state: "scored", final: true }] });
    expect(trackOf(held, { ...roles, finalCall: null }).who).toMatch(/power to place people in roles/);
  });

  it("a not shortlisted application stays in our review, skips the rest and declines nobody by itself", () => {
    const t = trackOf(facts({ shortlist: "no" }), roles);
    expect(t.now).toBe("review");
    expect(stateOf(t)).toMatchObject({ references: "skipped", final_interview: "skipped", agreement: "skipped", start: "later" });
    expect(t.primary).toBe("decide");
  });

  it("adopted reads Start; the stages that never happened read as skipped", () => {
    const t = trackOf(facts({ decided: "adopted", shortlist: "yes" }), roles);
    expect(t.primary).toBe("none");
    expect(t.now).toBe("start");
    expect(stateOf(t)).toMatchObject({ agreement: "done", start: "done", references: "skipped" });
  });

  it("declined ends at the stage it reached, and Start never happens", () => {
    const t = trackOf(facts({ decided: "declined", shortlist: "no" }), roles);
    expect(t.now).toBe("review");
    expect(stateOf(t)).toMatchObject({ review: "done", references: "skipped", start: "skipped" });
  });

  it("an application in flight keeps its place: the same facts read under the old stage names map one to one", () => {
    // Old "shortlist" (invited, not yet answered) and old "followups" (references in, conversations on) fold in.
    expect(trackStates(facts()).now).toBe("review");
    expect(trackStates(facts({ shortlist: "yes", refsAsked: true, refsGiven: true, references: [{ followedUp: false }], interviews: [{ state: "scored", final: false }, { state: "open", final: false }] })).now).toBe("references");
    // Old "decision" after the final conversation reads Agreement.
    expect(trackStates(facts({ shortlist: "yes", refsAsked: true, refsGiven: true, references: [{ followedUp: true }], interviews: [{ state: "scored", final: false }, { state: "scored", final: true }] })).now).toBe("agreement");
  });
});

describe("the admin list order", () => {
  it("is by stage, then by the day it arrived: nothing about the person", () => {
    const rows = [
      { id: "c", stage: "agreement" as const, confirmedAt: "2026-11-01T00:00:00Z" },
      { id: "b", stage: "review" as const, confirmedAt: "2026-11-05T00:00:00Z" },
      { id: "a", stage: "review" as const, confirmedAt: "2026-11-02T00:00:00Z" },
    ];
    expect(byStageThenDate(rows).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("references for a member's first long-term role (the lead, 19 Nov 2026)", () => {
  it("an open proposal may always be asked; a member only while they hold no live role seat", () => {
    expect(asksReferences("open", 3)).toBe(true);
    expect(asksReferences("member", 0)).toBe(true);
    // CONTROL: a member who already holds a role is not asked.
    expect(asksReferences("member", 1)).toBe(false);
  });
  it("walks the references and the agreement, never a shortlist or a final conversation", () => {
    const facts = { decided: null, refsAsked: false, refsGiven: false, references: [] as Array<{ followedUp: boolean }> };
    const ask = memberTrackOf(facts);
    expect(ask.stages.map((s) => s.key)).toEqual(["received", "references", "agreement", "start"]);
    expect([ask.now, ask.primary]).toEqual(["references", "ask_references"]);
    expect(memberTrackOf({ ...facts, refsAsked: true }).primary).toBe("wait_applicant");
    expect(memberTrackOf({ ...facts, refsAsked: true, refsGiven: true, references: [{ followedUp: false }] }).primary).toBe("follow_up");
    expect(memberTrackOf({ ...facts, refsAsked: true, refsGiven: true, references: [{ followedUp: true }] }).primary).toBe("decide");
    const decided = memberTrackOf({ ...facts, decided: "adopted" });
    expect(decided.primary).toBe("none");
    expect(decided.now).toBe("start");
    expect(decided.stages.find((s) => s.key === "references")?.state).toBe("skipped");
  });
  it("doubles the status page's references to ten", () => {
    expect(ONBOARDING_REFERENCES_MAX).toBe(10);
  });
});
