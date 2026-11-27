/**
 * THE NEXT-STEP LETTERS' WORDS (the lead, 27 Nov 2026), the role-only booking, the short role labels, the start day and
 * the letters already on main in the same shape. Pure.
 */
import { describe, expect, it } from "vitest";
import { stageLetter, stageLetterKey, type StageLetterInput } from "./applicantStageLetters";
import { parseRoleShortLabels, roleShortLabel } from "./roleShortLabel";
import { bookingLinksText, roleBookingFor } from "./interviewBooking";
import { adoptedAccountLetter, adoptedInviteLetter, closedLetter, invitedLetter } from "./openProposalDecide";
import { sayOnProfile } from "./applicantWords";
import { startDayOf, weekdayIndex, weekdayName, zoneLabel } from "./startDay";

const base: StageLetterInput = {
  kind: "references",
  firstName: "Rowan",
  roleNames: ["Lead Steward"],
  booking: null,
  followupRole: "Ops",
  finalCallRole: "Visionary",
  anchorCircle: "Anchor Circle",
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

  it("References and proposal: a bulleted list of steps, the page's link, who acts by role", () => {
    const refs = stageLetter({ ...base, booking: { role: "Community", links: ["https://cal.example.test/c"] } });
    expect(refs.subject).toBe("Next up: your references and your proposal");
    expect(refs.text).toContain("Next step:\nEverything for this step is on your page, one button each: https://village.example.test/application-status/op-1?token=t");
    expect(refs.text).toContain("- Add your references. For each one we need their email, plus a WhatsApp number, a US phone number or a Signal number. Please let them know we'll be in touch.");
    expect(refs.text).toContain("- Keep refining your proposal. You can update it until it goes to Anchor Circle for review.");
    expect(refs.text).toContain("- Book your conversation with Community: https://cal.example.test/c");
    expect(refs.text).toContain("Who acts next:\nYou, then Ops, who reaches out to your references.");
  });

  it("references already in are never asked again: we say we're about to reach out, and offer an edit while we can", () => {
    const inNow = stageLetter({ ...base, referencesIn: true, referencesEditable: true });
    expect(inNow.text).not.toContain("Add your references");
    expect(inNow.text).toContain("- Your references are in. Ops is about to reach out to them.");
    expect(inNow.text).toContain("- Want to change one? You can edit them on your page until we reach out.");
    // CONTROL: once somebody has reached out, no edit is offered.
    expect(stageLetter({ ...base, referencesIn: true, referencesEditable: false }).text).not.toContain("edit them");
  });

  it("the final conversation: connecting with the source, no presenting, refining continues until the circle", () => {
    const fin = stageLetter({ ...base, kind: "final_interview", booking: { role: "Visionary", links: ["https://cal.example.test/v"] } });
    expect(fin.subject).toBe("Next up: your final conversation with Visionary");
    expect(fin.text).toContain("It's a chance to connect with the source of this village.");
    expect(fin.text).toContain("You won't be presenting it.");
    expect(fin.text).toContain("until it goes to Anchor Circle for review");
    expect(fin.text).not.toMatch(/fixed/i);
    expect(fin.text).toContain("Next step:\nBook your final conversation with Visionary: https://cal.example.test/v");
  });

  it("Agreement: the anchor circle by its own name accepts or counters, and nothing to book", () => {
    const agr = stageLetter({ ...base, kind: "agreement" });
    expect(agr.subject).toBe("Your proposal is with Anchor Circle");
    expect(agr.text).toContain("Who acts next:\nAnchor Circle.");
    expect(agr.text).toContain("Then you get an email with your start date.");
    expect(stageLetter({ ...base, kind: "agreement", anchorCircle: null }).text).toContain("Who acts next:\nThe circle.");
  });

  it("carries only the booking it is handed: no booking, no link", () => {
    const none = stageLetter({ ...base, booking: null });
    expect(none.text).not.toMatch(/cal\.example\.test/);
    expect(none.text).toContain("- Your next conversation opens on your page when it's ready.");
  });

  it("speaks the applicant's language", () => {
    const es = stageLetter({ ...base, lang: "es", kind: "final_interview", booking: { role: "Visionary", links: ["https://cal.example.test/v"] } });
    expect(es.subject).toBe("Lo que sigue: su conversación final con Visionary");
    expect(es.text.startsWith("Hola Rowan,")).toBe(true);
    expect(es.text).toContain("No tiene que presentarla.");
  });

  it("the refined letter goes with no booking link, only the page", () => {
    const r = stageLetter({ ...base, kind: "refined", booking: { role: "Community", links: ["https://cal.example.test/c"] } });
    expect(r.subject).toBe("Got it: your updated proposal");
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

describe("the letters already on main, in the same shape (the lead, 27 Nov 2026)", () => {
  it("the invitation: all three calls as a list, the total, only the first one's link, who acts by role", () => {
    const l = invitedLetter({ firstName: "Rowan", village: "V", roleNames: ["Lead Role"], statusLink: null, lang: "en", conversations: [
      { role: "Operations Role", label: "Ops", minutes: 30, bookingLinks: [{ who: null, url: "https://cal.example.test/ops" }] },
      { role: "Community Role", label: "Community", minutes: 30, bookingLinks: [{ who: null, url: "https://cal.example.test/community" }] },
      { role: "Visionary Role", label: "Visionary", minutes: 30, final: true },
    ] });
    expect(l.text).toContain("Your conversations, in order:\n- A conversation with Ops\n- A conversation with Community\n- A final conversation with Visionary\nAbout 90 minutes in all, or longer if needed.");
    expect(l.text).not.toMatch(/30 minutes/);
    expect(l.text).toContain("Next step:\nBook your first conversation, with Ops: https://cal.example.test/ops");
    expect(l.text).toContain("Who acts next:\nYou book the time. Then Ops meets with you.");
    expect(l.text).not.toContain("cal.example.test/community");
    expect(l.text).not.toContain("decides by consent");
  });

  it("the adoption letters: the start day, the all-hands with its link, who may start them sooner, who acts next", () => {
    const base2 = { firstName: "Rowan", village: "V", roleNames: ["Lead Role"], season: "Season of Roots", startsOn: "1 January 2027", lang: "en" as const, startDay: "Monday 4 January 2027", soonerRole: "Ops", allHands: { when: "Monday at 12:00 Costa Rica time", link: "https://meet.example.test/all-hands" } };
    for (const l of [adoptedInviteLetter({ ...base2, link: "https://v.example.test/join", days: 14 } as any), adoptedAccountLetter({ ...base2, signIn: "https://v.example.test/profile" } as any)]) {
      expect(l.text).toContain("You start on Monday 4 January 2027.");
      expect(l.text).toContain("If Ops asks you to start sooner, they'll write to you.");
      expect(l.text).toContain("That day, join us for our all-hands meeting, Monday at 12:00 Costa Rica time.\nThe video call: https://meet.example.test/all-hands");
      expect(l.text).toContain("Who acts next:\nYou. Make your profile, and it shows what to align with before you start.");
    }
    // A role still waiting on a seat promises no day.
    expect(adoptedAccountLetter({ ...base2, waitsForSeat: true, signIn: "https://v.example.test/profile" } as any).text).not.toContain("You start on");
  });

  it("the closed letter: a list of ways to stay close, and who acts next", () => {
    const c = closedLetter({ firstName: "Rowan", village: "V", roleNames: ["Lead Role"], site: "https://v.example.test", team: "Ops", statusLink: null, lang: "en" });
    expect(c.text).toContain("Next step:\nNothing more to do. If you'd like to stay close:\n- Take a quest: https://v.example.test/quests\n- Apply again whenever a role calls to you.");
    expect(c.text).toContain("Who acts next:\nYou, if you choose to apply again.");
    expect(closedLetter({ firstName: null, village: "V", roleNames: [], site: "https://v.example.test", team: "Ops", statusLink: null, lang: "es" }).text).toContain("Quién actúa ahora:");
  });

  it("the profile says the page's 'below' as the application's page", () => {
    expect(sayOnProfile("en", "Book your conversation with Ops below.")).toBe("Book your conversation with Ops on your application's page.");
    expect(sayOnProfile("es", "Reserve abajo su conversación.")).toBe("Reserve en la página de su postulación su conversación.");
  });
});

describe("the start day (the lead, 27 Nov 2026: accepted Friday, start Monday, after the season begins)", () => {
  it("is the first all-hands weekday after the acceptance, and never before the role starts", () => {
    // Accepted Friday 27 Nov 2026, season already begun: Monday 30 Nov.
    expect(startDayOf("2026-11-01", "2026-11-27", 1)).toBe("2026-11-30");
    // Accepted on a Monday: the next Monday, never the same day.
    expect(startDayOf(null, "2026-11-30", 1)).toBe("2026-12-07");
    // The season starts later: the first Monday on or after its first day.
    expect(startDayOf("2027-01-01", "2026-11-27", 1)).toBe("2027-01-04");
    expect(startDayOf("2027-01-04", "2026-11-27", 1)).toBe("2027-01-04");
  });
  it("reads the village's weekday and zone, in the applicant's language", () => {
    expect(weekdayIndex("Monday")).toBe(1);
    expect(weekdayIndex("jueves")).toBe(4);
    expect(weekdayIndex("nonsense")).toBe(1);
    expect(weekdayName(1, "es")).toBe("lunes");
    expect(zoneLabel("America/Costa_Rica", "en")).toBe("Costa Rica time");
    expect(zoneLabel("America/Costa_Rica", "es")).toBe("hora de Costa Rica");
  });
});
