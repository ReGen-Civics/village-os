/**
 * The words of the applicant follow-ups (15 Nov 2026): the closed letter, the closed status, and the
 * new-invitation door. Short and kind, signed by a role team, no date or count of days in the words,
 * and present in every language the applicant can read.
 */
import { describe, expect, it } from "vitest";
import { APPLICANT_LANGUAGES, LANGUAGES, statusView } from "./applicantWords";
import { closedLetter, DECIDE_WORDS } from "./openProposalDecide";

const base = { firstName: "Ana", village: "Test Village", roleNames: ["Gate Keeper"], site: "https://x.test", team: "Welcome Host", statusLink: "https://x.test/application-status/op_1?token=t" };

describe("the closed letter", () => {
  for (const lang of APPLICANT_LANGUAGES) {
    it(`${lang}: greets, thanks, says it is closed, points to quests and the page, and is signed by the team`, () => {
      const l = closedLetter({ ...base, lang });
      const w = LANGUAGES[lang];
      expect(l.subject).toBe(w.closed.subject("Test Village"));
      expect(l.text.startsWith(w.hello("Ana"))).toBe(true);
      expect(l.text).toContain(w.closed.closed);
      expect(l.text).toContain("https://x.test/quests");
      expect(l.text).toContain(base.statusLink);
      expect(l.text).toContain(w.closed.signed("Welcome Host"));
      expect(l.text).not.toMatch(/undefined|\[object|\$\{/);
    });
  }

  it("names no date and no count of days, and no person", () => {
    for (const lang of APPLICANT_LANGUAGES) {
      const l = closedLetter({ ...base, statusLink: null, lang });
      expect(l.text).not.toMatch(/\d/);
      expect(l.text).not.toContain("Ana Lopez");
    }
  });

  it("is signed by a team, never by a person, and carries no em-dash or en-dash", () => {
    expect(LANGUAGES.en.closed.signed("Welcome Host")).toBe("With care,\nThe Welcome Host team");
    for (const lang of APPLICANT_LANGUAGES) {
      const w = LANGUAGES[lang];
      const all = [w.closed.closed, w.closed.quest("u"), w.status.closed.line, w.status.newInvitation.line, w.status.newInvitation.asked, w.status.move.closed].join(" ");
      expect(all).not.toMatch(/[–—]/);
      expect(all.toLowerCase()).not.toMatch(/\bseat(ed)?\b/);
    }
  });
});

describe("the closed status", () => {
  const served = { step: "decided", actsNext: "", path: [{ label: "Received", state: "done" as const }, { label: "Decision", state: "done" as const }], booking: null, mode: "block" as const, outcome: "withdrawn" as const };

  it("a quiet close reads as closed, never as the applicant's own withdrawal", () => {
    for (const lang of APPLICANT_LANGUAGES) {
      const v = statusView(lang, { ...served, closed: true });
      expect(v.closed).toBe(true);
      expect(v.move).toBe(LANGUAGES[lang].status.move.closed);
      expect(v.stepWords).toBe(LANGUAGES[lang].status.closed.step);
    }
  });

  it("a withdrawal the applicant made keeps its own words", () => {
    const v = statusView("en", { ...served, closed: false });
    expect(v.closed).toBe(false);
    expect(v.move).toBe(LANGUAGES.en.status.move.withdrawn);
  });

  it("the closed flag on anything but a withdrawal changes nothing", () => {
    const v = statusView("en", { ...served, outcome: "declined", closed: true });
    expect(v.closed).toBe(false);
  });
});

describe("the new-invitation words", () => {
  it("say join the team, ask the team, and promise no reissue by themselves", () => {
    const w = LANGUAGES.en.status.newInvitation;
    expect(w.line).toContain("join the team");
    expect(w.asked).toMatch(/let the team know/);
    expect(DECIDE_WORDS.newInvitationAskedNotice("Gate Keeper")).toContain("Gate Keeper");
  });
});
