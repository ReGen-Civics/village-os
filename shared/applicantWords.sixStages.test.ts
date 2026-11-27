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
    expect(v.move).toBe("You're on our shortlist. Book your conversation with Operations Role (Rye) below.");
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

  it("passes the refine form at References and proposal AND at the Final conversation, and its fixed line at Agreement", () => {
    const open = statusView("en", served({ sixStages: six("references", { open: true, frozen: false, why: "Because.", aim: "Books.", versions: 1 }) }));
    expect(open.refine).toEqual({ open: true, frozen: false, why: "Because.", aim: "Books.", versions: 1 });
    // The lead, 27 Nov 2026: they can keep refining through the final conversation.
    const atFinal = statusView("en", served({ sixStages: six("final_interview", { open: true, frozen: false, why: "Because.", aim: "Books.", versions: 1 }) }));
    expect(atFinal.refine?.open).toBe(true);
    expect(atFinal.tasks?.map((t) => t.key)).toEqual(["conversation", "proposal"]);
    const fixed = statusView("en", served({ sixStages: six("agreement", { open: false, frozen: true, why: "", aim: "", versions: 1 }) }));
    expect(fixed.refine?.frozen).toBe(true);
    expect(statusView("en", served({ sixStages: six("review") })).refine).toBeNull();
  });

  it("REFINE AT EVERY STAGE (the lead, 27 Nov 2026): Received and Our review offer the refine button too, the open conversation's first", () => {
    const refine = { open: true, frozen: false, why: "a", aim: "b", versions: 0 };
    const received = statusView("en", served({ sixStages: six("received", refine) }));
    expect(received.tasks?.map((t) => [t.key, t.action])).toEqual([["proposal", "Refine your proposal"]]);
    expect(received.refine).not.toBeNull();
    const bookNow = { role: "Operations Role", label: "Ops", url: "https://cal.example.test/ops", links: [{ who: null, url: "https://cal.example.test/ops" }] };
    const review = statusView("en", served({ sixStages: six("review", refine), bookNow }));
    expect(review.tasks?.map((t) => [t.key, t.action])).toEqual([["conversation", "Book with Ops"], ["proposal", "Refine your proposal"]]);
    // Not yet invited: the refine button alone, no conversation row.
    expect(statusView("en", served({ sixStages: six("review", refine) })).tasks?.map((t) => t.key)).toEqual(["proposal"]);
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
    expect(JSON.stringify(early.tasks)).not.toContain("cal.example.test/final");
    const atFinal = statusView("en", served({ sixStages: six("final_interview", { open: true, frozen: false, why: "", aim: "", versions: 1 }), bookNow: finalBook }));
    expect(atFinal.move).toMatch(/final conversation with Final Call Role \(Flor\)/);
    expect(atFinal.bookGold).toBe(true);
    // CONTROL: the community conversation's button is not the final's, and shows at References and proposal.
    const community = { ...finalBook, role: "Community Role", label: "Community Role", final: false };
    expect(statusView("en", served({ sixStages: six("references"), bookNow: community })).booking).not.toBeNull();
  });

  it("QA round 1: we say we will reply only while the move is ours, and 'answer each line' only when a counter-offer exists", () => {
    const refs = statusView("en", served({ sixStages: six("references", { open: true, frozen: false, why: "a", aim: "b", versions: 0 }), referencesAsked: { given: null, mayAdd: true } }));
    expect(refs.applicantActs).toBe(true);
    // One button per action, each saying done or to do (the lead, 27 Nov 2026).
    expect(refs.tasks?.map((t) => [t.key, t.state, t.action, t.done])).toEqual([
      ["references", "To do", "Add your references", false],
      ["proposal", "You can update it", "Refine your proposal", false],
      ["conversation", "Opens when it's ready", null, false],
    ]);
    expect(refs.bookGold).toBe(false);
    const waiting = statusView("en", served({ sixStages: six("agreement") }));
    expect(waiting.applicantActs).toBe(false);
    expect(waiting.move).not.toMatch(/Answer each line/);
    const countered = statusView("en", served({ sixStages: { ...six("agreement", { open: false, frozen: true, why: "", aim: "", versions: 1 })!, anchorCircle: "Anchor Circle" }, offer: { mayAnswer: true, rows: [{}] } }));
    expect(countered.move).toBe("The Anchor Circle sent a counter-offer. Answer each change below, and we'll go back and forth until we agree.");
    expect(countered.applicantActs).toBe(true);
    // With a counter-offer to answer, the fixed line steps aside.
    expect(countered.refine).toBeNull();
    // Waiting, the circle is named from the village's own circles; none named reads "the circle".
    expect(statusView("en", served({ sixStages: { ...six("agreement")!, anchorCircle: "Anchor Circle" } })).move).toBe("Your proposal is with the Anchor Circle for review. They'll accept it or send a counter-offer, right here.");
    expect(statusView("en", served({ sixStages: six("agreement") })).move).toMatch(/^Your proposal is with the circle for review/);
  });

  it("QA round 2: 'You are shortlisted' only when it was; invited without a shortlist reads otherwise", () => {
    const bookNow = { role: "Operations Role", label: "Operations Role", url: "https://cal.example.test/ops", links: [{ who: null, url: "https://cal.example.test/ops" }] };
    const invited = statusView("en", served({ sixStages: { ...six("review")!, shortlisted: false }, bookNow }));
    expect(invited.move).toBe("Book your first conversation with Operations Role below. It's part of our review.");
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
    expect(follow.move).toBe("Your references are in. Operations Role is about to reach out to them.");
    expect(follow.move).not.toMatch(/Add your references/);
    // Never asked again; the edit button shows only while nobody has reached out.
    expect(follow.tasks?.[0]).toMatchObject({ key: "references", state: "Done", done: true, action: null });
    const editable = statusView("en", served({ sixStages: { ...six("references", refine)!, next: { act: "follow_up", role: "Operations Role" } }, referencesAsked: { given: 2, mayAdd: false, mayEdit: true } }));
    expect(editable.tasks?.[0]).toMatchObject({ action: "Edit your references", href: "#reference-form" });
    const move = statusView("en", served({ sixStages: { ...six("references", { ...refine, open: false })!, next: { act: "move", role: "Final Call Role" } }, referencesAsked: { given: 2, mayAdd: false } }));
    expect(move.move).toBe("Your references are in. Final Call Role moves you to your final conversation next.");
    // No role named: the team.
    const team = statusView("en", served({ sixStages: { ...six("references", refine)!, next: { act: "move", role: null } }, referencesAsked: { given: 1, mayAdd: false } }));
    expect(team.move).toMatch(/^Your references are in\. The team moves/);
    expect(statusView("es", served({ sixStages: { ...six("references", refine)!, next: { act: "follow_up", role: null } }, referencesAsked: { given: 1, mayAdd: false } })).move).toMatch(/^Sus referencias ya llegaron\. El equipo está por contactarlas/);
    // CONTROL: before they are in, the card points to the buttons, the first of which asks for them.
    const before = statusView("en", served({ sixStages: six("references", refine), referencesAsked: { given: null, mayAdd: true } }));
    expect(before.move).toBe("Here's what to do at this step. Each one has its own button below.");
    expect(before.tasks?.[0].action).toBe("Add your references");
  });
});
