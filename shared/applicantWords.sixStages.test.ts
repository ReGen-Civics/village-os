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
    const v = statusView("en", served({ sixStages: six("review"), bookNow }));
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
});
