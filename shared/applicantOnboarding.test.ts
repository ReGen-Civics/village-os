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
  mayClaimReference,
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

const ref = (over: Partial<Record<string, string>> = {}) => ({ name: "Ana Ref", email: "ana@example.test", whatsapp: "+506 8888 1234", how: "We built a school garden together.", ally: "She runs a seed library.", ...over });

describe("the reference list", () => {
  it("takes one to ten references and drops wholly blank rows", () => {
    const out = parseReferenceList([ref(), { name: "", email: "", how: "", ally: "" }, ref({ name: "Ben", email: "ben@example.test" })]);
    expect(out.ok && out.value.map((r) => r.name)).toEqual(["Ana Ref", "Ben"]);
    // The stored contact is labelled lines, the email first.
    expect(out.ok && out.value[0].contact).toBe("Email: ana@example.test\nWhatsApp: +506 8888 1234");
  });
  it("leaves the ally line optional and needs a name and how they know the applicant", () => {
    expect(parseReferenceList([ref({ ally: "" }), ref({ name: "Ben", email: "ben@example.test" })]).ok).toBe(true);
    // At least two (the lead, 19 Nov 2026): one alone is refused.
    expect(parseReferenceList([ref()])).toEqual({ ok: false, error: "too_few", row: null });
    expect(parseReferenceList([ref({ how: "" })])).toEqual({ ok: false, error: "needs_all", row: 0, field: "how" });
  });
  it("THE LEAD'S RULE (27 Nov 2026): an email AND one of WhatsApp, a US phone or Signal, each checked", () => {
    const b = (over: Record<string, string>) => ref({ name: "Ben", email: "ben@example.test", whatsapp: "", ...over });
    // No email, or a bad one.
    expect(parseReferenceList([ref(), b({ email: "", whatsapp: "+506 8888 1234" })])).toEqual({ ok: false, error: "email", row: 1, field: "email" });
    expect(parseReferenceList([ref(), b({ email: "not an email", whatsapp: "+506 8888 1234" })])).toEqual({ ok: false, error: "email", row: 1, field: "email" });
    // An email alone is not enough.
    expect(parseReferenceList([ref(), b({})])).toEqual({ ok: false, error: "channel", row: 1, field: "whatsapp" });
    // Each of the three, alone, is enough with the email.
    expect(parseReferenceList([ref(), b({ whatsapp: "+44 7700 900123" })]).ok).toBe(true);
    expect(parseReferenceList([ref(), b({ usPhone: "(415) 555-0132" })]).ok).toBe(true);
    expect(parseReferenceList([ref(), b({ signal: "ben.42" })]).ok).toBe(true);
    // A number that does not read as its kind is refused.
    expect(parseReferenceList([ref(), b({ usPhone: "+506 8888 1234" })])).toEqual({ ok: false, error: "contact", row: 1, field: "usPhone" });
    expect(parseReferenceList([ref(), b({ whatsapp: "12" })])).toEqual({ ok: false, error: "contact", row: 1, field: "whatsapp" });
    // An older form's single contact reads as the email, and still needs a number.
    expect(parseReferenceList([ref(), { name: "Old", contact: "old@example.test", how: "Knew me." }])).toEqual({ ok: false, error: "channel", row: 1, field: "whatsapp" });
  });
  it("refuses none, the same reference twice and more than ten", () => {
    expect(parseReferenceList([])).toEqual({ ok: false, error: "none", row: null });
    expect(parseReferenceList([ref(), ref({ name: "Again", email: "ANA@example.test" })])).toEqual({ ok: false, error: "twice", row: 1 });
    const many = Array.from({ length: ONBOARDING_REFERENCES_MAX + 1 }, (_, i) => ref({ name: `R${i}`, email: `r${i}@example.test` }));
    expect(parseReferenceList(many)).toMatchObject({ ok: false, error: "too_many" });
    // CONTROL: ten is fine.
    expect(parseReferenceList(many.slice(0, ONBOARDING_REFERENCES_MAX)).ok).toBe(true);
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

describe("who reads a reference: 'Interviewers + placers' (the lead, 27 Nov 2026)", () => {
  const nobody = { isApplicant: false, recused: false, isPlacer: false, isInterviewer: false, isOwner: false };
  it("the conversation roles' holders, the placers and the reference's own owner", () => {
    expect(mayReadReference({ ...nobody, isInterviewer: true })).toBe(true);
    expect(mayReadReference({ ...nobody, isPlacer: true })).toBe(true);
    expect(mayReadReference({ ...nobody, isOwner: true })).toBe(true);
    // CONTROL: another member, a consent peer among them, reads nothing.
    expect(mayReadReference(nobody)).toBe(false);
  });
  it("never the applicant, never somebody who stepped out, whatever else they hold", () => {
    expect(mayReadReference({ ...nobody, isPlacer: true, isApplicant: true })).toBe(false);
    expect(mayReadReference({ ...nobody, isOwner: true, recused: true })).toBe(false);
  });
  it("only interviewers and placers claim and pick owners, never an owner alone", () => {
    const f = { isApplicant: false, recused: false, isPlacer: false, isInterviewer: false };
    expect(mayClaimReference({ ...f, isInterviewer: true })).toBe(true);
    expect(mayClaimReference({ ...f, isPlacer: true })).toBe(true);
    expect(mayClaimReference(f)).toBe(false);
    expect(mayAssignOwners({ ...f, isPlacer: true })).toBe(true);
    expect(mayAssignOwners(f)).toBe(false);
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
    // Review-first, invited: the first conversation is open and is part of our review, as the applicant's page says
    // (QA pass 2: the team was told to shortlist while the applicant was asked to book).
    expect(trackOf(facts(), roles)).toMatchObject({ now: "review", primary: "conversation", who: "Operations Role" });
    // The older path (no review first): the shortlist comes first and opens the first conversation.
    expect(trackOf(facts({ reviewStage: null, interviews: [{ state: "waiting", final: false }, { state: "waiting", final: false }] }), roles)).toMatchObject({ now: "review", primary: "shortlist" });
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
    // RULING 7: the final written up is still the Final conversation; the applicant refines, then sends it on.
    const held = { ...gathered, interviews: [...gathered.interviews, { state: "scored", final: true }], sentToCircle: false };
    const waiting = trackOf(held, roles);
    expect(waiting).toMatchObject({ now: "final_interview", primary: "send_to_circle", who: "The applicant" });
    expect(waiting.next).toContain("Welcome Role or Lead Steward may send it on");
    expect(waiting.next).not.toMatch(/fixes the proposal|delivers/);
    // Sent: Agreement, and the anchor circle acts (QA pass 2: the Visionary was named here).
    const t = trackOf({ ...held, sentToCircle: true }, { ...roles, anchorCircle: "Anchor Circle" });
    expect(t).toMatchObject({ now: "agreement", primary: "decide", who: "The Anchor Circle" });
    expect(t.next).toMatch(/counter/i);
    expect(trackOf({ ...held, sentToCircle: true }, roles).who).toBe("The anchor circle");
  });

  it("says the power to place people holds the final call when no final-call role is named", () => {
    const open = facts({ shortlist: "yes", refsAsked: true, refsGiven: true, references: [{ followedUp: true }], interviews: [{ state: "scored", final: false }, { state: "open", final: true }] });
    expect(trackOf(open, { ...roles, finalCall: null }).who).toMatch(/power to place people in roles/);
  });

  it("review-first: the invitation opens the first conversation inside our review, before the shortlist (QA pass 2)", () => {
    const invited = trackOf(facts({ reviewStage: "invited", firstReplied: true, shortlist: null }), roles);
    expect(invited).toMatchObject({ now: "review", primary: "conversation", who: "Operations Role" });
    expect(invited.next).toContain("part of our review");
    const heard = trackOf(facts({ reviewStage: "invited", firstReplied: true, shortlist: null, interviews: [{ state: "scored", final: false }, { state: "waiting", final: false }] }), roles);
    expect(heard).toMatchObject({ now: "review", primary: "shortlist" });
    expect(heard.next).toContain("Shortlisting begins References and proposal");
  });

  it("a not shortlisted application stays in our review, skips the rest and declines nobody by itself", () => {
    const t = trackOf(facts({ shortlist: "no" }), roles);
    expect(t.now).toBe("review");
    expect(stateOf(t)).toMatchObject({ references: "skipped", final_interview: "skipped", agreement: "skipped", start: "later" });
    expect(t.primary).toBe("decide");
  });

  it("adopted reads Start; the stages that never happened read as skipped", () => {
    const t = trackOf(facts({ decided: "adopted", shortlist: "yes" }), roles);
    // Start names the welcoming role, who welcomes them and is their buddy (QA pass 2: "says nobody acts").
    expect(t).toMatchObject({ primary: "welcome", who: "Welcome Role" });
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
