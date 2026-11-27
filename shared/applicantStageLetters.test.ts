/**
 * THE NEXT-STEP LETTERS' WORDS (the lead, 27 Nov 2026), the role-only booking, and the short role labels. Pure.
 */
import { describe, expect, it } from "vitest";
import { stageLetter, stageLetterKey, type StageLetterInput } from "./applicantStageLetters";
import { parseRoleShortLabels, roleShortLabel } from "./roleShortLabel";
import { bookingLinksText, roleBookingFor } from "./interviewBooking";

const base: StageLetterInput = {
  kind: "references",
  firstName: "Rowan",
  roleNames: ["Lead Steward"],
  booking: null,
  followupRole: "Ops",
  finalCallRole: "Visionary",
  referencesOpen: true,
  refineOpen: true,
  statusLink: "https://village.example.test/application-status/op-1?token=t",
  lang: "en",
};

describe("the next-step letters", () => {
  it("one key per application and stage", () => {
    expect(stageLetterKey("op-1", "references")).toBe("open-proposal:op-1:stage:references");
    expect(stageLetterKey("op-1", "final_interview")).not.toBe(stageLetterKey("op-1", "references"));
  });

  it("each names the next step and who acts, by role", () => {
    const refs = stageLetter({ ...base, booking: { role: "Community", links: ["https://cal.example.test/c"] } });
    expect(refs.subject).toBe("Your next step: your references and your proposal");
    expect(refs.text).toContain("Next step:");
    expect(refs.text).toContain("Book your conversation with Community: https://cal.example.test/c");
    expect(refs.text).toContain("Who acts next:\nYou, then Ops, who follows up with your references.");
    const fin = stageLetter({ ...base, kind: "final_interview", booking: { role: "Visionary", links: ["https://cal.example.test/v"] } });
    expect(fin.subject).toBe("Your next step: your final conversation with Visionary");
    expect(fin.text).toContain("It is now fixed");
    const agr = stageLetter({ ...base, kind: "agreement" });
    expect(agr.text).toContain("Visionary, who makes the final call.");
    // No role named for the final call: the people who place roles.
    expect(stageLetter({ ...base, kind: "agreement", finalCallRole: null }).text).toContain("The people who place roles in the village.");
  });

  it("carries only the booking it is handed: no booking, no link", () => {
    const none = stageLetter({ ...base, booking: null });
    expect(none.text).not.toMatch(/cal\.example\.test/);
    expect(none.text).toContain("Your next conversation opens on your status page when it is ready.");
  });

  it("speaks the applicant's language", () => {
    const es = stageLetter({ ...base, lang: "es", kind: "final_interview", booking: { role: "Visionary", links: ["https://cal.example.test/v"] } });
    expect(es.subject).toBe("Su siguiente paso: su conversación final con Visionary");
    expect(es.text.startsWith("Hola Rowan,")).toBe(true);
  });

  it("the refined letter goes with no link but the status page", () => {
    const r = stageLetter({ ...base, kind: "refined", booking: { role: "Community", links: ["https://cal.example.test/c"] } });
    expect(r.subject).toBe("We have your refined proposal");
    expect(r.text).not.toContain("cal.example.test");
  });
});

describe("the booking button, by role only", () => {
  it("short labels from the village's list, the full name otherwise", () => {
    const raw = "ops-role = Ops\ncommunity-role=Community; final-role = Visionary\n= nothing\nno-equals";
    expect(Array.from(parseRoleShortLabels(raw).entries())).toEqual([["ops-role", "Ops"], ["community-role", "Community"], ["final-role", "Visionary"]]);
    expect(roleShortLabel("ops-role", "Operations Role", raw)).toBe("Ops");
    expect(roleShortLabel("other", "Operations Role", raw)).toBe("Operations Role");
  });

  it("the role's own link first, and no person named", () => {
    const holders = [{ firstName: "Ana", bookingUrl: "https://cal.example.test/ana" }];
    expect(roleBookingFor("Ops", holders, "https://cal.example.test/ops")).toEqual({ label: "Ops", links: [{ who: null, url: "https://cal.example.test/ops" }] });
    // CONTROL: no role link, the holders' links, still unnamed.
    expect(roleBookingFor("Ops", [...holders, { firstName: "Ben", bookingUrl: "https://cal.example.test/ben" }], null).links.map((l) => l.who)).toEqual([null, null]);
    expect(bookingLinksText([{ who: null, url: "https://a.test" }, { who: null, url: "https://b.test" }])).toBe("\n1: https://a.test\n2: https://b.test");
  });
});
