/**
 * The onboarding stage's pure rules: the reference list, who reads a reference,
 * the stage track and the order of the admin list. Each case has a control
 * that fails for the reason claimed.
 */
import { describe, expect, it } from "vitest";
import {
  byStageThenDate,
  mayAssignOwners,
  mayReadReference,
  ONBOARDING_REFERENCES_MAX,
  parseReferenceList,
  parseShortlistAnswer,
  shortlistOf,
  trackOf,
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
    expect(parseReferenceList([ref({ ally: "" })]).ok).toBe(true);
    expect(parseReferenceList([ref({ how: "" })])).toEqual({ ok: false, error: "needs_all", row: 0 });
    expect(parseReferenceList([ref(), ref({ contact: "not a way to reach", name: "C" })])).toEqual({ ok: false, error: "contact", row: 1 });
  });
  it("refuses none, the same reference twice and more than five", () => {
    expect(parseReferenceList([])).toEqual({ ok: false, error: "none", row: null });
    expect(parseReferenceList([ref(), ref({ name: "Again", contact: "ANA@example.test" })])).toEqual({ ok: false, error: "twice", row: 1 });
    const six = Array.from({ length: ONBOARDING_REFERENCES_MAX + 1 }, (_, i) => ref({ name: `R${i}`, contact: `r${i}@example.test` }));
    expect(parseReferenceList(six)).toMatchObject({ ok: false, error: "too_many" });
    // CONTROL: five is fine.
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

describe("the stage track", () => {
  const facts = (over: Partial<TrackFacts> = {}): TrackFacts => ({
    decided: null,
    reviewStage: "invited",
    firstReplied: true,
    shortlist: null,
    refsAsked: false,
    refsGiven: false,
    references: [],
    interviews: [{ state: "open", final: false }],
    ...over,
  });
  const roles = { welcome: "Welcome Role", followup: "People and Operations", finalCall: "Lead Steward" };
  const stateOf = (t: ReturnType<typeof trackOf>) => Object.fromEntries(t.stages.map((s) => [s.key, s.state]));

  it("starts at our review while it waits, with the power to place people acting", () => {
    const t = trackOf(facts({ reviewStage: "review", firstReplied: false, interviews: [{ state: "waiting", final: false }] }), roles);
    expect(t.now).toBe("review");
    expect(t.primary).toBe("review");
    expect(t.who).toMatch(/power to place people in roles/);
  });

  it("asks for the shortlist once our review invited, then for references", () => {
    expect(trackOf(facts(), roles).primary).toBe("shortlist");
    const asked = trackOf(facts({ shortlist: "yes" }), roles);
    expect(asked.now).toBe("references");
    expect(asked.primary).toBe("ask_references");
    expect(trackOf(facts({ shortlist: "yes", refsAsked: true }), roles)).toMatchObject({ primary: "wait_applicant", who: "The applicant" });
  });

  it("runs the follow-ups beside the intuition conversations: neither waits for the other", () => {
    const t = trackOf(facts({ shortlist: "yes", refsAsked: true, refsGiven: true, references: [{ followedUp: false }], interviews: [{ state: "open", final: false }] }), roles);
    expect(t.now).toBe("followups");
    expect(t.who).toContain("People and Operations");
    expect(t.who).toContain("conversation roles");
    // CONTROL: with the conversations done and one reference still open, it is still the follow-ups.
    expect(trackOf(facts({ shortlist: "yes", refsAsked: true, refsGiven: true, references: [{ followedUp: false }], interviews: [{ state: "scored", final: false }] }), roles).now).toBe("followups");
  });

  it("moves to the final conversation, held by the final-call role, then to the decision", () => {
    const gathered = facts({ shortlist: "yes", refsAsked: true, refsGiven: true, references: [{ followedUp: true }], interviews: [{ state: "scored", final: false }] });
    expect(trackOf(gathered, roles)).toMatchObject({ now: "final_interview", primary: "add_final", who: "Lead Steward" });
    const withFinal = { ...gathered, interviews: [{ state: "scored", final: false }, { state: "open", final: true }] };
    expect(trackOf(withFinal, roles).primary).toBe("final_conversation");
    const held = { ...gathered, interviews: [{ state: "scored", final: false }, { state: "scored", final: true }] };
    expect(trackOf(held, roles)).toMatchObject({ now: "decision", primary: "decide", who: "Lead Steward" });
  });

  it("says the power to place people decides when no final-call role is named", () => {
    const held = facts({ shortlist: "yes", refsAsked: true, refsGiven: true, references: [{ followedUp: true }], interviews: [{ state: "scored", final: false }, { state: "scored", final: true }] });
    expect(trackOf(held, { ...roles, finalCall: null }).who).toMatch(/power to place people in roles/);
  });

  it("a not shortlisted application skips to the decision and declines nobody by itself", () => {
    const t = trackOf(facts({ shortlist: "no" }), roles);
    expect(t.now).toBe("decision");
    expect(stateOf(t)).toMatchObject({ references: "skipped", followups: "skipped", final_interview: "skipped", decision: "now" });
    expect(t.primary).toBe("decide");
  });

  it("once decided, nothing is left and the stages that never happened read as skipped", () => {
    const t = trackOf(facts({ decided: "adopted", shortlist: "yes" }), roles);
    expect(t.primary).toBe("none");
    expect(stateOf(t)).toMatchObject({ decision: "done", references: "skipped" });
  });
});

describe("the admin list order", () => {
  it("is by stage, then by the day it arrived: nothing about the person", () => {
    const rows = [
      { id: "c", stage: "decision" as const, confirmedAt: "2026-11-01T00:00:00Z" },
      { id: "b", stage: "review" as const, confirmedAt: "2026-11-05T00:00:00Z" },
      { id: "a", stage: "review" as const, confirmedAt: "2026-11-02T00:00:00Z" },
    ];
    expect(byStageThenDate(rows).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});
