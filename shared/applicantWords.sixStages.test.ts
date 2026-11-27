/**
 * THE APPLICANT'S PAGE ON THE SIX STAGES (the lead, 27 Nov 2026): only their stage, what to do next, and that stage's
 * booking button, in their language.
 */
import { describe, expect, it } from "vitest";
import { statusView, type StatusServedForView } from "./applicantWords";

const KEYS = ["received", "review", "references", "final_interview", "agreement", "start"] as const;
const six = (now: (typeof KEYS)[number], refine = { open: false, frozen: false, why: "", aim: "", versions: 0 }): StatusServedForView["sixStages"] => {
  const at = KEYS.indexOf(now);
  return { stages: KEYS.map((key, i) => ({ key, state: i < at ? ("done" as const) : i === at ? ("now" as const) : ("later" as const) })), now, refine };
};
const served = (over: Partial<StatusServedForView> = {}): StatusServedForView => ({
  step: "interview",
  actsNext: "x",
  path: [{ label: "Received", state: "done" }, { label: "Conversation with Operations Role (30 minutes)", state: "now" }],
  booking: "You book each conversation.",
  mode: "split",
  bookNow: null,
  outcome: null,
  ...over,
});

describe("the applicant's six stages", () => {
  it("draws the six stages in the lead's words, with one 'now'", () => {
    const v = statusView("en", served({ sixStages: six("references") }));
    expect(v.path.map((p) => p.label)).toEqual(["Received", "Our review", "References and proposal", "Final conversation", "Agreement", "Start"]);
    expect(v.path.filter((p) => p.state === "now").map((p) => p.label)).toEqual(["References and proposal"]);
    expect(v.stepWords).toBe("References and proposal");
  });

  it("says what to do next at the stage, and offers only that stage's booking button", () => {
    const bookNow = { role: "Operations Role", label: "Operations Role (Rye)", url: "https://cal.example.test/ops", links: [{ who: null, url: "https://cal.example.test/ops" }] };
    // Shortlisted (QA round 2: the words say so only then).
    const v = statusView("en", served({ sixStages: { ...six("review")!, shortlisted: true }, bookNow }));
    expect(v.move).toBe("You are shortlisted. Book your conversation with Operations Role (Rye) below.");
    expect(v.booking?.text).toBe("");
    expect(v.booking?.book && "links" in v.booking.book ? v.booking.book.links.map((l) => l.url) : []).toEqual(["https://cal.example.test/ops"]);
    // CONTROL: no conversation open, no button, and the older order line is gone.
    const none = statusView("en", served({ sixStages: six("review") }));
    expect(none.booking).toBeNull();
    expect(none.move).toMatch(/reading your proposal/);
  });

  it("speaks the applicant's language", () => {
    const v = statusView("es", served({ sixStages: six("agreement") }));
    expect(v.stepWords).toBe("Acuerdo");
    expect(v.move).toMatch(/contraoferta/);
  });

  it("passes the refine form at References and proposal, and its frozen line after", () => {
    const open = statusView("en", served({ sixStages: six("references", { open: true, frozen: false, why: "Because.", aim: "Books.", versions: 1 }) }));
    expect(open.refine).toEqual({ open: true, frozen: false, why: "Because.", aim: "Books.", versions: 1 });
    const frozen = statusView("en", served({ sixStages: six("final_interview", { open: false, frozen: true, why: "", aim: "", versions: 1 }) }));
    expect(frozen.refine?.frozen).toBe(true);
    expect(statusView("en", served({ sixStages: six("review") })).refine).toBeNull();
  });

  it("an adopted applicant reads Start as done; a declined one keeps its own answer and the older path", () => {
    const adopted = statusView("en", served({ outcome: "adopted", sixStages: { ...six("start")!, stages: KEYS.map((key) => ({ key, state: "done" as const })) } }));
    expect(adopted.path.every((p) => p.state === "done")).toBe(true);
    const declined = statusView("en", served({ outcome: "declined", sixStages: six("review") }));
    expect(declined.path.map((p) => p.label)).not.toContain("Our review");
    expect(declined.refine).toBeNull();
  });

  it("without the six stages (a member's own application), the older path stays", () => {
    const v = statusView("en", served());
    expect(v.path.map((p) => p.label)).toContain("Received");
    expect(v.refine).toBeNull();
  });

  it("QA round 1: a final conversation's button never shows before the Final conversation stage, and nothing says 'refine below' once the form is closed", () => {
    const finalBook = { role: "Final Call Role", label: "Final Call Role (Flor)", url: "https://cal.example.test/final", links: [{ who: null, url: "https://cal.example.test/final" }], final: true };
    const early = statusView("en", served({ sixStages: six("references", { open: false, frozen: false, why: "", aim: "", versions: 0 }), bookNow: finalBook }));
    expect(early.booking).toBeNull();
    expect(early.move).not.toMatch(/Final Call Role/);
    expect(early.move).not.toMatch(/refine/i);
    const atFinal = statusView("en", served({ sixStages: six("final_interview", { open: false, frozen: true, why: "", aim: "", versions: 1 }), bookNow: finalBook }));
    expect(atFinal.move).toMatch(/final conversation with Final Call Role \(Flor\)/);
    expect(atFinal.bookGold).toBe(true);
    // CONTROL: the community conversation's button is not the final's, and shows at References and proposal.
    const community = { ...finalBook, role: "Community Role", label: "Community Role", final: false };
    expect(statusView("en", served({ sixStages: six("references"), bookNow: community })).booking).not.toBeNull();
  });

  it("QA round 1: we say we will reply only while the move is ours, and 'answer each line' only when a counter-offer exists", () => {
    const refs = statusView("en", served({ sixStages: six("references", { open: true, frozen: false, why: "a", aim: "b", versions: 0 }), referencesAsked: { given: null, mayAdd: true } }));
    expect(refs.applicantActs).toBe(true);
    expect(refs.tasks?.map((t) => [t.key, t.state])).toEqual([["references", "To do"], ["proposal", "Open to refine"], ["conversation", "Opens when it is ready"]]);
    expect(refs.bookGold).toBe(false);
    const waiting = statusView("en", served({ sixStages: six("agreement") }));
    expect(waiting.applicantActs).toBe(false);
    expect(waiting.move).not.toMatch(/Answer each line/);
    const countered = statusView("en", served({ sixStages: six("agreement", { open: false, frozen: true, why: "", aim: "", versions: 1 }), offer: { mayAnswer: true, rows: [{}] } }));
    expect(countered.move).toMatch(/Answer each line below/);
    expect(countered.applicantActs).toBe(true);
    // The fixed line never shows at Agreement.
    expect(countered.refine).toBeNull();
  });

  it("QA round 2: 'You are shortlisted' only when it was; invited without a shortlist reads otherwise", () => {
    const bookNow = { role: "Operations Role", label: "Operations Role", url: "https://cal.example.test/ops", links: [{ who: null, url: "https://cal.example.test/ops" }] };
    const invited = statusView("en", served({ sixStages: { ...six("review")!, shortlisted: false }, bookNow }));
    expect(invited.move).toBe("Book your first conversation with Operations Role below. It is part of our review.");
    expect(invited.move).not.toMatch(/shortlist/i);
    // An older server sends no flag: never claim a shortlist it did not say.
    expect(statusView("en", served({ sixStages: six("review"), bookNow })).move).not.toMatch(/shortlist/i);
    expect(statusView("es", served({ sixStages: six("review"), bookNow })).move).not.toMatch(/preseleccionada/);
  });

  it("QA round 2: at References and proposal the stage card's gold act is 'Add your references'; the booking beside it is gold-edged", () => {
    const bookNow = { role: "Community Role", label: "Community Role", url: "https://cal.example.test/c", links: [{ who: null, url: "https://cal.example.test/c" }] };
    const v = statusView("en", served({ sixStages: six("references", { open: true, frozen: false, why: "a", aim: "b", versions: 0 }), referencesAsked: { given: null, mayAdd: true }, bookNow }));
    expect(v.primary).toEqual({ label: "Add your references", href: "#reference-form" });
    expect(v.bookGold).toBe(false);
    expect(v.booking).not.toBeNull();
    // CONTROL: once they are in, no primary, and the booking is the one gold act again.
    const sent = statusView("en", served({ sixStages: six("references", { open: true, frozen: false, why: "a", aim: "b", versions: 0 }), referencesAsked: { given: 2, mayAdd: false }, bookNow }));
    expect(sent.primary).toBeNull();
    expect(sent.bookGold).toBe(true);
    expect(statusView("en", served({ sixStages: six("review") })).primary).toBeNull();
  });

  it("QA round 2: once the references are in, the card says so and names the role that acts next", () => {
    const refine = { open: true, frozen: false, why: "a", aim: "b", versions: 0 };
    const follow = statusView("en", served({ sixStages: { ...six("references", refine)!, next: { act: "follow_up", role: "Operations Role" } }, referencesAsked: { given: 2, mayAdd: false } }));
    expect(follow.move).toMatch(/^Your references are in\. Operations Role contacts them next\./);
    expect(follow.move).toMatch(/still refine your proposal below/);
    expect(follow.move).not.toMatch(/Add your references/);
    const move = statusView("en", served({ sixStages: { ...six("references", { ...refine, open: false })!, next: { act: "move", role: "Final Call Role" } }, referencesAsked: { given: 2, mayAdd: false } }));
    expect(move.move).toBe("Your references are in. Final Call Role moves your application to the final conversation next.");
    // No role named: the team.
    const team = statusView("en", served({ sixStages: { ...six("references", refine)!, next: { act: "move", role: null } }, referencesAsked: { given: 1, mayAdd: false } }));
    expect(team.move).toMatch(/^Your references are in\. The team moves/);
    expect(statusView("es", served({ sixStages: { ...six("references", refine)!, next: { act: "follow_up", role: null } }, referencesAsked: { given: 1, mayAdd: false } })).move).toMatch(/^Sus referencias ya llegaron\. El equipo las contacta/);
    // CONTROL: before they are in, the card still asks for them.
    expect(statusView("en", served({ sixStages: six("references", refine), referencesAsked: { given: null, mayAdd: true } })).move).toMatch(/^Add your references/);
  });
});
